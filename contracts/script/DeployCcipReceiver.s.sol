// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ProofReceiverPass} from "../src/ProofReceiverPass.sol";

/**
 * Deploys ProofReceiverPass on the DESTINATION chain (where proofs are minted).
 *
 * Env:
 *   PRIVATE_KEY          deployer (becomes admin)
 *   CCIP_ROUTER_ADDRESS  CCIP router on this destination chain
 *
 * Usage:
 *   CCIP_ROUTER_ADDRESS=0x... forge script script/DeployCcipReceiver.s.sol:DeployCcipReceiver \
 *     --rpc-url sepolia --broadcast --private-key $PRIVATE_KEY
 */
contract DeployCcipReceiver is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(pk);
        address router = vm.envAddress("CCIP_ROUTER_ADDRESS");

        vm.startBroadcast(pk);
        ProofReceiverPass receiver = new ProofReceiverPass(router, admin);
        vm.stopBroadcast();

        console.log("ProofReceiverPass deployed at:", address(receiver));
        console.log("Router:", router);
        console.log("Admin:", admin);
    }
}
