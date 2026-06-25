#!/usr/bin/env bash
# Verify all Playces production contracts on Sourcify (no API key required).
# When ETHERSCAN_API_KEY is set, also submits to Etherscan / Basescan / Arbiscan
# (single Etherscan API v2 key works across chains).
#
# Usage:
#   bash contracts/verify-all.sh
#   ETHERSCAN_API_KEY=... bash contracts/verify-all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
DEPLOYER="${PLAYCES_DEPLOYER:-0x88cb5e1fAee0798E2780618CF4fD12933E385426}"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a
  source <(grep -E '^ETHERSCAN_API_KEY=' "$ENV_FILE" 2>/dev/null || true)
  set +a
fi

VERIFIER="${VERIFIER:-sourcify}"
if [ -n "${ETHERSCAN_API_KEY:-}" ]; then
  echo "ETHERSCAN_API_KEY set — will verify on Sourcify + block explorers."
  DUAL=1
else
  echo "No ETHERSCAN_API_KEY — verifying on Sourcify only."
  echo "Add ETHERSCAN_API_KEY to .env.local for Basescan / Etherscan green checks."
  DUAL=0
fi

cd "$ROOT/contracts"
forge build --sizes >/dev/null 2>&1 || forge build

PASS_ARGS="$(cast abi-encode "constructor(address,address)" "$DEPLOYER" "$DEPLOYER")"
SENDER_ARGS="$(cast abi-encode "constructor(address,address,address)" \
  0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165 \
  0xb1D4538B4571d411F07960EF2838Ce337FE1E80E \
  "$DEPLOYER")"
RECV_ARGS="$(cast abi-encode "constructor(address,address)" \
  0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59 \
  "$DEPLOYER")"
ESCROW_ARGS="$(cast abi-encode "constructor(address,address,address)" \
  "$DEPLOYER" "$DEPLOYER" 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)"

verify_one() {
  local chain="$1" addr="$2" contract="$3" args="$4" label="$5"
  echo ""
  echo "==> $label"
  echo "    $chain · $addr"
  forge verify-contract "$addr" "$contract" \
    --chain "$chain" \
    --verifier sourcify \
    --constructor-args "$args" \
    || echo "    (Sourcify submission failed — may already be verified)"
  if [ "$DUAL" = "1" ]; then
    forge verify-contract "$addr" "$contract" \
      --chain "$chain" \
      --etherscan-api-key "$ETHERSCAN_API_KEY" \
      --constructor-args "$args" \
      --watch \
      || echo "    (Explorer verification failed or pending — check manually)"
  fi
}

verify_one base \
  0xC1eF7A81195538bc529b8Ed42182eC73764450FC \
  src/PlaycesPass.sol:PlaycesPass \
  "$PASS_ARGS" \
  "PlaycesPass — memory proof mint (Base mainnet)"

verify_one base \
  0x01D514432b6694D8260bbA0fc2af3Cf327020823 \
  src/StakeEscrow.sol:StakeEscrow \
  "$ESCROW_ARGS" \
  "StakeEscrow — Blink USDC staking (Base mainnet)"

verify_one arbitrum-sepolia \
  0xC1eF7A81195538bc529b8Ed42182eC73764450FC \
  src/ProofSender.sol:ProofSender \
  "$SENDER_ARGS" \
  "ProofSender — CCIP source (Arbitrum Sepolia)"

verify_one arbitrum-sepolia \
  0x68476f79D46A3A7A0ce7cbA40E4eF77264c47904 \
  src/PlaycesPass.sol:PlaycesPass \
  "$PASS_ARGS" \
  "PlaycesPass — Arbitrum win badge direct mint (Arbitrum Sepolia)"

verify_one sepolia \
  0x68476f79D46A3A7A0ce7cbA40E4eF77264c47904 \
  src/ProofReceiverPass.sol:ProofReceiverPass \
  "$RECV_ARGS" \
  "ProofReceiverPass — CCIP destination (Ethereum Sepolia)"

echo ""
echo "Done. See contracts/deployments/production.json and README.md for links."
