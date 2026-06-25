// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PlaycesPass} from "../src/PlaycesPass.sol";

/**
 * Deploys PlaycesPass with the broadcasting wallet as both admin and minter.
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeployPlaycesPass \
 *     --rpc-url sepolia --broadcast --private-key $PRIVATE_KEY
 */
contract DeployPlaycesPass is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        PlaycesPass pass = new PlaycesPass(deployer, deployer);
        vm.stopBroadcast();

        console.log("PlaycesPass deployed at:", address(pass));
        console.log("Admin + Minter:", deployer);
    }
}
