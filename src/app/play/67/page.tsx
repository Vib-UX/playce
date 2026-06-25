"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Hand,
  LogIn,
  MapPin,
  Plus,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { getSponsorsByIds } from "@/lib/mock/sponsors";
import { getChainBattleSponsors, battleModeForSponsorId } from "@/lib/battle";
import { getGameById } from "@/lib/mock/games";
import { getEventBySlug } from "@/lib/mock/events";
import { usePlaycesAuth } from "@/lib/auth/context";
import { useGeofence } from "@/hooks/use-geofence";
import { generateRoomCode } from "@/lib/games/six-seven";
import { ACTIVE_CHAIN } from "@/lib/chain";
import type { PlaycesEvent, Sponsor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const GAME = getGameById("67");

export default function SixSevenLobbyPage() {
  return (
    <Suspense fallback={null}>
      <SixSevenLobby />
    </Suspense>
  );
}

/** Merge an event's sponsors with the reward-bearing chain sponsors (deduped). */
function repOptionsForEvent(event: PlaycesEvent): Sponsor[] {
  const fromEvent = getSponsorsByIds(event.sponsorIds);
  const ids = new Set(fromEvent.map((s) => s.id));
  const chains = getChainBattleSponsors().filter((s) => !ids.has(s.id));
  return [...chains, ...fromEvent];
}

function SixSevenLobby() {
  const searchParams = useSearchParams();
  const eventSlug = searchParams.get("event") ?? "";
  const event = eventSlug ? getEventBySlug(eventSlug) : undefined;

  if (!GAME) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Game unavailable</h1>
      </div>
    );
  }

  // Outside an event, the 67 is playable online for fun (no venue/geofence).
  // With a valid event, it's the venue-gated, checked-in lobby.
  if (!event) {
    return <OnlineLobby />;
  }

  return <EventLobby event={event} />;
}

