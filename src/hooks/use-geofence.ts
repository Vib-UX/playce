"use client";

import { useCallback, useState } from "react";
import type { GeoStatus, Venue } from "@/lib/types";
import { checkGeofence, DEMO_FORCE_INSIDE_ZONE } from "@/lib/mock/geofence";

interface GeofenceResult {
  status: GeoStatus;
  distanceMeters?: number;
  coords?: { lat: number; lng: number };
  error?: string;
  request: () => void;
  reset: () => void;
}

/**
 * Browser geolocation + venue geofence check. Honors the demo override so the
 * flow is explorable anywhere; flip `DEMO_FORCE_INSIDE_ZONE` to test the real
 * permission + distance path.
 */
export function useGeofence(venue: Venue): GeofenceResult {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [distanceMeters, setDistance] = useState<number>();
  const [coords, setCoords] = useState<{ lat: number; lng: number }>();
  const [error, setError] = useState<string>();

  const request = useCallback(() => {
    setStatus("requesting");
    setError(undefined);

    if (DEMO_FORCE_INSIDE_ZONE) {
      setTimeout(() => {
        setDistance(Math.round(venue.radiusMeters * 0.35));
        setStatus("inside");
      }, 1100);
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setError("Geolocation is not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const { inside, distanceMeters: dist } = checkGeofence(
          userCoords,
          venue.center,
          venue.radiusMeters,
        );
        setCoords(userCoords);
        setDistance(Math.round(dist));
        setStatus(inside ? "inside" : "outside");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          setError("Location permission was denied.");
        } else {
          setStatus("unavailable");
          setError("We couldn't determine your location.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [venue]);

  const reset = useCallback(() => {
    setStatus("idle");
    setDistance(undefined);
    setCoords(undefined);
    setError(undefined);
  }, []);

  return { status, distanceMeters, coords, error, request, reset };
}
