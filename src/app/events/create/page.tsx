"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CalendarPlus,
  Globe,
  Loader2,
  LogIn,
  MapPin,
} from "lucide-react";
import { usePlaycesAuth } from "@/lib/auth/context";
import { GAMES } from "@/lib/mock/games";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

type Mode = "online" | "venue";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Convert a <input type="datetime-local"> value to an ISO string. */
function localToISO(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export default function CreateEventPage() {
  const router = useRouter();
  const { authenticated, ready, login, getAccessToken } = usePlaycesAuth();

  const [mode, setMode] = useState<Mode>("online");
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("Meetup");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [timezone, setTimezone] = useState(browserTimezone());
  const [capacity, setCapacity] = useState("100");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [venueName, setVenueName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [gameIds, setGameIds] = useState<string[]>(["67", "chess"]);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liveGames = useMemo(() => GAMES, []);

  const toggleGame = (id: string) => {
    setGameIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const uploadCover = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Upload failed — paste an image URL instead.",
        );
      }
      if (data.gatewayUrl) setCoverImageUrl(data.gatewayUrl as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!authenticated || submitting) return;
    setError(null);

    if (title.trim().length < 3) {
      setError("Give your event a title (at least 3 characters).");
      return;
    }
    if (!start) {
      setError("Pick a start date and time.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getAccessToken().catch(() => null);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: title.trim(),
          tagline: tagline.trim(),
          description: description.trim(),
          kind: kind.trim(),
          startISO: localToISO(start),
          endISO: localToISO(end),
          timezone,
          capacity: Number(capacity) || undefined,
          coverImageUrl: coverImageUrl.trim() || undefined,
          gameIds,
          venue:
            mode === "venue"
              ? {
                  name: venueName.trim(),
                  addressLine: addressLine.trim(),
                  city: city.trim(),
                  country: country.trim(),
                  lat: lat ? Number(lat) : undefined,
                  lng: lng ? Number(lng) : undefined,
                }
              : { name: "Online", city: "Online" },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not create event.",
        );
      }
      router.push(`/event/${data.event.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create event.");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <Badge variant="brand">
        <CalendarPlus className="size-3" /> Host an event
      </Badge>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        <span className="aurora-text">Create your event</span>
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Set up a page, get it listed on Playces, and let people play head-to-head
        games — online or at your venue.
      </p>

      {ready && !authenticated && (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--brand)_40%,transparent)] bg-[color-mix(in_oklab,var(--brand)_8%,transparent)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Sign in to create and publish your event.
          </p>
          <Button variant="gradient" size="sm" onClick={() => login()}>
            <LogIn className="size-4" /> Sign in
          </Button>
        </div>
      )}

      <div className="mt-8 grid gap-6">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("online")}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-4 text-left transition",
              mode === "online"
                ? "border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_10%,transparent)]"
                : "border-border bg-card hover:border-muted-foreground/40",
            )}
          >
            <Globe className="size-5 text-[var(--brand)]" />
            <div>
              <p className="font-display font-semibold">Online</p>
              <p className="text-xs text-muted-foreground">Play from anywhere</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode("venue")}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-4 text-left transition",
              mode === "venue"
                ? "border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_10%,transparent)]"
                : "border-border bg-card hover:border-muted-foreground/40",
            )}
          >
            <MapPin className="size-5 text-[var(--brand)]" />
            <div>
              <p className="font-display font-semibold">In person</p>
              <p className="text-xs text-muted-foreground">At a venue</p>
            </div>
          </button>
        </div>

        {/* Basics */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Details</h2>
          <div className="mt-4 grid gap-4">
            <label className="block">
              <span className="text-sm font-medium">Event title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Friday Night Chess & The 67"
                className={inputClass}
                maxLength={120}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Tagline</span>
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="One line that sells it."
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's happening, who it's for, what to expect."
                rows={4}
                className={cn(inputClass, "resize-y")}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Kind</span>
                <input
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  placeholder="Meetup, Tournament, Party…"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Capacity</span>
                <input
                  value={capacity}
                  onChange={(e) =>
                    setCapacity(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  inputMode="numeric"
                  placeholder="100"
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        </div>

        {/* When */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">When</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Starts</span>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Ends</span>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-medium">Timezone</span>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="UTC"
              className={inputClass}
            />
          </label>
        </div>

        {/* Where (venue mode only) */}
        {mode === "venue" && (
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold">Where</h2>
            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="text-sm font-medium">Venue name</span>
                <input
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="The Pavilion"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Address</span>
                <input
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="125 W 18th St"
                  className={inputClass}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">City</span>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Country</span>
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Latitude</span>
                  <input
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    inputMode="decimal"
                    placeholder="40.7398"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Longitude</span>
                  <input
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    inputMode="decimal"
                    placeholder="-73.9956"
                    className={inputClass}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Lat/lng power the venue map and on-site check-in for games.
              </p>
            </div>
          </div>
        )}

        {/* Games */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Games</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the head-to-head games attendees can play at your event.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {liveGames.map((g) => {
              const selected = gameIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGame(g.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                    selected
                      ? "border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_12%,transparent)]"
                      : "border-border bg-card hover:border-muted-foreground/40",
                  )}
                >
                  {g.name}
                  {g.status === "soon" && (
                    <span className="text-xs text-muted-foreground">soon</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cover */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Cover image</h2>
          <div className="mt-4 grid gap-4">
            <label className="block">
              <span className="text-sm font-medium">Image URL</span>
              <input
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://… or upload below"
                className={inputClass}
              />
            </label>
            <div className="flex items-center gap-3">
              <label
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:border-muted-foreground/40",
                  uploading && "pointer-events-none opacity-60",
                )}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                {uploading ? "Uploading…" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadCover(file);
                  }}
                />
              </label>
              {coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  className="h-12 w-20 rounded-lg object-cover"
                />
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-4 py-2.5 text-sm text-[var(--destructive)]">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/events"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to events
          </Link>
          <Button
            variant="gradient"
            size="lg"
            onClick={submit}
            disabled={!authenticated || submitting}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarPlus className="size-4" />
            )}
            {submitting ? "Publishing…" : "Publish event"}
          </Button>
        </div>
      </div>
    </div>
  );
}
