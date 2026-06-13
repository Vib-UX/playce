#!/usr/bin/env bash
# Resolve RPC, USDC, and labels for Playce contract deploys.
# SETTLEMENT_CHAIN: sepolia (default) | base-sepolia | base
resolve_playce_chain() {
  local key="${SETTLEMENT_CHAIN:-${NEXT_PUBLIC_SETTLEMENT_CHAIN:-sepolia}}"

  case "$key" in
    base)
      RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"
      USDC_ADDRESS="${USDC_ADDRESS:-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}"
      CHAIN_LABEL="Base Mainnet"
      CHAIN_ID="8453"
      FAUCET_HINT="https://www.coinbase.com/ — bridge ETH to Base"
      PASS_ENV_KEY="BASE_MAINNET_PLAYCE_CONTRACT_ADDRESS"
      ESCROW_ENV_KEY="BASE_MAINNET_STAKE_ESCROW_ADDRESS"
      ;;
    base-sepolia)
      RPC_URL="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"
      USDC_ADDRESS="${USDC_ADDRESS:-0x036CbD53842c5426634e7929541eC2318f3dCF7e}"
      CHAIN_LABEL="Base Sepolia"
      CHAIN_ID="84532"
      FAUCET_HINT="https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet"
      PASS_ENV_KEY="BASE_SEPOLIA_PLAYCE_CONTRACT_ADDRESS"
      ESCROW_ENV_KEY="BASE_SEPOLIA_STAKE_ESCROW_ADDRESS"
      ;;
    *)
      RPC_URL="${SEPOLIA_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"
      USDC_ADDRESS="${USDC_ADDRESS:-0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238}"
      CHAIN_LABEL="Ethereum Sepolia"
      CHAIN_ID="11155111"
      FAUCET_HINT="https://sepoliafaucet.com"
      PASS_ENV_KEY="NEXT_PUBLIC_PLAYCE_CONTRACT_ADDRESS"
      ESCROW_ENV_KEY="STAKE_ESCROW_ADDRESS"
      ;;
  esac

  local active="${NEXT_PUBLIC_SETTLEMENT_CHAIN:-sepolia}"
  if [ "$key" = "$active" ]; then
    UPDATE_ACTIVE_ENV=1
  else
    UPDATE_ACTIVE_ENV=0
  fi
}
