#!/usr/bin/env node
/**
 * Generate an ECDSA P-256 key pair for Blink merchant signing.
 * Keys are written to secrets/ (git-ignored via *.pem).
 */
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "secrets");
fs.mkdirSync(dir, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});

const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
const publicPem = publicKey.export({ type: "spki", format: "pem" });

fs.writeFileSync(path.join(dir, "blink-private.pem"), privatePem);
fs.writeFileSync(path.join(dir, "blink-public.pem"), publicPem);

console.log("Wrote secrets/blink-private.pem and secrets/blink-public.pem");
