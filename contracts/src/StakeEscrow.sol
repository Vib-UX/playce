// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title StakeEscrow
 * @notice Holds USDC stakes for Playces "The 67" head-to-head matches.
 *
 * Blink deposits USDC directly to this contract. After server-side transfer
 * verification, the backend (OPERATOR_ROLE) calls `creditStake` to attribute
 * funds to a room seat. The host starts the match only after both seats are
 * credited. `settle` sends the full pot to the winner; `cancel` refunds both.
 */
contract StakeEscrow is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public immutable usdc;

    struct StakeSlot {
        address player;
        uint256 amount;
        bool credited;
    }

    /// @notice roomId => [host, guest] stake slots.
    mapping(bytes32 => StakeSlot[2]) public stakes;

    event StakeCredited(
        bytes32 indexed roomId,
        uint8 indexed role,
        address indexed player,
        uint256 amount
    );
    event Settled(bytes32 indexed roomId, address indexed winner, uint256 pot);
    event Cancelled(bytes32 indexed roomId, address host, address guest, uint256 refundEach);

    error ZeroAddress();
    error InvalidRole();
    error AlreadyCredited(bytes32 roomId, uint8 role);
    error NotCredited(bytes32 roomId, uint8 role);
    error PlayerMismatch(bytes32 roomId, uint8 role, address player);
    error InsufficientBalance(uint256 needed, uint256 available);

    constructor(address admin, address operator, address usdcToken) {
        if (admin == address(0) || operator == address(0) || usdcToken == address(0)) {
            revert ZeroAddress();
        }
        usdc = IERC20(usdcToken);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
    }

    /// @notice Attribute a Blink deposit to a room seat. `role`: 0 = host, 1 = guest.
    function creditStake(
        bytes32 roomId,
        uint8 role,
        address player,
        uint256 amount
    ) external onlyRole(OPERATOR_ROLE) {
        if (role > 1) revert InvalidRole();
        if (player == address(0)) revert ZeroAddress();
        if (amount == 0) revert InsufficientBalance(1, 0);

        StakeSlot storage slot = stakes[roomId][role];
        if (slot.credited) revert AlreadyCredited(roomId, role);
        if (usdc.balanceOf(address(this)) < amount) {
            revert InsufficientBalance(amount, usdc.balanceOf(address(this)));
        }

        slot.player = player;
        slot.amount = amount;
        slot.credited = true;

        emit StakeCredited(roomId, role, player, amount);
    }

    /// @notice Both seats must be credited. Sends the full pot to `winner`.
    function settle(bytes32 roomId, address winner) external onlyRole(OPERATOR_ROLE) {
        StakeSlot memory host = stakes[roomId][0];
        StakeSlot memory guest = stakes[roomId][1];
        if (!host.credited) revert NotCredited(roomId, 0);
        if (!guest.credited) revert NotCredited(roomId, 1);
        if (winner != host.player && winner != guest.player) {
            revert PlayerMismatch(roomId, winner == host.player ? 0 : 1, winner);
        }

        uint256 pot = host.amount + guest.amount;
        delete stakes[roomId][0];
        delete stakes[roomId][1];

        usdc.safeTransfer(winner, pot);
        emit Settled(roomId, winner, pot);
    }

    /// @notice Refund both players and clear the room.
    function cancel(bytes32 roomId) external onlyRole(OPERATOR_ROLE) {
        StakeSlot memory host = stakes[roomId][0];
        StakeSlot memory guest = stakes[roomId][1];

        delete stakes[roomId][0];
        delete stakes[roomId][1];

        if (host.credited && host.amount > 0) {
            usdc.safeTransfer(host.player, host.amount);
        }
        if (guest.credited && guest.amount > 0) {
            usdc.safeTransfer(guest.player, guest.amount);
        }

        emit Cancelled(roomId, host.player, guest.player, host.amount);
    }

    function bothStaked(bytes32 roomId) external view returns (bool) {
        return stakes[roomId][0].credited && stakes[roomId][1].credited;
    }

    function potAmount(bytes32 roomId) external view returns (uint256) {
        return stakes[roomId][0].amount + stakes[roomId][1].amount;
    }
}
