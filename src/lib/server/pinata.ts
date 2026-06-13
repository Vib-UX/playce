import "server-only";

/**
 * Server-only Pinata (IPFS) helpers.
 *
 * The captured "moment" photo and the resulting ERC-721 metadata JSON are pinned
 * here so the POAP's tokenURI can be a permanent `ipfs://…` reference. The Pinata
 * JWT is a secret — never import this from a client component.
 */

const PINATA_JWT = process.env.PINATA_JWT ?? "";
const RAW_GATEWAY =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? "https://gateway.pinata.cloud";

/** True when a Pinata JWT is configured and pinning is possible. */
export const PINATA_ENABLED = Boolean(PINATA_JWT);

const PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

/** Normalize the configured gateway to a bare origin (no trailing slash/path). */
function gatewayBase(): string {
  return RAW_GATEWAY.replace(/\/+$/, "").replace(/\/ipfs$/, "");
}

/** Build an HTTP gateway URL for a CID so browsers can render the content. */
export function gatewayUrl(cid: string): string {
  const clean = cid.replace(/^ipfs:\/\//, "");
  return `${gatewayBase()}/ipfs/${clean}`;
}

function assertEnabled(): void {
  if (!PINATA_ENABLED) {
    throw new Error("PINATA_JWT is not configured");
  }
}

export interface PinResult {
  cid: string;
  ipfsUri: string;
  gatewayUrl: string;
}

/** Pin a binary file (e.g. the captured photo) and return its CID. */
export async function pinFile(
  bytes: Uint8Array,
  filename: string,
  contentType: string,
): Promise<PinResult> {
  assertEnabled();

  const form = new FormData();
  const blob = new Blob([bytes as BlobPart], { type: contentType });
  form.append("file", blob, filename);
  form.append("pinataMetadata", JSON.stringify({ name: filename }));

  const res = await fetch(PIN_FILE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Pinata file pin failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { IpfsHash: string };
  return {
    cid: data.IpfsHash,
    ipfsUri: `ipfs://${data.IpfsHash}`,
    gatewayUrl: gatewayUrl(data.IpfsHash),
  };
}

/** Pin a JSON object (e.g. token metadata) and return its CID. */
export async function pinJSON(
  json: unknown,
  name: string,
): Promise<PinResult> {
  assertEnabled();

  const res = await fetch(PIN_JSON_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataMetadata: { name },
      pinataContent: json,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Pinata JSON pin failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { IpfsHash: string };
  return {
    cid: data.IpfsHash,
    ipfsUri: `ipfs://${data.IpfsHash}`,
    gatewayUrl: gatewayUrl(data.IpfsHash),
  };
}
