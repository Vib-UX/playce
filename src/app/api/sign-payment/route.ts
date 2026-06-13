import { NextResponse } from "next/server";
import {
  buildSignedResponse,
  parseStakeMetadata,
  validateSignerRequest,
  verifyPrivyWalletOwnership,
  type SignerRequestBody,
} from "@/lib/server/blink-signer";

export const runtime = "nodejs";

const MERCHANT_ID = process.env.MERCHANT_ID ?? "";
const MERCHANT_PRIVATE_KEY = process.env.MERCHANT_PRIVATE_KEY ?? "";
const STAKE_ESCROW_ADDRESS = process.env.STAKE_ESCROW_ADDRESS ?? "";

export async function POST(req: Request) {
  if (!MERCHANT_ID || !MERCHANT_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Blink merchant credentials are not configured." },
      { status: 503 },
    );
  }

  if (!STAKE_ESCROW_ADDRESS) {
    return NextResponse.json(
      { error: "Stake escrow is not deployed yet." },
      { status: 503 },
    );
  }

  let body: SignerRequestBody;
  try {
    body = (await req.json()) as SignerRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationErrors = validateSignerRequest(body, STAKE_ESCROW_ADDRESS);
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: validationErrors.join(" ") }, { status: 400 });
  }

  const stakeMeta = parseStakeMetadata(body.metadata);
  if (!stakeMeta) {
    return NextResponse.json(
      {
        error:
          "metadata must include roomCode (string), role (host|guest), and playerAddress (EVM address).",
      },
      { status: 400 },
    );
  }

  const authToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const ownership = await verifyPrivyWalletOwnership(authToken, stakeMeta.playerAddress);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  const response = buildSignedResponse(body, MERCHANT_ID, MERCHANT_PRIVATE_KEY);

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
