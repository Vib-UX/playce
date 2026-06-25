"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Coins,
  Crown,
  Hand,
  LogIn,
  Plus,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { getGameById } from "@/lib/mock/games";
import { getSponsorsByIds } from "@/lib/mock/sponsors";
import { rewardChainForSponsorId } from "@/lib/battle";
import { usePlaycesAuth } from "@/lib/auth/context";
import { generateRoomCode } from "@/lib/games/six-seven";
import {
  GAME_TYPES,
  TIME_CONTROLS,
  STAKE_PRESETS,
  DEFAULT_GAME_TYPE,
  DEFAULT_TIME_CONTROL_KEY,
  DEFAULT_STAKE_AMOUNT,
  MIN_STAKE_AMOUNT,
  MAX_STAKE_AMOUNT,
  clampStakeAmount,
  formatStake,
  type ChessGameType,
} from "@/lib/games/chess-options";
import { ACTIVE_CHAIN } from "@/lib/chain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const GAME = getGameById("chess");

export function ChessLobby() {
  return (
    <Suspense fallback={null}>
      <ChessLobbyInner />
    </Suspense>
  );
}

function ChessLobbyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventSlug = searchParams.get("event") ?? "";
  const { authenticated, ready, login, email } = usePlaycesAuth();

  const sponsorOptions = useMemo(
    () => getSponsorsByIds(GAME?.sponsorIds ?? ["arbitrum", "ethereum", "base"]),
    [],
  );

  const [mode, setMode] = useState<"menu" | "join">("menu");
  const [joinCode, setJoinCode] = useState("");
  const [sponsorId, setSponsorId] = useState(sponsorOptions[0]?.id ?? "");

  // Host-chosen match options (encoded into the room URL on create).
  const [gameType, setGameType] = useState<ChessGameType>(DEFAULT_GAME_TYPE);
  const [timeControlKey, setTimeControlKey] = useState(DEFAULT_TIME_CONTROL_KEY);
  const [stakeAmount, setStakeAmount] = useState(DEFAULT_STAKE_AMOUNT);
  const [customStake, setCustomStake] = useState("");

  const youLabel = email ? email.split("@")[0] : "You";
  const rewardChain = rewardChainForSponsorId(sponsorId);
  const isCustomStake = !STAKE_PRESETS.includes(stakeAmount);

  const roomHref = (code: string, role: "host" | "guest") => {
    const params = new URLSearchParams({ role });
    if (sponsorId) params.set("rep", sponsorId);
    if (eventSlug) params.set("event", eventSlug);
    if (role === "host") {
      params.set("game", gameType);
      params.set("tc", timeControlKey);
      params.set("stake", String(stakeAmount));
    }
    return `/play/chess/${code}?${params.toString()}`;
  };

  const applyCustomStake = (raw: string) => {
    setCustomStake(raw);
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) setStakeAmount(clampStakeAmount(parsed));
  };

  const createRoom = () => {
    if (!authenticated) return;
    router.push(roomHref(generateRoomCode(), "host"));
  };

  const joinRoom = () => {
    if (!authenticated) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    router.push(roomHref(code, "guest"));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="brand">
          <Crown className="size-3" /> Chess Blitz
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Users className="size-3" /> 2 players
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Trophy className="size-3" /> Settled by Chainlink CRE
        </Badge>
      </div>

      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        <span className="aurora-text">{GAME?.name ?? "Chess Blitz"}</span>
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Stake head-to-head, then play a blitz game on Lichess. A Chainlink CRE
        workflow reads the Lichess result and settles the pot trustlessly — the
        winner takes the USDC pot plus a soulbound win badge.
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
              <div className="mt-5 grid gap-5">
                {/* Match options (host picks these; the guest inherits them) */}
                <div className="grid gap-4 rounded-2xl border border-border bg-background/40 p-4">
                  {/* Game type */}
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <Swords className="size-3.5 text-[var(--brand)]" /> Game
                    </span>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {GAME_TYPES.map((g) => (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() => setGameType(g.value)}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-left transition",
                            g.value === gameType
                              ? "border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_12%,transparent)]"
                              : "border-border bg-card hover:border-muted-foreground/40",
                          )}
                        >
                          <span className="block text-sm font-semibold">{g.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {g.hint}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time control */}
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <Clock className="size-3.5 text-[var(--brand)]" /> Time format
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {TIME_CONTROLS.map((tc) => (
                        <button
                          key={tc.key}
                          type="button"
                          onClick={() => setTimeControlKey(tc.key)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                            tc.key === timeControlKey
                              ? "border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_12%,transparent)]"
                              : "border-border bg-card hover:border-muted-foreground/40",
                          )}
                        >
                          {tc.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stake amount */}
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <Coins className="size-3.5 text-[var(--brand)]" /> Stake per player
                      <span className="text-muted-foreground">· winner takes all</span>
                    </span>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {STAKE_PRESETS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setStakeAmount(amt);
                            setCustomStake("");
                          }}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                            !isCustomStake && amt === stakeAmount
                              ? "border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_12%,transparent)]"
                              : "border-border bg-card hover:border-muted-foreground/40",
                          )}
                        >
                          {formatStake(amt)}
                        </button>
                      ))}
                      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
                        <span className="text-muted-foreground">$</span>
                        <input
                          value={customStake}
                          onChange={(e) =>
                            applyCustomStake(e.target.value.replace(/[^0-9.]/g, ""))
                          }
                          inputMode="decimal"
                          placeholder="custom"
                          className="w-16 bg-transparent text-center outline-none placeholder:text-muted-foreground/60"
                        />
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Both players stake {formatStake(stakeAmount)} USDC (
                      {formatStake(MIN_STAKE_AMOUNT)}–{formatStake(MAX_STAKE_AMOUNT)}) on{" "}
                      {ACTIVE_CHAIN.name}.
                    </p>
                  </div>
                </div>

                <Button
                  variant="gradient"
                  size="lg"
                  className="w-full justify-between"
                  onClick={createRoom}
                  disabled={!authenticated}
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="size-4" />
                    Create room (you play white)
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
                  <Button variant="ghost" size="lg" onClick={() => setMode("menu")}>
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

            {/* Rep your chain (drives the win-badge chain + AR theming) */}
            <div className="mt-6">
              <span className="text-sm font-medium">Rep your chain</span>
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
                    {s.rewardChain && <Trophy className="size-3 text-[var(--brand)]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
              <Trophy className="size-4" />
            </span>
            <div>
              <p className="font-medium text-foreground">
                Chain battle · winner-takes-all
              </p>
              <p className="mt-0.5">
                Both players stake USDC via Blink (on {ACTIVE_CHAIN.name}). After
                the Lichess game, a Chainlink CRE workflow reports the winner
                on-chain and the pot is released
                {rewardChain
                  ? `, plus a soulbound win badge on ${rewardChain.label}.`
                  : "."}
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              ← Back to Playces
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
