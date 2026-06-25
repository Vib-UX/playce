// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from
    "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Metadata} from
    "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {CCIPReceiver} from
    "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {Client} from
    "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/**
 * @title ProofReceiverPass
 * @notice Destination-chain soulbound proof-of-presence NFT minted from a
 *         Chainlink CCIP message.
 *
 * Playces's "chain battles" (The 67) settle off-chain. When a battle finishes,
 * the source chain's {ProofSender} sends a CCIP message carrying the winner,
 * an event id, and a metadata URI. CCIP delivers it here and `_ccipReceive`
 * mints the soulbound pass to the winner on this (destination) chain.
 *
 * Mirrors {PlaycesPass} invariants:
 *  - One token per (eventId, wallet).
 *  - Tokens are soulbound (non-transferable).
 *  - Each token stores its eventId + metadata URI.
 *
 * Security: only allowlisted source chain selectors AND senders can mint.
 */
contract ProofReceiverPass is CCIPReceiver, ERC721URIStorage, AccessControl {
    uint256 private _nextTokenId = 1;

    /// @notice eventId => wallet => has claimed.
    mapping(bytes32 => mapping(address => bool)) public claimed;
    /// @notice tokenId => eventId it proves attendance for.
    mapping(uint256 => bytes32) public eventOf;
    /// @notice eventId => number of passes minted.
    mapping(bytes32 => uint256) public eventClaims;

    /// @notice Source chain selector => allowed.
    mapping(uint64 => bool) public allowlistedSourceChains;
    /// @notice Source sender (ProofSender) => allowed.
    mapping(address => bool) public allowlistedSenders;

    event SourceChainAllowlisted(uint64 indexed chainSelector, bool allowed);
    event SenderAllowlisted(address indexed sender, bool allowed);
    event ProofMinted(
        bytes32 indexed messageId,
        uint64 indexed sourceChainSelector,
        address indexed to,
        bytes32 eventId,
        uint256 tokenId
    );
    event ProofSkipped(bytes32 indexed messageId, string reason);

    error NotAllowlistedSourceChain(uint64 chainSelector);
    error NotAllowlistedSender(address sender);
    error Soulbound();
    error ZeroAddress();

    constructor(address router, address admin)
        CCIPReceiver(router)
        ERC721("Playces Proof of Presence", "PLAYCESPOP")
    {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ── Allowlisting (admin) ─────────────────────────────────────────────────
    function allowlistSourceChain(uint64 chainSelector, bool allowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        allowlistedSourceChains[chainSelector] = allowed;
        emit SourceChainAllowlisted(chainSelector, allowed);
    }

    function allowlistSender(address sender, bool allowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        allowlistedSenders[sender] = allowed;
        emit SenderAllowlisted(sender, allowed);
    }

    // ── CCIP receive ─────────────────────────────────────────────────────────
    function _ccipReceive(Client.Any2EVMMessage memory message)
        internal
        override
    {
        uint64 sourceSelector = message.sourceChainSelector;
        if (!allowlistedSourceChains[sourceSelector]) {
            revert NotAllowlistedSourceChain(sourceSelector);
        }
        address sender = abi.decode(message.sender, (address));
        if (!allowlistedSenders[sender]) revert NotAllowlistedSender(sender);

        (address to, bytes32 eventId, string memory uri) =
            abi.decode(message.data, (address, bytes32, string));

        // Idempotent: a repeat (eventId, wallet) is skipped rather than reverted
        // so CCIP doesn't retry a message that can never succeed.
        if (to == address(0) || claimed[eventId][to]) {
            emit ProofSkipped(message.messageId, "already-claimed-or-zero");
            return;
        }

        claimed[eventId][to] = true;
        uint256 tokenId = _nextTokenId++;
        eventOf[tokenId] = eventId;
        eventClaims[eventId] += 1;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit ProofMinted(message.messageId, sourceSelector, to, eventId, tokenId);
    }

    // ── Views ────────────────────────────────────────────────────────────────
    function hasClaimed(bytes32 eventId, address wallet)
        external
        view
        returns (bool)
    {
        return claimed[eventId][wallet];
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ── Soulbound enforcement ────────────────────────────────────────────────
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    // `CCIPReceiver.supportsInterface` is `pure`, so the merged override must be
    // `pure` too (cannot loosen mutability). We therefore report the supported
    // interface ids explicitly instead of delegating to the `view` ERC721 /
    // AccessControl implementations.
    function supportsInterface(bytes4 interfaceId)
        public
        pure
        override(ERC721URIStorage, AccessControl, CCIPReceiver)
        returns (bool)
    {
        return CCIPReceiver.supportsInterface(interfaceId)
            || interfaceId == type(IERC721).interfaceId
            || interfaceId == type(IERC721Metadata).interfaceId
            || interfaceId == type(IAccessControl).interfaceId;
    }
}
