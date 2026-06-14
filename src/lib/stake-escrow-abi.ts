/** Minimal ABI for StakeEscrow operator calls. */
export const stakeEscrowAbi = [
  {
    type: "function",
    name: "creditStake",
    inputs: [
      { name: "roomId", type: "bytes32" },
      { name: "role", type: "uint8" },
      { name: "player", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "bothStaked",
    inputs: [{ name: "roomId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "potAmount",
    inputs: [{ name: "roomId", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "settle",
    inputs: [
      { name: "roomId", type: "bytes32" },
      { name: "winner", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "roomId", type: "bytes32", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "pot", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
