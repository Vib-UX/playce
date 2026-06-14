// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ChessArbiter} from "../src/ChessArbiter.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * Deploys ChessArbiter and wires it to settle the existing StakeEscrow.
 *
 * The deployer must be an admin of the StakeEscrow so this script can grant the
 * arbiter OPERATOR_ROLE (needed to call `settle`).
 *
 * Usage:
 *   STAKE_ESCROW_ADDRESS=0x... \
 *   KEYSTONE_FORWARDER=0x... \   # optional; set after you know the CRE forwarder
 *   PRIVATE_KEY=$MINTER_PRIVATE_KEY \
 *   forge script script/DeployChessArbiter.s.sol:DeployChessArbiter \
 *     --rpc-url base --broadcast
 */
contract DeployChessArbiter is Script {
    bytes32 constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address escrow = vm.envAddress("STAKE_ESCROW_ADDRESS");
        // Forwarder may be unknown at deploy time — default to zero and set it
        // later via `setForwarder` once the CRE workflow target is known.
        address forwarder = vm.envOr("KEYSTONE_FORWARDER", address(0));

        vm.startBroadcast(pk);
        ChessArbiter arbiter = new ChessArbiter(deployer, deployer, escrow, forwarder);
        // Let the arbiter release pots from the escrow.
        IAccessControl(escrow).grantRole(OPERATOR_ROLE, address(arbiter));
        vm.stopBroadcast();

        console.log("ChessArbiter deployed at:", address(arbiter));
        console.log("StakeEscrow:", escrow);
        console.log("Forwarder:", forwarder);
        console.log("Admin + Operator:", deployer);
    }
}
