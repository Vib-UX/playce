// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @dev Chainlink CRE consumer interface. A CRE workflow writes a signed report;
 *      the chain's Keystone forwarder delivers it by calling onReport. In a full
 *      setup you'd extend the official Chainlink cre-contracts ReceiverTemplate;
 *      this minimal interface + forwarder gate keeps the contract buildable with
 *      the repo's current Foundry remappings (no extra submodule).
 */
interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

/** @dev The slice of {StakeEscrow} the arbiter needs to release a pot. */
interface IStakeEscrow {
    function settle(bytes32 roomId, address winner) external;
}

/**
 * @title ChessArbiter
 * @notice Trust-minimized settlement for Playces chess PvP.
 *
 * Flow:
 *  1. Playces's backend (OPERATOR_ROLE) calls {openMatch} once both players have
 *     staked and a Lichess game id exists, emitting {ChessMatchOpened} (which a
 *     Chainlink CRE workflow watches).
 *  2. The CRE workflow fetches the authoritative Lichess result, ABI-encodes
 *     `(matchId, winner)` into a signed report, and the Keystone forwarder
 *     delivers it via {onReport}.
 *  3. {onReport} validates the winner and releases the staked pot from
 *     {StakeEscrow} to the winner — no trusted backend in the settlement path.
 *
 * The arbiter must hold OPERATOR_ROLE on the configured {StakeEscrow} so it can
 * call `settle`.
 */
contract ChessArbiter is AccessControl, IReceiver {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IStakeEscrow public immutable escrow;

    /// @notice Keystone forwarder allowed to deliver CRE reports.
    address public forwarder;

    struct Match {
        bytes32 roomId;
        address white;
        address black;
        address winner;
        bool opened;
        bool settled;
        string gameId;
    }

    /// @notice matchId => match record.
    mapping(bytes32 => Match) public matches;
    /// @notice All opened match ids, for enumeration in {pendingMatches}.
    bytes32[] public matchIds;

    event ForwarderUpdated(address indexed forwarder);
    event ChessMatchOpened(
        bytes32 indexed matchId,
        bytes32 indexed roomId,
        address white,
        address black,
        string gameId
    );
    event ChessMatchSettled(bytes32 indexed matchId, address indexed winner);

    error ZeroAddress();
    error AlreadyOpened(bytes32 matchId);
    error NotOpened(bytes32 matchId);
    error AlreadySettled(bytes32 matchId);
    error UnknownWinner(bytes32 matchId, address winner);
    error NotForwarder(address sender);

    constructor(address admin, address operator, address escrow_, address forwarder_) {
        if (admin == address(0) || operator == address(0) || escrow_ == address(0)) {
            revert ZeroAddress();
        }
        escrow = IStakeEscrow(escrow_);
        forwarder = forwarder_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    function setForwarder(address forwarder_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        forwarder = forwarder_;
        emit ForwarderUpdated(forwarder_);
    }

    // ── Open ───────────────────────────────────────────────────────────────
    /// @notice Register a staked match so the CRE workflow can settle it.
    function openMatch(
        bytes32 matchId,
        bytes32 roomId,
        address white,
        address black,
        string calldata gameId
    ) external onlyRole(OPERATOR_ROLE) {
        if (white == address(0) || black == address(0)) revert ZeroAddress();
        if (matches[matchId].opened) revert AlreadyOpened(matchId);

        matches[matchId] = Match({
            roomId: roomId,
            white: white,
            black: black,
            winner: address(0),
            opened: true,
            settled: false,
            gameId: gameId
        });
        matchIds.push(matchId);

        emit ChessMatchOpened(matchId, roomId, white, black, gameId);
    }

    // ── CRE report delivery ──────────────────────────────────────────────────
    /// @inheritdoc IReceiver
    function onReport(bytes calldata, bytes calldata report) external override {
        if (msg.sender != forwarder) revert NotForwarder(msg.sender);
        (bytes32 matchId, address winner) = abi.decode(report, (bytes32, address));
        _settle(matchId, winner);
    }

    /**
     * @notice Settle a match directly (admin escape hatch for local simulation
     *         without a live Keystone forwarder). Production settlement flows
     *         through {onReport}.
     */
    function adminSettle(bytes32 matchId, address winner)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _settle(matchId, winner);
    }

    function _settle(bytes32 matchId, address winner) internal {
        Match storage m = matches[matchId];
        if (!m.opened) revert NotOpened(matchId);
        if (m.settled) revert AlreadySettled(matchId);
        if (winner != m.white && winner != m.black) {
            revert UnknownWinner(matchId, winner);
        }

        m.settled = true;
        m.winner = winner;

        escrow.settle(m.roomId, winner);
        emit ChessMatchSettled(matchId, winner);
    }

    // ── Views ────────────────────────────────────────────────────────────────
    /// @notice Opened-but-unsettled matches, for the CRE workflow to poll.
    function pendingMatches()
        external
        view
        returns (
            bytes32[] memory ids,
            string[] memory gameIds,
            address[] memory whites,
            address[] memory blacks
        )
    {
        uint256 total = matchIds.length;
        uint256 n;
        for (uint256 i; i < total; ++i) {
            Match storage m = matches[matchIds[i]];
            if (m.opened && !m.settled) ++n;
        }

        ids = new bytes32[](n);
        gameIds = new string[](n);
        whites = new address[](n);
        blacks = new address[](n);

        uint256 j;
        for (uint256 i; i < total; ++i) {
            bytes32 id = matchIds[i];
            Match storage m = matches[id];
            if (m.opened && !m.settled) {
                ids[j] = id;
                gameIds[j] = m.gameId;
                whites[j] = m.white;
                blacks[j] = m.black;
                ++j;
            }
        }
    }

    function matchCount() external view returns (uint256) {
        return matchIds.length;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl, IERC165)
        returns (bool)
    {
        return interfaceId == type(IReceiver).interfaceId
            || super.supportsInterface(interfaceId);
    }
}
