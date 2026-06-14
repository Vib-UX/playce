// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ProofSender} from "../src/ProofSender.sol";

/**
 * Deploys ProofSender on the SOURCE chain (where chain battles settle).
 *
 * Env:
 *   PRIVATE_KEY          deployer (becomes admin + SENDER_ROLE)
 *   CCIP_ROUTER_ADDRESS  CCIP router on this source chain
 *   LINK_TOKEN_ADDRESS   LINK token on this source chain (pays CCIP fees)
 *
 * Usage:
 *   CCIP_ROUTER_ADDRESS=0x... LINK_TOKEN_ADDRESS=0x... \
 *     forge script script/DeployCcipSender.s.sol:DeployCcipSender \
 *     --rpc-url base_sepolia --broadcast --private-key $PRIVATE_KEY
 */
contract DeployCcipSender is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(pk);
        address router = vm.envAddress("CCIP_ROUTER_ADDRESS");
        address link = vm.envAddress("LINK_TOKEN_ADDRESS");

        vm.startBroadcast(pk);
        ProofSender sender = new ProofSender(router, link, admin);
        vm.stopBroadcast();

        console.log("ProofSender deployed at:", address(sender));
        console.log("Router:", router);
        console.log("LINK:", link);
        console.log("Admin/Sender:", admin);
    }
}
