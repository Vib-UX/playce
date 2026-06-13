import type { PlayceEvent } from "@/lib/types";

/**
 * Polished placeholder data for the flagship Playce venue plus a few supporting
 * venues for the gallery / landing surfaces. Swap with a real CMS or onchain
 * registry later — the shape matches `PlayceEvent`. Sponsors and games are
 * referenced by id (see `mock/sponsors.ts` and `mock/games.ts`).
 */
export const EVENTS: PlayceEvent[] = [
  {
    id: "evt_base_house_nyc",
    slug: "base-house-nyc",
    title: "Playce House NYC",
    tagline: "Show up, play head-to-head, and earn at the IRL arena.",
    description:
      "Playce House is a one-night social arena where the room becomes the game. Check in, rep your favorite chain, throw the 67 against other attendees for a staked pot, and unlock sponsor airdrops from Chainlink, Pyth, and Blink. Win your moment and collect it onchain.",
    coverImageColor: "#ff2e88",
    coverImageUrl: "/events/base-house-nyc.png",
    kind: "Playce Night",
    startISO: "2026-06-18T18:00:00-04:00",
    endISO: "2026-06-18T23:30:00-04:00",
    timezone: "America/New_York",
    venue: {
      name: "50 W 23rd St — 4th Floor",
      addressLine: "50 W 23rd St, 4th floor",
      city: "New York",
      country: "USA",
      center: { lat: 40.7423, lng: -73.9906 },
      radiusMeters: 200,
    },
    hosts: [
      { id: "h1", name: "Playce", role: "Host", handle: "@playce" },
      {
        id: "h2",
        name: "Cortex Global",
        role: "Co-host",
        handle: "@cortexglobal",
      },
      {
        id: "h3",
        name: "Ava Lindqvist",
        role: "Curator",
        handle: "@avabuilds",
      },
    ],
    speakers: [
      { id: "s1", name: "Keone Hon", title: "On real-time onchain games" },
      {
        id: "s2",
        name: "Priya Raman",
        title: "Embedded wallets for the next billion",
      },
      { id: "s3", name: "Marcus Cole", title: "Agents that play" },
      { id: "s4", name: "Lena Ortiz", title: "Designing playful crypto UX" },
    ],
    schedule: [
      {
        id: "sc1",
        startISO: "2026-06-18T18:00:00-04:00",
        endISO: "2026-06-18T18:45:00-04:00",
        title: "Doors & check-in",
        description:
          "Check in, get an embedded wallet in seconds, and rep your chain.",
        track: "Welcome",
      },
      {
        id: "sc2",
        startISO: "2026-06-18T18:45:00-04:00",
        endISO: "2026-06-18T19:30:00-04:00",
        title: "Sponsor showcase",
        description: "Chainlink, Pyth, and Blink open their airdrops for the night.",
        track: "Mainstage",
      },
      {
        id: "sc3",
        startISO: "2026-06-18T19:30:00-04:00",
        endISO: "2026-06-18T21:30:00-04:00",
        title: "The 67 — staked head-to-head",
        description: "Two hours of p2p-staked 67 matches with sponsor AR skins.",
        track: "Arena",
      },
      {
        id: "sc4",
        startISO: "2026-06-18T21:30:00-04:00",
        endISO: "2026-06-18T22:15:00-04:00",
        title: "Leaderboard & airdrops",
        description: "Top players unlock sponsor airdrops — verified onchain.",
        track: "Mainstage",
      },
      {
        id: "sc5",
        startISO: "2026-06-18T22:15:00-04:00",
        endISO: "2026-06-18T23:30:00-04:00",
        title: "Collect your moment & social",
        description: "Mint your reward, keep the memory, and meet the room.",
        track: "Social",
      },
    ],
    rsvpCount: 612,
    claimCount: 348,
    verifiedCount: 401,
    capacity: 700,
    sponsorIds: ["chainlink", "pyth", "blink", "base"],
    gameIds: ["67", "reprace"],
    airdrops: [
      {
        id: "ad_link_nyc",
        sponsorId: "chainlink",
        title: "Chainlink Oracle Drop",
        reward: "250 LINK pts",
        requirement: "Check in + win one 67 match",
        claimed: 184,
        total: 400,
      },
      {
        id: "ad_pyth_nyc",
        sponsorId: "pyth",
        title: "Pyth Price Pack",
        reward: "Mystery box",
        requirement: "Rep Pyth as your AR skin in a match",
        claimed: 96,
        total: 250,
      },
      {
        id: "ad_blink_nyc",
        sponsorId: "blink",
        title: "Blink Action Pass",
        reward: "Early access",
        requirement: "Play any game at the venue",
        claimed: 220,
        total: 500,
      },
    ],
    collectible: {
      name: "Playce Moment",
      symbol: "PLAYCE",
      description:
        "A verified onchain reward from Playce House NYC. Proof you showed up and played.",
      art: {
        hue: 330,
        accentHue: 170,
        edition: "NYC · 2026",
        variant: "capsule",
      },
      arModelUrls: [
        "/models/collectible.glb",
        "/models/mascot-plush.glb",
      ],
    },
    chainId: 84532,
  },
  {
    id: "evt_ethconf_nyc",
    slug: "ethconf",
    title: "ETHConf",
    tagline: "Where Ethereum meets institutional finance — now with games.",
    description:
      "ETHConf 2026 brings builders, institutions, and researchers together. Three days of keynotes and deep technical sessions at the Javits Center — and a Playce arena in the lobby where you check in, play, and earn sponsor airdrops between talks.",
    coverImageColor: "#18d9c0",
    coverImageUrl: "/events/ethconf.png",
    kind: "Conference",
    startISO: "2026-06-08T08:30:00-04:00",
    endISO: "2026-06-10T18:30:00-04:00",
    timezone: "America/New_York",
    venue: {
      name: "Javits Center",
      addressLine: "429 11th Ave",
      city: "New York",
      country: "USA",
      center: { lat: 40.7577, lng: -74.0027 },
      radiusMeters: 300,
    },
    hosts: [
      { id: "h1", name: "ETHGlobal", role: "Host", handle: "@ethglobal" },
      {
        id: "h2",
        name: "Kartik Talwar",
        role: "Co-host",
        handle: "@kartiktalwar",
      },
    ],
    speakers: [
      {
        id: "s1",
        name: "Dr. Elena Cho",
        title: "Tokenized treasuries at scale",
      },
      {
        id: "s2",
        name: "Marcus Reyes",
        title: "Institutional custody onchain",
      },
      { id: "s3", name: "Priya Nair", title: "Compliance-native DeFi" },
      { id: "s4", name: "Tomás Vidal", title: "Settlement rails for TradFi" },
    ],
    schedule: [
      {
        id: "sc1",
        startISO: "2026-06-08T08:30:00-04:00",
        endISO: "2026-06-08T10:00:00-04:00",
        title: "Registration & opening keynote",
        description: "Doors open. Check in to the Playce arena and grab a coffee.",
        track: "Day 1 · Mainstage",
      },
      {
        id: "sc2",
        startISO: "2026-06-08T10:00:00-04:00",
        endISO: "2026-06-08T17:00:00-04:00",
        title: "Institutional finance track",
        description: "Tokenization, custody, and settlement deep-dives.",
        track: "Day 1 · Sessions",
      },
      {
        id: "sc3",
        startISO: "2026-06-09T09:00:00-04:00",
        endISO: "2026-06-09T18:00:00-04:00",
        title: "Protocol & research day",
        description: "Scaling, privacy, and the road ahead for Ethereum.",
        track: "Day 2 · Sessions",
      },
      {
        id: "sc4",
        startISO: "2026-06-10T09:00:00-04:00",
        endISO: "2026-06-10T18:30:00-04:00",
        title: "Builders day & closing",
        description: "Demos, fireside chats, and the closing keynote.",
        track: "Day 3 · Mainstage",
      },
    ],
    rsvpCount: 1840,
    claimCount: 962,
    verifiedCount: 1203,
    capacity: 2200,
    sponsorIds: ["chainlink", "pyth"],
    gameIds: ["67"],
    airdrops: [
      {
        id: "ad_link_conf",
        sponsorId: "chainlink",
        title: "Chainlink Data Drop",
        reward: "150 LINK pts",
        requirement: "Check in at the arena",
        claimed: 540,
        total: 1200,
      },
    ],
    collectible: {
      name: "ETHConf 2026 — Playce Moment",
      symbol: "ETHCONF",
      description:
        "A verified onchain reward from ETHConf 2026 at the Javits Center.",
      art: {
        hue: 170,
        accentHue: 286,
        edition: "NYC · 2026",
        variant: "prism",
      },
    },
    chainId: 84532,
  },
  {
    id: "evt_ethglobal_nyc",
    slug: "ethglobal-nyc",
    title: "ETHGlobal New York 2026",
    tagline: "The flagship Ethereum hackathon returns to NYC.",
    description:
      "ETHGlobal New York 2026 is a 36-hour hackathon bringing the world's best builders together. Between hacking, drop into the Playce arena to check in, throw the 67, and earn sponsor airdrops.",
    coverImageColor: "#c2ff3d",
    coverImageUrl: "/events/ethglobal-nyc.png",
    kind: "Hackathon",
    startISO: "2026-06-12T09:00:00-04:00",
    endISO: "2026-06-14T18:00:00-04:00",
    timezone: "America/New_York",
    venue: {
      name: "Pier 36",
      addressLine: "299 South St",
      city: "New York",
      country: "USA",
      center: { lat: 40.7095, lng: -73.9869 },
      radiusMeters: 280,
    },
    hosts: [
      { id: "h1", name: "ETHGlobal", role: "Host", handle: "@ethglobal" },
    ],
    speakers: [
      { id: "s1", name: "Nadia Brooks", title: "Judge · Infrastructure" },
      { id: "s2", name: "Leo Tanaka", title: "Judge · Consumer apps" },
      { id: "s3", name: "Sam Okafor", title: "Workshop · Onchain agents" },
      {
        id: "s4",
        name: "Maya Fischer",
        title: "Workshop · Account abstraction",
      },
    ],
    schedule: [
      {
        id: "sc1",
        startISO: "2026-06-12T09:00:00-04:00",
        endISO: "2026-06-12T12:00:00-04:00",
        title: "Check-in & opening ceremony",
        description: "Form teams, check in to the arena, and kick off the hackathon.",
        track: "Day 1",
      },
      {
        id: "sc2",
        startISO: "2026-06-12T12:00:00-04:00",
        endISO: "2026-06-14T09:00:00-04:00",
        title: "Hacking begins",
        description: "36 hours to build. Workshops and mentorship throughout.",
        track: "Build",
      },
      {
        id: "sc3",
        startISO: "2026-06-14T09:00:00-04:00",
        endISO: "2026-06-14T13:00:00-04:00",
        title: "Submissions & judging",
        description: "Project submissions close. Judging round begins.",
        track: "Day 3",
      },
      {
        id: "sc4",
        startISO: "2026-06-14T13:00:00-04:00",
        endISO: "2026-06-14T18:00:00-04:00",
        title: "Demos & closing ceremony",
        description: "Finalist demos, prizes, and the closing ceremony.",
        track: "Day 3",
      },
    ],
    rsvpCount: 1320,
    claimCount: 540,
    verifiedCount: 788,
    capacity: 1500,
    sponsorIds: ["base", "blink"],
    gameIds: ["67", "reprace"],
    airdrops: [
      {
        id: "ad_base_hack",
        sponsorId: "base",
        title: "Base Builder Drop",
        reward: "Onchain badge",
        requirement: "Check in + play one game",
        claimed: 310,
        total: 900,
      },
    ],
    collectible: {
      name: "ETHGlobal New York 2026 — Playce Moment",
      symbol: "ETHNYC",
      description:
        "A verified onchain reward from the ETHGlobal New York 2026 hackathon.",
      art: {
        hue: 90,
        accentHue: 330,
        edition: "NYC · 2026",
        variant: "core",
        modelUrl: "/models/ethglobal-nyc.glb",
      },
    },
    chainId: 84532,
  },
  {
    id: "evt_base_house_lisbon",
    slug: "base-house-lisbon",
    title: "Playce House Lisbon",
    tagline: "Atlantic-coast arena night — show up, play, earn.",
    description:
      "The Lisbon edition of Playce House brings the European community together for a night of head-to-head games and sponsor airdrops.",
    coverImageColor: "#18d9c0",
    kind: "Playce Night",
    startISO: "2026-07-09T18:30:00+01:00",
    endISO: "2026-07-09T23:00:00+01:00",
    timezone: "Europe/Lisbon",
    venue: {
      name: "LX Factory — Hangar",
      addressLine: "R. Rodrigues de Faria 103",
      city: "Lisbon",
      country: "Portugal",
      center: { lat: 38.7036, lng: -9.1781 },
      radiusMeters: 220,
    },
    hosts: [{ id: "h1", name: "Playce", role: "Host", handle: "@playce" }],
    speakers: [
      { id: "s1", name: "João Almeida", title: "Real-time onchain play" },
      { id: "s2", name: "Sofia Marques", title: "Onchain moments" },
    ],
    schedule: [
      {
        id: "sc1",
        startISO: "2026-07-09T18:30:00+01:00",
        endISO: "2026-07-09T19:15:00+01:00",
        title: "Doors & check-in",
        track: "Welcome",
      },
      {
        id: "sc2",
        startISO: "2026-07-09T19:15:00+01:00",
        endISO: "2026-07-09T21:30:00+01:00",
        title: "The 67 — staked head-to-head",
        track: "Arena",
      },
      {
        id: "sc3",
        startISO: "2026-07-09T21:30:00+01:00",
        endISO: "2026-07-09T23:00:00+01:00",
        title: "Collect & social",
        track: "Social",
      },
    ],
    rsvpCount: 284,
    claimCount: 120,
    verifiedCount: 156,
    capacity: 400,
    sponsorIds: ["pyth", "blink"],
    gameIds: ["67"],
    airdrops: [
      {
        id: "ad_pyth_lis",
        sponsorId: "pyth",
        title: "Pyth Price Pack",
        reward: "Mystery box",
        requirement: "Win one 67 match",
        claimed: 40,
        total: 200,
      },
    ],
    collectible: {
      name: "Playce House Lisbon — Moment",
      symbol: "PLAYCE",
      description: "A verified onchain reward from Playce House Lisbon.",
      art: {
        hue: 170,
        accentHue: 330,
        edition: "LIS · 2026",
        variant: "prism",
      },
    },
    chainId: 84532,
  },
];

export const FEATURED_EVENT = EVENTS[0];

export function getEventBySlug(slug: string): PlayceEvent | undefined {
  return EVENTS.find((e) => e.slug === slug);
}

export function getEventById(id: string): PlayceEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}
