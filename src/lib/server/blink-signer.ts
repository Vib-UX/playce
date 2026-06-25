/**
 * Blink signer helpers — validation, payload signing, Privy wallet checks.
 */

import { createSign, randomUUID } from "node:crypto";
import { isAddress } from "viem";
import { ACTIVE_CHAIN, ACTIVE_USDC } from "@/lib/chain";
import {
  MIN_STAKE_AMOUNT,
  MAX_STAKE_AMOUNT,
  isValidStakeAmount,
} from "@/lib/blink/config";

export const BLINK_CHAIN_ID = ACTIVE_CHAIN.id;
export const BLINK_USDC = ACTIVE_USDC;

export interface SignerRequestBody {
  amount: number;
  chainId: number;
  address: string;
  token: string;
  callbackScheme?: string | null;
  url?: string;
  version?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface StakeMetadata {
  roomCode: string;
  role: "host" | "guest";
  playerAddress: string;
}

export function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function signPayload(payload: string, privateKeyPem: string): string {
  const signer = createSign("SHA256");
  signer.update(payload);
  signer.end();
  return signer.sign(privateKeyPem).toString("base64url");
}

export function validateSignerRequest(
  body: SignerRequestBody,
  escrowAddress: string,
  expectedAmount?: number,
): string[] {
  const errors: string[] = [];
  const { amount, chainId, address, token, callbackScheme } = body;

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push("amount must be a positive number.");
  }
  if (!isValidStakeAmount(amount)) {
    errors.push(
      `amount must be between ${MIN_STAKE_AMOUNT} and ${MAX_STAKE_AMOUNT} USDC.`,
    );
  }
  // When the room's agreed stake is known, enforce it exactly so both seats
  // deposit the same amount the host configured.
  if (
    typeof expectedAmount === "number" &&
    Math.abs(amount - expectedAmount) > 1e-9
  ) {
    errors.push(`amount must be exactly ${expectedAmount} USDC for this room.`);
  }
  if (!Number.isInteger(chainId) || chainId <= 0) {
    errors.push("chainId must be a positive integer.");
  }
  if (chainId !== BLINK_CHAIN_ID) {
    errors.push(`chainId must be ${BLINK_CHAIN_ID} (${ACTIVE_CHAIN.name}).`);
  }
  if (!isAddress(address)) {
    errors.push("address must be a valid EVM address.");
  }
  if (escrowAddress && address.toLowerCase() !== escrowAddress.toLowerCase()) {
    errors.push("address must be the configured stake escrow contract.");
  }
  if (typeof token !== "string" || token.toLowerCase() !== BLINK_USDC.toLowerCase()) {
    errors.push(`token must be ${ACTIVE_CHAIN.name} USDC.`);
  }
  if (
    callbackScheme !== null &&
    callbackScheme !== undefined &&
    (typeof callbackScheme !== "string" ||
      !/^[a-zA-Z][a-zA-Z0-9+\-.]*$/.test(callbackScheme))
  ) {
    errors.push("callbackScheme must be null or a valid URI scheme.");
  }
  if (callbackScheme !== null && callbackScheme !== undefined) {
    errors.push("callbackScheme must be null for web integrations.");
  }

  return errors;
}

export function parseStakeMetadata(
  metadata: Record<string, unknown> | undefined,
): StakeMetadata | null {
  if (!metadata) return null;
  const roomCode = metadata.roomCode;
  const role = metadata.role;
  const playerAddress = metadata.playerAddress;
  if (typeof roomCode !== "string" || roomCode.length < 4) return null;
  if (role !== "host" && role !== "guest") return null;
  if (typeof playerAddress !== "string" || !isAddress(playerAddress, { strict: false })) {
    return null;
  }
  return {
    roomCode: roomCode.toUpperCase(),
    role,
    playerAddress: playerAddress.toLowerCase(),
  };
}

export function buildSignedResponse(
  request: SignerRequestBody,
  merchantId: string,
  privateKeyPem: string,
) {
  const {
    amount,
    chainId,
    address,
    token,
    callbackScheme = null,
    version = "v1",
  } = request;

  const idempotencyKey = randomUUID();
  const signatureTimestamp = new Date().toISOString();

  const payloadObject = {
    amount,
    chainId,
    address,
    token,
    idempotencyKey,
    callbackScheme,
    signatureTimestamp,
    version,
  };

  const payload = encodeBase64Url(JSON.stringify(payloadObject));
  const signature = signPayload(payload, privateKeyPem);

  return {
    merchantId,
    payload,
    signature,
    preview: { amount, chainId, address, token, idempotencyKey },
  };
}

/**
 * Authenticate a caller by their Privy token, returning their identity. Unlike
 * `verifyPrivyWalletOwnership` this isn't tied to a specific wallet — it just
 * confirms the user is signed in (used for create-event style actions).
 *
 * When Privy isn't configured (local/dev) this returns `{ ok: true,
 * configured: false }` so the flow still works without secrets.
 */
export async function verifyPrivyAuth(
  authToken: string | null,
): Promise<
  | {
      ok: true;
      configured: boolean;
      userId?: string;
      email?: string;
      wallet?: string;
    }
  | { ok: false; status: number; error: string }
> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  const appSecret = process.env.PRIVY_APP_SECRET ?? "";

  if (!appId || !appSecret) {
    return { ok: true, configured: false };
  }
  if (!authToken) {
    return { ok: false, status: 401, error: "Sign in to continue." };
  }

  try {
    const { PrivyClient } = await import("@privy-io/server-auth");
    const privy = new PrivyClient(appId, appSecret);
    const { userId } = await privy.verifyAuthToken(authToken);
    const user = await privy.getUser(userId);

    const email = user.linkedAccounts.find((a) => a.type === "email")?.address;
    const wallet = user.linkedAccounts
      .filter((a) => a.type === "wallet")
      .map((a) => a.address)[0];

    return { ok: true, configured: true, userId, email, wallet };
  } catch {
    return { ok: false, status: 401, error: "Invalid authorization token." };
  }
}

export async function verifyPrivyWalletOwnership(
  authToken: string | null,
  requestedAddress: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  const appSecret = process.env.PRIVY_APP_SECRET ?? "";

  if (!appId || !appSecret) {
    return { ok: false, status: 503, error: "Privy is not configured for staking." };
  }
  if (!authToken) {
    return { ok: false, status: 401, error: "Missing authorization token." };
  }

  try {
    const { PrivyClient } = await import("@privy-io/server-auth");
    const privy = new PrivyClient(appId, appSecret);
    const { userId } = await privy.verifyAuthToken(authToken);
    const user = await privy.getUser(userId);

    const userWallets = user.linkedAccounts
      .filter((a) => a.type === "wallet")
      .map((a) => a.address.toLowerCase());

    if (!userWallets.includes(requestedAddress.toLowerCase())) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[blink-signer] ownership mismatch — requested:",
          requestedAddress.toLowerCase(),
          "| linked wallets:",
          userWallets,
        );
      }
      return {
        ok: false,
        status: 403,
        error:
          "This wallet isn't linked to your Playces account. Connect & link it in Privy (or stake from your Playces embedded wallet) before staking.",
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, status: 401, error: "Invalid authorization token." };
  }
}
