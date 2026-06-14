// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StakeEscrow} from "../src/StakeEscrow.sol";

/**
 * Fork dry-run of the LIVE StakeEscrow on Base mainnet — no broadcast.
 *
 * Runs the real deployed bytecode at current chain state to prove a chess pot
 * settles and the winner actually receives the USDC. This is the on-chain half
 * the Chainlink CRE report triggers (ChessArbiter.onReport -> escrow.settle).
 *
 * Run:
 *   cd contracts
 *   forge test --match-path test/StakeEscrowSettleFork.t.sol -vv
 */
contract StakeEscrowSettleForkTest is Test {
    // Live deployment (see contracts/deployments/production.json).
    StakeEscrow constant ESCROW =
        StakeEscrow(0x01D514432b6694D8260bbA0fc2af3Cf327020823);
    // Holds OPERATOR_ROLE (the backend minter == deployer).
    address constant OPERATOR = 0x88cb5e1fAee0798E2780618CF4fD12933E385426;
    // Fixed per-player stake: 0.25 USDC (6 decimals), matches STAKE_AMOUNT.
    uint256 constant STAKE = 250_000;

    IERC20 usdc;

    function setUp() public {
        // Fork Base mainnet at latest block (rpc alias from foundry.toml).
        vm.createSelectFork("base");
        usdc = IERC20(address(ESCROW.usdc()));
    }

    function test_settle_pays_winner() public {
        bytes32 roomId = keccak256(bytes("SIM-CHESS-DEMO"));
        address host = makeAddr("host"); // white / winner
        address guest = makeAddr("guest"); // black

        // Make sure the escrow holds enough USDC to cover the pot (fork-only;
        // mirrors two real Blink deposits landing in the contract).
        deal(address(usdc), address(ESCROW), STAKE * 2);

        // Backend credits both seats after verifying the deposits.
        vm.startPrank(OPERATOR);
        ESCROW.creditStake(roomId, 0, host, STAKE);
        ESCROW.creditStake(roomId, 1, guest, STAKE);
        vm.stopPrank();

        assertTrue(ESCROW.bothStaked(roomId), "both seats credited");
        assertEq(ESCROW.potAmount(roomId), STAKE * 2, "pot == 2 stakes");

        // Settle to the CRE-verified winner (host/white here).
        uint256 beforeBal = usdc.balanceOf(host);
        vm.prank(OPERATOR);
        ESCROW.settle(roomId, host);
        uint256 received = usdc.balanceOf(host) - beforeBal;

        assertEq(received, STAKE * 2, "winner received the full pot");

        console.log("Escrow:        ", address(ESCROW));
        console.log("USDC:          ", address(usdc));
        console.log("Winner:        ", host);
        console.log("Pot (USDC 6dp):", received);
    }

    /// Settling to a non-player must revert (no funds leak to outsiders).
    function test_settle_rejects_non_player() public {
        bytes32 roomId = keccak256(bytes("SIM-CHESS-REJECT"));
        address host = makeAddr("host2");
        address guest = makeAddr("guest2");
        address outsider = makeAddr("outsider");

        deal(address(usdc), address(ESCROW), STAKE * 2);
        vm.startPrank(OPERATOR);
        ESCROW.creditStake(roomId, 0, host, STAKE);
        ESCROW.creditStake(roomId, 1, guest, STAKE);
        vm.expectRevert();
        ESCROW.settle(roomId, outsider);
        vm.stopPrank();
    }
}
