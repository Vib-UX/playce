// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PlaycePass} from "../src/PlaycePass.sol";

/**
 * Deploys PlaycePass with the broadcasting wallet as both admin and minter.
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeployPlaycePass \
 *     --rpc-url sepolia --broadcast --private-key $PRIVATE_KEY
 */
contract DeployPlaycePass is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        PlaycePass pass = new PlaycePass(deployer, deployer);
        vm.stopBroadcast();

        console.log("PlaycePass deployed at:", address(pass));
        console.log("Admin + Minter:", deployer);
    }
}
