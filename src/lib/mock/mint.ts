import type { PlayceEvent, Claim, NFTMetadata } from "@/lib/types";
import { explorerTxUrl } from "@/lib/chain";
import { sleep } from "@/lib/utils";

function randomHex(length: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export interface MintResult {
  txHash: string;
  tokenId: string;
  metadata: NFTMetadata;
  claim: Claim;
}

export type MintProgressHandler = (
  phase: "preparing" | "signing" | "submitting" | "confirming",
) => void;

/**
 * Stubbed mint flow.
 *
 * Mirrors a real viem/wagmi `writeContract` + `waitForTransactionReceipt`
 * sequence so the UI states (preparing → signing → submitting → confirming →
 * success) are already wired. Replace the body with an actual contract call:
 *
 *   const hash = await walletClient.writeContract({
 *     address: PLAYCE_CONTRACT_ADDRESS,
 *     abi: playceAbi,
 *     functionName: "mintClaim",
 *     args: [to, eventId, metadataURI],
 *   });
 *   await publicClient.waitForTransactionReceipt({ hash });
 */
export async function mintReward(
  event: PlayceEvent,
  wallet: string,
  email: string | undefined,
  onProgress?: MintProgressHandler,
): Promise<MintResult> {
  onProgress?.("preparing");
  await sleep(700);

  onProgress?.("signing");
  await sleep(900);

  onProgress?.("submitting");
  const txHash = `0x${randomHex(64)}`;
  await sleep(800);

  onProgress?.("confirming");
  await sleep(1100);

  const tokenId = String(Math.floor(1000 + Math.random() * 9000));
  const metadataURI = `ipfs://bafy${randomHex(46)}`;

  const metadata: NFTMetadata = {
    tokenId,
    name: `${event.collectible.name} #${tokenId}`,
    description: event.collectible.description,
    image: metadataURI + "/image.glb",
    eventId: event.id,
    metadataURI,
    attributes: [
      { trait_type: "Event", value: event.title },
      { trait_type: "Edition", value: event.collectible.art.edition },
      { trait_type: "City", value: event.venue.city },
      { trait_type: "Variant", value: event.collectible.art.variant },
      { trait_type: "Network", value: "Base Sepolia" },
      { trait_type: "Verification", value: "Geo + Email" },
    ],
  };

  const claim: Claim = {
    id: `claim_${tokenId}`,
    eventId: event.id,
    eventSlug: event.slug,
    eventTitle: event.title,
    wallet,
    email,
    txHash,
    blockExplorerUrl: explorerTxUrl(txHash),
    claimedAtISO: new Date().toISOString(),
    metadata,
    art: event.collectible.art,
  };

  return { txHash, tokenId, metadata, claim };
}
