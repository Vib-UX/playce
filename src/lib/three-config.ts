/**
 * 3D collectible configuration.
 *
 * Drop a `.glb` into `public/models/` and set the URL below to use a custom
 * asset everywhere the collectible renders (viewer, claim reveal, and the
 * "Capture the moment" AR camera overlay). Leave as `null` to use the built-in
 * procedural "memory capsule".
 */
export const COLLECTIBLE_MODEL_URL: string | null = null;
// Set to "/models/collectible.glb" to use a custom model as the global default.
// (Left `null` so the home + general viewers keep the procedural "memory capsule";
//  the Blitz camera supplies its own model via `collectible.arModelUrl`.)

/**
 * Fine multiplier on top of the automatic bounding-box fit. The model is first
 * normalized to a consistent medium size, then multiplied by this value. Nudge
 * up/down for taste (1 = medium).
 */
export const COLLECTIBLE_MODEL_SCALE = 1;
