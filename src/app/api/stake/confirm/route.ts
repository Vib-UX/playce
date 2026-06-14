import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { STAKE_AMOUNT } from "@/lib/blink/config";
import { verifyPrivyWalletOwnership } from "@/lib/server/blink-signer";
import { creditStakeOnchain } from "@/lib/server/stake-escrow";
import { recordStake } from "@/lib/server/stake-registry.mjs";

export const runtime = "nodejs";

interface ConfirmBody {
  roomCode: string;
  role: "host" | "guest";
  playerAddress: string;
  amount: number;
  transferId: string;
  accessToken?: string;
}

export async function POST(req: Request) {
  let body: ConfirmBody;
  try {
    body = (await req.json()) as ConfirmBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { roomCode, role, playerAddress, amount, transferId, accessToken } = body;

  if (!roomCode || roomCode.length < 4) {
    return NextResponse.json({ error: "Invalid roomCode." }, { status: 400 });
  }
  if (role !== "host" && role !== "guest") {
    return NextResponse.json({ error: "role must be host or guest." }, { status: 400 });
  }
  if (!isAddress(playerAddress)) {
    return NextResponse.json({ error: "Invalid playerAddress." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount !== STAKE_AMOUNT) {
    return NextResponse.json(
      { error: `amount must be exactly ${STAKE_AMOUNT} USDC.` },
      { status: 400 },
    );
  }
  if (!transferId || typeof transferId !== "string") {
    return NextResponse.json({ error: "transferId is required." }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization");
  const token =
    accessToken ?? authHeader?.replace(/^Bearer\s+/i, "") ?? null;

  const ownership = await verifyPrivyWalletOwnership(token, playerAddress);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  // TODO: verify transferId against Blink API before production.
  const stake = {
    roomCode: roomCode.toUpperCase(),
    role,
    playerAddress,
    amount,
    transferId,
    confirmedAt: Date.now(),
  };

  recordStake(stake);

  // Dev/test: skip the real on-chain USDC credit — just record the seat as
  // staked so the game (solo or PvP) can start without any transaction.
  if (process.env.NEXT_PUBLIC_BLINK_DEV_MOCK_STAKE === "true") {
    return NextResponse.json({ ok: true, stake, onchainTx: null, mock: true });
  }

  let onchainTx: string | null = null;
  try {
    onchainTx = await creditStakeOnchain({
      roomCode: stake.roomCode,
      role,
      player: playerAddress,
      amount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "On-chain credit failed.";
    return NextResponse.json(
      {
        error: message,
        recorded: true,
        stake,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    stake,
    onchainTx,
  });
}
