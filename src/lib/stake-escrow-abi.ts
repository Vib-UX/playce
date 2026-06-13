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
] as const;
