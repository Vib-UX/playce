// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PlaycePass} from "../src/PlaycePass.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract PlaycePassTest is Test {
    PlaycePass pass;

    address admin = address(0xA11CE);
    address minter = address(0xB0B);
    address alice = address(0x1111);
    address bob = address(0x2222);

    bytes32 eventId = keccak256("evt_base_house_nyc");
    string uri = "ipfs://bafytest/metadata.json";

    function setUp() public {
        pass = new PlaycePass(admin, minter);
    }

    function test_Constructor_GrantsRoles() public view {
        assertTrue(pass.hasRole(pass.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(pass.hasRole(pass.MINTER_ROLE(), minter));
    }

    function test_MintClaim_MintsToRecipient() public {
        vm.prank(minter);
        uint256 tokenId = pass.mintClaim(alice, eventId, uri);

        assertEq(pass.ownerOf(tokenId), alice);
        assertEq(pass.tokenURI(tokenId), uri);
        assertEq(pass.eventOf(tokenId), eventId);
        assertTrue(pass.hasClaimed(eventId, alice));
        assertEq(pass.eventClaims(eventId), 1);
        assertEq(pass.totalMinted(), 1);
    }

    function test_MintClaim_RevertsOnDoubleClaim() public {
        vm.startPrank(minter);
        pass.mintClaim(alice, eventId, uri);
        vm.expectRevert(
            abi.encodeWithSelector(PlaycePass.AlreadyClaimed.selector, eventId, alice)
        );
        pass.mintClaim(alice, eventId, uri);
        vm.stopPrank();
    }

    function test_MintClaim_AllowsDifferentEventSameWallet() public {
        bytes32 eventId2 = keccak256("evt_base_house_lisbon");
        vm.startPrank(minter);
        pass.mintClaim(alice, eventId, uri);
        pass.mintClaim(alice, eventId2, uri);
        vm.stopPrank();
        assertEq(pass.totalMinted(), 2);
    }

    function test_MintClaim_RevertsForNonMinter() public {
        bytes32 minterRole = pass.MINTER_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                alice,
                minterRole
            )
        );
        vm.prank(alice);
        pass.mintClaim(alice, eventId, uri);
    }

    function test_Soulbound_BlocksTransfer() public {
        vm.prank(minter);
        uint256 tokenId = pass.mintClaim(alice, eventId, uri);

        vm.prank(alice);
        vm.expectRevert(PlaycePass.Soulbound.selector);
        pass.transferFrom(alice, bob, tokenId);
    }

    function test_MintClaim_RevertsOnZeroAddress() public {
        vm.prank(minter);
        vm.expectRevert(PlaycePass.ZeroAddress.selector);
        pass.mintClaim(address(0), eventId, uri);
    }
}
