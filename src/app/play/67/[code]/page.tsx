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
  Lock,
  RotateCcw,
  Trophy,
} from "lucide-react";
import type { CollectibleArt, Sponsor } from "@/lib/types";
import { SPONSORS, getSponsorById } from "@/lib/mock/sponsors";
import {
  battleModeForSponsorId,
  isChainBattleSponsorId,
  rewardChainForSponsorId,
} from "@/lib/battle";
import { usePlayceAuth } from "@/lib/auth/context";
import { PRIVY_ENABLED } from "@/lib/auth/context";
import { useStakeDeposit } from "@/lib/blink/use-stake-deposit";
import {
  BLINK_DEV_MOCK_STAKE,
  BLINK_STAKING_ENABLED,
  STAKE_AMOUNT,
} from "@/lib/blink/config";
import { ACTIVE_CHAIN } from "@/lib/chain";
import { Collectible3DViewer } from "@/components/collectible-3d-viewer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getClientId,
  GAME_RECORD_MS,
  ROUND_SECONDS,
  WINNER_SHOWCASE_MODELS,
  WINNER_SHOWCASE_MODEL_SCALES,
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

/** Lifecycle of the auto proof-of-presence capture + mint. */
type ProofStatus =
  | "idle"
  | "recording"
  | "uploading"
  | "minting"
  | "done"
  | "error";

interface ProofNft {
  name: string;
  image: string;
  animationUrl?: string;
  txHash: string;
  blockExplorerUrl: string;
  tokenId: string;
  metadataURI: string;
  onchain: boolean;
  /** Set when the proof was dispatched cross-chain via Chainlink CCIP. */
  crossChain?: boolean;
  ccip?: { messageId: string; explorerUrl: string; sourceChain: string };
}

/** Lifecycle of the chain-battle reward claim (pot settle + win badge). */
type ClaimStatus = "idle" | "claiming" | "done" | "error";

interface ClaimResult {
  /** USDC pot settlement on Base mainnet. */
  pot?: {
    txHash?: string;
    explorerUrl: string;
    explorerLabel?: string;
    amount?: string;
    /** Real Blink deposit/transfer reference for the staked USDC. */
    blinkTransferId?: string;
  };
  /** Soulbound win badge on the repped chain. */
  badge?: {
    mechanism: "direct" | "ccip";
    chainLabel: string;
    txHash?: string;
    explorerUrl?: string;
    /** CCIP message tracking when the badge crosses chains. */
    ccip?: { messageId: string; explorerUrl: string };
  };
  /** Set when a real badge mint was attempted but reverted (no link to show). */
  badgeError?: string;
  error?: string;
}

/** Source crop so the video fills a w×h box preserving aspect (object-fit: cover). */
function coverCrop(sw: number, sh: number, dw: number, dh: number) {
  const sAspect = sw / sh;
  const dAspect = dw / dh;
  let cw: number;
  let ch: number;
  if (sAspect > dAspect) {
    ch = sh;
    cw = sh * dAspect;
  } else {
    cw = sw;
    ch = sw / dAspect;
  }
  return { sx: (sw - cw) / 2, sy: (sh - ch) / 2, sw: cw, sh: ch };
}

