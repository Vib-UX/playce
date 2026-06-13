#!/usr/bin/env node
/**
 * Submit a Blink merchant application.
 *
 * Usage:
 *   BLINK_REGISTRATION_EMAIL=you@example.com \
 *   BLINK_REGISTRATION_DOMAIN=playce.app \
 *   BLINK_PUBLIC_KEY_PATH=secrets/blink-public.pem \
 *   BLINK_SANDBOX=1 node scripts/register-blink-merchant.mjs
 */
import fs from "node:fs";
import path from "node:path";

const email = process.env.BLINK_REGISTRATION_EMAIL;
const domain = process.env.BLINK_REGISTRATION_DOMAIN ?? "playce.app";
const telegram = process.env.BLINK_REGISTRATION_TELEGRAM;
const description =
  process.env.BLINK_REGISTRATION_DESCRIPTION ??
  "Playce is a venue-based social gaming app where attendees check in at real-world events, play head-to-head mini-games like The 67, and collect onchain rewards. Blink funds USDC stakes deposited into our escrow contract before winner-takes-all matches on Ethereum Sepolia.";
const sandbox = process.env.BLINK_SANDBOX === "1" || process.env.BLINK_SANDBOX === "true";
const apiBase = sandbox
  ? "https://api-sandbox.blink.cash"
  : "https://api.blink.cash";
const defaultKeyPath = sandbox
  ? path.join(process.cwd(), "secrets", "blink-sandbox-public.pem")
  : path.join(process.cwd(), "secrets", "blink-public.pem");
const publicKeyPath = process.env.BLINK_PUBLIC_KEY_PATH ?? defaultKeyPath;

if (!email) {
  console.error("Set BLINK_REGISTRATION_EMAIL before running.");
  process.exit(1);
}

if (description.length < 20 || description.length > 1000) {
  console.error("Description must be 20–1000 characters.");
  process.exit(1);
}

const publicKey = fs.readFileSync(publicKeyPath, "utf8");
const body = { email, domain, publicKey, description };
if (telegram) body.telegram = telegram;

console.log(`API: ${apiBase}`);
console.log("Request body (publicKey truncated):");
console.log(
  JSON.stringify({ ...body, publicKey: publicKey.slice(0, 40) + "…" }, null, 2),
);

const res = await fetch(`${apiBase}/v1/merchants/applications`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log(`\nStatus: ${res.status}`);
console.log(text);

if (!res.ok) process.exit(1);
