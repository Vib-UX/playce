// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {StakeEscrow} from "../src/StakeEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract StakeEscrowTest is Test {
    StakeEscrow escrow;
    MockUSDC usdc;
    address admin = address(0xA11CE);
    address host = address(0xBEEF);
    address guest = address(0xCAFE);
    bytes32 roomId = keccak256("ROOM01");

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new StakeEscrow(admin, admin, address(usdc));
        usdc.mint(address(escrow), 20e6);
    }

    function test_credit_and_settle() public {
        vm.prank(admin);
        escrow.creditStake(roomId, 0, host, 5e6);
        vm.prank(admin);
        escrow.creditStake(roomId, 1, guest, 5e6);
        assertTrue(escrow.bothStaked(roomId));

        vm.prank(admin);
        escrow.settle(roomId, host);
        assertEq(usdc.balanceOf(host), 10e6);
    }

    function test_cancel_refunds() public {
        vm.prank(admin);
        escrow.creditStake(roomId, 0, host, 5e6);
        vm.prank(admin);
        escrow.creditStake(roomId, 1, guest, 5e6);

        vm.prank(admin);
        escrow.cancel(roomId);
        assertEq(usdc.balanceOf(host), 5e6);
        assertEq(usdc.balanceOf(guest), 5e6);
    }
}
