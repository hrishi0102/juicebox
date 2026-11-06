// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {TeamScoreboard} from "../src/TeamScoreboard.sol";

/// Deploy TeamScoreboard pointing at a CRE forwarder.
///   Arc testnet simulation forwarder (MockKeystoneForwarder): 0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1
///   Arc testnet production KeystoneForwarder:                 0x76c9cf548b4179F8901cda1f8623568b58215E62
///   Sepolia simulation forwarder:                             0x15fC6ae953E024d975e77382eEeC56A9101f9F88
///
/// FORWARDER=0x15fC6ae953E024d975e77382eEeC56A9101f9F88 forge script script/Deploy.s.sol --rpc-url https://ethereum-sepolia-rpc.publicnode.com --private-key $PK --broadcast
contract Deploy is Script {
    function run() external {
        address forwarder = vm.envOr("FORWARDER", address(0x15fC6ae953E024d975e77382eEeC56A9101f9F88));
        vm.startBroadcast();
        TeamScoreboard board = new TeamScoreboard(forwarder);
        vm.stopBroadcast();
        console.log("TeamScoreboard", address(board));
        console.log("forwarder", forwarder);
    }
}
