"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Crown,
  ExternalLink,
  Loader2,
  Lock,
  Trophy,
} from "lucide-react";
import { getSponsorById } from "@/lib/mock/sponsors";
import { rewardChainForSponsorId } from "@/lib/battle";
import { usePlayceAuth, PRIVY_ENABLED } from "@/lib/auth/context";
import { useStakeDeposit } from "@/lib/blink/use-stake-deposit";
import {
  BLINK_DEV_MOCK_STAKE,
  BLINK_STAKING_ENABLED,
  STAKE_AMOUNT,
} from "@/lib/blink/config";
import { ACTIVE_CHAIN } from "@/lib/chain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Role = "host" | "guest";

interface ChessMatchView {
  roomCode: string;
  sponsorId: string | null;
  white: string | null;
  black: string | null;
  gameId: string | null;
  url: string | null;
  urlWhite: string | null;
  urlBlack: string | null;
  status: "lobby" | "live" | "finished";
  winnerColor: "white" | "black" | null;
  winnerWallet: string | null;
  draw: boolean;
  lichessStatus: string | null;
  opened: boolean;
}

interface StatusResponse {
  match: ChessMatchView | null;
  stakes: { host: boolean; guest: boolean };
  settledOnchain: boolean;
}

type ClaimStatus = "idle" | "claiming" | "done" | "error";

interface ClaimResult {
  pot?: { txHash?: string; explorerUrl: string; amount?: string };
  badge?: {
    mechanism: "direct" | "ccip";
    chainLabel: string;
    txHash?: string;
    explorerUrl?: string;
    ccip?: { messageId: string; explorerUrl: string };
  };
  badgeError?: string;
  error?: string;
}

export default function ChessRoomPage() {
  return (
    <Suspense fallback={null}>
      <ChessRoom />
    </Suspense>
  );
}

