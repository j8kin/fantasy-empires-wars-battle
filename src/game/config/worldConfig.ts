// src/game/config/worldConfig.ts
// All world-space dimensions live here. Edit this file to tune spacing globally.

export const WORLD_CONFIG = {
  widthMeters:  1000,
  heightMeters: 1000,
  metersToPixels: 4,  // 1 m = 4 px  →  world = 4000 × 4000 px

  // ── Entity sizes (meters) ──────────────────────────────────────────────────
  packSizeMeters:       30,              // 30 × 30 m deploy footprint per pack
  unitSizeMeters:        2,              // 2 × 2 m individual unit (Battle Phase)
  warMachineSizeMeters: { w: 5, h: 10 }, // Catapult / Ballista / Battering Ram
  siegeTowerSizeMeters: { w: 10, h: 10 },

  // ── Battle Phase camera ────────────────────────────────────────────────────
  defaultViewportMeters: 100,  // default: 100 × 100 m visible
  minZoomMeters:          30,  // max zoom-in:  30 × 30 m visible
  maxZoomMeters:         250,  // max zoom-out: 250 × 250 m visible
} as const;

/** Zone fractions (fraction of world height for each side) */
export const DEFAULT_ZONES = {
  attacker: 0.20,
  neutral:  0.10,
  defender: 0.70,
} as const;

/** Derived pixel dimensions of the full world */
export const WORLD_PX = {
  width:  WORLD_CONFIG.widthMeters  * WORLD_CONFIG.metersToPixels,  // 4000
  height: WORLD_CONFIG.heightMeters * WORLD_CONFIG.metersToPixels,  // 4000
} as const;
