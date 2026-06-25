"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Deposit,
  getDisplayMessage,
  type DepositError,
  type DepositResult,
  type SignerRequest,
} from "@swype-org/deposit";
import { getEmbeddedConnectedWallet, useWallets } from "@privy-io/react-auth";
import { usePlaycesAuth } from "@/lib/auth/context";
import { ACTIVE_CHAIN, isWalletOnActiveChain } from "@/lib/chain";
import { announcePrivyWallet } from "@/lib/blink/announce-privy-wallet";
import {
  getBlinkStakingWallet,
  isExternalWallet,
} from "@/lib/blink/staking-wallet";
import { prepareNativeMetaMaskForBlink } from "@/lib/blink/metamask-prep";
import {
  BLINK_CHAIN_ID,
  BLINK_ENVIRONMENT,
  BLINK_MERCHANT_ID,
  BLINK_USDC_ADDRESS,
  STAKE_ESCROW_ADDRESS,
} from "@/lib/blink/config";

export interface StakeDepositParams {
  amount: number;
  roomCode: string;
  role: "host" | "guest";
}

type DepositStatus = "idle" | "signer-loading" | "iframe-active" | "completed" | "error";

/**
 * Manages the Blink Deposit instance lifecycle directly instead of the SDK's
 * useBlinkDeposit hook, which can call `.on()` on a null ref after Fast Refresh
 * or Strict Mode cleanup.
 */
export function useStakeDeposit() {
  const { wallet, getAccessToken, mode, authenticated } = usePlaycesAuth();
  const { ready: walletsReady, wallets } = useWallets();
  // Privy-owned address used for stake attribution + server ownership checks.
  // The embedded Playces wallet is always linked; Blink funds from MetaMask in
  // its own picker, so this stays independent of the funding wallet.
  const playerAddress = getEmbeddedConnectedWallet(wallets)?.address ?? wallet;
  const depositRef = useRef<Deposit | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [result, setResult] = useState<DepositResult | null>(null);
  const [error, setError] = useState<DepositError | null>(null);

  const signer = useCallback(
    async (data: SignerRequest) => {
      const token = await getAccessToken();
      const res = await fetch("/api/sign-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err.error === "string" ? err.error : `Signer error: ${res.status}`,
        );
      }
      return res.json();
    },
    [getAccessToken],
  );

  useEffect(() => {
    const deposit = new Deposit({
      signer,
      merchantId: BLINK_MERCHANT_ID || undefined,
      environment: BLINK_ENVIRONMENT,
      debug: process.env.NODE_ENV === "development",
      preload: false,
      // Full widget exposes "pay from any wallet / exchange" deposit options so
      // users aren't forced into the passkey-gated one-tap flow. Requires the
      // full widget to also be enabled on the Blink merchant account.
      enableFullWidget: true,
    });
    depositRef.current = deposit;
    setReady(true);

    const onStatusChange = (s: DepositStatus) => setStatus(s);
    const onComplete = (r: DepositResult) => {
      setResult(r);
      setError(null);
    };
    const onError = (e: DepositError) => setError(e);

    deposit.on("status-change", onStatusChange);
    deposit.on("complete", onComplete);
    deposit.on("error", onError);

    return () => {
      deposit.off("status-change", onStatusChange);
      deposit.off("complete", onComplete);
      deposit.off("error", onError);
      deposit.destroy();
      depositRef.current = null;
      setReady(false);
    };
  }, [signer]);

  const requestDeposit = useCallback(
    (request: Parameters<Deposit["requestDeposit"]>[0]) => {
      const deposit = depositRef.current;
      if (!deposit) {
        return Promise.reject(new Error("Deposit is not ready yet."));
      }
      return deposit.requestDeposit(request);
    },
    [],
  );

  const canStake =
    ready &&
    walletsReady &&
    mode === "privy" &&
    authenticated &&
    Boolean(wallet) &&
    Boolean(getBlinkStakingWallet(wallets, wallet)) &&
    Boolean(BLINK_MERCHANT_ID) &&
    Boolean(STAKE_ESCROW_ADDRESS);

  const prepareWalletForBlink = useCallback(async () => {
    const stakingWallet = getBlinkStakingWallet(wallets, wallet);
    if (!stakingWallet) {
      throw new Error(
        "Connect MetaMask (or another wallet) to your Playces account before staking.",
      );
    }

    if (isExternalWallet(stakingWallet)) {
      // Blink uses native MetaMask via EIP-6963 — switch chain there, not via Privy.
      await prepareNativeMetaMaskForBlink(stakingWallet.address);
    } else {
      if (!isWalletOnActiveChain(stakingWallet.chainId)) {
        await stakingWallet.switchChain(ACTIVE_CHAIN.id);
      }
      const provider = await stakingWallet.getEthereumProvider();
      announcePrivyWallet(provider, stakingWallet.address);
    }

    return stakingWallet;
  }, [wallets, wallet]);

  const stake = useCallback(
    async ({ amount, roomCode, role }: StakeDepositParams) => {
      if (!wallet) throw new Error("Connect a wallet before staking.");
      if (!STAKE_ESCROW_ADDRESS) {
        throw new Error("Stake escrow is not configured.");
      }

      await prepareWalletForBlink();

      const ownedAddress = playerAddress;
      if (!ownedAddress) {
        throw new Error("No Playces wallet found for stake attribution.");
      }

      return requestDeposit({
        amount,
        chainId: BLINK_CHAIN_ID,
        address: STAKE_ESCROW_ADDRESS,
        token: BLINK_USDC_ADDRESS,
        callbackScheme: null,
        reference: `67-${roomCode}-${role}`,
        metadata: {
          roomCode: roomCode.toUpperCase(),
          role,
          playerAddress: ownedAddress,
        },
      });
    },
    [wallet, playerAddress, requestDeposit, prepareWalletForBlink],
  );

  const displayMessage = error ? getDisplayMessage(error) : null;
  const isActive = status === "signer-loading" || status === "iframe-active";

  return useMemo(
    () => ({
      status,
      result,
      error,
      displayMessage,
      isActive,
      canStake,
      stake,
      wallet,
      playerAddress,
    }),
    [
      status,
      result,
      error,
      displayMessage,
      isActive,
      canStake,
      stake,
      wallet,
      playerAddress,
    ],
  );
}
