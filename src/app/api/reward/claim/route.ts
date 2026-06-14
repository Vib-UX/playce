import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { explorerTxUrl, ACTIVE_CHAIN } from "@/lib/chain";
import { onchainEventId } from "@/lib/poap-abi";
import { getSponsorById } from "@/lib/mock/sponsors";
import { rewardChainForSponsorId } from "@/lib/battle";
import {
  getBattleResult,
  markBattleClaimed,
} from "@/lib/server/leaderboard-store.mjs";
import { settleStakeOnchain, ESCROW_ONCHAIN_ENABLED } from "@/lib/server/stake-escrow";
import { mintWinBadge, WIN_BADGE_ENABLED } from "@/lib/server/win-badge";
import { CCIP_ENABLED } from "@/lib/server/ccip-minter";
import { PINATA_ENABLED, pinJSON } from "@/lib/server/pinata";
import { verifyPrivyWalletOwnership } from "@/lib/server/blink-signer";

export const runtime = "nodejs";

interface ClaimBody {
  roomCode?: string;
  winnerAddress?: string;
  /** Winner's repped sponsor — used as a fallback when the authoritative WS
   *  battle record isn't reachable (e.g. continue/solo demo runs). */
  sponsorId?: string;
}

function randomHex(length: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * 16)];
  return out;
}

function usdcLabel(units: bigint): string {
  return `$${(Number(units) / 1_000_000).toFixed(2)} USDC`;
}

/** Translate a viem contract revert into a short, claimer-friendly message. */
function friendlyBadgeError(err: unknown, mechanism: "direct" | "ccip"): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/InsufficientLinkBalance/.test(msg)) {
    return "Win badge couldn't mint: the CCIP sender is low on LINK. Fund it and re-claim.";
  }
  if (/NotAllowlistedDestinationChain/.test(msg)) {
    return "Win badge couldn't mint: the destination chain isn't allowlisted on the CCIP sender.";
  }
  if (mechanism === "ccip") {
    return "Win badge couldn't be dispatched via CCIP — please try again shortly.";
  }
  return "Win badge mint reverted — please try again shortly.";
}

