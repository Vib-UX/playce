// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRouterClient} from
    "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from
    "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/**
 * @title ProofSender
 * @notice Source-chain sender for Playces's cross-chain proof-of-presence.
 *
 * When a "chain battle" (The 67) finishes, Playces's backend (holding
 * SENDER_ROLE) calls {sendProof}. This builds a Chainlink CCIP message carrying
 * the winner, an event id, and a metadata URI, pays the CCIP fee in LINK, and
 * dispatches it to the {ProofReceiverPass} on the destination chain, which mints
 * the soulbound pass there.
 *
 * Fees are paid in LINK held by this contract — fund it with LINK before use.
 */
contract ProofSender is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant SENDER_ROLE = keccak256("SENDER_ROLE");

    IRouterClient public immutable router;
    IERC20 public immutable linkToken;

    /// @notice Gas limit for `_ccipReceive` execution on the destination chain.
    uint256 public destGasLimit = 400_000;

    /// @notice Destination chain selector => allowed.
    mapping(uint64 => bool) public allowlistedDestinationChains;

    event DestinationChainAllowlisted(uint64 indexed chainSelector, bool allowed);
    event DestGasLimitUpdated(uint256 gasLimit);
    event ProofSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address indexed winner,
        bytes32 eventId,
        uint256 fees
    );

    error NotAllowlistedDestinationChain(uint64 chainSelector);
    error InsufficientLinkBalance(uint256 needed, uint256 balance);
    error ZeroAddress();

    constructor(address router_, address link_, address admin) {
        if (router_ == address(0) || link_ == address(0) || admin == address(0)) {
            revert ZeroAddress();
        }
        router = IRouterClient(router_);
        linkToken = IERC20(link_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SENDER_ROLE, admin);
    }

    // ── Admin config ─────────────────────────────────────────────────────────
    function allowlistDestinationChain(uint64 chainSelector, bool allowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        allowlistedDestinationChains[chainSelector] = allowed;
        emit DestinationChainAllowlisted(chainSelector, allowed);
    }

    function setDestGasLimit(uint256 gasLimit)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        destGasLimit = gasLimit;
        emit DestGasLimitUpdated(gasLimit);
    }

    // ── Send ───────────────────────────────────────────────────────────────
    /**
     * @notice Send a cross-chain proof-of-presence mint instruction.
     * @param destinationChainSelector CCIP selector of the destination chain.
     * @param receiver                 {ProofReceiverPass} address on the destination.
     * @param winner                   Battle winner to mint the pass to.
     * @param eventId                  keccak256 of the off-chain battle/event id.
     * @param uri                      Token metadata URI (e.g. ipfs://...).
     * @return messageId               The CCIP message id.
     */
    function sendProof(
        uint64 destinationChainSelector,
        address receiver,
        address winner,
        bytes32 eventId,
        string calldata uri
    ) external onlyRole(SENDER_ROLE) returns (bytes32 messageId) {
        if (!allowlistedDestinationChains[destinationChainSelector]) {
            revert NotAllowlistedDestinationChain(destinationChainSelector);
        }
        if (receiver == address(0) || winner == address(0)) revert ZeroAddress();

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: abi.encode(winner, eventId, uri),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({gasLimit: destGasLimit})
            ),
            feeToken: address(linkToken)
        });

        uint256 fees = router.getFee(destinationChainSelector, message);
        uint256 balance = linkToken.balanceOf(address(this));
        if (fees > balance) revert InsufficientLinkBalance(fees, balance);

        linkToken.approve(address(router), fees);
        messageId = router.ccipSend(destinationChainSelector, message);

        emit ProofSent(messageId, destinationChainSelector, winner, eventId, fees);
    }

    /// @notice Quote the LINK fee for a given proof message (view helper).
    function quoteProofFee(
        uint64 destinationChainSelector,
        address receiver,
        address winner,
        bytes32 eventId,
        string calldata uri
    ) external view returns (uint256) {
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: abi.encode(winner, eventId, uri),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({gasLimit: destGasLimit})
            ),
            feeToken: address(linkToken)
        });
        return router.getFee(destinationChainSelector, message);
    }

    // ── Treasury ─────────────────────────────────────────────────────────────
    /// @notice Withdraw LINK (or any ERC20) held for fees.
    function withdrawToken(address token, address to)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, IERC20(token).balanceOf(address(this)));
    }

    receive() external payable {}
}
