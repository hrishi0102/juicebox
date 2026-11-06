// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {TeamScoreboard, IReceiver, IERC165} from "../src/TeamScoreboard.sol";

contract TeamScoreboardTest is Test {
    TeamScoreboard board;
    address forwarder = address(0xF0);
    bytes32 team = keccak256("acme-payments");

    function setUp() public {
        board = new TeamScoreboard(forwarder);
    }

    function report(uint32 day, uint64 spend) internal view returns (bytes memory) {
        // teamId, periodDay, receipts, people, rejected, spendCents, done, wastedCents, mergedPrs, prsChecked, prsStillMerged
        return abi.encode(team, day, uint32(25), uint32(5), uint32(1), spend, uint32(116), uint64(22208), uint32(89), uint16(10), uint16(9));
    }

    function test_forwarderCanPost() public {
        vm.prank(forwarder);
        board.onReport("", report(20398, 39500));
        (uint32 day, TeamScoreboard.Score memory s) = board.latest(team);
        assertEq(day, 20398);
        assertEq(s.receipts, 25);
        assertEq(s.people, 5);
        assertEq(s.rejected, 1);
        assertEq(s.spendCents, 39500);
        assertEq(s.done, 116);
        assertEq(s.wastedCents, 22208);
        assertEq(s.mergedPrs, 89);
        assertEq(s.prsStillMerged, 9);
    }

    function test_onlyForwarder() public {
        vm.expectRevert(abi.encodeWithSelector(TeamScoreboard.NotForwarder.selector, address(this)));
        board.onReport("", report(20398, 1));
    }

    function test_noRewritingHistory() public {
        vm.startPrank(forwarder);
        board.onReport("", report(20400, 1));
        vm.expectRevert(abi.encodeWithSelector(TeamScoreboard.StaleReport.selector, uint32(20399), uint32(20400)));
        board.onReport("", report(20399, 1));
        vm.stopPrank();
    }

    function test_supportsReceiverInterface() public view {
        assertTrue(board.supportsInterface(type(IReceiver).interfaceId));
        assertTrue(board.supportsInterface(type(IERC165).interfaceId));
        assertFalse(board.supportsInterface(0xdeadbeef));
    }

    function test_ownerCanSwitchForwarder() public {
        board.setForwarder(address(0xF1));
        assertEq(board.forwarder(), address(0xF1));
        vm.prank(address(0xBAD));
        vm.expectRevert(TeamScoreboard.NotOwner.selector);
        board.setForwarder(address(0xF2));
    }
}
