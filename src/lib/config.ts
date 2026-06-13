/**
 * App-wide toggles.
 *
 * ALLOW_MULTIPLE_CLAIMS: when true, a wallet can claim the same event more than
 * once. This is a testing convenience — it relaxes the frontend "already
 * claimed" gate and the backend duplicate check, and makes each onchain mint use
 * a unique event-id hash so the soulbound contract never reverts with
 * AlreadyClaimed. Set to `false` to enforce one POAP per (event, wallet).
 */
export const ALLOW_MULTIPLE_CLAIMS = true;
