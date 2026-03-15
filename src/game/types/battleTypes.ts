// ── Unit name enums ───────────────────────────────────────────────────────────

export const RegularUnitName = {
  WARD_HANDS: 'Ward-hands',
  WARRIOR:    'Warrior',
  DWARF:      'Dwarf',
  ORC:        'Orc',
  HALFLING:   'Halfling',
  ELF:        'Elf',
  DARK_ELF:   'Dark-Elf',
  // DRIVEN Doctrine
  GOLEM:      'Golem',
  GARGOYLE:   'Gargoyle',
  DENDRITE:   'Dendrite',
  // Via Necromancer aura or Summon spell
  UNDEAD:     'Undead',
} as const;

export const WarMachineName = {
  BALLISTA:      'Ballista',
  CATAPULT:      'Catapult',
  BATTERING_RAM: 'Battering Ram',
  SIEGE_TOWER:   'Siege Tower',
} as const;

export const HeroUnitName = {
  // Non-mage
  FIGHTER:     'Fighter',
  HAMMER_LORD: 'Hammer-lord',
  RANGER:      'Ranger',
  SHADOW_BLADE:'Shadowblade',
  OGR:         'Ogr',
  // Mage
  PYROMANCER:  'Pyromancer',
  CLERIC:      'Cleric',
  DRUID:       'Druid',
  ENCHANTER:   'Enchanter',
  NECROMANCER: 'Necromancer',
  // DRIVEN Doctrine
  WARSMITH:    'Warsmith',
} as const;

export const UnitRank = {
  REGULAR: 'regular',
  VETERAN: 'veteran',
  ELITE:   'elite',
} as const;

export const MAX_HERO_LEVEL = 32;

// ── Derived type aliases ───────────────────────────────────────────────────────

export type RegularUnitType = (typeof RegularUnitName)[keyof typeof RegularUnitName];
export type WarMachineType  = (typeof WarMachineName)[keyof typeof WarMachineName];
export type HeroUnitType    = (typeof HeroUnitName)[keyof typeof HeroUnitName];
export type UnitRankType    = (typeof UnitRank)[keyof typeof UnitRank];

/** Matches StructureConfig.type — RTS returns the type name of each destroyed building. */
export type BuildingType = 'castle-wall' | 'gate' | 'tower' | 'keep' | 'barracks';

// ── Core combat types ─────────────────────────────────────────────────────────

export interface CombatStats {
  hp: number;
  attack: number;
  armor: number;
  moveSpeed: number;
  attackSpeed: number;  // attacks per second
  accuracy?: number;    // 0.0–1.0; undefined = always hits (melee)
  range?: number;       // px; undefined = melee
}

/** Artifact is opaque to the RTS — received in HeroState and returned unchanged. */
export interface Artifact {
  id: string;
  name: string;
}

// ── Army unit state types (from TBS shared types) ─────────────────────────────

export interface RegularsState {
  type: RegularUnitType;
  rank: UnitRankType;
  count: number;
  combatStats: CombatStats;
  cost: number;  // maintenance cost per turn per unit
}

export interface HeroState {
  id: string;        // uuid
  type: HeroUnitType;
  name: string;
  level: number;
  combatStats: CombatStats;
  artifacts: Artifact[];
  mana?: number;    // produced per turn; undefined for non-magic heroes
  cost: number;     // maintenance cost per turn
}

export interface WarMachineState {
  type: WarMachineType;
  count: number;
  /** How many battles this machine can survive before destruction. Decrements each battle. */
  durability: number;
}

// ── Battlefield config ────────────────────────────────────────────────────────

export type TerrainType = 'plains' | 'forest' | 'swamp' | 'mountains' | 'snow';

export interface StructureConfig {
  type: BuildingType;
  hp: number;
  armor: number;
}

export interface BattlefieldConfig {
  type: 'open-field' | 'siege';
  terrain: TerrainType;
  /**
   * Zone split as fractions of total battlefield height (must sum to 1.0).
   * Defaults to attacker: 0.20 / neutral: 0.10 / defender: 0.70.
   */
  zones?: {
    attacker: number;
    neutral: number;
    defender: number;
  };
  /** Structures present — empty by default; non-empty implies type: 'siege'. */
  structures?: StructureConfig[];
}

// ── Battle input / output ─────────────────────────────────────────────────────

export interface BattleArmy {
  /** Identifier of the controlling player or AI */
  controlledBy: string;
  regulars: RegularsState[];
  heroes: HeroState[];
  warMachines: WarMachineState[];
}

export interface BattleContext {
  /** Which side the human player controls */
  playerSide: 'attacker' | 'defender';
  attacker: BattleArmy;
  defender: BattleArmy;
  battlefield: BattlefieldConfig;
}

export interface BattleResult {
  winner: 'attacker' | 'defender';
  endCondition: 'annihilation' | 'retreat' | 'objective' | 'stalemate';
  /** Full army state of the winning side after battle (survivors + captured war machines) */
  winnerArmy: BattleArmy;
  /** Units the winner lost during the battle */
  winnerLost: BattleArmy;
  /** Units the loser lost during the battle */
  loserLost: BattleArmy;
  /** Buildings destroyed during this battle */
  lostBuildings: BuildingType[];
}

/** Internal type passed from DeployScene to BattleScene */
export interface DeployResult {
  /** Placed pack positions indexed by pack id */
  placements: Map<string, { x: number; y: number }>;
  /** Packs that did not fit in the 25-slot limit, queued as reinforcements */
  reinforcementQueue: Array<RegularsState | HeroState>;
}
