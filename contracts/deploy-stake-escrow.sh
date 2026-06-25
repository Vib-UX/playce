#!/usr/bin/env bash
# Deploy StakeEscrow to a settlement chain.
#
# SETTLEMENT_CHAIN: sepolia (default) | base-sepolia | base
#
# Usage:
#   bash contracts/deploy-stake-escrow.sh
#   SETTLEMENT_CHAIN=base bash contracts/deploy-stake-escrow.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      MINTER_PRIVATE_KEY|BASE_RPC_URL|BASE_SEPOLIA_RPC_URL|SEPOLIA_RPC_URL|SETTLEMENT_CHAIN|NEXT_PUBLIC_SETTLEMENT_CHAIN)
        export "$key=$value" ;;
    esac
  done < <(grep -E '^(MINTER_PRIVATE_KEY|BASE_RPC_URL|BASE_SEPOLIA_RPC_URL|SEPOLIA_RPC_URL|SETTLEMENT_CHAIN|NEXT_PUBLIC_SETTLEMENT_CHAIN)=' "$ENV_FILE")
fi

# shellcheck source=resolve-chain.sh
source "$SCRIPT_DIR/resolve-chain.sh"
resolve_playces_chain

if [ -n "${MINTER_PRIVATE_KEY:-}" ]; then
  PK="$MINTER_PRIVATE_KEY"
elif [ -d "$HOME/.playces/keystore" ]; then
  KEYSTORE_DIR="$HOME/.playces/keystore"
  KSFILE="$(ls -1 "$KEYSTORE_DIR" | head -1)"
  PK="$(cast wallet decrypt-keystore --keystore-dir "$KEYSTORE_DIR" "$KSFILE" --unsafe-password "" | awk '{print $NF}')"
else
  echo "Set MINTER_PRIVATE_KEY or create ~/.playces/keystore with a funded deployer." >&2
  exit 1
fi

DEPLOYER="$(cast wallet address --private-key "$PK")"
echo "Chain:    $CHAIN_LABEL ($CHAIN_ID)"
echo "Deployer: $DEPLOYER"
BALANCE="$(cast balance "$DEPLOYER" --rpc-url "$RPC_URL" --ether)"
echo "Balance:  $BALANCE ETH"

if awk "BEGIN { exit !($BALANCE < 0.00001) }"; then
  echo "" >&2
  echo "Insufficient $CHAIN_LABEL ETH. Fund: $DEPLOYER" >&2
  echo "Faucets: $FAUCET_HINT" >&2
  exit 1
fi

cd "$ROOT/contracts"
OUT="$(USDC_ADDRESS="$USDC_ADDRESS" PRIVATE_KEY="$PK" forge script script/DeployStakeEscrow.s.sol:DeployStakeEscrow \
  --rpc-url "$RPC_URL" --broadcast --skip-simulation 2>&1)"
echo "$OUT"

ADDR="$(echo "$OUT" | grep -oiE 'StakeEscrow deployed at: 0x[0-9a-fA-F]{40}' | grep -oiE '0x[0-9a-fA-F]{40}' | tail -1)"
if [ -z "$ADDR" ]; then
  echo "Could not parse deployed StakeEscrow address." >&2
  exit 1
fi
echo "Deployed StakeEscrow at: $ADDR"

touch "$ENV_FILE"
set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    tmp="$(mktemp)"
    while IFS= read -r line; do
      case "$line" in
        ${key}=*) printf '%s=%s\n' "$key" "$val" ;;
        *) printf '%s\n' "$line" ;;
      esac
    done < "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}

if [ "$UPDATE_ACTIVE_ENV" = "1" ]; then
  set_env "STAKE_ESCROW_ADDRESS" "$ADDR"
  set_env "NEXT_PUBLIC_STAKE_ESCROW_ADDRESS" "$ADDR"
  echo "Updated active STAKE_ESCROW_ADDRESS in .env.local"
else
  set_env "$ESCROW_ENV_KEY" "$ADDR"
  echo "Saved $ESCROW_ENV_KEY (active Sepolia env unchanged)"
fi

echo "Restart 'npm run dev' if you updated the active chain's env."
