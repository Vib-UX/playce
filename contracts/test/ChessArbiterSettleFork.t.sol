// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StakeEscrow} from "../src/StakeEscrow.sol";
import {ChessArbiter} from "../src/ChessArbiter.sol";

/**
 * End-to-end fork dry-run of the FULL Chainlink CRE settlement path — no
 * broadcast. Forks Base mainnet, deploys ChessArbiter against the LIVE
 * StakeEscrow, and drives settlement exactly the way the CRE workflow does:
 *
 *   CRE workflow encodes (matchId, winner)  ──signed report──▶
 *   Keystone forwarder ─▶ ChessArbiter.onReport ─▶ StakeEscrow.settle(winner)
 *
 * The report bytes here are byte-identical to what `main.ts` builds via
 * `encodeAbiParameters([{type:'bytes32'},{type:'address'}], [matchId, winner])`,
 * and `onReport` is gated on `msg.sender == forwarder` — so impersonating the
 * forwarder reproduces the on-chain delivery the DON performs.
 *
 * Run:
 *   cd contracts
 *   forge test --match-path test/ChessArbiterSettleFork.t.sol -vv
 */
contract ChessArbiterSettleForkTest is Test {
    StakeEscrow constant ESCROW =
        StakeEscrow(0x01D514432b6694D8260bbA0fc2af3Cf327020823);
    address constant ESCROW_ADMIN = 0x88cb5e1fAee0798E2780618CF4fD12933E385426;
    bytes32 constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    uint256 constant STAKE = 250_000; // 0.25 USDC

    IERC20 usdc;
    ChessArbiter arbiter;
    address forwarder = makeAddr("keystoneForwarder");

    function setUp() public {
        vm.createSelectFork("base");
        usdc = IERC20(address(ESCROW.usdc()));

        // Deploy the arbiter against the live escrow; this test is its operator.
        arbiter = new ChessArbiter(
            address(this),
            address(this),
            address(ESCROW),
            forwarder
        );
        // The arbiter must hold OPERATOR_ROLE on the escrow to settle pots.
        vm.prank(ESCROW_ADMIN);
        ESCROW.grantRole(OPERATOR_ROLE, address(arbiter));
    }

    function test_cre_report_settles_pot() public {
        // Tie the matchId to a real Lichess game id (same derivation as
        // src/lib/server/chess-arbiter.ts: keccak256("chess:" + gameId)).
        string memory gameId = "JBcl9lqY";
        bytes32 matchId = keccak256(bytes(string.concat("chess:", gameId)));
        bytes32 roomId = keccak256(bytes("SIM-CHESS-CRE"));
        address white = makeAddr("white"); // winner per Lichess
        address black = makeAddr("black");

        // Backend registers the match on-chain (emits ChessMatchOpened, which
        // the CRE workflow watches).
        arbiter.openMatch(matchId, roomId, white, black, gameId);

        // Two Blink deposits land in the escrow + backend credits the seats.
        deal(address(usdc), address(ESCROW), STAKE * 2);
        vm.startPrank(ESCROW_ADMIN);
        ESCROW.creditStake(roomId, 0, white, STAKE);
        ESCROW.creditStake(roomId, 1, black, STAKE);
        vm.stopPrank();

        // One match should be pending settlement (what pendingMatches() feeds
        // to the workflow).
        (bytes32[] memory pendingBefore, , , ) = arbiter.pendingMatches();
        assertEq(pendingBefore.length, 1, "1 pending match before report");

        // The CRE workflow fetched Lichess (winner=white) and produced this
        // report. Byte-identical to encodeAbiParameters([bytes32, address]).
        bytes memory report = abi.encode(matchId, white);

        // Keystone forwarder delivers the signed report.
        uint256 beforeBal = usdc.balanceOf(white);
        vm.prank(forwarder);
        arbiter.onReport("", report);
        uint256 received = usdc.balanceOf(white) - beforeBal;

        assertEq(received, STAKE * 2, "winner paid the full pot via CRE report");

        (bytes32[] memory pendingAfter, , , ) = arbiter.pendingMatches();
        assertEq(pendingAfter.length, 0, "match cleared after settlement");

        console.log("Arbiter:       ", address(arbiter));
        console.log("Escrow (live): ", address(ESCROW));
        console.log("Game id:       ", gameId);
        console.log("Winner:        ", white);
        console.log("Pot (USDC 6dp):", received);
    }

    /// Only the configured Keystone forwarder may deliver reports.
    function test_onReport_rejects_non_forwarder() public {
        bytes32 matchId = keccak256(bytes("chess:REJECT"));
        bytes32 roomId = keccak256(bytes("SIM-CHESS-CRE-REJECT"));
        address white = makeAddr("white2");
        address black = makeAddr("black2");

        arbiter.openMatch(matchId, roomId, white, black, "REJECT");
        deal(address(usdc), address(ESCROW), STAKE * 2);
        vm.startPrank(ESCROW_ADMIN);
        ESCROW.creditStake(roomId, 0, white, STAKE);
        ESCROW.creditStake(roomId, 1, black, STAKE);
        vm.stopPrank();

        bytes memory report = abi.encode(matchId, white);
        // A random caller (not the forwarder) must be rejected.
        vm.expectRevert();
        arbiter.onReport("", report);
    }
}
