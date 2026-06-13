"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Hand,
  Lock,
  LogIn,
  Plus,
  Swords,
  Users,
} from "lucide-react";
import { SPONSORS } from "@/lib/mock/sponsors";
import { getGameById } from "@/lib/mock/games";
import { usePlayceAuth } from "@/lib/auth/context";
import { generateRoomCode } from "@/lib/games/six-seven";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const GAME = getGameById("67");

export default function SixSevenLobby() {
  const router = useRouter();
  const { authenticated, ready, login, email } = usePlayceAuth();

  const sponsorOptions = useMemo(
    () => (GAME ? SPONSORS.filter((s) => GAME.sponsorIds.includes(s.id)) : SPONSORS),
    [],
  );

  const [mode, setMode] = useState<"menu" | "join">("menu");
  const [joinCode, setJoinCode] = useState("");
  const [sponsorId, setSponsorId] = useState(sponsorOptions[0]?.id ?? "");

  const youLabel = email ? email.split("@")[0] : "You";

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

  if (!GAME) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Game unavailable</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <Badge variant="brand">
          <Swords className="size-3" /> Head-to-head
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Users className="size-3" /> 2 players
        </Badge>
      </div>

      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        <span className="aurora-text">{GAME.name}</span>
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Create a room and share the code, or join your opponent. Two players,
        a 20-second 6-7 seesaw showdown read live from your camera — most swaps
        wins.
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

            {/* Rep your chain (AR skin) */}
            <div className="mt-6">
              <span className="text-sm font-medium">Rep your chain (AR skin)</span>
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
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Staking placeholder — wired later via Privy smart wallets. */}
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
              <Lock className="size-4" />
            </span>
            <div>
              <p className="font-medium text-foreground">Winner-takes-all staking</p>
              <p className="mt-0.5">
                Coming soon — stake head-to-head with your Privy smart wallet.
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              ← Back to Playce
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
