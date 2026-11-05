// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Interface every Chainlink CRE consumer implements. The CRE forwarder calls onReport
///         with the DON-signed report (in simulation, the MockKeystoneForwarder does).
interface IReceiver {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @title TeamScoreboard
/// @notice Verified monthly AI-spend scores per team, written by the Receipts CRE workflow.
///         The workflow reads the team's shared receipts from Arkiv, re-checks the evidence PRs on
///         GitHub, reaches consensus across DON nodes, and reports the result here. No person
///         (not the manager, not the engineers, not us) can write a score directly.
contract TeamScoreboard is IReceiver, IERC165 {
    struct Score {
        uint64 postedAt;
        uint32 receipts; // shared receipts counted
        uint64 spendCents; // total spend in those receipts, US cents
        uint32 shippedTasks;
        uint32 keptWorkMilli; // kept work x 1000
        uint16 survivalBps; // share of shipped code still alive (65535 = unknown)
        uint16 wasteBps; // share of spend that was waste
        uint16 prsChecked; // evidence PRs the DON re-checked on GitHub
        uint16 prsStillMerged; // of those, still merged
    }

    address public owner;
    address public forwarder;

    mapping(bytes32 teamId => mapping(uint32 periodDay => Score)) public scores;
    mapping(bytes32 teamId => uint32) public latestPeriodDay;

    event TeamScorePosted(
        bytes32 indexed teamId,
        uint32 indexed periodDay,
        uint32 receipts,
        uint64 spendCents,
        uint32 shippedTasks,
        uint32 keptWorkMilli,
        uint16 survivalBps,
        uint16 wasteBps,
        uint16 prsChecked,
        uint16 prsStillMerged
    );
    event ForwarderChanged(address forwarder);

    error NotForwarder(address sender);
    error NotOwner();
    error StaleReport(uint32 periodDay, uint32 latest);

    constructor(address forwarder_) {
        owner = msg.sender;
        forwarder = forwarder_;
        emit ForwarderChanged(forwarder_);
    }

    /// @notice Switch from the simulation forwarder to the production KeystoneForwarder.
    function setForwarder(address forwarder_) external {
        if (msg.sender != owner) revert NotOwner();
        forwarder = forwarder_;
        emit ForwarderChanged(forwarder_);
    }

    function onReport(bytes calldata, bytes calldata report) external override {
        if (msg.sender != forwarder) revert NotForwarder(msg.sender);
        (
            bytes32 teamId,
            uint32 periodDay,
            uint32 receipts,
            uint64 spendCents,
            uint32 shippedTasks,
            uint32 keptWorkMilli,
            uint16 survivalBps,
            uint16 wasteBps,
            uint16 prsChecked,
            uint16 prsStillMerged
        ) = abi.decode(report, (bytes32, uint32, uint32, uint64, uint32, uint32, uint16, uint16, uint16, uint16));

        uint32 prev = latestPeriodDay[teamId];
        if (periodDay < prev) revert StaleReport(periodDay, prev); // no rewriting history
        latestPeriodDay[teamId] = periodDay;

        scores[teamId][periodDay] = Score({
            postedAt: uint64(block.timestamp),
            receipts: receipts,
            spendCents: spendCents,
            shippedTasks: shippedTasks,
            keptWorkMilli: keptWorkMilli,
            survivalBps: survivalBps,
            wasteBps: wasteBps,
            prsChecked: prsChecked,
            prsStillMerged: prsStillMerged
        });
        emit TeamScorePosted(
            teamId, periodDay, receipts, spendCents, shippedTasks, keptWorkMilli, survivalBps, wasteBps, prsChecked, prsStillMerged
        );
    }

    function latest(bytes32 teamId) external view returns (uint32 periodDay, Score memory score) {
        periodDay = latestPeriodDay[teamId];
        score = scores[teamId][periodDay];
    }

    /// @dev The CRE forwarder only calls receivers that report IReceiver through ERC165.
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
