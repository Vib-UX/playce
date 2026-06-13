import type { GeoPoint } from "@/lib/types";

/**
 * Haversine distance in meters between two coordinates.
 */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface GeoCheckResult {
  inside: boolean;
  distanceMeters: number;
}

/**
 * Stubbed geofence check. In production this could be a signed location
 * attestation; here we just compare against the venue center + radius.
 */
export function checkGeofence(
  user: GeoPoint,
  center: GeoPoint,
  radiusMeters: number,
): GeoCheckResult {
  const dist = distanceMeters(user, center);
  return { inside: dist <= radiusMeters, distanceMeters: dist };
}

/**
 * Demo override. When `true`, the app skips the browser and treats the user as
 * standing inside the event zone (handy for exploring without traveling).
 *
 * Default `false`: the app requests real location permission, reads the user's
 * GPS coordinates, and verifies them against the venue center + radius with the
 * haversine `checkGeofence` above — enforced on both the client and the server
 * (`/api/claim`). A claim is only possible from within the venue radius.
 */
export const DEMO_FORCE_INSIDE_ZONE = false;