function ChessRoom() {
  const params = useParams<{ code: string }>();
  const code = String(params.code ?? "").toUpperCase();
  const searchParams = useSearchParams();
  const role = (searchParams.get("role") === "guest" ? "guest" : "host") as Role;
  const repSponsorId = searchParams.get("rep") ?? undefined;
  const eventSlug = searchParams.get("event") ?? undefined;

  const { email, wallet, getAccessToken, mode, authenticated } = usePlayceAuth();
  const {
    stake,
    canStake,
    status: stakeStatus,
    displayMessage: stakeError,
    isActive: stakeActive,
    result: stakeResult,
    playerAddress: stakePlayerAddress,
  } = useStakeDeposit();

  const playerAddress = stakePlayerAddress ?? wallet ?? null;
  const youLabel = email ? email.split("@")[0] : "You";
  const sponsor = repSponsorId ? getSponsorById(repSponsorId) : undefined;
  const rewardChain = rewardChainForSponsorId(repSponsorId);

  const [match, setMatch] = useState<ChessMatchView | null>(null);
  const [stakes, setStakes] = useState({ host: false, guest: false });
  const [settledOnchain, setSettledOnchain] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [waitingForHost, setWaitingForHost] = useState(false);

  const [stakeConfirming, setStakeConfirming] = useState(false);
  const [stakeMessage, setStakeMessage] = useState<string | null>(null);

  const [claimStatus, setClaimStatus] = useState<ClaimStatus>("idle");
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);

  const [inviteUrl, setInviteUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const registeredRef = useRef(false);
  const registeringRef = useRef(false);

  // ── Invite link + QR (guests join via this) ───────────────────────────
  useEffect(() => {
    if (!code) return;
    const url = `${window.location.origin}/play/chess/${code}?role=guest${
      repSponsorId ? `&rep=${repSponsorId}` : ""
    }${eventSlug ? `&event=${eventSlug}` : ""}`;
    setInviteUrl(url);
    QRCode.toDataURL(url, {
      width: 256,
      margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [code, repSponsorId, eventSlug]);

  const applyStatus = useCallback((data: StatusResponse) => {
    if (data.match) setMatch(data.match);
    if (data.stakes) setStakes(data.stakes);
    setSettledOnchain(Boolean(data.settledOnchain));
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/chess/status?code=${encodeURIComponent(code)}`);
      if (!res.ok) return;
      const data = (await res.json()) as StatusResponse;
      applyStatus(data);
    } catch {
      /* transient — keep last state */
    }
  }, [code, applyStatus]);

  // Register this seat (host creates the Lichess challenge; guest joins it).
  const ensureRegistered = useCallback(async () => {
    if (registeredRef.current || registeringRef.current) return;
    if (!authenticated || !playerAddress || !code) return;
    registeringRef.current = true;
    try {
      const token = await getAccessToken().catch(() => null);
      const res = await fetch("/api/chess/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          roomCode: code,
          address: playerAddress,
          role,
          sponsorId: role === "host" ? repSponsorId : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        match?: ChessMatchView;
        error?: string;
      };
      if (res.status === 409 && role === "guest") {
        // Host hasn't opened the room yet — keep retrying on the poll.
        setWaitingForHost(true);
        return;
      }
      if (!res.ok || !data.match) {
        setRegisterError(data.error ?? "Could not join the room.");
        return;
      }
      setWaitingForHost(false);
      setRegisterError(null);
      setMatch(data.match);
      registeredRef.current = true;
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : "Could not join the room.");
    } finally {
      registeringRef.current = false;
    }
  }, [authenticated, playerAddress, code, role, repSponsorId, getAccessToken]);

  // Poll: register (with retry for a waiting guest), then refresh status. This
  // is the fallback; the WS relay below delivers faster live updates.
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (!registeredRef.current) await ensureRegistered();
      else await refreshStatus();
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [code, ensureRegistered, refreshStatus]);

  // Live relay: instant match + stake updates (Lichess result is polled
  // server-side). Reconnects on drop; HTTP polling above stays as a fallback.
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(
        `${proto}//${window.location.host}/api/chess-ws?code=${encodeURIComponent(code)}`,
      );
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as {
            type?: string;
            match?: ChessMatchView | null;
            stakes?: { host: boolean; guest: boolean };
          };
          if (msg.type !== "state") return;
          if (msg.match) setMatch(msg.match);
          if (msg.stakes) setStakes(msg.stakes);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        retry = setTimeout(connect, 2500);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* noop */
      }
    };
  }, [code]);

  // ── Derived ───────────────────────────────────────────────────────────
  const myColor: "white" | "black" = role === "host" ? "white" : "black";
  const myBoardUrl = role === "host" ? match?.urlWhite : match?.urlBlack;
  const myStaked = role === "host" ? stakes.host : stakes.guest;
  const opponentStaked = role === "host" ? stakes.guest : stakes.host;
  const opponentSeated = Boolean(role === "host" ? match?.black : match?.white);
  const gameStatus = match?.status ?? "lobby";
  const bothStaked = stakes.host && stakes.guest;
  const stakeGateActive = BLINK_STAKING_ENABLED || BLINK_DEV_MOCK_STAKE;

  const youWon =
    gameStatus === "finished" &&
    !match?.draw &&
    Boolean(match?.winnerWallet) &&
    match?.winnerWallet?.toLowerCase() === playerAddress?.toLowerCase();
  const youLost =
    gameStatus === "finished" && !match?.draw && Boolean(match?.winnerWallet) && !youWon;
  const claimable = Boolean(youWon && playerAddress);

  const showInvite = role === "host" && !opponentSeated;

  // ── Staking (reuses the 67 stake rails) ───────────────────────────────
  const handleStake = async () => {
    if (!code) return;
    if (!BLINK_DEV_MOCK_STAKE && !canStake) return;
    setStakeMessage(null);
    try {
      let transferId: string | undefined;
      if (BLINK_DEV_MOCK_STAKE) {
        transferId = `dev-mock-${role}-${code}`;
      } else {
        const depositResult = await stake({ amount: STAKE_AMOUNT, roomCode: code, role });
        transferId = depositResult.transfer?.id;
        if (!transferId) {
          setStakeMessage("Deposit completed but no transfer id was returned.");
          return;
        }
      }

      setStakeConfirming(true);
      const token = await getAccessToken();
      const res = await fetch("/api/stake/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          roomCode: code,
          role,
          playerAddress: stakePlayerAddress ?? wallet,
          amount: STAKE_AMOUNT,
          transferId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStakeMessage(typeof data.error === "string" ? data.error : "Could not confirm stake.");
        return;
      }
      setStakeMessage(
        BLINK_DEV_MOCK_STAKE
          ? "Stake confirmed (dev mock)."
          : "Stake confirmed — waiting for opponent.",
      );
      void refreshStatus();
    } catch (err) {
      setStakeMessage(err instanceof Error ? err.message : "Stake failed.");
    } finally {
      setStakeConfirming(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  // ── Reward claim (winner: pot + soulbound badge via /api/reward/claim) ──
  const claimReward = useCallback(async () => {
    if (!playerAddress) {
      setClaimResult({ error: "Connect your wallet to claim." });
      setClaimStatus("error");
      return;
    }
    setClaimStatus("claiming");
    setClaimResult(null);
    try {
      const token = await getAccessToken().catch(() => null);
      if (!token) throw new Error("Sign in to claim your reward.");
      const res = await fetch("/api/reward/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomCode: code,
          winnerAddress: playerAddress,
          sponsorId: match?.sponsorId ?? repSponsorId ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ClaimResult;
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      setClaimResult(data);
      setClaimStatus("done");
    } catch (err) {
      setClaimResult({ error: err instanceof Error ? err.message : "Claim failed" });
      setClaimStatus("error");
    }
  }, [code, playerAddress, getAccessToken, match?.sponsorId, repSponsorId]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={eventSlug ? `/play/chess?event=${eventSlug}` : "/play/chess"}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Leave
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-border bg-card px-3 py-1.5 uppercase tracking-widest text-muted-foreground">
            Room <span className="font-mono text-foreground">{code}</span>
            <span className="text-[var(--brand)]"> · {myColor}</span>
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Badge variant="brand">
          <Crown className="size-3" /> Chess Blitz
        </Badge>
        {sponsor && (
          <Badge variant="outline" className="gap-1">
            <span className="size-2 rounded-full" style={{ backgroundColor: sponsor.brandColor }} />
            Repping {sponsor.name}
          </Badge>
        )}
        <Badge
          variant="outline"
          className={cn(
            "gap-1",
            gameStatus === "live" && "text-emerald-500",
            gameStatus === "finished" && "text-[var(--brand)]",
          )}
        >
          {gameStatus === "lobby" ? "Lobby" : gameStatus === "live" ? "Live on Lichess" : "Finished"}
        </Badge>
      </div>

      {registerError && (
        <div className="mt-4 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 p-3 text-center text-sm text-[var(--destructive)]">
          {registerError}
        </div>
      )}

      {!authenticated && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Sign in from the lobby to take your seat in this room.
        </div>
      )}

      {/* Staking — both players stake before the result counts. */}
      {stakeGateActive && gameStatus !== "finished" && authenticated && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--brand)_12%,transparent)] text-[var(--brand)]">
              <Lock className="size-4" />
            </span>
            <div className="flex-1">
              <p className="font-medium">Winner-takes-all stake</p>
              <p className="text-xs text-muted-foreground">
                {BLINK_DEV_MOCK_STAKE
                  ? "Dev/test mode: tap to mark yourself staked — no real USDC moves."
                  : `Both players stake ${STAKE_AMOUNT} USDC via Blink on ${ACTIVE_CHAIN.name} before playing.`}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn(myStaked && "text-[var(--brand)]")}>
              You {myStaked ? "staked" : "not staked"}
            </span>
            <span>·</span>
            <span className={cn(opponentStaked && "text-[var(--brand)]")}>
              Opponent {opponentStaked ? "staked" : opponentSeated ? "waiting…" : "not joined"}
            </span>
          </div>

          {!myStaked && (
            <Button
              variant="gradient"
              className="mt-3 w-full"
              onClick={handleStake}
              disabled={
                (!BLINK_DEV_MOCK_STAKE && !canStake) ||
                stakeActive ||
                stakeConfirming ||
                stakeStatus === "signer-loading"
              }
            >
              {stakeStatus === "signer-loading" || stakeActive || stakeConfirming
                ? "Preparing…"
                : BLINK_DEV_MOCK_STAKE
                  ? `Stake $${STAKE_AMOUNT} (dev mock)`
                  : `Stake $${STAKE_AMOUNT} USDC`}
            </Button>
          )}

          {(stakeError || stakeMessage) && (
            <p className="mt-2 text-xs text-[var(--destructive)]">{stakeError || stakeMessage}</p>
          )}
          {stakeResult && myStaked && (
            <p className="mt-2 text-xs text-[var(--brand)]">
              Transfer {stakeResult.transfer.id} recorded.
            </p>
          )}
        </div>
      )}

      {!BLINK_STAKING_ENABLED && !BLINK_DEV_MOCK_STAKE && PRIVY_ENABLED && mode === "privy" && (
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Staking unavailable — deploy StakeEscrow and set STAKE_ESCROW_ADDRESS.
        </p>
      )}

      {/* Board: open your colored Lichess game. */}
      {gameStatus !== "finished" && match?.gameId && (
        <div className="mt-5 rounded-3xl border border-border bg-card p-5 card-glow">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Your board
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold">
            Play the {myColor} pieces on Lichess
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {bothStaked
              ? "Both staked — open your board and play. The result is read back automatically."
              : "Open your board to warm up; the pot counts once both players have staked."}
          </p>
          <a
            href={myBoardUrl ?? match.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <ExternalLink className="size-4" /> Open my Lichess board
          </a>
          {gameStatus === "live" && (
            <p className="mt-3 inline-flex items-center gap-2 text-xs text-emerald-500">
              <Loader2 className="size-3.5 animate-spin" /> Game in progress — waiting
              for the result…
            </p>
          )}
        </div>
      )}

      {waitingForHost && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
          Waiting for the host to open this room…
        </div>
      )}

      {/* Invite (host waiting for an opponent to join) */}
      {showInvite && (
        <div className="mt-5 rounded-3xl border border-border bg-card p-6 text-center card-glow">
          <p className="text-xs uppercase tracking-widest text-[var(--brand)]">
            Waiting for opponent
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold">Share this room</h2>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Invite QR code"
              className="mx-auto mt-4 size-44 rounded-2xl bg-muted p-2"
            />
          )}
          <div className="mt-4 font-mono text-3xl tracking-[0.4em] text-foreground">{code}</div>
          <div className="mt-4 flex items-center gap-2">
            <input
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 truncate rounded-xl border border-input bg-background px-3 py-2 text-xs font-mono text-muted-foreground"
            />
            <Button variant="secondary" size="sm" onClick={copyInvite}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      {/* Finished */}
      {gameStatus === "finished" && (
        <div className="mt-5 rounded-3xl border border-border bg-card p-6 text-center card-glow">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--brand)_16%,transparent)] text-[var(--brand)]">
            <Trophy className="size-7" />
          </span>
          <h2 className="mt-4 font-display text-3xl font-black">
            {match?.draw ? "Draw" : youWon ? "You win!" : youLost ? "You lose" : "Game over"}
          </h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {match?.draw
              ? `Drawn on Lichess (${match.lichessStatus ?? "draw"})`
              : `${match?.winnerColor ?? "?"} won by ${match?.lichessStatus ?? "result"}`}
          </p>

          {settledOnchain && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--brand)_12%,transparent)] px-3 py-1 text-xs font-medium text-[var(--brand)]">
              <Check className="size-3.5" /> Pot settled on-chain by Chainlink CRE
            </p>
          )}

          {match?.draw && (
            <p className="mt-4 text-sm text-muted-foreground">
              A draw refunds both stakes — no winner to pay out.
            </p>
          )}

          {claimable && (
            <div className="mt-5 rounded-2xl border border-[color-mix(in_oklab,var(--brand)_40%,transparent)] bg-[color-mix(in_oklab,var(--brand)_8%,transparent)] p-4 text-left">
              <p className="text-sm font-semibold text-foreground">
                {settledOnchain ? "Claim your win badge" : "Claim your reward"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {settledOnchain
                  ? `The pot is already in your wallet. Claim a soulbound win badge on ${rewardChain?.label ?? "your chain"}.`
                  : `Claim the USDC pot plus a soulbound win badge on ${rewardChain?.label ?? "your chain"}.`}
              </p>
              {claimStatus !== "done" ? (
                <Button
                  variant="gradient"
                  size="lg"
                  className="mt-3 w-full"
                  onClick={() => void claimReward()}
                  disabled={claimStatus === "claiming"}
                >
                  <Trophy className="size-4" />
                  {claimStatus === "claiming" ? "Claiming…" : "Claim reward"}
                </Button>
              ) : (
                <div className="mt-3 space-y-1.5">
                  {claimResult?.pot && (
                    <a
                      href={claimResult.pot.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline"
                    >
                      Pot settled{claimResult.pot.amount ? ` · ${claimResult.pot.amount}` : ""}
                      <ArrowRight className="size-3.5" />
                    </a>
                  )}
                  {claimResult?.badge?.ccip ? (
                    <a
                      href={claimResult.badge.ccip.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline"
                    >
                      Track badge via CCIP → {claimResult.badge.chainLabel}
                      <ArrowRight className="size-3.5" />
                    </a>
                  ) : claimResult?.badge?.explorerUrl ? (
                    <a
                      href={claimResult.badge.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline"
                    >
                      Win badge minted on {claimResult.badge.chainLabel}
                      <ArrowRight className="size-3.5" />
                    </a>
                  ) : null}
                  {claimResult?.badgeError && (
                    <p className="text-xs text-[var(--destructive)]">{claimResult.badgeError}</p>
                  )}
                </div>
              )}
              {claimStatus === "error" && claimResult?.error && (
                <p className="mt-2 text-xs text-[var(--destructive)]">{claimResult.error}</p>
              )}
            </div>
          )}

          <Link
            href={eventSlug ? `/play/chess?event=${eventSlug}` : "/play/chess"}
            className="mt-5 inline-block text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to lobby
          </Link>
        </div>
      )}
    </div>
  );
}
