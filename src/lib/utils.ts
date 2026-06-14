import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address?: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

// Pin the locale + timezone so the server and client render identical strings
// (otherwise dates hydrate-mismatch: server runs in UTC, the browser in local
// time). Each event carries its own IANA `timezone`.
const DATE_LOCALE = "en-US";

export function formatDateRange(
  startISO: string,
  endISO: string,
  timeZone?: string,
): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const dateFmt: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  };
  const timeFmt: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  };
  // Compare days within the target timezone so "same day" is stable across envs.
  const dayKey = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone });
  const sameDay = dayKey(start) === dayKey(end);
  if (sameDay) {
    return `${start.toLocaleDateString(DATE_LOCALE, dateFmt)} · ${start.toLocaleTimeString(
      DATE_LOCALE,
      timeFmt,
    )} – ${end.toLocaleTimeString(DATE_LOCALE, timeFmt)}`;
  }
  return `${start.toLocaleDateString(DATE_LOCALE, dateFmt)} – ${end.toLocaleDateString(
    DATE_LOCALE,
    dateFmt,
  )}`;
}

export function formatTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString(DATE_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
