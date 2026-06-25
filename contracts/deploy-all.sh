#!/usr/bin/env bash
# Deploy PlaycesPass + StakeEscrow to a settlement chain.
#
# SETTLEMENT_CHAIN:
#   sepolia (default) | base-sepolia | base
#
# When the target chain matches NEXT_PUBLIC_SETTLEMENT_CHAIN, addresses are
# written to the active app env vars. Otherwise they go to chain-specific keys
# and contracts/deployments/<chain>.json (Sepolia env is not overwritten).
#
# Usage:
#   bash contracts/deploy-all.sh
#   SETTLEMENT_CHAIN=base bash contracts/deploy-all.sh
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
  echo "Set MINTER_PRIVATE_KEY in .env.local or create ~/.playces/keystore." >&2
  exit 1
fi

DEPLOYER="$(cast wallet address --private-key "$PK")"
BALANCE="$(cast balance "$DEPLOYER" --rpc-url "$RPC_URL" --ether)"
echo "Chain:    $CHAIN_LABEL ($CHAIN_ID)"
echo "Deployer: $DEPLOYER"
echo "Balance:  $BALANCE ETH"

if awk "BEGIN { exit !($BALANCE < 0.00001) }"; then
  echo "" >&2
  echo "Insufficient $CHAIN_LABEL ETH. Fund this address first:" >&2
  echo "  $DEPLOYER" >&2
  echo "" >&2
  echo "Faucets: $FAUCET_HINT" >&2
  echo "" >&2
  echo "Need ~0.00003 ETH total for both contracts, then re-run:" >&2
  echo "  SETTLEMENT_CHAIN=${SETTLEMENT_CHAIN:-${NEXT_PUBLIC_SETTLEMENT_CHAIN:-sepolia}} bash contracts/deploy-all.sh" >&2
  exit 1
fi

set_env() {
  local key="$1" val="$2"
  touch "$ENV_FILE"
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

write_deployment_manifest() {
  local pass_addr="$1" escrow_addr="$2"
  local chain_key="${SETTLEMENT_CHAIN:-${NEXT_PUBLIC_SETTLEMENT_CHAIN:-sepolia}}"
  local manifest_dir="$ROOT/contracts/deployments"
  mkdir -p "$manifest_dir"
  cat > "$manifest_dir/${chain_key}.json" <<EOF
{
  "chain": "$CHAIN_LABEL",
  "chainId": $CHAIN_ID,
  "deployer": "$DEPLOYER",
  "usdc": "$USDC_ADDRESS",
  "playcesPass": "$pass_addr",
  "stakeEscrow": "$escrow_addr",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
  echo "Manifest → contracts/deployments/${chain_key}.json"
}

cd "$ROOT/contracts"

echo ""
echo "── Deploying PlaycesPass ──"
PASS_OUT="$(PRIVATE_KEY="$PK" forge script script/Deploy.s.sol:DeployPlaycesPass \
  --rpc-url "$RPC_URL" --broadcast --skip-simulation 2>&1)" || {
  echo "$PASS_OUT" >&2
  exit 1
}
echo "$PASS_OUT"
PASS_ADDR="$(echo "$PASS_OUT" | grep -oiE 'PlaycesPass deployed at: 0x[0-9a-fA-F]{40}' | grep -oiE '0x[0-9a-fA-F]{40}' | tail -1)"

echo ""
echo "── Deploying StakeEscrow ──"
ESCROW_OUT="$(USDC_ADDRESS="$USDC_ADDRESS" PRIVATE_KEY="$PK" forge script script/DeployStakeEscrow.s.sol:DeployStakeEscrow \
  --rpc-url "$RPC_URL" --broadcast --skip-simulation 2>&1)" || {
  echo "$ESCROW_OUT" >&2
  exit 1
}
echo "$ESCROW_OUT"
ESCROW_ADDR="$(echo "$ESCROW_OUT" | grep -oiE 'StakeEscrow deployed at: 0x[0-9a-fA-F]{40}' | grep -oiE '0x[0-9a-fA-F]{40}' | tail -1)"
if [ -z "$ESCROW_ADDR" ]; then
  echo "Could not parse StakeEscrow address." >&2
  exit 1
fi

if [ "$UPDATE_ACTIVE_ENV" = "1" ]; then
  if [ -n "$PASS_ADDR" ]; then
    set_env "NEXT_PUBLIC_PLAYCES_CONTRACT_ADDRESS" "$PASS_ADDR"
  fi
  set_env "STAKE_ESCROW_ADDRESS" "$ESCROW_ADDR"
  set_env "NEXT_PUBLIC_STAKE_ESCROW_ADDRESS" "$ESCROW_ADDR"
  echo "Updated active app env vars in .env.local"
else
  if [ -n "$PASS_ADDR" ]; then
    set_env "$PASS_ENV_KEY" "$PASS_ADDR"
  fi
  set_env "$ESCROW_ENV_KEY" "$ESCROW_ADDR"
  echo "Saved chain-specific addresses (active Sepolia env unchanged)"
fi

write_deployment_manifest "${PASS_ADDR:-}" "$ESCROW_ADDR"

echo ""
echo "Done ($CHAIN_LABEL)."
echo "  PlaycesPass:  ${PASS_ADDR:-skipped}"
echo "  StakeEscrow: $ESCROW_ADDR"
if [ "$UPDATE_ACTIVE_ENV" = "1" ]; then
  echo "Restart 'npm run dev' to pick up .env.local changes."
fi
