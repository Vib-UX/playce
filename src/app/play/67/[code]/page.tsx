"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowRight,
  CameraOff,
  Copy,
  Check,
  Hand,
  RotateCcw,
  Trophy,
} from "lucide-react";
import type { CollectibleArt, Sponsor } from "@/lib/types";
import { SPONSORS } from "@/lib/mock/sponsors";
import { usePlayceAuth } from "@/lib/auth/context";
import { Collectible3DViewer } from "@/components/collectible-3d-viewer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getClientId,
  ROUND_SECONDS,
  type PeerStatus,
  type Role,
  type ServerMessage,
  type ServerState,
} from "@/lib/games/six-seven";
import {
  createHandLandmarker,
  classifySeesaw,
  HAND_CONNECTIONS,
  SCORE_COOLDOWN_MS,
  type DetectionResult,
  type HandLandmarkerInstance,
  type HandSide,
  type LandmarkPoint,
  type SeesawStatus,
} from "@/lib/games/hand-tracking";

type ConnState = "connecting" | "online" | "reconnecting" | "failed";

const MAX_RECONNECT_ATTEMPTS = 12;

function hexToHue(hex: string): number {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

function sponsorArt(sponsor: Sponsor): CollectibleArt {
  const hue = hexToHue(sponsor.brandColor);
  return {
    hue,
    accentHue: (hue + 40) % 360,
    edition: sponsor.name,
    variant: "prism",
  };
}

function statusText(s: SeesawStatus): string {
  switch (s.kind) {
    case "waiting":
      return "Show both hands";
    case "closed":
      return "Open your palms";
    case "level":
      return "Level — keep swinging";
    case "tilt":
      return s.higher === "left" ? "Left up" : "Right up";
  }
}

export default function SixSevenRoomPage() {
  return (
    <Suspense fallback={null}>
      <SixSevenRoom />
    </Suspense>
  );
}

function SixSevenRoom() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = String(params.code ?? "").toUpperCase();
  const { email } = usePlayceAuth();
  const youLabel = email ? email.split("@")[0] : "You";

  const sponsor = useMemo(() => {
    const rep = search.get("rep");
    return SPONSORS.find((s) => s.id === rep) ?? SPONSORS[0];
  }, [search]);

  // ── Refs ──────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarkerInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const lastHigherRef = useRef<HandSide | null>(null);
  const cooldownUntilRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const runningRef = useRef(false);
  const fatalRef = useRef<string | null>(null);
  const skin0Ref = useRef<HTMLDivElement>(null);
  const skin1Ref = useRef<HTMLDivElement>(null);

  // ── State ─────────────────────────────────────────────────────────────
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState("");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<SeesawStatus>({ kind: "waiting" });

  const [role, setRole] = useState<Role | null>(null);
  const [server, setServer] = useState<ServerState | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    runningRef.current = server?.status === "running";
  }, [server?.status]);

  useEffect(() => {
    fatalRef.current = fatalError;
  }, [fatalError]);

  // ── Invite link + QR ──────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    const url = `${window.location.origin}/play/67/${code}`;
    setInviteUrl(url);
    QRCode.toDataURL(url, {
      width: 256,
      margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [code]);

  // ── WebSocket (authoritative game state) ──────────────────────────────
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (cancelled) return;
      const clientId = getClientId();
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${window.location.host}/api/ws?code=${encodeURIComponent(
        code,
      )}&clientId=${encodeURIComponent(clientId)}`;
      setConn(attempt === 0 ? "connecting" : "reconnecting");

      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConn("online");
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as ServerMessage;
          if (msg.type === "joined") setRole(msg.role);
          else if (msg.type === "state") setServer(msg);
          else if (msg.type === "error") setFatalError(msg.message);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (cancelled) return;
        if (fatalRef.current) {
          setConn("failed");
          return;
        }
        attempt += 1;
        if (attempt > MAX_RECONNECT_ATTEMPTS) {
          setConn("failed");
          return;
        }
        const delay = Math.min(5000, 250 * 2 ** (attempt - 1));
        setConn("reconnecting");
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        /* noop */
      }
    };
  }, [code]);

  // ── Camera enumeration + landmarker init (once) ───────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
        tmp.getTracks().forEach((t) => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vids = devices.filter((d) => d.kind === "videoinput");
        if (cancelled) return;
        setCameras(vids);
        if (vids[0]) setCamId(vids[0].deviceId);
        const lm = await createHandLandmarker();
        if (cancelled) {
          lm.close();
          return;
        }
        landmarkerRef.current = lm;
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Attach the selected camera ────────────────────────────────────────
  const attachCamera = useCallback(async (deviceId: string) => {
    const videoEl = videoRef.current;
    if (!deviceId || !videoEl) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      videoEl.srcObject = stream;
      await videoEl.play().catch(() => {});
    } catch {
      /* selection failed — keep prior stream */
    }
  }, []);

  useEffect(() => {
    attachCamera(camId);
  }, [camId, attachCamera]);

  // ── Detection loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;

    const drawHands = (
      ctx: CanvasRenderingContext2D,
      hands: LandmarkPoint[][],
      w: number,
      h: number,
      color: string,
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(3, w / 240);
      ctx.fillStyle = "#ffffff";
      for (const lms of hands) {
        for (const [a, b] of HAND_CONNECTIONS) {
          ctx.beginPath();
          ctx.moveTo(lms[a].x * w, lms[a].y * h);
          ctx.lineTo(lms[b].x * w, lms[b].y * h);
          ctx.stroke();
        }
        for (const lm of lms) {
          ctx.beginPath();
          ctx.arc(lm.x * w, lm.y * h, Math.max(4, w / 200), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    // Pin a sponsor model over a hand's palm (landmark 9). The video is
    // mirrored (-scale-x-100), so mirror x to match the on-screen hand.
    const positionSkin = (
      el: HTMLDivElement | null,
      hand: LandmarkPoint[] | undefined,
    ) => {
      if (!el) return;
      if (!hand) {
        el.style.opacity = "0";
        return;
      }
      const palm = hand[9] ?? hand[0];
      el.style.left = `${(1 - palm.x) * 100}%`;
      el.style.top = `${palm.y * 100}%`;
      el.style.opacity = "1";
    };

    const loop = () => {
      const videoEl = videoRef.current;
      const canvasEl = canvasRef.current;
      const landmarker = landmarkerRef.current;
      rafRef.current = requestAnimationFrame(loop);
      if (!videoEl || !canvasEl || !landmarker) return;
      if (videoEl.readyState < 2 || !videoEl.videoWidth) return;

      let ts = performance.now();
      if (ts <= lastTsRef.current) ts = lastTsRef.current + 1;
      lastTsRef.current = ts;

      let result: DetectionResult;
      try {
        result = landmarker.detectForVideo(videoEl, ts);
      } catch {
        return;
      }

      const w = videoEl.videoWidth;
      const h = videoEl.videoHeight;
      if (canvasEl.width !== w) canvasEl.width = w;
      if (canvasEl.height !== h) canvasEl.height = h;
      const ctx = canvasEl.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      drawHands(ctx, result.landmarks, w, h, "#ff2e88");

      // Sort by x so each sponsor skin sticks to a consistent hand.
      const ordered = [...result.landmarks].sort((a, b) => a[0].x - b[0].x);
      positionSkin(skin0Ref.current, ordered[0]);
      positionSkin(skin1Ref.current, ordered[1]);

      const next = classifySeesaw(result.landmarks);
      setStatus(next);

      if (next.kind === "tilt") {
        const prev = lastHigherRef.current;
        const now = performance.now();
        if (
          runningRef.current &&
          prev !== null &&
          next.higher !== prev &&
          now > cooldownUntilRef.current
        ) {
          cooldownUntilRef.current = now + SCORE_COOLDOWN_MS;
          if (wsRef.current?.readyState === 1) {
            wsRef.current.send(JSON.stringify({ type: "score" }));
          }
        }
        lastHigherRef.current = next.higher;
      }
    };
    loop();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready]);

  // ── Host controls ─────────────────────────────────────────────────────
  const sendStart = () => {
    if (wsRef.current?.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "start" }));
    lastHigherRef.current = null;
    cooldownUntilRef.current = 0;
  };

  const sendReset = () => {
    if (wsRef.current?.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "reset" }));
    lastHigherRef.current = null;
    cooldownUntilRef.current = 0;
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

  // ── Derived ───────────────────────────────────────────────────────────
  const peers = server?.peers ?? {
    host: "empty" as PeerStatus,
    guest: "empty" as PeerStatus,
  };
  const opponentStatus: PeerStatus = role === "host" ? peers.guest : peers.host;
  const opponentReady = opponentStatus === "online";

  const myIdx = role === "host" ? 0 : 1;
  const oppIdx = role === "host" ? 1 : 0;
  const myScore = server?.scores[myIdx] ?? 0;
  const oppScore = server?.scores[oppIdx] ?? 0;
  const gameStatus = server?.status ?? "waiting";
  const timeLeft = server?.timeLeft ?? ROUND_SECONDS;
  const winner = server?.winner ?? null;

  const youWon = winner !== null && winner === myIdx;
  const youLost = winner !== null && winner === oppIdx;
  const tied = gameStatus === "finished" && winner === null;

  const showInvite = role === "host" && peers.guest === "empty";

  const totalSwaps = myScore + oppScore;
  const myShare =
    totalSwaps === 0
      ? 50
      : Math.max(6, Math.min(94, (myScore / totalSwaps) * 100));

  const connPill =
    conn === "online"
      ? null
      : conn === "connecting"
        ? { tone: "muted", text: "Connecting…" }
        : conn === "reconnecting"
          ? { tone: "amber", text: "Reconnecting…" }
          : { tone: "red", text: "Disconnected" };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/play/67"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Leave
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-border bg-card px-3 py-1.5 uppercase tracking-widest text-muted-foreground">
            Room <span className="font-mono text-foreground">{code}</span>
            {role && <span className="text-[var(--brand)]"> · {role}</span>}
          </span>
          {connPill && (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 font-mono text-[10px]",
                connPill.tone === "red"
                  ? "bg-[var(--destructive)]/20 text-[var(--destructive)]"
                  : connPill.tone === "amber"
                    ? "bg-amber-500/20 text-amber-500"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {connPill.text}
            </span>
          )}
        </div>
      </div>

      {/* Seesaw bar + countdown + scores */}
      <div className="mt-5 flex flex-col items-center">
        <div className="relative w-full max-w-lg">
          <div className="relative h-3.5 overflow-hidden rounded-full border border-border bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,var(--aurora-2),var(--aurora-1))] transition-[width] duration-200"
              style={{ width: `${myShare}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-[linear-gradient(270deg,var(--aurora-3),color-mix(in_oklab,var(--aurora-3)_50%,transparent))] transition-[width] duration-200"
              style={{ width: `${100 - myShare}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 -ml-2.5 -mt-2.5 size-5 rounded-full border-2 border-background bg-foreground shadow transition-[left] duration-200"
            style={{ left: `${myShare}%` }}
          />
        </div>
        <div
          className={cn(
            "mt-3 font-display text-5xl font-black tabular-nums sm:text-6xl",
            timeLeft <= 5 && gameStatus === "running"
              ? "animate-pulse text-[var(--destructive)]"
              : "text-foreground",
          )}
        >
          {timeLeft}
        </div>
        <div className="mt-1 flex items-center gap-5 text-[11px] uppercase tracking-widest text-muted-foreground">
          <span>
            {youLabel}
            <span className="ml-1 font-mono text-foreground">{myScore}</span>
          </span>
          <span>
            Opp{!opponentReady && opponentStatus === "reconnecting" ? " (reconnecting…)" : !opponentReady ? " (waiting…)" : ""}
            <span className="ml-1 font-mono text-foreground">{oppScore}</span>
          </span>
        </div>
      </div>

      {/* Camera stage */}
      <div className="relative mt-5 aspect-[3/4] w-full overflow-hidden rounded-3xl border border-border bg-black sm:aspect-video">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full -scale-x-100"
        />

        {/* Sponsor AR skins pinned to each hand */}
        <div className="pointer-events-none absolute inset-0">
          {[skin0Ref, skin1Ref].map((ref, i) => (
            <div
              key={i}
              ref={ref}
              className="absolute size-28 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-150 sm:size-36"
              style={{ left: "50%", top: "50%" }}
            >
              <Collectible3DViewer
                art={sponsorArt(sponsor)}
                modelUrl={sponsor.arModelUrl}
                interactive={false}
                hint={false}
                spin={1.8}
                className="!rounded-none bg-transparent"
              />
            </div>
          ))}
        </div>

        {/* Status pill */}
        <div className="absolute left-2 top-2 rounded-full bg-black/70 px-3 py-1 font-mono text-xs text-white">
          {statusText(status)}
        </div>

        {/* Hands seesaw indicator */}
        {status.kind === "tilt" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-end justify-around">
            <div
              className={cn(
                "text-5xl transition-transform sm:text-6xl",
                status.higher === "left"
                  ? "-translate-y-3"
                  : "translate-y-3 opacity-60",
              )}
            >
              ✋
            </div>
            <div
              className={cn(
                "text-5xl transition-transform sm:text-6xl",
                status.higher === "right"
                  ? "-translate-y-3"
                  : "translate-y-3 opacity-60",
              )}
            >
              ✋
            </div>
          </div>
        )}

        {/* Loading / error states */}
        {!ready && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-6 text-center">
            <p className="max-w-xs text-sm text-white/85">
              Loading hand-tracking… grant camera access if prompted.
            </p>
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center text-white/85">
            <CameraOff className="size-8" />
            <p className="text-sm">Could not start hand detection: {loadError}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-5 flex flex-col gap-3">
        {role === "host" && gameStatus !== "running" && (
          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={sendStart}
            disabled={!opponentReady || !ready || conn !== "online"}
          >
            <Hand className="size-4" />
            {gameStatus === "finished" ? "Play again" : "Start the 67"}
          </Button>
        )}
        {role === "host" &&
          (gameStatus === "running" || gameStatus === "finished") && (
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={sendReset}
            >
              <RotateCcw className="size-4" /> Reset
            </Button>
          )}
        {role === "guest" && gameStatus !== "running" && (
          <p className="text-center text-sm text-muted-foreground">
            {gameStatus === "finished"
              ? "Waiting for the host to start a new round…"
              : "Waiting for the host to start…"}
          </p>
        )}

        {/* Camera picker */}
        {cameras.length > 1 && (
          <label className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="uppercase tracking-widest">Camera</span>
            <select
              value={camId}
              onChange={(e) => setCamId(e.target.value)}
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--brand)]"
            >
              {cameras.map((c) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label || `Camera ${c.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {fatalError && (
        <div className="mt-4 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 p-3 text-center text-sm text-[var(--destructive)]">
          {fatalError}
        </div>
      )}

      {/* Invite overlay (host waiting for opponent) */}
      {showInvite && !fatalError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center card-glow">
            <p className="text-xs uppercase tracking-widest text-[var(--brand)]">
              Waiting for opponent
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">
              Share this room
            </h2>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Invite QR code"
                className="mx-auto mt-4 size-48 rounded-2xl bg-muted p-2"
              />
            )}
            <div className="mt-4 font-mono text-3xl tracking-[0.4em] text-foreground">
              {code}
            </div>
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
            <Link
              href="/play/67"
              className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground"
            >
              ← Leave room
            </Link>
          </div>
        </div>
      )}

      {/* Finished overlay */}
      {gameStatus === "finished" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center card-glow">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--brand)_16%,transparent)] text-[var(--brand)]">
              <Trophy className="size-7" />
            </span>
            <h2 className="mt-4 font-display text-3xl font-black">
              {tied ? "It's a tie!" : youWon ? "You win!" : youLost ? "You lose" : "Time's up"}
            </h2>
            <p className="mt-1 font-mono text-muted-foreground">
              {myScore} – {oppScore}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {youWon && (
                <Link
                  href="/claim"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110"
                >
                  Collect your reward
                  <ArrowRight className="size-4" />
                </Link>
              )}
              {role === "host" ? (
                <Button variant="outline" size="lg" onClick={sendReset}>
                  <RotateCcw className="size-4" /> Play again
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Waiting for the host to start a new round…
                </p>
              )}
              <Link
                href="/play/67"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back to lobby
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
