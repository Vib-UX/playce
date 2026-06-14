#!/usr/bin/env bash
# Deploy Playce's soulbound WIN BADGE for chain battles.
#
# Two badge rails (the winner's repped chain decides which):
#   - Arbitrum-repped win  -> DIRECT backend mint on Arbitrum Sepolia.
#       This script deploys a PlaycePass (soulbound ERC-721) there and wires
#       BADGE_ARBITRUM_ADDRESS into .env.local.
#   - Ethereum-repped win   -> Chainlink CCIP (Arbitrum Sepolia ProofSender ->
#       Ethereum Sepolia ProofReceiverPass). That pair is deployed separately by
#       contracts/deploy-ccip.sh and reused as-is (no new contract here).
#
# The backend (MINTER_PRIVATE_KEY) is granted MINTER_ROLE (it is the deployer
# here, which is admin + minter) so badge mints are gasless for winners.
#
# Prereqs:
#   - Foundry installed.
#   - Deployer funded with gas on Arbitrum Sepolia. Key resolved (in order):
#       PRIVATE_KEY env, MINTER_PRIVATE_KEY env / .env.local, or ~/.playce/keystore
#
# Usage:  bash contracts/deploy-badge.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYSTORE_DIR="$HOME/.playce/keystore"

ARB_RPC="${ARBITRUM_SEPOLIA_RPC_URL:-https://sepolia-rollup.arbitrum.io/rpc}"

# ── Resolve deployer key: PRIVATE_KEY > MINTER_PRIVATE_KEY/.env.local > keystore
PK="${PRIVATE_KEY:-${MINTER_PRIVATE_KEY:-}}"
if [ -z "$PK" ] && [ -f "$ROOT/.env.local" ]; then
  PK="$(grep -E '^MINTER_PRIVATE_KEY=' "$ROOT/.env.local" | head -1 | cut -d= -f2-)"
fi
if [ -z "$PK" ] && [ -d "$KEYSTORE_DIR" ]; then
  KSFILE="$(ls -1 "$KEYSTORE_DIR" | head -1)"
  PK="$(cast wallet decrypt-keystore --keystore-dir "$KEYSTORE_DIR" "$KSFILE" --unsafe-password "" | awk '{print $NF}')"
fi
[ -n "$PK" ] || { echo "No deployer key (set PRIVATE_KEY or MINTER_PRIVATE_KEY)." >&2; exit 1; }
case "$PK" in 0x*) ;; *) PK="0x$PK" ;; esac
DEPLOYER="$(cast wallet address --private-key "$PK")"

echo "Deployer:           $DEPLOYER"
echo "Arbitrum Sepolia:   $ARB_RPC"

cd "$ROOT/contracts"

# ── Deploy the soulbound win badge (PlaycePass) on Arbitrum Sepolia ─────────
echo "==> Deploying PlaycePass (win badge) on Arbitrum Sepolia..."
OUT="$(PRIVATE_KEY="$PK" \
  forge script script/Deploy.s.sol:DeployPlaycePass \
  --rpc-url "$ARB_RPC" --broadcast --skip-simulation 2>&1)"
echo "$OUT"
BADGE="$(echo "$OUT" | grep -oE 'PlaycePass deployed at: 0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}')"
[ -n "$BADGE" ] || { echo "Could not parse badge address." >&2; exit 1; }
echo "Win badge (Arbitrum Sepolia): $BADGE"

# ── Wire into .env.local ────────────────────────────────────────────────────
ENV_FILE="$ROOT/.env.local"
set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    local tmp; tmp="$(mktemp)"
    while IFS= read -r line; do
      case "$line" in "${key}="*) printf '%s=%s\n' "$key" "$val" ;; *) printf '%s\n' "$line" ;; esac
    done < "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}

set_env WIN_BADGE_ENABLED true
set_env BADGE_ARBITRUM_ADDRESS "$BADGE"
set_env ARBITRUM_SEPOLIA_RPC_URL "$ARB_RPC"

echo ""
echo "Done. Wired the Arbitrum win-badge address into .env.local."
echo "Ethereum-repped wins reuse the CCIP pair from contracts/deploy-ccip.sh"
echo "  (ProofSender on Arbitrum Sepolia -> ProofReceiverPass on Ethereum Sepolia)."
echo "Then restart 'npm run dev'."
