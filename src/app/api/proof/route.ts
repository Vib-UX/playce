import { NextResponse } from "next/server";
import { isAddress, parseEventLogs } from "viem";
import { explorerTxUrl, ACTIVE_CHAIN } from "@/lib/chain";
import { playceAbi, onchainEventId } from "@/lib/poap-abi";
import { PROOF_EVENT_SLUG } from "@/lib/games/six-seven";
import { getSponsorById } from "@/lib/mock/sponsors";
import {
  ONCHAIN_ENABLED,
  PLAYCE_ADDRESS,
  publicClient,
  getMinterWallet,
} from "@/lib/server/minter";
import { PINATA_ENABLED, pinJSON } from "@/lib/server/pinata";
import { verifyPrivyWalletOwnership } from "@/lib/server/blink-signer";

export const runtime = "nodejs";

// The memory proof-of-presence clip ALWAYS direct-mints on the Base-mainnet
// settlement chain (the backend holds MINTER_ROLE). Chainlink CCIP is reserved
// for chain-battle WIN BADGES only (see /api/reward/claim), never the proof clip.
const PROOF_DESCRIPTION =
  "Proof of presence from The 67 at ETHGlobal NYC. A one-of-a-kind memory NFT " +
  "minted from a live 15-second gameplay clip.";

interface ProofBody {
  playerAddress?: string;
  roomCode?: string;
  clipIpfsUri?: string;
  clipGatewayUrl?: string;
  /** Sponsor the player repped (drives the proof's name + attributes). */
  sponsorId?: string;
}

function randomHex(length: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * 16)];
  }
  return out;
}

export async function POST(req: Request) {
  let body: ProofBody;
  try {
    body = (await req.json()) as ProofBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { playerAddress, roomCode, clipIpfsUri, clipGatewayUrl, sponsorId } =
    body;

  if (!playerAddress || !isAddress(playerAddress)) {
    return NextResponse.json(
      { error: "A valid playerAddress is required." },
      { status: 400 },
    );
  }

  // Verify the caller owns the wallet they're minting to. When Privy isn't
  // configured (local/dev), this returns a 503 which we treat as a pass so the
  // mock mint flow keeps working.
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const ownership = await verifyPrivyWalletOwnership(token, playerAddress);
  if (!ownership.ok && ownership.status !== 503) {
    return NextResponse.json(
      { error: ownership.error },
      { status: ownership.status },
    );
  }

  const room = (roomCode ?? "").toUpperCase().slice(0, 12);
  const isVideo = Boolean(clipIpfsUri);

  const sponsor = sponsorId ? getSponsorById(sponsorId) : undefined;
  const sponsorName = sponsor?.name ?? "Chainlink";
  const PROOF_NAME = `${sponsorName} — The 67 @ ETHGlobal NYC`;

  // Build + pin ERC-721 metadata. Falls back gracefully if Pinata isn't set up.
  let tokenURI = "";
  const image = clipGatewayUrl ?? "/models/ethglobal-nyc.glb";
  const animationUrl = isVideo ? clipGatewayUrl : undefined;

  const attributes = [
    { trait_type: "Event", value: "ETHGlobal NYC" },
    { trait_type: "Game", value: "The 67" },
    { trait_type: "Sponsor", value: sponsorName },
    { trait_type: "Result", value: "Proof of presence" },
    { trait_type: "Network", value: ACTIVE_CHAIN.name },
    ...(room ? [{ trait_type: "Room", value: room }] : []),
    { trait_type: "Media", value: isVideo ? "Video" : "Showcase" },
  ];

  if (PINATA_ENABLED) {
    try {
      const metadataJson: Record<string, unknown> = {
        name: PROOF_NAME,
        description: PROOF_DESCRIPTION,
        image: clipGatewayUrl ?? "/models/ethglobal-nyc.glb",
        attributes,
      };
      if (isVideo && clipIpfsUri) {
        metadataJson.animation_url = clipIpfsUri;
      }
      const pinnedMeta = await pinJSON(
        metadataJson,
        `playce-${PROOF_EVENT_SLUG}-${room || "room"}-${Date.now()}.json`,
      );
      tokenURI = pinnedMeta.ipfsUri;
    } catch (err) {
      console.error("[proof] metadata pin failed", err);
    }
  }

  // Unique on-chain event id per mint so the soulbound contract never reverts
  // with AlreadyClaimed for repeat players.
  const eventIdHash = onchainEventId(
    `${PROOF_EVENT_SLUG}#${room}#${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`,
  );

  // Mock fallback when no contract / minter is configured.
  if (!ONCHAIN_ENABLED || !PLAYCE_ADDRESS) {
    const txHash = `0x${randomHex(64)}`;
    const tokenId = String(Math.floor(1000 + Math.random() * 9000));
    return NextResponse.json({
      nft: {
        name: PROOF_NAME,
        image,
        animationUrl,
        txHash,
        blockExplorerUrl: explorerTxUrl(txHash),
        tokenId,
        metadataURI: tokenURI || `ipfs://bafy${randomHex(46)}`,
        onchain: false,
      },
      onchain: false,
    });
  }

  // Real onchain mint.
  try {
    const { walletClient } = getMinterWallet();
    const hash = await walletClient.writeContract({
      address: PLAYCE_ADDRESS,
      abi: playceAbi,
      functionName: "mintClaim",
      args: [playerAddress, eventIdHash, tokenURI],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({
      abi: playceAbi,
      logs: receipt.logs,
      eventName: "Claimed",
    });
    const tokenId = logs.length > 0 ? String(logs[0].args.tokenId) : "0";

    return NextResponse.json({
      nft: {
        name: PROOF_NAME,
        image,
        animationUrl,
        txHash: hash,
        blockExplorerUrl: explorerTxUrl(hash),
        tokenId,
        metadataURI: tokenURI,
        onchain: true,
      },
      onchain: true,
    });
  } catch (err) {
    console.error("[proof] mint failed", err);
    return NextResponse.json(
      { error: "Proof mint failed. Please try again." },
      { status: 500 },
    );
  }
}
