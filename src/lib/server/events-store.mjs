/**
 * User-created event registry — the "create your own event" backing store.
 *
 * Mirrors `chess-store.mjs` / `stake-registry.mjs`: a single process-local map
 * (shared via globalThis) used by the Next.js API routes and server components,
 * which all run inside the same `server.mjs` process. The map is the hot path;
 * every mutation writes through to Redis and `hydrateEventsStore()` re-hydrates
 * it on boot, so user events survive restarts/redeploys. Falls back to pure
 * in-memory when REDIS_URL is unset (fine for local dev/demo).
 *
 * Stored values are full `PlaycesEvent` objects (see `lib/types.ts`) plus an
 * internal `createdAt` timestamp used only for ordering.
 */
import { loadJSON, saveJSON } from "./redis.mjs";

const REDIS_KEY = "playces:events:user";

const GLOBAL_KEY = "__playces_user_events__";
if (!globalThis[GLOBAL_KEY]) {
  globalThis[GLOBAL_KEY] = new Map();
}
/** @type {Map<string, any>} keyed by event slug. */
const events = globalThis[GLOBAL_KEY];

let hydrated = false;

function slugKey(slug) {
  return String(slug ?? "").trim().toLowerCase();
}

/** Write-through the whole registry to Redis (fire-and-forget). */
function persist() {
  saveJSON(REDIS_KEY, Object.fromEntries(events));
}

/**
 * Reload user events from Redis into the in-memory map. Safe to call many
 * times — only the first call actually hydrates.
 * @returns {Promise<number>} number of events hydrated
 */
export async function hydrateEventsStore() {
  if (hydrated) return events.size;
  hydrated = true;
  const stored = await loadJSON(REDIS_KEY, null);
  if (!stored || typeof stored !== "object") return events.size;
  for (const [key, value] of Object.entries(stored)) {
    if (value && typeof value === "object" && !events.has(key)) {
      events.set(key, value);
    }
  }
  return events.size;
}

/**
 * All user-created events, newest first.
 * @returns {Promise<any[]>}
 */
export async function listUserEvents() {
  await hydrateEventsStore();
  return [...events.values()].sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );
}

/**
 * Look up a single user event by slug.
 * @param {string} slug
 * @returns {Promise<any | undefined>}
 */
export async function getUserEvent(slug) {
  await hydrateEventsStore();
  return events.get(slugKey(slug));
}

/**
 * Whether a slug is already taken by a user event.
 * @param {string} slug
 * @returns {Promise<boolean>}
 */
export async function userEventExists(slug) {
  await hydrateEventsStore();
  return events.has(slugKey(slug));
}

/**
 * Persist a freshly-built event. The caller is responsible for slug uniqueness
 * (use the service helper which checks mock + user slugs).
 * @param {any} event a full PlaycesEvent
 * @returns {Promise<any>} the stored event
 */
export async function saveUserEvent(event) {
  await hydrateEventsStore();
  const stored = { ...event, createdAt: event.createdAt ?? Date.now() };
  events.set(slugKey(stored.slug), stored);
  persist();
  return stored;
}

/**
 * Increment the RSVP counter on a user event ("Going").
 * @param {string} slug
 * @returns {Promise<number | null>} the new count, or null if not found
 */
export async function incrementRsvp(slug) {
  await hydrateEventsStore();
  const key = slugKey(slug);
  const event = events.get(key);
  if (!event) return null;
  event.rsvpCount = (event.rsvpCount ?? 0) + 1;
  events.set(key, event);
  persist();
  return event.rsvpCount;
}
