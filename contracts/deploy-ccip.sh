#!/usr/bin/env bash
# Deploy Playces's Chainlink CCIP proof-of-presence across two chains:
#   - ProofSender   on the SOURCE chain (where chain battles settle)
#   - ProofReceiver on the DEST chain   (where the soulbound proof is minted)
# Then cross-allowlist the pair and wire addresses into the web app's .env.local.
#
# Defaults: SOURCE = Arbitrum Sepolia (has gas + LINK), DEST = Ethereum Sepolia.
#
# Prereqs:
#   - Foundry installed; CCIP contracts available:
#       git submodule update --init --recursive contracts/lib/chainlink-local
#   - Deployer funded with gas on BOTH chains. The key is read from (in order):
#       PRIVATE_KEY env, MINTER_PRIVATE_KEY env / .env.local, or ~/.playces/keystore
#   - After deploy: fund ProofSender with LINK on the source chain for CCIP fees
#     (this script attempts an auto-fund from the deployer's LINK balance)
#
# Usage:  bash contracts/deploy-ccip.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYSTORE_DIR="$HOME/.playces/keystore"

# ── CCIP directory (testnets) — override via env if Chainlink updates them ──
SOURCE_CHAIN="${CCIP_SOURCE_CHAIN:-arbitrum-sepolia}"
DEST_CHAIN="${CCIP_DEST_CHAIN:-sepolia}"

SOURCE_RPC="${SOURCE_RPC_URL:-https://sepolia-rollup.arbitrum.io/rpc}"
SOURCE_ROUTER="${SOURCE_CCIP_ROUTER:-0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165}"
SOURCE_LINK="${SOURCE_LINK_TOKEN:-0xb1D4538B4571d411F07960EF2838Ce337FE1E80E}"
SOURCE_SELECTOR="${SOURCE_CHAIN_SELECTOR:-3478487238524512106}"

DEST_RPC="${DEST_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"
DEST_ROUTER="${DEST_CCIP_ROUTER:-0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59}"
DEST_SELECTOR="${DEST_CHAIN_SELECTOR:-16015286601757825753}"

# Amount of LINK (whole tokens) to auto-fund the ProofSender with after deploy.
LINK_FUND_AMOUNT="${LINK_FUND_AMOUNT:-2}"

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

echo "Deployer:      $DEPLOYER"
echo "Source chain:  $SOURCE_CHAIN ($SOURCE_RPC)"
echo "Dest chain:    $DEST_CHAIN ($DEST_RPC)"

cd "$ROOT/contracts"

# ── 1. Deploy receiver on the destination chain ─────────────────────────────
echo "==> Deploying ProofReceiverPass on $DEST_CHAIN..."
RECV_OUT="$(PRIVATE_KEY="$PK" CCIP_ROUTER_ADDRESS="$DEST_ROUTER" \
  forge script script/DeployCcipReceiver.s.sol:DeployCcipReceiver \
  --rpc-url "$DEST_RPC" --broadcast --skip-simulation 2>&1)"
echo "$RECV_OUT"
RECEIVER="$(echo "$RECV_OUT" | grep -oE 'ProofReceiverPass deployed at: 0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}')"
[ -n "$RECEIVER" ] || { echo "Could not parse receiver address." >&2; exit 1; }
echo "ProofReceiverPass: $RECEIVER"

# ── 2. Deploy sender on the source chain ────────────────────────────────────
echo "==> Deploying ProofSender on $SOURCE_CHAIN..."
SEND_OUT="$(PRIVATE_KEY="$PK" CCIP_ROUTER_ADDRESS="$SOURCE_ROUTER" LINK_TOKEN_ADDRESS="$SOURCE_LINK" \
  forge script script/DeployCcipSender.s.sol:DeployCcipSender \
  --rpc-url "$SOURCE_RPC" --broadcast --skip-simulation 2>&1)"
echo "$SEND_OUT"
SENDER="$(echo "$SEND_OUT" | grep -oE 'ProofSender deployed at: 0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}')"
[ -n "$SENDER" ] || { echo "Could not parse sender address." >&2; exit 1; }
echo "ProofSender: $SENDER"

# ── 3. Cross-allowlist the pair ─────────────────────────────────────────────
echo "==> Allowlisting source chain + sender on the receiver..."
cast send "$RECEIVER" "allowlistSourceChain(uint64,bool)" "$SOURCE_SELECTOR" true \
  --rpc-url "$DEST_RPC" --private-key "$PK" >/dev/null
cast send "$RECEIVER" "allowlistSender(address,bool)" "$SENDER" true \
  --rpc-url "$DEST_RPC" --private-key "$PK" >/dev/null

echo "==> Allowlisting destination chain on the sender..."
cast send "$SENDER" "allowlistDestinationChain(uint64,bool)" "$DEST_SELECTOR" true \
  --rpc-url "$SOURCE_RPC" --private-key "$PK" >/dev/null

# ── 4. Fund the ProofSender with LINK for CCIP fees (source chain) ──────────
if [ "$LINK_FUND_AMOUNT" != "0" ]; then
  FUND_WEI="$(cast to-wei "$LINK_FUND_AMOUNT" ether)"
  LINK_BAL="$(cast call "$SOURCE_LINK" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$SOURCE_RPC" | awk '{print $1}')"
  echo "==> Funding ProofSender with $LINK_FUND_AMOUNT LINK (deployer LINK balance: $LINK_BAL wei)..."
  if [ "$(printf '%s\n' "$LINK_BAL" "$FUND_WEI" | sort -g | head -1)" = "$FUND_WEI" ]; then
    cast send "$SOURCE_LINK" "transfer(address,uint256)" "$SENDER" "$FUND_WEI" \
      --rpc-url "$SOURCE_RPC" --private-key "$PK" >/dev/null
    echo "    Funded."
  else
    echo "    SKIPPED — deployer has insufficient LINK on $SOURCE_CHAIN. Fund $SENDER manually."
  fi
fi

# ── 5. Wire addresses into .env.local ───────────────────────────────────────
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

set_env CCIP_ENABLED true
set_env CCIP_SOURCE_CHAIN "$SOURCE_CHAIN"
set_env CCIP_DEST_CHAIN "$DEST_CHAIN"
set_env PROOF_SENDER_ADDRESS "$SENDER"
set_env PROOF_RECEIVER_ADDRESS "$RECEIVER"
set_env CCIP_ROUTER_ADDRESS "$SOURCE_ROUTER"
set_env LINK_TOKEN_ADDRESS "$SOURCE_LINK"
set_env CCIP_DEST_CHAIN_SELECTOR "$DEST_SELECTOR"

echo ""
echo "Done. Wired CCIP addresses into .env.local."
echo "NEXT: fund the ProofSender with LINK on $SOURCE_CHAIN for CCIP fees:"
echo "  ProofSender: $SENDER"
echo "  LINK:        $SOURCE_LINK"
echo "Then restart 'npm run dev'."
