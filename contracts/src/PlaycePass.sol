// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from
    "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PlaycePass
 * @notice Soulbound check-in / reward NFTs for Playce venues.
 *
 * Eligibility (geofencing, identity verification, game results) is checked
 * off-chain by Playce's backend. After a successful verification the backend —
 * holding MINTER_ROLE — mints a pass directly to the attendee's wallet, so
 * collecting is gasless for the user.
 *
 * Invariants:
 *  - One token per (eventId, wallet).
 *  - Each token stores its eventId and a metadata URI.
 *  - Tokens are soulbound (non-transferable) — a pass is proof *you* were there.
 */
contract PlaycePass is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId = 1;

    /// @notice eventId => wallet => has claimed.
    mapping(bytes32 => mapping(address => bool)) public claimed;
    /// @notice tokenId => eventId it proves attendance for.
    mapping(uint256 => bytes32) public eventOf;
    /// @notice eventId => number of passes minted.
    mapping(bytes32 => uint256) public eventClaims;

    event Claimed(
        address indexed to,
        bytes32 indexed eventId,
        uint256 indexed tokenId,
        string tokenURI
    );

    error AlreadyClaimed(bytes32 eventId, address wallet);
    error Soulbound();
    error ZeroAddress();

    constructor(address admin, address minter)
        ERC721("Playce Moment", "PLAYCE")
    {
        if (admin == address(0) || minter == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    /**
     * @notice Mint a pass to a verified attendee.
     * @param to       Recipient (the attendee's embedded wallet).
     * @param eventId  keccak256 of the off-chain event id.
     * @param uri      Token metadata URI (e.g. ipfs://...).
     * @return tokenId The newly minted token id.
     */
    function mintClaim(address to, bytes32 eventId, string calldata uri)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (to == address(0)) revert ZeroAddress();
        if (claimed[eventId][to]) revert AlreadyClaimed(eventId, to);

        claimed[eventId][to] = true;
        tokenId = _nextTokenId++;
        eventOf[tokenId] = eventId;
        eventClaims[eventId] += 1;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit Claimed(to, eventId, tokenId, uri);
    }

    /// @notice Whether `wallet` has already claimed `eventId`.
    function hasClaimed(bytes32 eventId, address wallet)
        external
        view
        returns (bool)
    {
        return claimed[eventId][wallet];
    }

    /// @notice Total passes minted across all events.
    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ── Soulbound enforcement ────────────────────────────────────────────────
    // Allow mint (from == 0) and burn (to == 0); block wallet-to-wallet moves.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
