import type { RegularUnitType, HeroUnitType, WarMachineType } from '../types/battleTypes';

// ── Sprite config types ───────────────────────────────────────────────────────

interface AnimDef {
  frames: number[];
  frameRate: number;
  repeat: number;  // -1 = loop
}

export interface UnitSpriteConfig {
  textureKey: string;
  frameWidth: number;
  frameHeight: number;
  scale?: number;                    // default: 1.0
  origin?: { x: number; y: number }; // default: { x: 0.5, y: 1.0 }
  animations: {
    idle?: AnimDef;
    walk: AnimDef;   // required
    attack?: AnimDef;
    death?: AnimDef;
    ranged?: AnimDef;
  };
}

// ── Placeholder colours (used when no sprite is registered) ───────────────────
// All entities render as coloured rectangles in Steps 1–2.

export const UNIT_PLACEHOLDER_COLOURS: Record<
  RegularUnitType | HeroUnitType | WarMachineType,
  number
> = {
  // Regular units
  'Ward-hands':    0xadd8e6,  // light blue
  'Warrior':       0x8a8a8a,  // steel grey
  'Dwarf':         0xb8600a,  // dark orange
  'Orc':           0x3a7a1a,  // green
  'Halfling':      0xc8a87a,  // light brown
  'Elf':           0xb8d4a0,  // pale green
  'Dark-Elf':      0x4a1a6a,  // dark purple
  'Golem':         0x444444,  // dark grey
  'Gargoyle':      0x6a7a9a,  // slate blue
  'Dendrite':      0x1a4a1a,  // dark green
  'Undead':        0xe8e8b0,  // pale yellow
  // Heroes — all gold
  'Fighter':       0xffd700,
  'Hammer-lord':   0xffd700,
  'Ranger':        0xffd700,
  'Shadowblade':   0xffd700,
  'Ogr':           0xffd700,
  'Pyromancer':    0xffd700,
  'Cleric':        0xffd700,
  'Druid':         0xffd700,
  'Enchanter':     0xffd700,
  'Necromancer':   0xffd700,
  'Warsmith':      0xffd700,
  // War machines — dark red, larger rectangle
  'Ballista':      0x8b0000,
  'Catapult':      0x8b0000,
  'Battering Ram': 0x8b0000,
  'Siege Tower':   0x8b0000,
};

// ── Registry ──────────────────────────────────────────────────────────────────

const _registry = new Map<string, UnitSpriteConfig>();

/**
 * Central registry mapping any unit type to a sprite configuration.
 * Unknown types fall back to a coloured rectangle (see UNIT_PLACEHOLDER_COLOURS).
 * Real sprites are added from Step 3 onwards by calling register().
 */
export const UnitSpriteRegistry = {
  register(
    type: RegularUnitType | HeroUnitType | WarMachineType,
    config: UnitSpriteConfig,
  ): void {
    _registry.set(type, config);
  },

  get(
    type: RegularUnitType | HeroUnitType | WarMachineType,
  ): UnitSpriteConfig | undefined {
    return _registry.get(type);
  },

  has(type: RegularUnitType | HeroUnitType | WarMachineType): boolean {
    return _registry.has(type);
  },
} as const;
