import { keccak256, toHex } from "viem";

/** Minimal ABI for PlaycePass (see contracts/src/PlaycePass.sol). */
export const playceAbi = [
  {
    type: "function",
    name: "mintClaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "eventId", type: "bytes32" },
      { name: "uri", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "hasClaimed",
    stateMutability: "view",
    inputs: [
      { name: "eventId", type: "bytes32" },
      { name: "wallet", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "eventClaims",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalMinted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "eventId", type: "bytes32", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "tokenURI", type: "string", indexed: false },
    ],
    anonymous: false,
  },
] as const;

/** Deterministic on-chain event id from the off-chain string id. */
export function onchainEventId(eventId: string): `0x${string}` {
  return keccak256(toHex(eventId));
}