/** Pick the best-supported recording container for this browser. */
function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

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
  const code = String(params.code ?? "").toUpperCase();
  const searchParams = useSearchParams();
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
  const [stakeConfirming, setStakeConfirming] = useState(false);
  const [stakeMessage, setStakeMessage] = useState<string | null>(null);
  const youLabel = email ? email.split("@")[0] : "You";

  // Per-hand AR skins reflect the repped sponsor:
  //  - chain battle (Arbitrum / Ethereum) -> Arb vs Eth, mirroring Pyth vs
  //    Chainlink so each hand wears a rival chain.
  //  - repped sponsor with a companion (Blink -> Chainlink, Chainlink -> Pyth)
  //    -> repped on one hand, the companion skin on the other.
  //  - other sponsor with a .glb (Privy, Dynamic, …) -> both hands wear it.
  //  - fallback -> the bundled Pyth + Chainlink skins.
  const handSponsors = useMemo(() => {
    // Companion skin shown on the OTHER hand for a given repped sponsor.
    const COMPANION_SKIN: Record<string, string> = {
      blink: "chainlink",
      chainlink: "pyth",
    };
    const chainlink = SPONSORS.find((s) => s.id === "chainlink") ?? SPONSORS[0];
    const pyth = SPONSORS.find((s) => s.id === "pyth") ?? SPONSORS[0];
    if (isChainBattleSponsorId(repSponsorId)) {
      const arb = getSponsorById("arbitrum");
      const eth = getSponsorById("ethereum");
      if (arb?.arModelUrl && eth?.arModelUrl) return [arb, eth] as const;
    }
    const repped = repSponsorId ? getSponsorById(repSponsorId) : undefined;
    if (repped?.arModelUrl) {
      const companionId = COMPANION_SKIN[repped.id];
      const companion = companionId ? getSponsorById(companionId) : undefined;
      if (companion?.arModelUrl) return [repped, companion] as const;
      return [repped, repped] as const;
    }
    // [skin0 -> screen-right -> Pyth, skin1 -> screen-left -> Chainlink]
    return [pyth, chainlink] as const;
  }, [repSponsorId]);

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
  const stageRef = useRef<HTMLDivElement>(null);

  // Proof-of-presence auto-recorder machinery.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recDrawRafRef = useRef<number | null>(null);
  const recStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recTickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recStartedRef = useRef(false);

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
  const [soloMode, setSoloMode] = useState(false);

  const [proofStatus, setProofStatus] = useState<ProofStatus>("idle");
  const [proofSecondsLeft, setProofSecondsLeft] = useState(0);
  const [proofNft, setProofNft] = useState<ProofNft | null>(null);

  const [claimStatus, setClaimStatus] = useState<ClaimStatus>("idle");
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);

  useEffect(() => {
    runningRef.current = server?.status === "running";
  }, [server?.status]);

  useEffect(() => {
    fatalRef.current = fatalError;
  }, [fatalError]);

  // ── Invite link + QR ──────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    const url = `${window.location.origin}/play/67/${code}${
      eventSlug ? `?event=${eventSlug}` : ""
    }`;
    setInviteUrl(url);
    QRCode.toDataURL(url, {
      width: 256,
      margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [code, eventSlug]);

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

  // ── Identify this seat (wallet + repped sponsor) for the leaderboard ──
  // Re-sent whenever the socket comes online or the wallet/rep changes so a
  // finished round can be attributed to the right player + chain.
  useEffect(() => {
    if (conn !== "online") return;
    if (wsRef.current?.readyState !== 1) return;
    if (!wallet && !repSponsorId) return;
    wsRef.current.send(
      JSON.stringify({
        type: "identify",
        wallet,
        sponsorId: repSponsorId,
        battleMode: battleModeForSponsorId(repSponsorId),
      }),
    );
  }, [conn, wallet, repSponsorId]);

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

  const refreshStakeStatus = () => {
    if (wsRef.current?.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "stake-status" }));
  };

  const handleStake = async () => {
    if (!role || !code) return;
    if (!BLINK_DEV_MOCK_STAKE && !canStake) return;
    setStakeMessage(null);
    try {
      let transferId: string | undefined;
      if (BLINK_DEV_MOCK_STAKE) {
        // Dev/test: no real Blink deposit — synthesize a transfer id and let the
        // confirm endpoint record the stake without an on-chain credit.
        transferId = `dev-mock-${role}-${code}`;
      } else {
        const depositResult = await stake({
          amount: STAKE_AMOUNT,
          roomCode: code,
          role,
        });
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
        setStakeMessage(
          typeof data.error === "string" ? data.error : "Could not confirm stake.",
        );
        return;
      }
      setStakeMessage(
        BLINK_DEV_MOCK_STAKE
          ? "Stake confirmed (dev mock) — you can start."
          : "Stake confirmed — waiting for opponent.",
      );
      refreshStakeStatus();
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

  // ── Derived ───────────────────────────────────────────────────────────
  const peers = server?.peers ?? {
    host: "empty" as PeerStatus,
    guest: "empty" as PeerStatus,
  };
  const stakes = server?.stakes ?? { host: false, guest: false };
  const myStaked = role === "host" ? stakes.host : role === "guest" ? stakes.guest : false;
  const rawOpponentStaked = role === "host" ? stakes.guest : role === "guest" ? stakes.host : false;
  // Continuing alone: the house is the opponent and is treated as auto-staked.
  const opponentStaked = rawOpponentStaked || soloMode;
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

  // ── Battle type (chain vs memory) + claim eligibility ────────────────────
  const battleMode = server?.battleMode ?? "memory";
  const solo = server?.solo ?? false;
  const winnerWallet = server?.winnerWallet ?? null;
  const winnerSponsorId = server?.winnerSponsorId ?? null;
  // Chain battles are always real matches with a stake + reward, even when the
  // host "continues" alone (the opponent is the house). Only a memory run with
  // no guest stays a free solo high-score moment.
  const isChainBattle = battleMode === "chain";
  const soloMemory = solo && battleMode !== "chain";
  const winnerRewardChain = winnerSponsorId
    ? rewardChainForSponsorId(winnerSponsorId)
    : undefined;
  // Winner showcase reflects the winning player's repped sponsor: Chainlink ->
  // chainlink.glb, Arbitrum -> arb.glb, etc., paired with the event artifact.
  // Falls back to the local rep (solo) and finally to Chainlink.
  const showcaseSponsorId = winnerSponsorId ?? repSponsorId ?? null;
  const showcaseSponsor = showcaseSponsorId
    ? getSponsorById(showcaseSponsorId)
    : undefined;
  const showcaseModels = [
    showcaseSponsor?.arModelUrl ?? WINNER_SHOWCASE_MODELS[0],
    "/models/ethglobal-nyc.glb",
  ];
  // The winning player may claim the pot + soulbound badge via their wallet.
  const claimable =
    isChainBattle && gameStatus === "finished" && youWon && Boolean(winnerWallet);

  // Staking gates every chain battle. A real opponent triggers it; when the
  // host chooses to continue alone the house stands in, so the gate still
  // applies (the house side is auto-staked).
  const opponentPresent =
    (role === "host" ? peers.guest : peers.host) !== "empty";
  const stakeGateActive =
    BLINK_STAKING_ENABLED &&
    battleMode === "chain" &&
    (opponentPresent || soloMode);

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

  // ── Proof-of-presence auto-recorder ───────────────────────────────────
  const recorderSupported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function";

  const uploadAndMintProof = useCallback(
    async (blob: Blob, type: string) => {
      setProofStatus("uploading");
      try {
        const ext = type.includes("mp4") ? "mp4" : "webm";
        const form = new FormData();
        form.append("file", blob, `playce-67-${code || "room"}.${ext}`);
        const upRes = await fetch("/api/upload", { method: "POST", body: form });
        if (!upRes.ok) throw new Error(`Upload failed (${upRes.status})`);
        const clip = (await upRes.json()) as {
          ipfsUri: string;
          gatewayUrl: string;
        };

        const playerAddress = stakePlayerAddress ?? wallet;
        const token = await getAccessToken().catch(() => null);
        if (!playerAddress || !token) {
          // No linked Playce wallet/session — keep the clip, skip the mint.
          setProofStatus("error");
          return;
        }

        setProofStatus("minting");
        const mintRes = await fetch("/api/proof", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            playerAddress,
            roomCode: code,
            clipIpfsUri: clip.ipfsUri,
            clipGatewayUrl: clip.gatewayUrl,
            sponsorId: repSponsorId,
          }),
        });
        const data = (await mintRes.json().catch(() => ({}))) as {
          nft?: ProofNft;
          crossChain?: boolean;
          ccip?: { messageId: string; explorerUrl: string; sourceChain: string };
          error?: string;
        };
        if (!mintRes.ok || !data.nft) {
          throw new Error(data.error ?? "Mint failed");
        }
        setProofNft({
          ...data.nft,
          crossChain: data.crossChain,
          ccip: data.ccip,
        });
        setProofStatus("done");
      } catch {
        setProofStatus("error");
      }
    },
    [code, stakePlayerAddress, wallet, getAccessToken, repSponsorId],
  );

  // ── Chain-battle reward claim (Privy-authed) ──────────────────────────
  // The winner authenticates with their embedded wallet; the backend settles
  // the Base-mainnet pot and mints the soulbound win badge on the repped chain
  // (direct on Arbitrum Sepolia, or Chainlink CCIP for Ethereum Sepolia).
  const claimReward = useCallback(async () => {
    const claimAddress = stakePlayerAddress ?? wallet;
    if (!claimAddress) {
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
          winnerAddress: claimAddress,
          // Sent so a continue/solo claim can still mint the badge on the
          // repped chain when the authoritative WS record isn't available.
          sponsorId: winnerSponsorId ?? repSponsorId ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ClaimResult;
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      setClaimResult(data);
      setClaimStatus("done");
    } catch (err) {
      setClaimResult({
        error: err instanceof Error ? err.message : "Claim failed",
      });
      setClaimStatus("error");
    }
  }, [code, stakePlayerAddress, wallet, getAccessToken, winnerSponsorId, repSponsorId]);

  const teardownProofRecording = useCallback(() => {
    if (recDrawRafRef.current !== null) {
      cancelAnimationFrame(recDrawRafRef.current);
      recDrawRafRef.current = null;
    }
    if (recStopTimerRef.current) {
      clearTimeout(recStopTimerRef.current);
      recStopTimerRef.current = null;
    }
    if (recTickTimerRef.current) {
      clearTimeout(recTickTimerRef.current);
      recTickTimerRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    recorderRef.current = null;
  }, []);

  const startProofRecording = useCallback(() => {
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!stage || !video || !recorderSupported) return;
    if (recorderRef.current) return;

    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const rect = stage.getBoundingClientRect();
    const W = Math.max(2, Math.round(rect.width * scale));
    const H = Math.max(2, Math.round(rect.height * scale));

    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    // Composite the live (mirrored) feed + landmarks + hand skins + watermark
    // onto an offscreen canvas, independent of the detection RAF loop.
    const draw = () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw && vh) {
        const crop = coverCrop(vw, vh, W, H);
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
      }
      const lc = canvasRef.current;
      if (lc && lc.width) {
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(lc, 0, 0, W, H);
        ctx.restore();
      }
      for (const ref of [skin0Ref, skin1Ref]) {
        const div = ref.current;
        if (!div || div.style.opacity === "0") continue;
        const gl = div.querySelector("canvas");
        if (!gl) continue;
        const lx = parseFloat(div.style.left);
        const ty = parseFloat(div.style.top);
        if (Number.isNaN(lx) || Number.isNaN(ty)) continue;
        const s = Math.round(W * 0.2);
        ctx.drawImage(gl, (lx / 100) * W - s / 2, (ty / 100) * H - s / 2, s, s);
      }
      const pad = Math.round(W * 0.035);
      ctx.save();
      ctx.textBaseline = "bottom";
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = Math.round(W * 0.02);
      ctx.font = `600 ${Math.round(W * 0.034)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText("Playce · The 67 · ETHGlobal NYC", pad, H - pad);
      ctx.restore();
      recDrawRafRef.current = requestAnimationFrame(draw);
    };
    draw();

    let stream: MediaStream;
    try {
      stream = out.captureStream(30);
    } catch {
      teardownProofRecording();
      return;
    }

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, videoBitsPerSecond: 4_000_000 } : undefined,
      );
    } catch {
      teardownProofRecording();
      return;
    }

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      if (recDrawRafRef.current !== null) {
        cancelAnimationFrame(recDrawRafRef.current);
        recDrawRafRef.current = null;
      }
      const blobType = recorder.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunks, { type: blobType });
      void uploadAndMintProof(blob, blobType);
    };

    recorderRef.current = recorder;
    recorder.start();
    setProofStatus("recording");

    const startedAt = performance.now();
    setProofSecondsLeft(Math.ceil(GAME_RECORD_MS / 1000));
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((GAME_RECORD_MS - (performance.now() - startedAt)) / 1000),
      );
      setProofSecondsLeft(left);
      if (left > 0 && recorderRef.current?.state === "recording") {
        recTickTimerRef.current = setTimeout(tick, 250);
      }
    };
    tick();

    recStopTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    }, GAME_RECORD_MS);
  }, [recorderSupported, teardownProofRecording, uploadAndMintProof]);

  useEffect(() => {
    // Auto-capture once the round actually starts — works for solo and PvP, and
    // the 15s clip lines up with real gameplay.
    if (gameStatus !== "running") {
      // Reset so the next round (host "Play again") records again.
      if (gameStatus === "waiting") {
        recStartedRef.current = false;
        setProofStatus("idle");
        setProofNft(null);
      }
      return;
    }
    if (recStartedRef.current || !ready || !recorderSupported) return;
    recStartedRef.current = true;
    startProofRecording();
  }, [gameStatus, ready, recorderSupported, startProofRecording]);

  useEffect(() => () => teardownProofRecording(), [teardownProofRecording]);

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
      <div
        ref={stageRef}
        className="relative mt-5 aspect-[3/4] w-full overflow-hidden rounded-3xl border border-border bg-black sm:aspect-video"
      >
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
                art={sponsorArt(handSponsors[i])}
                modelUrl={handSponsors[i].arModelUrl}
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

        {/* Proof-of-presence capture indicator */}
        {proofStatus !== "idle" && (
          <div className="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {proofStatus === "recording" ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 animate-pulse rounded-full bg-red-500" />
                REC · {proofSecondsLeft}s
              </span>
            ) : proofStatus === "uploading" ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 animate-pulse rounded-full bg-amber-400" />
                Pinning your clip…
              </span>
            ) : proofStatus === "minting" ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 animate-pulse rounded-full bg-amber-400" />
                Minting your proof…
              </span>
            ) : proofStatus === "done" ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <Check className="size-3.5" /> Proof minted
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-white/70">
                Clip saved
              </span>
            )}
          </div>
        )}

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

      {/* Staking — chain battles (PvP) only. */}
      {stakeGateActive && gameStatus !== "running" && role && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--brand)_12%,transparent)] text-[var(--brand)]">
              <Lock className="size-4" />
            </span>
            <div className="flex-1">
              <p className="font-medium">Winner-takes-all stake</p>
              {BLINK_DEV_MOCK_STAKE ? (
                <p className="text-xs text-muted-foreground">
                  Dev/test mode: tap to mark yourself staked — no real Blink
                  transaction or USDC is moved. The host can start solo or in PvP
                  once staked.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Both players stake {STAKE_AMOUNT} USDC via Blink before the host can start.
                  When you stake, MetaMask will prompt you to switch to{" "}
                  <span className="text-foreground">{ACTIVE_CHAIN.name}</span> — approve that
                  first, then authorize USDC. You need USDC and a little ETH for gas on
                  the same MetaMask account linked to Playce.
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn(myStaked && "text-[var(--brand)]")}>
              You {myStaked ? "staked" : "not staked"}
            </span>
            <span>·</span>
            <span className={cn(opponentStaked && "text-[var(--brand)]")}>
              Opponent {opponentStaked ? "staked" : "waiting…"}
            </span>
          </div>

          {!myStaked && (
            <div className="mt-3">
              {!authenticated ? (
                <p className="text-xs text-muted-foreground">
                  Sign in to stake — use the lobby login before joining a room.
                </p>
              ) : (
                <Button
                  variant="gradient"
                  className="w-full"
                  onClick={handleStake}
                  disabled={
                    (!BLINK_DEV_MOCK_STAKE && !canStake) ||
                    stakeActive ||
                    stakeConfirming ||
                    stakeStatus === "signer-loading" ||
                    conn !== "online"
                  }
                >
                  {stakeStatus === "signer-loading" || stakeActive || stakeConfirming
                    ? "Preparing…"
                    : BLINK_DEV_MOCK_STAKE
                      ? `Stake $${STAKE_AMOUNT} (dev mock)`
                      : `Stake $${STAKE_AMOUNT} USDC`}
                </Button>
              )}
            </div>
          )}

          {(stakeError || stakeMessage) && (
            <p className="mt-2 text-xs text-[var(--destructive)]">
              {stakeError || stakeMessage}
            </p>
          )}
          {stakeResult && myStaked && (
            <p className="mt-2 text-xs text-[var(--brand)]">
              Transfer {stakeResult.transfer.id} recorded.
            </p>
          )}
        </div>
      )}

      {!BLINK_STAKING_ENABLED && PRIVY_ENABLED && mode === "privy" && (
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Staking unavailable — deploy StakeEscrow and set STAKE_ESCROW_ADDRESS.
        </p>
      )}

      {/* Controls */}
      <div className="mt-5 flex flex-col gap-3">
        {role === "host" && gameStatus !== "running" && (
          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={sendStart}
            disabled={
              !ready ||
              conn !== "online" ||
              (stakeGateActive && (!myStaked || !opponentStaked))
            }
          >
            <Hand className="size-4" />
            {gameStatus === "finished"
              ? "Play again"
              : stakeGateActive && !myStaked
                ? "Stake to start"
                : stakeGateActive && !opponentStaked
                  ? "Waiting for opponent's stake…"
                  : "Start the 67"}
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
      {showInvite && !fatalError && !soloMode && (
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
            <Button
              variant="gradient"
              size="lg"
              className="mt-4 w-full"
              onClick={() => setSoloMode(true)}
            >
              <Hand className="size-4" /> Continue
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Jump straight into the match — record your clip and claim your
              reward. An opponent can still join anytime.
            </p>
            <Link
              href={eventSlug ? `/play/67?event=${eventSlug}` : "/play/67"}
              className="mt-3 inline-block text-xs text-muted-foreground hover:text-foreground"
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
              {soloMemory
                ? "Run complete!"
                : tied
                  ? "It's a tie!"
                  : youWon
                    ? "You win!"
                    : youLost
                      ? "You lose"
                      : "Time's up"}
            </h2>
            <p className="mt-1 font-mono text-muted-foreground">
              {soloMemory ? `Score ${myScore}` : `${myScore} – ${oppScore}`}
            </p>

            {/* Cosmetic sponsor showcase — the winner's repped chain/product. */}
            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-[color-mix(in_oklab,var(--brand)_8%,transparent)]">
              <div className="h-44 w-full">
                <Collectible3DViewer
                  art={sponsorArt(showcaseSponsor ?? handSponsors[1])}
                  modelUrls={showcaseModels}
                  modelScales={[...WINNER_SHOWCASE_MODEL_SCALES]}
                  interactive
                  hint={false}
                  spin={1.2}
                  className="!rounded-none bg-transparent aspect-auto h-full"
                />
              </div>
              <div className="px-4 py-3">
                <p className="text-sm font-semibold">
                  {showcaseSponsor?.name || "Chainlink"}{" "}
                  — {isChainBattle ? "Chain battle" : soloMemory ? "Solo run" : "Winner"} @ ETHGlobal NYC
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {proofStatus === "recording"
                    ? `Capturing your proof clip… ${proofSecondsLeft}s`
                    : proofStatus === "uploading"
                      ? "Pinning your clip to IPFS…"
                      : proofStatus === "minting"
                        ? "Minting your proof-of-presence NFT…"
                        : proofStatus === "done"
                          ? proofNft?.crossChain
                            ? "Cross-chain proof dispatched via Chainlink CCIP — minting on the destination chain."
                            : "Your proof-of-presence NFT is minted."
                          : proofStatus === "error"
                            ? "Clip saved — mint a proof from your collection later."
                            : "Your unique memory from The 67."}
                </p>

                {proofStatus === "done" && proofNft && (
                  <div className="mt-3 space-y-2">
                    {proofNft.animationUrl && (
                      <video
                        src={proofNft.animationUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="h-28 w-full rounded-lg object-cover"
                      />
                    )}
                    {proofNft.crossChain && proofNft.ccip ? (
                      <a
                        href={proofNft.ccip.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline"
                      >
                        Track CCIP delivery
                        <ArrowRight className="size-3.5" />
                      </a>
                    ) : (
                      <a
                        href={proofNft.blockExplorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline"
                      >
                        View proof NFT #{proofNft.tokenId}
                        <ArrowRight className="size-3.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {/* Chain battle: winner claims the pot + soulbound badge via Privy. */}
              {claimable && (
                <div className="rounded-2xl border border-[color-mix(in_oklab,var(--brand)_40%,transparent)] bg-[color-mix(in_oklab,var(--brand)_8%,transparent)] p-4 text-left">
                  <p className="text-sm font-semibold text-foreground">
                    Chain battle reward
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Claim the USDC pot (settled on Base) plus a soulbound win
                    badge on {winnerRewardChain?.label ?? "your chain"} —
                    delivered to your wallet.
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
                      {claimStatus === "claiming"
                        ? "Claiming…"
                        : "Claim reward"}
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
                          {claimResult.pot.explorerLabel ?? "Pot settled"}
                          {claimResult.pot.amount
                            ? ` · ${claimResult.pot.amount}`
                            : ""}{" "}
                          <ArrowRight className="size-3.5" />
                        </a>
                      )}
                      {claimResult?.pot?.blinkTransferId && (
                        <p className="font-mono text-[11px] text-muted-foreground">
                          Blink deposit · {claimResult.pot.blinkTransferId}
                        </p>
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
                        <p className="text-xs text-[var(--destructive)]">
                          {claimResult.badgeError}
                        </p>
                      )}
                    </div>
                  )}
                  {claimStatus === "error" && claimResult?.error && (
                    <p className="mt-2 text-xs text-[var(--destructive)]">
                      {claimResult.error}
                    </p>
                  )}
                </div>
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
                href={eventSlug ? `/play/67?event=${eventSlug}` : "/play/67"}
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
