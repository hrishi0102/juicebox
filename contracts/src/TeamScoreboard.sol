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
/// @notice Monthly team checks of Receipts, written by the Chainlink CRE workflow. Every DON node
///         reads the team's receipts from Arkiv, checks each EIP-712 signature, adds up the signed
///         numbers and re-checks the merged PRs on GitHub; consensus takes the median and reports it
///         here. Only the CRE forwarder can post, so no person (not the manager, not the engineers,
///         not us) can write or change a team's score.
contract TeamScoreboard is IReceiver, IERC165 {
    /// @dev The report, in the order the workflow encodes it (cre/receipts-monthly/score.ts, REPORT_ABI).
    struct Report {
        bytes32 teamId; // keccak256 of the Arkiv team id, e.g. keccak256("acme-payments")
        uint32 periodDay; // days since 1970 when the check ran
        uint32 receipts; // signed weeks counted (one per person per week)
        uint32 people; // different people among them
        uint32 rejected; // receipts dropped because their signature did not check out
        uint64 spendCents; // AI spend in those weeks, US cents
        uint32 done; // things done
        uint64 wastedCents; // spend on Wasted items, US cents
        uint32 mergedPrs; // merged PRs, as signed by each person
        uint16 prsChecked; // PRs the DON asked GitHub about
        uint16 prsStillMerged; // of those, still merged
    }

    struct Score {
        uint64 postedAt;
        uint32 receipts;
        uint32 people;
        uint32 rejected;
        uint64 spendCents;
        uint32 done;
        uint64 wastedCents;
        uint32 mergedPrs;
        uint16 prsChecked;
        uint16 prsStillMerged;
    }

    address public owner;
    address public forwarder;

    mapping(bytes32 teamId => mapping(uint32 periodDay => Score)) public scores;
    mapping(bytes32 teamId => uint32) public latestPeriodDay;

    event TeamScorePosted(
        bytes32 indexed teamId,
        uint32 indexed periodDay,
        uint32 receipts,
        uint32 people,
        uint32 rejected,
        uint64 spendCents,
        uint32 done,
        uint64 wastedCents,
        uint32 mergedPrs,
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
        Report memory r = abi.decode(report, (Report));

        uint32 prev = latestPeriodDay[r.teamId];
        if (r.periodDay < prev) revert StaleReport(r.periodDay, prev); // no rewriting history
        latestPeriodDay[r.teamId] = r.periodDay;

        scores[r.teamId][r.periodDay] = Score({
            postedAt: uint64(block.timestamp),
            receipts: r.receipts,
            people: r.people,
            rejected: r.rejected,
            spendCents: r.spendCents,
            done: r.done,
            wastedCents: r.wastedCents,
            mergedPrs: r.mergedPrs,
            prsChecked: r.prsChecked,
            prsStillMerged: r.prsStillMerged
        });
        emit TeamScorePosted(
            r.teamId, r.periodDay, r.receipts, r.people, r.rejected, r.spendCents, r.done, r.wastedCents, r.mergedPrs, r.prsChecked, r.prsStillMerged
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
