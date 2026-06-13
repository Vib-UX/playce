import { sleep } from "@/lib/utils";

/**
 * Stubbed whitelist / email-verification logic.
 * For the MVP, any verified email is eligible. A short list of domains is
 * treated as "pre-approved RSVPs" to show the pass-through path; everything
 * else still passes (open event) but you can flip `OPEN_EVENT` to false to
 * gate by the allowlist.
 */
const APPROVED_DOMAINS = ["base.org", "playce.xyz", "ethereum.org"];
const OPEN_EVENT = true;

export interface WhitelistResult {
  whitelisted: boolean;
  reason: string;
}

export async function checkWhitelist(email?: string): Promise<WhitelistResult> {
  await sleep(500);
  if (!email) {
    return { whitelisted: false, reason: "No email on file" };
  }
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (APPROVED_DOMAINS.includes(domain)) {
    return { whitelisted: true, reason: "Pre-approved RSVP" };
  }
  if (OPEN_EVENT) {
    return { whitelisted: true, reason: "Open event — all verified guests welcome" };
  }
  return { whitelisted: false, reason: "Not on the guest list" };
}
