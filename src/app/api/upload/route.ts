import { NextResponse } from "next/server";
import { PINATA_ENABLED, pinFile } from "@/lib/server/pinata";

/**
 * Pins a captured "moment" to IPFS via Pinata.
 *
 * Two request shapes are supported:
 *  - JSON `{ dataUrl, filename }` — a base64 photo (canvas export).
 *  - multipart/form-data with a `file` field — a recorded video clip.
 *
 * Returns the CID / ipfs:// URI / gateway URL so the claim flow can use it as
 * the NFT media.
 */

interface UploadBody {
  dataUrl?: string;
  filename?: string;
}

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB
const MAX_VIDEO_BYTES = 40 * 1024 * 1024; // 40 MB — a short composited clip.

export async function POST(req: Request) {
  if (!PINATA_ENABLED) {
    return NextResponse.json(
      { error: "IPFS uploads are not configured (missing PINATA_JWT)." },
      { status: 503 },
    );
  }

  const reqContentType = req.headers.get("content-type") ?? "";

  // Video clips arrive as binary multipart form data.
  if (reqContentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Clip too large" }, { status: 413 });
    }
    const contentType = file.type || "video/webm";
    const ext = contentType.split("/")[1]?.split(";")[0] || "webm";
    const providedName =
      typeof form.get("filename") === "string"
        ? (form.get("filename") as string)
        : undefined;
    const name = providedName || `playces-moment-${Date.now()}.${ext}`;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await pinFile(bytes, name, contentType);
      return NextResponse.json({ ...result, mediaType: "video" });
    } catch (err) {
      console.error("[upload] video pin failed", err);
      return NextResponse.json(
        { error: "Failed to upload clip to IPFS. Please try again." },
        { status: 502 },
      );
    }
  }

  let body: UploadBody;
  try {
    body = (await req.json()) as UploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { dataUrl, filename } = body;
  if (!dataUrl || typeof dataUrl !== "string") {
    return NextResponse.json({ error: "Missing image data" }, { status: 400 });
  }

  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) {
    return NextResponse.json({ error: "Unsupported image format" }, { status: 400 });
  }

  const contentType = match[1] || "image/png";
  const isBase64 = Boolean(match[2]);
  const payload = match[3];

  const bytes = isBase64
    ? new Uint8Array(Buffer.from(payload, "base64"))
    : new Uint8Array(Buffer.from(decodeURIComponent(payload), "utf-8"));

  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "Empty image" }, { status: 400 });
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  try {
    const ext = contentType.split("/")[1]?.split("+")[0] || "png";
    const name = filename || `playces-moment-${Date.now()}.${ext}`;
    const result = await pinFile(bytes, name, contentType);
    return NextResponse.json({ ...result, mediaType: "image" });
  } catch (err) {
    console.error("[upload] pin failed", err);
    return NextResponse.json(
      { error: "Failed to upload to IPFS. Please try again." },
      { status: 502 },
    );
  }
}
