#!/usr/bin/env bash
# Deploy PlaycesPass to Ethereum Sepolia using a local keystore, then wire the
# deployed address into the web app's .env.local.
#
# Prereqs:
#   - Foundry installed
#   - Deployer wallet funded with Sepolia ETH (see address below)
#
# Usage:  bash contracts/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYSTORE_DIR="$HOME/.playces/keystore"
RPC_URL="${SEPOLIA_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"

KSFILE="$(ls -1 "$KEYSTORE_DIR" | head -1)"
PK="$(cast wallet decrypt-keystore --keystore-dir "$KEYSTORE_DIR" "$KSFILE" --unsafe-password "" | awk '{print $NF}')"
DEPLOYER="$(cast wallet address --private-key "$PK")"

echo "Deployer: $DEPLOYER"
echo "Balance:  $(cast balance "$DEPLOYER" --rpc-url "$RPC_URL" --ether) ETH"

cd "$ROOT/contracts"
OUT="$(PRIVATE_KEY="$PK" forge script script/Deploy.s.sol:DeployPlaycesPass \
  --rpc-url "$RPC_URL" --broadcast --skip-simulation 2>&1)"
echo "$OUT"

ADDR="$(echo "$OUT" | grep -oE 'PlaycesPass deployed at: 0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}')"
if [ -z "$ADDR" ]; then
  echo "Could not parse deployed address." >&2
  exit 1
fi
echo "Deployed PlaycesPass at: $ADDR"

# Wire into web .env.local
ENV_FILE="$ROOT/.env.local"
if grep -q '^NEXT_PUBLIC_PLAYCES_CONTRACT_ADDRESS=' "$ENV_FILE"; then
  tmp="$(mktemp)"
  while IFS= read -r line; do
    case "$line" in
      NEXT_PUBLIC_PLAYCES_CONTRACT_ADDRESS=*) printf 'NEXT_PUBLIC_PLAYCES_CONTRACT_ADDRESS=%s\n' "$ADDR" ;;
      *) printf '%s\n' "$line" ;;
    esac
  done < "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
fi
echo "Updated NEXT_PUBLIC_PLAYCES_CONTRACT_ADDRESS in .env.local"
echo "Restart 'npm run dev' to pick up the new env."