/** Online, just-for-fun lobby — no venue, no geofence. Casual or staked. */
function OnlineLobby() {
  const router = useRouter();
  const { authenticated, ready, login, email } = usePlaycesAuth();

  const sponsorOptions = useMemo(() => getChainBattleSponsors(), []);

  const [mode, setMode] = useState<"menu" | "join">("menu");
  const [joinCode, setJoinCode] = useState("");
  // Default to casual (no rep) so online play has zero staking friction.
  const [sponsorId, setSponsorId] = useState("");

  const youLabel = email ? email.split("@")[0] : "You";
  const battleMode = battleModeForSponsorId(sponsorId);
  const isChainBattle = battleMode === "chain";

  const roomHref = (code: string) =>
    `/play/67/${code}${sponsorId ? `?rep=${sponsorId}` : ""}`;

  const createRoom = () => {
    if (!authenticated) return;
    router.push(roomHref(generateRoomCode()));
  };

  const joinRoom = () => {
    if (!authenticated) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    router.push(roomHref(code));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="brand">
          <Swords className="size-3" /> Head-to-head
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Users className="size-3" /> 2 players
        </Badge>
        <Badge variant="outline" className="gap-1">
          Online
        </Badge>
      </div>

      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        <span className="aurora-text">{GAME!.name}</span>
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Create a room and share the code, or join your opponent. Two players, a
        20-second 6-7 seesaw showdown read live from your camera — most swaps
        wins. Play just for fun, or rep a chain to stake the pot.
      </p>

      {!ready ? (
        <div className="mt-8 h-40 animate-pulse rounded-3xl border border-border bg-card/50" />
      ) : (
        <div className="mt-8 grid gap-5">
          <div className="rounded-3xl border border-border bg-card p-5 card-glow sm:p-6">
            {!authenticated && (
              <div className="mb-5 flex flex-col items-start gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--brand)_40%,transparent)] bg-[color-mix(in_oklab,var(--brand)_8%,transparent)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Sign in to create or join a room.
                </p>
                <Button variant="gradient" size="sm" onClick={() => login()}>
                  <LogIn className="size-4" />
                  Sign in
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">
                {mode === "menu" ? "Start a match" : "Join a room"}
              </h2>
              <span className="text-xs text-muted-foreground">
                Playing as <span className="text-foreground">{youLabel}</span>
              </span>
            </div>

            {mode === "menu" ? (
              <div className="mt-5 grid gap-3">
                <Button
                  variant="gradient"
                  size="lg"
                  className="w-full justify-between"
                  onClick={createRoom}
                  disabled={!authenticated}
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="size-4" />
                    Create room
                  </span>
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => setMode("join")}
                  disabled={!authenticated}
                >
                  <Hand className="size-4" />
                  Join with a code
                </Button>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Room code</span>
                  <input
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(
                        e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") joinRoom();
                    }}
                    maxLength={8}
                    autoFocus
                    placeholder="ABC123"
                    inputMode="text"
                    autoComplete="off"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-center font-mono text-xl uppercase tracking-[0.3em] outline-none focus:border-[var(--brand)]"
                  />
                </label>
                <div className="grid grid-cols-[auto_1fr] gap-3">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setMode("menu")}
                  >
                    Back
                  </Button>
                  <Button
                    variant="gradient"
                    size="lg"
                    onClick={joinRoom}
                    disabled={!authenticated || joinCode.trim().length < 4}
                  >
                    Join room
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Casual vs rep-a-chain (staked) */}
            <div className="mt-6">
              <span className="text-sm font-medium">How do you want to play?</span>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => setSponsorId("")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                    sponsorId === ""
                      ? "border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_12%,transparent)]"
                      : "border-border bg-card hover:border-muted-foreground/40",
                  )}
                >
                  Just for fun
                </button>
                {sponsorOptions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSponsorId(s.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                      s.id === sponsorId
                        ? "border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_12%,transparent)]"
                        : "border-border bg-card hover:border-muted-foreground/40",
                    )}
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: s.brandColor }}
                    />
                    {s.name}
                    {s.rewardChain && (
                      <Trophy className="size-3 text-[var(--brand)]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Battle type explainer */}
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
              {isChainBattle ? (
                <Trophy className="size-4" />
              ) : (
                <Swords className="size-4" />
              )}
            </span>
            <div>
              {isChainBattle ? (
                <>
                  <p className="font-medium text-foreground">
                    Chain battle · winner-takes-all
                  </p>
                  <p className="mt-0.5">
                    Stake USDC via Blink (on {ACTIVE_CHAIN.name}) in the room.
                    The winner claims the pot plus a soulbound win badge on{" "}
                    {sponsorOptions.find((s) => s.id === sponsorId)?.rewardChain
                      ?.label ?? "their chain"}
                    .
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">
                    Just for fun · no stake
                  </p>
                  <p className="mt-0.5">
                    Pure bragging rights — no stake, no wallet needed to play.
                    Rep a chain to play for a staked pot instead.
                  </p>
                </>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Want to play in person?{" "}
            <Link href="/events" className="hover:text-foreground">
              Find an event near you
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function EventLobby({ event }: { event: PlaycesEvent }) {
  const router = useRouter();
  const { authenticated, ready, login, email } = usePlaycesAuth();
  const geo = useGeofence(event.venue);
  // Soft gate: presence is confirmed by GPS, but desktop/Wi-Fi geolocation is
  // unreliable (often 100km+ off), so an "I'm here" override lets a player who
  // is actually at the venue continue when the check can't confirm it.
  const [override, setOverride] = useState(false);
  const checkedIn = geo.status === "inside" || override;
  // Show the manual override once a check has actually run and didn't confirm.
  const checkFailed =
    geo.status === "outside" ||
    geo.status === "denied" ||
    geo.status === "unavailable";

  const sponsorOptions = useMemo(() => repOptionsForEvent(event), [event]);

  const [mode, setMode] = useState<"menu" | "join">("menu");
  const [joinCode, setJoinCode] = useState("");
  const [sponsorId, setSponsorId] = useState(sponsorOptions[0]?.id ?? "");

  const youLabel = email ? email.split("@")[0] : "You";
  const battleMode = battleModeForSponsorId(sponsorId);
  const isChainBattle = battleMode === "chain";

  const roomHref = (code: string) =>
    `/play/67/${code}?event=${event.slug}${sponsorId ? `&rep=${sponsorId}` : ""}`;

  const canPlay = authenticated && checkedIn;

  const createRoom = () => {
    if (!canPlay) return;
    router.push(roomHref(generateRoomCode()));
  };

  const joinRoom = () => {
    if (!canPlay) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    router.push(roomHref(code));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="brand">
          <Swords className="size-3" /> Head-to-head
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Users className="size-3" /> 2 players
        </Badge>
        <Link
          href={`/event/${event.slug}`}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <MapPin className="size-3" /> {event.venue.name}
        </Link>
      </div>

      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        <span className="aurora-text">{GAME!.name}</span>
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Create a room and share the code, or join your opponent. Two players, a
        20-second 6-7 seesaw showdown read live from your camera — most swaps
        wins.
      </p>

      {!ready ? (
        <div className="mt-8 h-40 animate-pulse rounded-3xl border border-border bg-card/50" />
      ) : (
        <div className="mt-8 grid gap-5">
          {/* Check-in gate — PvP is geofenced to the venue. */}
          {!checkedIn && (
            <div className="rounded-3xl border border-[color-mix(in_oklab,var(--brand)_40%,transparent)] bg-[color-mix(in_oklab,var(--brand)_8%,transparent)] p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--brand)_18%,transparent)] text-[var(--brand-deep)] dark:text-[var(--brand)]">
                  <MapPin className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    Check in at {event.venue.name}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {geo.status === "outside"
                      ? `You're ~${geo.distanceMeters}m away — you must be inside the venue to play.`
                      : geo.status === "denied"
                        ? "Location permission was denied. Enable it to check in."
                        : geo.status === "unavailable"
                          ? geo.error ?? "We couldn't determine your location."
                          : "Verify you're at the venue to start a match."}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="gradient"
                      size="sm"
                      onClick={geo.request}
                      disabled={geo.status === "requesting"}
                    >
                      <MapPin className="size-4" />
                      {geo.status === "requesting"
                        ? "Checking…"
                        : checkFailed
                          ? "Try again"
                          : "Check in to play"}
                    </Button>
                    {checkFailed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOverride(true)}
                      >
                        I&apos;m here — continue
                      </Button>
                    )}
                  </div>
                  {checkFailed && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      On a laptop, location can be off by miles. If you&apos;re
                      really at {event.venue.name}, continue.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-3xl border border-border bg-card p-5 card-glow sm:p-6">
            {!authenticated && (
              <div className="mb-5 flex flex-col items-start gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--brand)_40%,transparent)] bg-[color-mix(in_oklab,var(--brand)_8%,transparent)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Sign in to create or join a room.
                </p>
                <Button variant="gradient" size="sm" onClick={() => login()}>
                  <LogIn className="size-4" />
                  Sign in
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">
                {mode === "menu" ? "Start a match" : "Join a room"}
              </h2>
              <span className="text-xs text-muted-foreground">
                Playing as <span className="text-foreground">{youLabel}</span>
              </span>
            </div>

            {mode === "menu" ? (
              <div className="mt-5 grid gap-3">
                <Button
                  variant="gradient"
                  size="lg"
                  className="w-full justify-between"
                  onClick={createRoom}
                  disabled={!canPlay}
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="size-4" />
                    Create room
                  </span>
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => setMode("join")}
                  disabled={!canPlay}
                >
                  <Hand className="size-4" />
                  Join with a code
                </Button>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Room code</span>
                  <input
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(
                        e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") joinRoom();
                    }}
                    maxLength={8}
                    autoFocus
                    placeholder="ABC123"
                    inputMode="text"
                    autoComplete="off"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-center font-mono text-xl uppercase tracking-[0.3em] outline-none focus:border-[var(--brand)]"
                  />
                </label>
                <div className="grid grid-cols-[auto_1fr] gap-3">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setMode("menu")}
                  >
                    Back
                  </Button>
                  <Button
                    variant="gradient"
                    size="lg"
                    onClick={joinRoom}
                    disabled={!canPlay || joinCode.trim().length < 4}
                  >
                    Join room
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Rep your chain / product (AR skin + battle type) */}
            <div className="mt-6">
              <span className="text-sm font-medium">Rep your chain or product</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {sponsorOptions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSponsorId(s.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                      s.id === sponsorId
                        ? "border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_12%,transparent)]"
                        : "border-border bg-card hover:border-muted-foreground/40",
                    )}
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: s.brandColor }}
                    />
                    {s.name}
                    {s.rewardChain && (
                      <Trophy className="size-3 text-[var(--brand)]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Battle type explainer — derived from the repped sponsor. */}
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
              {isChainBattle ? (
                <Trophy className="size-4" />
              ) : (
                <Swords className="size-4" />
              )}
            </span>
            <div>
              {isChainBattle ? (
                <>
                  <p className="font-medium text-foreground">
                    Chain battle · winner-takes-all
                  </p>
                  <p className="mt-0.5">
                    Stake USDC via Blink (on {ACTIVE_CHAIN.name}) in the room.
                    The winner claims the pot plus a soulbound win badge on{" "}
                    {sponsorOptions.find((s) => s.id === sponsorId)?.rewardChain
                      ?.label ?? "their chain"}
                    .
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">
                    Memory battle · proof of presence
                  </p>
                  <p className="mt-0.5">
                    No stake — every player mints their 67 moment as a
                    proof-of-presence NFT. Rep a chain (Arbitrum or Ethereum) to
                    play for a staked pot instead.
                  </p>
                </>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            <Link
              href={`/event/${event.slug}`}
              className="hover:text-foreground"
            >
              ← Back to {event.title}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
