#!/usr/bin/env bash
# Deploy ChessArbiter — the Chainlink CRE consumer that settles chess PvP pots.
#
# It is deployed on the active settlement chain (same chain as StakeEscrow) and
# granted OPERATOR_ROLE on the escrow so it can release pots when the CRE
# workflow reports the verified Lichess winner.
#
# Prereqs:
#   - Foundry installed.
#   - STAKE_ESCROW_ADDRESS set in .env.local (deploy-stake-escrow.sh first).
#   - Deployer (MINTER_PRIVATE_KEY) funded with gas and an admin of the escrow.
#
# Usage:
#   bash contracts/deploy-chess-arbiter.sh
#   SETTLEMENT_CHAIN=base bash contracts/deploy-chess-arbiter.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      MINTER_PRIVATE_KEY|BASE_RPC_URL|BASE_SEPOLIA_RPC_URL|SEPOLIA_RPC_URL|SETTLEMENT_CHAIN|NEXT_PUBLIC_SETTLEMENT_CHAIN|STAKE_ESCROW_ADDRESS|KEYSTONE_FORWARDER)
        export "$key=$value" ;;
    esac
  done < <(grep -E '^(MINTER_PRIVATE_KEY|BASE_RPC_URL|BASE_SEPOLIA_RPC_URL|SEPOLIA_RPC_URL|SETTLEMENT_CHAIN|NEXT_PUBLIC_SETTLEMENT_CHAIN|STAKE_ESCROW_ADDRESS|KEYSTONE_FORWARDER)=' "$ENV_FILE")
fi

# shellcheck source=resolve-chain.sh
source "$SCRIPT_DIR/resolve-chain.sh"
resolve_playces_chain

[ -n "${STAKE_ESCROW_ADDRESS:-}" ] || {
  echo "STAKE_ESCROW_ADDRESS not set — run contracts/deploy-stake-escrow.sh first." >&2
  exit 1
}

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
case "$PK" in 0x*) ;; *) PK="0x$PK" ;; esac

DEPLOYER="$(cast wallet address --private-key "$PK")"
echo "Chain:    $CHAIN_LABEL ($CHAIN_ID)"
echo "Deployer: $DEPLOYER"
echo "Escrow:   $STAKE_ESCROW_ADDRESS"
echo "Forwarder:${KEYSTONE_FORWARDER:-<unset — set later via setForwarder>}"

cd "$ROOT/contracts"
OUT="$(STAKE_ESCROW_ADDRESS="$STAKE_ESCROW_ADDRESS" \
  KEYSTONE_FORWARDER="${KEYSTONE_FORWARDER:-0x0000000000000000000000000000000000000000}" \
  PRIVATE_KEY="$PK" \
  forge script script/DeployChessArbiter.s.sol:DeployChessArbiter \
  --rpc-url "$RPC_URL" --broadcast --skip-simulation 2>&1)"
echo "$OUT"

ADDR="$(echo "$OUT" | grep -oiE 'ChessArbiter deployed at: 0x[0-9a-fA-F]{40}' | grep -oiE '0x[0-9a-fA-F]{40}' | tail -1)"
[ -n "$ADDR" ] || { echo "Could not parse deployed ChessArbiter address." >&2; exit 1; }
echo "Deployed ChessArbiter at: $ADDR"

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

set_env "CHESS_ARBITER_ADDRESS" "$ADDR"
set_env "CHESS_ARBITER_ENABLED" "true"
echo "Wired CHESS_ARBITER_ADDRESS + CHESS_ARBITER_ENABLED into .env.local"
echo "Next: build + deploy the CRE workflow (cre/chess-result-feed), then set the"
echo "Keystone forwarder on the arbiter via setForwarder()."
