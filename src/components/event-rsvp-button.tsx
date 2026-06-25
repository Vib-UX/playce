"use client";

import { useState } from "react";
import { Check, Loader2, Users } from "lucide-react";
import { usePlaycesAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";

export function EventRsvpButton({
  slug,
  initialCount,
}: {
  slug: string;
  initialCount: number;
}) {
  const { authenticated, login } = usePlaycesAuth();
  const [count, setCount] = useState(initialCount);
  const [going, setGoing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rsvp = async () => {
    if (!authenticated) {
      void login();
      return;
    }
    if (going || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${slug}/rsvp`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not RSVP.",
        );
      }
      if (typeof data.rsvpCount === "number") setCount(data.rsvpCount);
      setGoing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not RSVP.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display font-semibold">RSVP</p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            {count.toLocaleString()} going
          </p>
        </div>
        <Button
          variant={going ? "outline" : "gradient"}
          size="sm"
          onClick={rsvp}
          disabled={pending || going}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : going ? (
            <Check className="size-4" />
          ) : null}
          {going ? "You're going" : "Going"}
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-[var(--destructive)]">{error}</p>
      )}
    </div>
  );
}
