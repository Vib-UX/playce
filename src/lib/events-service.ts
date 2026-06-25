/**
 * Server-only event resolver. This is the single source of truth for reading
 * events across the app: it merges the bundled mock catalog (`lib/mock/events`)
 * with user-created events from the Redis-backed store (`server/events-store`).
 *
 * Import this only from server components and route handlers — never from a
 * client component (it pulls in the server store + Node Redis client).
 */
import type { PlaycesEvent } from "@/lib/types";
import { EVENTS, getEventBySlug as getMockEventBySlug } from "@/lib/mock/events";
import { getGamesByIds } from "@/lib/mock/games";
import {
  listUserEvents,
  getUserEvent,
  userEventExists,
  saveUserEvent,
} from "@/lib/server/events-store.mjs";

/** The shape the create form/API submits. */
export interface CreateEventInput {
  title: string;
  tagline?: string;
  description?: string;
  kind?: string;
  startISO: string;
  endISO?: string;
  timezone?: string;
  venue?: {
    name?: string;
    addressLine?: string;
    city?: string;
    country?: string;
    lat?: number;
    lng?: number;
    radiusMeters?: number;
  };
  capacity?: number;
  coverImageUrl?: string;
  coverImageColor?: string;
  gameIds?: string[];
}

const SLUG_MAX = 60;
const DEFAULT_COVER_COLORS = [
  "#c2ff3d",
  "#18d9c0",
  "#ff7a3d",
  "#7c5cff",
  "#ff5c8a",
  "#3da5ff",
];

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
}

/** A slug is taken if a mock event or a stored user event already uses it. */
async function slugTaken(slug: string): Promise<boolean> {
  if (getMockEventBySlug(slug)) return true;
  return userEventExists(slug);
}

/** Pick a unique slug derived from the title (adds a numeric suffix on clash). */
async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || `event-${Date.now().toString(36)}`;
  if (!(await slugTaken(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`.slice(0, SLUG_MAX);
    if (!(await slugTaken(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/**
 * Map the create form input onto a full `PlaycesEvent`, filling in sensible
 * defaults for the rich fields a casual host won't provide (sponsors, airdrops,
 * speakers, collectible art, etc.).
 */
async function buildEvent(
  input: CreateEventInput,
  creator: { id?: string; handle?: string },
): Promise<PlaycesEvent> {
  const slug = await uniqueSlug(input.title);
  const id = `evt_user_${slug.replace(/-/g, "_")}`;
  const start = input.startISO;
  const end = input.endISO && input.endISO.length > 0 ? input.endISO : start;
  const hostName = creator.handle || "Host";
  const hue = hashHue(slug);

  const validGameIds = getGamesByIds(input.gameIds ?? []).map((g) => g.id);
  const coverColor =
    input.coverImageColor ||
    DEFAULT_COVER_COLORS[hashHue(id) % DEFAULT_COVER_COLORS.length];

  return {
    id,
    slug,
    title: input.title.trim(),
    tagline: (input.tagline ?? "").trim() || "An event on Playces.",
    description:
      (input.description ?? "").trim() ||
      "Join this event on Playces. Check in, play head-to-head games, and earn onchain moments.",
    coverImageColor: coverColor,
    coverImageUrl: input.coverImageUrl?.trim() || undefined,
    kind: (input.kind ?? "").trim() || "Meetup",
    startISO: start,
    endISO: end,
    timezone: input.timezone?.trim() || "UTC",
    venue: {
      name: input.venue?.name?.trim() || "Online",
      addressLine: input.venue?.addressLine?.trim() || "",
      city: input.venue?.city?.trim() || "Online",
      country: input.venue?.country?.trim() || "",
      center: {
        lat: Number.isFinite(input.venue?.lat) ? Number(input.venue?.lat) : 0,
        lng: Number.isFinite(input.venue?.lng) ? Number(input.venue?.lng) : 0,
      },
      radiusMeters:
        Number.isFinite(input.venue?.radiusMeters) &&
        Number(input.venue?.radiusMeters) > 0
          ? Number(input.venue?.radiusMeters)
          : 500,
    },
    hosts: [{ id: "host", name: hostName, role: "Host" }],
    speakers: [],
    schedule: [],
    rsvpCount: 0,
    claimCount: 0,
    verifiedCount: 0,
    capacity:
      Number.isFinite(input.capacity) && Number(input.capacity) > 0
        ? Math.floor(Number(input.capacity))
        : 100,
    sponsorIds: [],
    gameIds: validGameIds,
    airdrops: [],
    collectible: {
      name: `${input.title.trim()} — Playces Moment`,
      symbol: slug.slice(0, 8).toUpperCase().replace(/-/g, ""),
      description: `A verified onchain reward from ${input.title.trim()}.`,
      art: {
        hue,
        accentHue: (hue + 40) % 360,
        edition: new Date(start).getFullYear().toString(),
        variant: "prism",
      },
    },
    chainId: 11155111,
    source: "user",
    createdBy: creator.id || creator.handle || undefined,
  };
}

/** Validate required input. Returns a list of human-readable errors (empty = ok). */
export function validateCreateInput(input: Partial<CreateEventInput>): string[] {
  const errors: string[] = [];
  if (!input.title || input.title.trim().length < 3) {
    errors.push("Title must be at least 3 characters.");
  }
  if (input.title && input.title.trim().length > 120) {
    errors.push("Title must be 120 characters or fewer.");
  }
  if (!input.startISO || Number.isNaN(Date.parse(input.startISO))) {
    errors.push("A valid start date/time is required.");
  }
  if (input.endISO && Number.isNaN(Date.parse(input.endISO))) {
    errors.push("End date/time is invalid.");
  }
  if (
    input.startISO &&
    input.endISO &&
    !Number.isNaN(Date.parse(input.startISO)) &&
    !Number.isNaN(Date.parse(input.endISO)) &&
    Date.parse(input.endISO) < Date.parse(input.startISO)
  ) {
    errors.push("End must be after the start.");
  }
  return errors;
}

/** Build + persist a user event. Caller must validate first. */
export async function createUserEvent(
  input: CreateEventInput,
  creator: { id?: string; handle?: string },
): Promise<PlaycesEvent> {
  const event = await buildEvent(input, creator);
  await saveUserEvent(event);
  return event;
}

/** Mock events tagged with their source so the UI can branch on it. */
function mockEvents(): PlaycesEvent[] {
  return EVENTS.map((e) => ({ ...e, source: "mock" as const }));
}

/** All events: user-created (newest first) followed by the bundled catalog. */
export async function getAllEvents(): Promise<PlaycesEvent[]> {
  const user = (await listUserEvents()) as PlaycesEvent[];
  return [...user, ...mockEvents()];
}

/** Resolve an event by slug from either source (mock first, then user). */
export async function getEventBySlugAny(
  slug: string,
): Promise<PlaycesEvent | undefined> {
  const mock = getMockEventBySlug(slug);
  if (mock) return { ...mock, source: "mock" };
  const user = (await getUserEvent(slug)) as PlaycesEvent | undefined;
  return user;
}