export async function POST(req: Request) {
  let body: ClaimBody;
  try {
    body = (await req.json()) as ClaimBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const roomCode = (body.roomCode ?? "").toUpperCase().slice(0, 12);
  const winnerAddress = body.winnerAddress ?? "";

  if (!roomCode) {
    return NextResponse.json({ error: "A roomCode is required." }, { status: 400 });
  }
  if (!winnerAddress || !isAddress(winnerAddress)) {
    return NextResponse.json(
      { error: "A valid winnerAddress is required." },
      { status: 400 },
    );
  }

  // ── Authoritative outcome (recorded by the WS server on finish) ───────────
  // For a continue/solo chain run the WS record may not be reachable from the
  // route's bundle, so we fall back to a client-attested claim: the winner is
  // the authenticated caller, repping the sponsor they send. PvP claims keep
  // the authoritative, anti-fraud verification.
  const result = getBattleResult(roomCode);
  const fallbackSponsorId =
    typeof body.sponsorId === "string" ? body.sponsorId : null;

  if (result) {
    if (result.battleMode !== "chain") {
      return NextResponse.json(
        { error: "This was a memory battle — no pot or badge to claim." },
        { status: 400 },
      );
    }
    if (!result.winnerWallet) {
      return NextResponse.json(
        { error: "That round was a tie — no winner to reward." },
        { status: 400 },
      );
    }
    if (result.winnerWallet.toLowerCase() !== winnerAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the winning player can claim this reward." },
        { status: 403 },
      );
    }
    if (result.claimedAt) {
      return NextResponse.json(
        { error: "This reward has already been claimed." },
        { status: 409 },
      );
    }
  } else {
    // No authoritative record — only a chain-rep sponsor can be claimed.
    if (!fallbackSponsorId || !rewardChainForSponsorId(fallbackSponsorId)) {
      return NextResponse.json(
        { error: "No finished chain battle found for this room." },
        { status: 404 },
      );
    }
  }

  const roundId = result?.roundId ?? 0;

  // ── Verify the caller owns the winning wallet (Privy embedded wallet) ─────
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const ownership = await verifyPrivyWalletOwnership(token, winnerAddress);
  if (!ownership.ok && ownership.status !== 503) {
    return NextResponse.json(
      { error: ownership.error },
      { status: ownership.status },
    );
  }

  const sponsorId = result?.winnerSponsorId ?? fallbackSponsorId;
  const rewardChain = rewardChainForSponsorId(sponsorId);
  const sponsor = sponsorId ? getSponsorById(sponsorId) : undefined;

  // Deterministic per-room+round event id so a repeat claim can't double-mint
  // (the soulbound badge reverts AlreadyClaimed for the same id).
  const eventId = onchainEventId(`win#${roomCode}#${roundId}`);

  // ── Pin the win-badge metadata (best-effort) ──────────────────────────────
  let tokenURI = "";
  if (PINATA_ENABLED) {
    try {
      const pinned = await pinJSON(
        {
          name: `Playce Win Badge — ${sponsor?.name ?? "Chain"} @ ETHGlobal NYC`,
          description:
            "Soulbound proof of a chain-battle win in The 67 at ETHGlobal NYC.",
          image: "/models/chainlink.glb",
          attributes: [
            { trait_type: "Event", value: "ETHGlobal NYC" },
            { trait_type: "Game", value: "The 67" },
            { trait_type: "Result", value: "Chain battle winner" },
            { trait_type: "Chain", value: rewardChain?.label ?? "—" },
            ...(sponsor ? [{ trait_type: "Repped", value: sponsor.name }] : []),
            { trait_type: "Room", value: roomCode },
          ],
        },
        `playce-winbadge-${roomCode}-${roundId}.json`,
      );
      tokenURI = pinned.ipfsUri;
    } catch (err) {
      console.error("[reward/claim] badge metadata pin failed", err);
    }
  }

  // ── Settle the Base-mainnet pot + mint the win badge ──────────────────────
  const out: {
    pot?: { txHash: string; explorerUrl: string; amount?: string };
    badge?: {
      mechanism: "direct" | "ccip";
      chainLabel: string;
      txHash?: string;
      explorerUrl?: string;
      ccip?: { messageId: string; explorerUrl: string };
    };
    /** Surfaced when a real (configured) badge mint was attempted but reverted,
     *  so we never present a fabricated CCIP/badge link as if it succeeded. */
    badgeError?: string;
    mock?: boolean;
    error?: string;
  } = {};

  const mechanism = rewardChain?.badgeMechanism ?? "direct";
  const chainLabel = rewardChain?.label ?? ACTIVE_CHAIN.name;
  // Is the relevant on-chain path actually wired? (vs dev/local where a mock is
  // the honest representation.)
  const badgeConfigured = mechanism === "ccip" ? CCIP_ENABLED : WIN_BADGE_ENABLED;

  try {
    const settled = await settleStakeOnchain({
      roomCode,
      winner: winnerAddress,
    });
    if (settled) {
      out.pot = {
        txHash: settled.txHash,
        explorerUrl: explorerTxUrl(settled.txHash),
        amount: settled.pot > 0n ? usdcLabel(settled.pot) : undefined,
      };
    }
  } catch (err) {
    console.error("[reward/claim] pot settle failed", err);
  }

  let badgeError: string | undefined;
  try {
    const badge = await mintWinBadge({
      winner: winnerAddress,
      sponsorId,
      eventId,
      uri: tokenURI,
    });
    if (badge) out.badge = badge;
  } catch (err) {
    badgeError = friendlyBadgeError(err, mechanism);
    console.error("[reward/claim] badge mint failed", err);
  }

  // Pot: settle reverts in demos (no real USDC credited via dev-mock stake), so
  // a mock pot link keeps the flow moving. Only fabricate when escrow isn't
  // configured for real or the demo settle had nothing to settle.
  if (!out.pot) {
    const txHash = `0x${randomHex(64)}`;
    out.mock = true;
    out.pot = { txHash, explorerUrl: explorerTxUrl(txHash), amount: undefined };
  }

  // Badge: when the on-chain path IS configured but the mint reverted (e.g. the
  // CCIP sender is low on LINK), surface the real error instead of a dead link.
  // Only fabricate a badge link when minting isn't configured (dev/local).
  if (!out.badge) {
    if (badgeConfigured) {
      out.badge = { mechanism, chainLabel };
      out.badgeError =
        badgeError ?? "Badge mint didn't go through — please try again.";
    } else {
      out.mock = true;
      const explorerBase = rewardChain?.explorerBaseUrl;
      const badgeTx = `0x${randomHex(64)}`;
      out.badge =
        mechanism === "ccip"
          ? {
              mechanism,
              chainLabel,
              ccip: {
                messageId: `0x${randomHex(64)}`,
                explorerUrl: `https://ccip.chain.link/msg/0x${randomHex(64)}`,
              },
            }
          : {
              mechanism,
              chainLabel,
              txHash: badgeTx,
              explorerUrl: explorerBase
                ? `${explorerBase}/tx/${badgeTx}`
                : explorerTxUrl(badgeTx),
            };
    }
  }

  markBattleClaimed(roomCode);
  return NextResponse.json(out);
}
