// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {StakeEscrow} from "../src/StakeEscrow.sol";

/**
 * Deploys StakeEscrow on Ethereum Sepolia.
 *
 * Usage:
 *   USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
 *   PRIVATE_KEY=$MINTER_PRIVATE_KEY \
 *   forge script script/DeployStakeEscrow.s.sol:DeployStakeEscrow \
 *     --rpc-url sepolia --broadcast
 */
contract DeployStakeEscrow is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(pk);
        StakeEscrow escrow = new StakeEscrow(deployer, deployer, usdc);
        vm.stopBroadcast();

        console.log("StakeEscrow deployed at:", address(escrow));
        console.log("USDC token:", usdc);
        console.log("Admin + Operator:", deployer);
    }
}
