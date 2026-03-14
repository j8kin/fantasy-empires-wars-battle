# RTS Battle — Game Specification

> **Status:** Active — all known open questions resolved.
> Decisions marked `[OPEN]` need confirmation before implementation.
>
> This document is the authoritative spec for the RTS battle sub-game.
> It is updated as design decisions are made.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Integration with TBS](#2-integration-with-tbs)
3. [Battlefield](#3-battlefield)
4. [Unit System](#4-unit-system)
5. [Deploy Phase](#5-deploy-phase)
6. [Battle Phase](#6-battle-phase)
   - 6.11 Special Unit Abilities (Orc Bloodlust, Gargoyle Flight, Golem Wall-Buster, Dendrite)
7. [Hero Aura System](#7-hero-aura-system)
   - 7.8 DRIVEN Faction — Command Radius, Instant Defeat, Magic Resistance
8. [Scene Architecture](#8-scene-architecture)
9. [Development Steps](#9-development-steps)
10. [Resolved Decisions](#10-resolved-decisions)
11. [Unit Type Reference](#11-unit-type-reference)

---

## 1. Overview

The RTS battle module is a Phaser 3 scene group embedded inside the larger
Turn-Based Strategy (TBS) application. When a battle is triggered in the TBS layer,
it passes army and battlefield context to the RTS module, which runs the battle and
returns a `BattleResult`.

The battle has two sequential phases:

1. **Deploy Phase** — player and opponent place their armies on the battlefield
2. **Battle Phase** — real-time combat with semi-autonomous units

The human player can be either the attacker or the defender — this is determined
by the TBS context passed at startup.

---

## 2. Integration with TBS

### 2.1 Input — `BattleContext`

The TBS app provides a `BattleContext` object when launching the battle module.
`playerSide` tells the RTS which army the human controls.

```typescript
export interface BattleContext {
  /** Which side the human player controls */
  playerSide: 'attacker' | 'defender';
  attacker: BattleArmy;
  defender: BattleArmy;
  battlefield: BattlefieldConfig;
}

export type TerrainType = 'plains' | 'forest' | 'swamp' | 'mountains' | 'snow';

export interface BattlefieldConfig {
  type: 'open-field' | 'siege';
  terrain: TerrainType;

  /**
   * Zone split as fractions of total battlefield height (must sum to 1.0).
   * If omitted, defaults to the standard split below.
   */
  zones?: {
    attacker: number;   // default: 0.20
    neutral:  number;   // default: 0.10
    defender: number;   // default: 0.70
  };

  /** Siege-only: structures in the defender zone */
  structures?: StructureConfig[];
}

export interface StructureConfig {
  type: 'castle-wall' | 'gate' | 'tower' | 'keep' | 'barracks';
  hp: number;
  armor: number;
}
```

### 2.2 Output — `BattleResult`

Returned to TBS when the battle ends (victory, annihilation, retreat, or stalemate).

```typescript
export interface BattleResult {
  winner: 'attacker' | 'defender';
  endCondition: 'annihilation' | 'retreat' | 'objective' | 'stalemate';
  survivors: {
    attacker: ArmySurvivorState;
    defender: ArmySurvivorState;
  };
  /**
   * War machines (Catapult / Ballista only) that transfer to the winner.
   * Includes both mid-battle captures and post-battle auto-capture.
   * Note: if the winner is DRIVEN, this array is empty — DRIVEN destroys all captured machines.
   */
  capturedWarMachines: WarMachineState[];
}

export interface ArmySurvivorState {
  regulars: RegularsState[];      // dead units removed, count reduced
  heroes: HeroState[];            // dead heroes omitted entirely
  /**
   * Ballista and Catapult only — durability updated on survivors.
   * Battering Ram and Siege Tower are NOT returned (they become battlefield scenery).
   * If DRIVEN won: this array is empty for both sides.
   */
  warMachines: WarMachineState[];
}
```

---

## 3. Battlefield

### 3.1 Zone Layout

The battlefield is divided into three horizontal zones during the **Deploy Phase**.
Attacker is always at the **top**; defender at the **bottom**.

```
┌────────────────────────────────────────────────────┐  ──
│                                                    │   │ 20%  (default)
│         ATTACKER DEPLOY ZONE                       │   │
│                                                    │   │
├── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ┤  ──
│         NEUTRAL ZONE                               │   │ 10%
├── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ┤  ──
│                                                    │   │
│         DEFENDER DEPLOY ZONE                       │   │ 70%
│         (structures placed here for siege)         │   │
│                                                    │   │
└────────────────────────────────────────────────────┘  ──
```

**Camera orientation:**
- If `playerSide === 'attacker'` → player's units are at the top; camera starts there.
- If `playerSide === 'defender'` → player's units are at the bottom; camera starts there.
- The battlefield coordinates stay fixed; only the initial camera position and HUD labels adapt.

**Zone percentages** are configurable via `BattlefieldConfig.zones`.
Default split (20 / 10 / 70) applies when omitted. The TBS layer may provide different
splits for special scenarios (e.g., desperate last-stand siege: 10 / 5 / 85).

### 3.2 Battlefield Generation

The RTS procedurally generates the map from `BattlefieldConfig` at scene start:

| Config field | Generated output |
|---|---|
| `type: 'siege'` | Castle walls + gate + towers at the neutral/defender boundary |
| `type: 'open-field'` | Flat terrain with scattered cover objects |
| `terrain: 'forest'` | Tree clusters in neutral and defender zones |
| `terrain: 'swamp'` | Mud patches that reduce movement speed |
| `terrain: 'mountains'` | Impassable rock formations with narrow passes |
| `terrain: 'snow'` | Cosmetic snow layer; slight movement penalty |

Structures (walls, gate, towers, keep) are **destructible objects** with HP and armor —
not visual decorations. Destroying the **gate** opens a path.

### 3.3 Stalemate Detection

A stalemate occurs when the attacker cannot reach any valid target or objective:

- All remaining attacker units are melee-only AND all paths to enemies/structures are
  blocked by intact walls with no openings
- No ranged units or siege equipment capable of damaging those structures remain
- This state is confirmed if no attacker unit deals damage for **60 consecutive seconds**

**Stalemate result:** Attacker units automatically enter `RETREATING` state.
`BattleResult.endCondition = 'stalemate'`. Defender wins.

---

## 4. Unit System

### 4.1 Pack System

During **Deploy Phase**, the army is organized into **packs** (slots).
Packs are the unit of deployment on the battlefield.

| Army unit type | Pack size |
|---|---|
| Regular units | Up to **20** units per pack |
| Hero | **1** hero per pack |
| War machine | **1** machine per pack |

**Pack calculation for regulars:**
```
packs = ceil(count / 20)
```
Example: 123 Orc Warriors → `ceil(123 / 20)` = **7 packs** (6 × 20 + 1 × 3)

**Maximum deployed packs per side: 25**

Packs beyond the 25-slot limit are queued as **reinforcements** (§6.8).

> **War machine exception:** War machines that don't fit within the 25-pack limit
> are **permanently lost** — they cannot enter as reinforcements. Players must choose
> which war machines to bring.

### 4.2 Unit Sprite Registry

A central `UnitSpriteRegistry` maps any `RegularUnitType | HeroUnitType | WarMachineType`
to a sprite configuration. Unknown types fall back to `'default'`.

```typescript
interface UnitSpriteConfig {
  textureKey: string;
  frameWidth: number;
  frameHeight: number;
  scale?: number;                      // default: 1.0
  origin?: { x: number; y: number };   // default: { x: 0.5, y: 1.0 }
  animations: {
    idle?:    AnimDef;
    walk:     AnimDef;                 // required
    attack?:  AnimDef;
    death?:   AnimDef;
    ranged?:  AnimDef;
  };
}

interface AnimDef {
  frames: number[];
  frameRate: number;
  repeat: number;   // -1 = loop
}
```

**Adding a new unit sprite:**
1. Drop animation frames into `/sprites/<unit-type>/`
2. Register one `UnitSpriteConfig` entry in `UnitSpriteRegistry`
3. Done — all game code resolves sprites through the registry automatically

---

## 5. Deploy Phase

### 5.1 Flow

1. Battlefield renders with zone boundary lines clearly visible
2. Player's **army panel** on the side lists all packs grouped by unit type
3. Player clicks a pack in the panel → clicks a position in their deploy zone to place it
4. Placed pack shows as a single sprite with a count badge (e.g., "×20")
5. Packs can be dragged and repositioned until "Ready" is confirmed
6. War machine placement triggers the loading dialog (§5.2)
7. Opponent deploys simultaneously via AI (hidden until battle starts)
8. **"Ready for Battle"** → transitions to Battle Phase

### 5.2 War Machine Loading

When a war machine pack is placed on the field:
- A dialog appears listing the required crew unit type and count
- That many regular units are consumed from the matching stack in the army panel
- The machine's effective stats (attack, range, fire rate) are computed from
  `WarMachineState` + crew `CombatStats`
- If insufficient crew exists, placement is blocked with a clear error

### 5.3 Reinforcement Queue

Packs beyond the 25-slot limit are queued in this priority order:
1. Heroes
2. Regular unit packs (in `BattleArmy.regulars` order)
3. War machines → **dropped entirely**, not queued

---

## 6. Battle Phase

### 6.1 Pack Expansion

At battle start, every deployed pack **expands** into individual unit sprites:

- Pack of 20 Orc Warriors → 20 individual `UnitSprite` instances
- Units spread into a **4 × 5 formation** within the pack's placement footprint
- Partial packs use the same grid, leaving trailing cells empty
- From this point each unit is fully independent — it has its own position, HP, and AI state

### 6.2 Battle Entities

| Entity class | Source | Visual |
|---|---|---|
| `RegularUnit` | `RegularsState` pack | Sprite; HP shown on hover/selection |
| `HeroUnit` | `HeroState` | Sprite + **name label** + **HP bar** (always visible) + **aura ring** |
| `WarMachineUnit` | `WarMachineState` | Large sprite + HP bar + crew count badge |
| `Structure` | `StructureConfig` | Static sprite with HP bar (siege only) |

### 6.3 Unit AI — State Machine

```
         auto-aggro radius
IDLE ──────────────────────────> ENGAGING
  │                                  │
  │  target assigned by player       │  target destroyed → back to IDLE
  └──> MOVING ─────────────────────> │
             │                       │
             │  enemy intercepts     │
             └──────────────────> ENGAGING
                                     │
                               HP < flee_threshold
                               OR morale < flee_morale
                                     │
                                     v
                                 RETREATING ──> border edge → despawn (survives)
```

War machines have an additional transition:
```
IDLE / ENGAGING ──> ABANDONED (owner retreat)
ABANDONED ──> CAPTURED (enemy unit reaches it, no friendly crew nearby)
```

**State behaviors by unit type:**

| State | Melee regular | Ranged regular | Hero | War machine |
|---|---|---|---|---|
| **IDLE** | Scan nearby | Scan nearby | Wider scan radius | Stationary, scan |
| **MOVING** | Charge target | Advance to optimal range, then hold | Charge | Tow slowly |
| **ENGAGING** | Melee nearest | Fire projectile; kite backwards if melee closes | High-damage melee | Fire area attack |
| **RETREATING** | Run to own border | Run to own border | Run (high flee threshold) | Abandoned in place |

### 6.4 Target Priority (default; player can override)

1. Closest enemy unit actively threatening the pack
2. Enemy **hero** (high-value target)
3. Enemy **war machine**
4. Player-assigned target (set by right-clicking an enemy)
5. Nearest enemy unit (fallback)

### 6.5 Combat Resolution

#### Attack Types

| Type | Who uses it | Facing | Blocked by units | Blocked by terrain | Targets |
|---|---|---|---|---|---|
| **melee** | Regular units | Required (front) | Yes | Yes | 1 unit in contact |
| **hero-arc** | Fighter, Hammerlord, Ogr, Warsmith, Cleric | Required (front arc) | No — weapon reach | No — weapon reach | Up to 3 in forward arc, at buffer range |
| **ranged** | Elf, Dark-Elf, Halfling, Ranger hero | No | Yes | Yes | 1 chosen target |
| **reach** | Dendrite, Druid hero | No — 360° | No | No | 1 chosen target; damage falloff |
| **fireball** | Pyromancer hero | No | No | No | All units in blast radius (friendly + enemy) |
| **death-bolt** | Necromancer hero | No | No | No | Up to 3 units in a line |
| **vortex** | Enchanter hero | Required (forward) | No | No | 5 fixed zones: 3 forward + 1 left + 1 right |
| **area** | Catapult | No | No | No | All units in splash radius at impact |
| **piercing** | Ballista | No | No | No | All units in a line (no cap) |

#### Damage Formula

**Melee / Reach:**
```
damage = max(1, attacker.attack + morale_bonus − defender.armor)
```
Both sides deal damage simultaneously on clash.

**Reach falloff:**
```
damage = max(1, baseDamage × (1 − distance / maxReachRadius) − defender.armor)
```

**Ranged:**
- Unit stops at optimal range, fires projectile (arc or straight depending on type)
- If melee enemy enters `flee_range` → kite backward while continuing to fire
- Accuracy stat determines miss chance (TBD exact formula)

**Area (war machine catapult-type):**
- Arc projectile → splash damage within radius to all units at impact zone

**Piercing (war machine ballista-type):**
- Straight bolt → hits all units in a line from source to max range

### 6.6 Morale

Every unit has a **morale** value (0–100).
Starting morale is based on rank:

| Rank | Starting morale |
|---|---|
| Regular | 50 |
| Veteran | 65 |
| Elite | 80 |

**Morale modifiers (continuous):**
- In range of a friendly non-magic hero's aura: **+morale/s**
- In range of enemy Necromancer's aura: **−morale/s**
- Nearby friendly unit death: **−5** (one-time)
- Nearby hero death: **−20** immediately + **−5/s** debuff for 30 s (§7.3)

**Morale effects:**
```
attack bonus  = (morale − 50) * 0.2   // −10 to +10 at extremes
flee_threshold HP% = 30% − (morale − 50) * 0.2   // low morale = flee at higher HP
```

### 6.7 Victory Conditions

| Condition | Winner | `endCondition` |
|---|---|---|
| All opponent units dead | Remaining side | `'annihilation'` |
| One side retreats (player command) | Opposing side | `'retreat'` |
| Attacker destroys the castle **keep** | Attacker | `'objective'` |
| Stalemate detected (§3.3) | Defender | `'stalemate'` |

### 6.8 Reinforcements

- Trigger: a regular-unit pack on the field reaches **0 survivors**
- Next pack from the reinforcement queue enters from the player's border edge
  (attacker: top edge; defender: bottom edge)
- Entering units expand immediately into 4×5 formation and receive `MOVING` state
  toward the last known enemy cluster
- Heroes in the queue enter the same way on the same trigger (1-unit "pack")

### 6.9 Retreat

1. Player clicks **"Retreat"** in the HUD (with confirmation prompt)
2. All surviving player units enter `RETREATING` state → move toward their border edge
3. Units reaching the border despawn and are counted as survivors in `BattleResult`
4. Player's war machines are **abandoned** → opponent may capture them freely
5. Battle ends when all retreating units have despawned or been killed

### 6.10 War Machine System

#### 6.10.1 Two-Phase HP Model

War machines have two distinct HP pools that activate sequentially:

```
┌─────────────────────────────────────────────────────────┐
│  PHASE 1: Crew HP                                       │
│  Represents the operating crew (consumed during deploy) │
│  Effectiveness = crewHP / maxCrewHP  (0.0 → 1.0)        │
│                                                         │
│  actualDamage     = baseDamage  × effectiveness         │
│  actualMoveSpeed  = baseSpeed   × effectiveness         │
│                                                         │
│  crewHP → 0  ═══════════════╗                           │
│                             ▼                           │
├─────────────────────────────────────────────────────────┤
│  PHASE 2: Structure HP                                  │
│  Machine body. Crew is dead; machine is UNOCCUPIED.     │
│  Can be CAPTURED by any melee unit (except DRIVEN).     │
│  If attacked while unoccupied → structural damage.      │
│                                                         │
│  structureHP → 0  ════════╗                             │
│                           ▼                             │
│               DESTROYED (explosion, removed)            │
└─────────────────────────────────────────────────────────┘
```

**Crew HP** is calculated from the crew units loaded during deploy:
`maxCrewHP = crewCount × crewUnit.combatStats.hp`

**Structure HP** is a fixed value per machine type defined in `BATTLE_CONFIG.warMachine.*`.

#### 6.10.2 Effectiveness Degradation

As crew HP decreases, all machine outputs scale proportionally:

| Crew HP % | Damage output | Move speed | Fire rate |
|---|---|---|---|
| 100% | 100% | 100% | 100% |
| 75% | 75% | 75% | 75% |
| 50% | 50% | 50% | 50% |
| 25% | 25% | 25% | 25% |
| 0% (Phase 2) | 0% — unoccupied | 0% — stationary | — |

All three scale identically via `effectiveness`. There is no threshold — degradation is continuous.

#### 6.10.3 Capture Rules

**Only Catapult and Ballista can be captured during battle.**
Battering Ram and Siege Tower become landscape features and cannot be captured or destroyed
(see their profiles in §6.10.5).

**Capture process for Catapult / Ballista:**

1. Machine enters Phase 2 (crew dead) → UNOCCUPIED
2. Enemy melee unit of the **correct crew type** reaches it → machine is captured
3. Capturing unit(s) become the new crew; machine reactivates at `recapturedEffectiveness`
   (configurable — default 70%, representing a fresh but less-drilled crew)
4. **If the wrong unit type reaches it:** machine is **destroyed** — they cannot operate it
   and the confrontation damages it beyond use
5. DRIVEN units **cannot** capture or operate war machines under any circumstances

**Post-battle auto-capture** (applied to battle result after combat ends):
- If **defender wins**: all surviving Catapults and Ballistas on the field transfer to the defender
- If **DRIVEN army wins**: all war machines on the field are **destroyed**
  (DRIVEN will not keep equipment they cannot use)
- If **attacker wins** (non-DRIVEN): surviving machines remain with attacker

When the owning side **retreats**: crew flees with them, machine enters Phase 2 in place.
Opponent then applies the capture rules above.

#### 6.10.4 State Transitions Summary

| Machine | Capturable during battle? | Post-battle (defender wins) | Post-battle (DRIVEN wins) |
|---|---|---|---|
| **Ballista** | ✅ correct crew type only | → Defender | Destroyed |
| **Catapult** | ✅ correct crew type only | → Defender | Destroyed |
| **Battering Ram** | ❌ becomes landscape | N/A (landscape) | N/A (landscape) |
| **Siege Tower** | ❌ becomes indestructible bridge | N/A (landscape) | N/A (landscape) |

**Events during battle:**

| Event | Trigger | Result |
|---|---|---|
| **Crew wiped** | Crew HP → 0 (Ballista / Catapult) | Phase 2 — UNOCCUPIED; can be captured |
| **Wrong crew captures** | Wrong unit type reaches unoccupied machine | Machine **destroyed** |
| **Captured** | Correct crew type reaches unoccupied Catapult or Ballista | Machine switches sides |
| **Destroyed** | Structure HP → 0 | Explosion; removed from field |
| **Abandoned** | Owner retreats | Crew flees; machine becomes unoccupied in place |
| **Ram anchors** | Battering Ram breaks the gate | Crew unmounts as infantry; Ram becomes landscape |
| **Tower anchors** | Siege Tower contacts wall | Crew unmounts at wall top; Tower becomes permanent bridge |
| **Tower/Ram crew killed in transit** | Crew HP → 0 before reaching objective | Crew dead; machine halts as landscape obstacle |

`WarMachineState.durability` decrements by 1 for each Ballista/Catapult that survives a battle.
Battering Ram and Siege Tower do not return in `BattleResult` (they become battlefield scenery).

---

#### 6.10.5 War Machine Profiles

---

##### Battering Ram

- **Purpose:** Open the castle gate. Nothing else.
- **Damage target:** Gate structure only — deals 0 damage to units and all other structures
- **Move speed:** Slow; crew pushing it forward
- **Attack pattern:** Melee contact with gate — repeated bashing on arrival
- **Effectiveness:** Gate damage rate and move speed scale with crew HP
- **Crew:** Warriors or Orcs (heavy melee) — strength matters for pushing
- **Cannot be captured** — becomes landscape after use

**Lifecycle:**

```
Phase 1 — Moving + bashing:
  [CREW pushes RAM] ──► ╔════╗
                        ║GATE║ ← crew HP drives gate damage rate

Gate breaks:
  → Gate opening is now passable — attacker units proceed through
  → Crew UNMOUNTS at the gate opening as regular infantry and joins the assault
  → Number of unmounted units = surviving crew (proportional to remaining crew HP)
  → Ram wreckage stays as inert landscape — meaningless to both sides, not capturable
```

If the crew is killed *before* reaching the gate (crew HP → 0 in transit):
- No one to unmount — crew is dead
- Ram halts in place as landscape (blocks movement, serves no further purpose)

---

##### Ballista

- **Purpose:** Long-range anti-unit weapon. Kills specific targets.
- **Damage target:** Units only — deals 0 damage to walls, gates, structures
- **Attack pattern:** `piercing` bolt — hits up to 3 units in a line
- **Wall penetration:** Can target and hit units **behind castle walls**
  - Accuracy penalty: `−BATTLE_CONFIG.warMachine.ballista.wallPenaltyAccuracy`
  - Damage penalty: `−BATTLE_CONFIG.warMachine.ballista.wallPenaltyDamage`
- **Optimal targets:** Enemy heroes, war machine crew, densely packed unit lines
- **Crew:** Elf or Dark-Elf (precision aiming)
- **Effectiveness:** Damage and fire rate scale with crew HP

---

##### Catapult

- **Purpose:** Siege weapon primarily for destroying walls and structures.
- **Damage target:** Structures preferred; units with low accuracy
  - vs. structures: full damage, reliable
  - vs. units: heavy inaccuracy; projectile lands in approximate area
    (`scatter = BATTLE_CONFIG.warMachine.catapult.unitTargetScatter` px radius from aim point)
  - Units inside the scatter radius take splash damage even on a "miss" vs. a specific unit
- **Attack pattern:** `area` — arc projectile + splash on impact
- **Friendly fire:** Yes — splash radius hits all units regardless of faction
- **Crew:** Warriors or Dwarfs (heavy labour)
- **Effectiveness:** Damage, accuracy (scatter decreases), and fire rate scale with crew HP

```
     ⌒⌒⌒
    ╱   ╲    arc trajectory
[CAT]    ╳  impact zone (scatter circle)
          ╲__/ splash radius
```

---

##### Siege Tower

- **Purpose:** Deliver troops to the top of castle walls; create a permanent crossing.
- **Damage:** Zero — the Siege Tower deals no damage to anything
- **Move:** Very slow; high structural HP (hardest machine to destroy in transit)
- **Crew:** Ward-hands or Halflings (agile climbers)
- **Cannot be captured** — becomes indestructible landscape once anchored

**Lifecycle:**

```
Phase 1 — Moving toward wall:
  [CREW inside TOWER] ──► ║wall║
  (tower can take damage from towers, Ballista, etc. — crew HP reduces)

Tower makes contact with wall → ANCHORS:
  ┌──┐ ← attacker units enter and climb
  │  │
  │  │──── wall ──── (tower is now fused to wall)
  │  │
  └──┘ ← defenders can also descend back through it

  → Tower becomes INDESTRUCTIBLE permanent bridge (both sides can use it)
  → Crew UNMOUNTS at the wall top as regular infantry units
  → Surviving crew count ∝ crew HP at moment of contact:
      unmountedUnits = ceil(crewHP / maxCrewHP × originalCrewCount)
```

**Key rules after anchoring:**
- The bridge is permanent and usable by the **attacker only** — the tower is on the attacker's
  approach side; the defender has no use for it and cannot capture or operate it
- Any non-war-machine attacker unit can use the bridge to reach the wall top
- Tower cannot be destroyed or captured once anchored — permanent landscape

If the crew is killed *before* reaching the wall (crew HP → 0 in transit):
- Tower halts, no one to steer it — becomes an inert obstacle in the field
- Cannot anchor on its own; battle continues without the bridge

---

### 6.11 Special Unit Abilities (Passives)

Certain regular unit types have intrinsic abilities beyond standard combat stats.

#### Orc — Bloodlust

- **Aura immunity:** Immune to the Ogr's Terror aura (they do not fear Ogrs)
- **Bloodlust passive:** Every time an Orc deals damage or receives damage, it gains
  +2 morale and +1% attack (stacks up to a cap, resets at end of battle)
- Orcs become **more effective** as a battle drags on — they should not be retreated early
- High-morale Orcs may pursue fleeing enemies rather than holding position

#### Gargoyle — Flight

- **Ignore terrain:** Gargoyles fly over all terrain obstacles (forests, swamp, rocks)
- **Scale walls:** In siege battles, Gargoyles can fly directly over castle walls and
  attack units and structures behind them without needing a gate to be opened
- **Counter:** Tower archers and Ballista have bonus accuracy vs. flying units
- **Cannot capture war machines** — they cannot physically operate ground equipment

#### Golem — Wall-Buster

- **Bonus structure damage:** Golems deal `×3` damage to walls, gates, and towers
  (equivalent to a Battering Ram, but as a field unit)
- **Heavy armor:** Golems have very high `armor` stat but low movement speed
- **Cannot be kited** by ranged units effectively — their HP pool absorbs most attrition

#### Dendrite — Reach Attack

Dendrite is a DRIVEN Doctrine unit with a plant/organic form. Its defining mechanic
is a **Reach Attack** — a new attack type distinct from melee, ranged, and area damage.

**Properties:**

| Property | Value |
|---|---|
| Facing required | None — 360° target selection |
| Blocked by other units | No — roots go under/around |
| Blocked by terrain/walls | No — roots go underground |
| Hits all units in radius | No — one chosen target per attack |
| Visual | Brief tendril extension to target; no projectile object |

**Damage falloff:**
```
damage = baseDamage × (1 − distance / maxReachRadius)
```
Full damage at contact. Approaches zero at the edge of reach. Minimum 1 if in range.

**Target selection:**
- AI: prefers high-value targets just outside the front melee line
  (enemy heroes, ranged units, war machine crew standing behind the main pack)
- Player: can manually assign any visible unit within reach radius as the target
- The Dendrite still has a primary melee attack for units in direct contact (normal melee)

**Tactical purpose:**
Dendrite can reach through a pack of enemy Warriors to strike the hero or Ranger
standing two rows back. Opponents cannot use bodyguards as a shield against Reach Attacks.
The damage falloff keeps it from being too powerful at maximum extent.

**Implementation note:**
`AttackType` enum should include `'reach'` alongside `'melee'`, `'ranged'`, `'area'`,
`'piercing'`. Reach attack properties: `reachRadius`, `damageFalloff`, `ignoresObstacles: true`.
The tendril animation is a short visual-only effect (not a physics projectile).

### 6.12 Hero Attack Patterns

Heroes have unique attack mechanics that differ from regular units. All hero melee
parameters live in `BATTLE_CONFIG.heroAttack.*` (see §7.9).

---

#### Hero Arc — Melee Heroes (Fighter, Hammer-lord, Ogr, Warsmith, Cleric)

Melee heroes do not attack at contact range. They have a **weapon reach buffer**:
a zone slightly ahead of their sprite where their weapon hits, before enemies physically
reach the hero. This gives them a survivability edge and enables **hit-and-run**.

```
  ┌─────────────────────┐
  │   weapon reach zone │ ← hero attacks enemies here
  │   (buffer distance) │   up to 3 targets across front arc
  ├─────────────────────┤
  │       HERO          │
  └─────────────────────┘
```

**Properties:**
- `weaponReach`: distance ahead of the hero where attacks land (~1.5× regular melee range)
- `arcTargets`: max targets hit simultaneously (up to 3 in forward arc)
- `arcAngle`: forward cone angle (≈120°)
- Both sides do NOT deal damage simultaneously — hero attacks first (they keep enemies at arm's length)

**Hit-and-run pattern:**
1. Hero engages — attacks 3 enemies in arc at buffer distance
2. When surrounded on too many sides (configurable threshold), transitions to `MOVING`
3. Hero runs in the direction with fewest enemies — enemies follow
4. After escaping melee range, stops, turns back to ENGAGING
5. Repeats — effective at chewing through tight formations without dying

Enemies must push INTO the hero's weapon zone to deal damage (they get hit while advancing).

---

#### Pyromancer — Fireball (Friendly Fire)

```
              [impact]
             /   ╔═╗
            /    ║ ║  ← blast radius, damages ALL units
[Pyromancer]     ╚═╝    (friendly and enemy equally)
```

- Projectile travels in an arc to the target position
- On impact: area damage to all units within `fireballRadius` — no faction distinction
- The Pyromancer's own troops in the blast zone take full damage
- AI: Pyromancer will not fire if a configurable ratio of friendly units are in the blast zone;
  AI targeting prefers the densest cluster of enemy units to maximise hits
- Player-controlled: player is responsible for friendly fire consequences
- **Structure damage:**
  - Wooden structures (gate, wooden doors): `fireballDamage × woodStructureMultiplier`
  - Stone structures (walls, towers, keep): `fireballDamage × stoneStructureMultiplier`
  - Default multipliers in `BATTLE_CONFIG.heroAttack.pyromancer`:
    `woodStructureMultiplier: 1.5`, `stoneStructureMultiplier: 0.3`

---

#### Necromancer — Death Bolt

```
[Necromancer] ──●──●──●──   (up to 3 units hit in line)
```

- Straight dark bolt projectile in the direction of the target
- Pierces through up to 3 units in a line (stops after 3 regardless of remaining distance)
- Same direction/targeting as Ballista but hero-cast; capped at 3
- Works on both units and structures (reduced damage vs. stone)
- `BATTLE_CONFIG.heroAttack.necromancer.boltMaxTargets = 3`

---

#### Druid — Reach (Enhanced)

Same `reach` attack type as Dendrite (§6.11), with hero-level scaling:

- `reachRadius` scales with level: `BASE_REACH + druid.level * REACH_PER_LEVEL`
- Damage = `baseDamage × (1 − distance / reachRadius)` with level scaling on base
- **360° target selection**, ignores unit and terrain obstruction
- **Bonus vs. wooden structures:** Druid roots deal ×2 damage to wooden gates and doors
  (can open a wooden gate without a Battering Ram)
- Roots/vines visual: tendrils extending from the Druid's feet to the target

---

#### Enchanter — Air Vortex

The Enchanter releases a vortex that covers a fixed cross/T-shaped pattern:

```
         [F3]
         [F2]
[L1] [F1][ENC][R1]
```

- `[F1][F2][F3]` = 3 zones forward (column along facing direction)
- `[L1]` = 1 zone to the left (same row as Enchanter)
- `[R1]` = 1 zone to the right (same row as Enchanter)
- Each zone is approximately 1 unit-width wide; units inside any zone take full damage
- **No damage falloff** — all 5 zones deal equal damage
- **Structure damage:** Air Vortex deals the same damage multiplier vs. stone walls as
  Golem melee (×3 vs. structures) — Enchanter can breach castle walls
- Cooldown between vortex casts: `BATTLE_CONFIG.heroAttack.enchanter.vortexCooldown`

---

#### Cleric — Mace Strike (Hero Arc)

The Cleric uses the standard **Hero Arc** (see above) with a mace weapon.

In addition, the Cleric's **Divine Blessing** aura (§7.2) has a secondary effect:
all Undead within the aura radius — enemy or friendly — take continuous holy damage.
See §7.2 Cleric entry for configuration.

---

## 7. Hero Aura System

Heroes project a continuous **aura** — a circular area effect centred on the hero
that passively modifies units nearby as long as the hero is alive.

### 7.1 Aura Radius

```
auraRadius = BASE_RADIUS + hero.level * RADIUS_PER_LEVEL
```

Tunable constants: `BASE_RADIUS = 80px`, `RADIUS_PER_LEVEL = 20px`
A level-5 hero has a radius of 180 px.

### 7.2 Aura Catalogue

#### Non-Mage Heroes

| Hero | Aura | Effect | Target | Ring colour |
|---|---|---|---|---|
| **Fighter** | **Battle Cry** | +morale/s, +attack% | Friendly | Golden / amber |
| **Hammer-lord** | **Iron Resolve** | +armor, +damage vs. structures | Friendly (melee) | Steel grey |
| **Ranger** | **Eagle Eye** | +accuracy, +effective range | Friendly **ranged only** | Forest green |
| **Shadowblade** | **Shadow Veil** | Enemy aggro radius −30%; friendly move speed +15% | Friendly | Dark purple |
| **Ogr** | **Terror** | −morale/s; enemy flee threshold raised | **Enemy** | Dark red |

> **Ogr + Orc interaction:** Orc units are **immune** to the Terror aura — they do not
> respect fear, not even from an Ogr. Additionally, Orcs have the **Bloodlust** passive
> (see §6.11): they gain morale and attack when they deal or receive damage, making them
> more dangerous as a fight intensifies, not less.

#### Mage Heroes

| Hero | Aura | Effect | Target | Ring colour |
|---|---|---|---|---|
| **Cleric** | **Divine Blessing** | HP regeneration/s (strongest); + continuous Holy Damage to all Undead in radius (enemy and friendly) | Friendly (regen) + All Undead (damage) | Soft blue / white |
| **Druid** | **Nature's Ward** | HP regen/s (weaker than Cleric) + enemy move speed −20% | Friendly (regen) + Enemy (slow) | Leaf green |
| **Enchanter** | **Arcane Empowerment** | +attack, +armor, +move speed (small all-stat buff) | Friendly | Cyan / arcane blue |
| **Pyromancer** | **Infernal Aura** | Periodic fire damage (tick) | **Enemy** | Orange / ember |
| **Necromancer** | **Death's Embrace** | −attack% curse; units that die inside radius have a chance to **rise as Undead** | Enemy (curse) + on-death | Sickly purple / green |

#### Non-Magic Hero — DRIVEN Doctrine (rejects magic entirely)

The Warsmith belongs to the **DRIVEN** faction and follows completely different rules.
**Warsmith has no aura.** Instead, it projects a **Command Radius** (see §7.8).
War machines, morale, and magic effects do not apply to DRIVEN units at all.

| Hero | Mechanic | Effect | Ring colour |
|---|---|---|---|
| **Warsmith** | **Command Radius** | DRIVEN units inside radius can act; outside = DORMANT | Copper / mechanical orange |

### 7.3 Aura Stacking Rules

| Scenario | Rule |
|---|---|
| Two heroes of the **same aura type** | No stack — highest value wins |
| Two heroes of **different aura types** on the same target | Additive — both apply |
| Friendly and enemy aura on the same unit | Both apply simultaneously (e.g., Cleric heals a unit while Necromancer curses its attack) |
| Any aura targeting a **DRIVEN unit** | Ignored — DRIVEN units are fully immune to all auras, friendly and enemy |
| **Warsmith** Command Radius | Not an aura — separate mechanic (§7.8); cannot stack or conflict with auras |

**Warsmith magic resistance:** Warsmith heroes are not immune to magic, but they
resist it proportionally to their level (see §7.8 for formula). Other hero types have no
magic resistance.

### 7.4 Necromancer — Undead Rise

Two categories of Undead exist on the battlefield, with different lifecycles:

#### Permanent Undead (summoned on the strategic map, brought to battle via `BattleArmy`)

- Arrive as normal deployed units (standard pack rules apply)
- If they survive the battle, they return to the TBS army as survivors
- Killed Permanent Undead are gone — they **cannot be raised again** in the same battle

#### Aura-raised Undead (risen during battle by Necromancer aura)

- Trigger: a non-Undead unit dies inside the Necromancer's aura
- Rise chance = `hero.level × riseChancePerLevel` (e.g., level 3 → 15%)
- On success: one Undead unit rises at the death position on the Necromancer's side
- Stats: **50% of the original unit's stats**, **no morale** (never flee), no rank
- Do **not** count toward the 25-pack limit
- Do **not** join the reinforcement queue
- Do **not** return to TBS army — they are temporary battlefield constructs
- **When the Necromancer dies: all aura-raised Undead instantly collapse**
- Killed aura-raised Undead also **cannot be raised again** in the same battle

> The "no re-raising" rule applies universally: once an Undead unit is killed on this
> battlefield, that entity is permanently gone for this engagement.

### 7.4 Global Battle Config

All numerical values for auras, hero attacks, command radius, morale, and magic resistance
live in a single exported `BATTLE_CONFIG` object. This is the **one place** to tune all
parameters — no magic numbers elsewhere in the codebase.

```typescript
// src/game/config/battleConfig.ts
export const BATTLE_CONFIG = {

  // ── Aura system ──────────────────────────────────────────────────────────
  aura: {
    baseRadius: 80,           // px, all heroes
    radiusPerLevel: 20,       // px per hero level

    fighter: {
      moralePerSec: 2,
      attackBonus: 0.05,      // fraction
    },
    hammerLord: {
      armorBonus: 5,
      structureDamageBonus: 0.30,
    },
    ranger: {
      accuracyBonus: 0.20,
      rangeBonus: 50,         // px
    },
    shadowblade: {
      aggroRadiusReduction: 0.30,
      moveSpeedBonus: 0.15,
    },
    ogr: {
      moralePerSec: -3,
      fleeThresholdBonus: 0.10,
    },
    cleric: {
      hpRegenPerSec: 3,
      undeadSurvivalSeconds: 7,   // how long full-HP Undead survives inside aura
      undeadTickInterval: 0.5,    // seconds between holy damage ticks
    },
    druid: {
      hpRegenPerSec: 1.5,
      enemySlowFactor: 0.20,
    },
    enchanter: {
      attackBonus: 0.10,
      armorBonus: 3,
      moveSpeedBonus: 0.10,
    },
    pyromancer: {
      fireDamagePerTick: 5,
      tickInterval: 1.0,
    },
    necromancer: {
      attackCursePerLevel: 0.03,
      riseChancePerLevel: 0.05,   // 5% per level
    },
  },

  // ── Hero attack patterns ─────────────────────────────────────────────────
  heroAttack: {
    arc: {                        // shared by Fighter, Hammerlord, Ogr, Warsmith, Cleric
      weaponReach: 48,            // px buffer ahead of hero
      arcTargets: 3,
      arcAngle: 120,              // degrees
      fleeWhenSurroundedSides: 3, // how many sides need enemies before hit-and-run
    },
    pyromancer: {
      fireballRadius: 80,              // px blast radius
      friendlyFireEnabled: true,
      aiMinFriendlyRatio: 0.25,        // AI won't fire if >25% of blast is friendly units
      woodStructureMultiplier: 1.5,    // fireball vs. wooden gate/doors
      stoneStructureMultiplier: 0.30,  // fireball vs. stone walls/towers
    },
    necromancer: {
      boltMaxTargets: 3,
      boltRange: 400,             // px
    },
    druid: {
      baseReach: 80,              // px
      reachPerLevel: 15,          // px per level
      woodStructureDamageMultiplier: 2.0,
    },
    enchanter: {
      vortexZoneSize: 48,         // px per zone cell
      vortexForwardZones: 3,
      vortexSideZones: 1,         // each side
      structureDamageMultiplier: 3.0,
      vortexCooldown: 2.5,        // seconds
    },
  },

  // ── DRIVEN Command Radius ────────────────────────────────────────────────
  commandRadius: {
    base: 120,                    // px
    perLevel: 15,
  },

  // ── Warsmith magic resistance ─────────────────────────────────────────────
  magicResist: {
    base: 0.10,
    perLevel: 0.02,
    max: 0.75,
  },

  // ── War machines ─────────────────────────────────────────────────────────
  warMachine: {
    // Structure HP (Phase 2) — the machine body after crew is wiped
    structureHp: {
      batteringRam:  80,
      ballista:      60,
      catapult:      100,
      siegeTower:    200,   // toughest — hardest to destroy once anchored
    },
    batteringRam: {
      gateDamagePerSwing: 40,
    },
    ballista: {
      wallPenaltyAccuracy: 0.40,  // −40% accuracy when shooting through walls
      wallPenaltyDamage:   0.25,  // −25% damage through walls
      maxPierceTargets:    3,
      range:               500,   // px
    },
    catapult: {
      unitTargetScatter:   120,   // px radius — how far off-centre shots land vs units
      splashRadius:         80,   // px — damage radius at impact
      structureDamageMultiplier: 2.5,
    },
    siegeTower: {
      moveSpeed:            0.3,  // fraction of normal unit speed
    },
    // Effectiveness when a machine is recaptured (fresh but undrilled crew)
    recapturedEffectiveness: 0.70,
  },

  // ── Morale ───────────────────────────────────────────────────────────────
  morale: {
    startByRank: { regular: 50, veteran: 65, elite: 80 },
    nearbyDeathPenalty: -5,
    heroDeath: { instant: -20, debuffPerSec: -5, debuffDuration: 30 },
    orcBloodlustPerHit: 2,        // morale gained per damage event
    orcAttackBonusPerHit: 0.01,   // attack fraction gained per damage event
    orcBloodlustCap: 50,          // max stacked bonus
  },

} as const;
```

> All values are `as const` — TypeScript-safe and IDE-autocomplete-friendly.
> Swap any number here to tune the entire game without touching game logic.

### 7.5 Cleric — Holy Damage to Undead

The Cleric's **Divine Blessing** aura has a secondary, always-active effect:
all Undead units within the aura radius take continuous holy damage.

- Targets: **all** Undead regardless of faction (enemy Undead + friendly Permanent Undead)
- Effect: not instant — damage is applied on a configurable tick
- The Undead will die within `undeadSurvivalSeconds` seconds if they remain in range
- The damage is applied per tick: `tickDamage = undeadMaxHP / (undeadSurvivalSeconds / tickInterval)`
- Undead that exit the aura stop taking damage immediately

**Faction implication:** Cleric + Necromancer in the same army creates self-conflict —
the Cleric's aura will drain the Necromancer's aura-raised Undead. Permanent Undead
brought from the TBS map are also at risk. This is intentional design tension, not a bug.

Configuration in `BATTLE_CONFIG.aura.cleric`:
```typescript
cleric: {
  hpRegenPerSec: 3,
  undeadSurvivalSeconds: 7,   // how long an Undead survives at full HP inside aura
  undeadTickInterval: 0.5,    // damage tick interval in seconds
}
```

### 7.7 Hero Death Effects

When a hero is killed:

1. **Aura removed immediately** — all affected units lose the buff/debuff
2. **Death penalty** on all friendly units that were inside the aura at time of death:
   - −20 morale (instant)
   - −5 morale/s debuff for **30 seconds** (applied on top of any new hero aura nearby)
3. Hero removed from field and from `BattleResult.survivors.heroes`
4. **Visual:** brief red flash on affected units + floating "−morale" text; aura ring
   shatters outward as a particle burst

### 7.8 Aura Visualisation

- Translucent ring around each hero, colour per table above
- Ring diameter = `auraRadius * 2`
- Opacity pulses slowly (breathing effect)
- On hero death: ring shatters outward with a particle burst
- Units inside an enemy debuff aura (Necromancer, Pyromancer, Terror) get a subtle
  tinted overlay to indicate they are affected

### 7.9 Future Extensions

- `mana` field on `HeroState` is reserved for active-cast spells (not in current scope)
- New hero types: add sprite config + one aura entry — picked up automatically
- Potential Ranger secondary: small melee bonus at reduced multiplier (`[OPEN]`)

---

### 7.10 DRIVEN Faction — Command Radius

The DRIVEN Doctrine is a faction built entirely around constructed/magical beings
controlled by Warsmith heroes. They operate under completely different rules.

#### Faction Constraints

| Rule | Detail |
|---|---|
| **No war machines** | DRIVEN never fields Ballista, Catapult, Battering Ram, or Siege Tower |
| **No mage heroes** | Only Warsmith heroes are available to DRIVEN armies |
| **No other hero types** | Fighter, Ranger, Ogr, etc. are never in a DRIVEN army |
| **Driven regular units** | Only Golem, Gargoyle, and Dendrite |
| **Aura immunity** | DRIVEN units are fully immune to all hero auras (friendly or enemy) |
| **Morale immunity** | DRIVEN units have no morale stat and never flee from morale |

#### Command Radius Mechanic

Each Warsmith projects a **Command Radius** centred on themselves:

```
commandRadius = CMD_BASE + warsmith.level * CMD_PER_LEVEL
```

Tunable: `CMD_BASE = 120px`, `CMD_PER_LEVEL = 15px`

**DRIVEN units inside at least one Warsmith's Command Radius:**
- Act normally — IDLE, MOVING, ENGAGING states work as usual

**DRIVEN units outside ALL Command Radii → enter `DORMANT` state:**
- Stop moving instantly
- Cannot attack
- **Cannot be damaged** — they become inert objects
- Cannot be targeted by spells or auras
- If a Warsmith moves close enough to cover them, they reactivate automatically

```
IDLE / MOVING / ENGAGING ──> DORMANT  (left command radius)
DORMANT ──> IDLE                       (Warsmith moves into range)
```

> **Tactical implication:** Opponents should try to kite Warsmiths away from their
> units, or push DRIVEN units out of range. The Warsmith is both a commander and a
> single point of failure.

#### Warsmith — Instant Defeat Condition

If **all Warsmiths on one side are killed**, the entire DRIVEN army collapses instantly:

- All remaining DRIVEN units on the field enter a brief "shutdown" animation then despawn
- This counts as `endCondition: 'annihilation'` in `BattleResult`
- No units survive — the army is destroyed

> This makes Warsmith heroes extremely high-priority targets for opponents.
> DRIVEN players must protect their Warsmiths aggressively.

#### Warsmith — Magic Resistance

Although Warsmiths reject magic philosophically, they are not immune — they resist it:

```
magicResistance = RESIST_BASE + warsmith.level * RESIST_PER_LEVEL   // 0.0–1.0
effectStrength  = baseEffect * (1 − magicResistance)
```

Tunable: `RESIST_BASE = 0.10`, `RESIST_PER_LEVEL = 0.02`
A level-10 Warsmith has 30% magic resistance; level-32 has 74% (capped at 75%).

Applies to: incoming Necromancer curse, Druid slow, Pyromancer fire tick, Enchanter debuffs.
Does **not** apply to physical damage.

#### Victory Condition Addition for DRIVEN

| Condition | Winner | Applies when |
|---|---|---|
| All Warsmiths killed | Opponent | Defending or attacking DRIVEN army |

This condition is checked in addition to the standard conditions in §6.7.

#### DRIVEN Victory — War Machine Disposition

When DRIVEN wins the battle, all war machines (Catapult, Ballista) remaining on the
field are **destroyed** — DRIVEN will not keep what they cannot use.
`BattleResult.capturedWarMachines` is empty; `BattleResult.survivors.*.warMachines`
is empty for both sides.

---

## 8. Scene Architecture

```
PreloadScene
  └─> DeployScene          Phase 1: army placement
        └─> DeployUIScene  army list panel, war machine dialog, ready button

  └─> BattleScene          Phase 2: real-time combat
        └─> BattleUIScene  selection info, target label, retreat button, battle log
```

Both `UIScene` variants run as **parallel overlay scenes** — same pattern as the
existing `UIScene` in the codebase (`this.scene.launch(...)`).

**Data flow between scenes:**
```
TBS app
  │  BattleContext (prop / shared store)
  v
PreloadScene ──> DeployScene ──[DeployResult]──> BattleScene ──[BattleResult]──> TBS app
```

`DeployResult` is an internal type: positions of all placed packs + reinforcement queue.

---

## 9. Development Steps

| Step | Scope | Key deliverables |
|---|---|---|
| **1 — Foundation** | Sprite system + battlefield | `UnitSpriteRegistry`, camera pan/zoom, zone rendering (20/10/70), terrain scaffold, `BattleContext` interface |
| **2 — Deploy Phase** | Phase 1 complete | Army panel, 4×5 pack placement, war machine loading dialog, AI opponent deployment, reinforcement queue |
| **3 — Battle Core** | Movement + melee | Pack expansion into 4×5 formation, `RegularUnit` / `HeroUnit` classes, IDLE / MOVING / ENGAGING states, melee combat, health/death |
| **4 — Unit AI** | Autonomous behavior | Full AI state machine, aggro radius, target priority, morale system (no hero interaction yet) |
| **5 — Ranged Combat** | Projectiles + kiting | Projectile system, ranged unit kiting behavior, ranged `WarMachineUnit` basic fire |
| **6 — War Machines** | Siege mechanics | Area / piercing damage, crew system, structure HP (walls/gate/keep), stalemate detection |
| **7 — Hero Auras** | Full hero system | Aura rendering, Cleric regen, Necromancer curse, non-magic morale aura, Necromancer Undead rise, hero death penalty |
| **8 — DRIVEN Faction** | Command radius | Command Radius rendering, DORMANT state, Warsmith defeat condition, magic resistance, Gargoyle wall-flight, Golem bonus vs structures |
| **9 — Retreat & Results** | End conditions | Retreat command with confirmation, victory detection, war machine capture, `BattleResult` output |
| **10 — Polish** | UX / VFX | Hit sparks, death effects, aura shatter on hero death, Undead collapse effect, reinforcement fanfare, battle log panel, sound hooks |

**Playable prototype target:** Steps 1–4 (armies fight, units have basic AI, player can assign targets).
**Full feature complete:** Steps 1–10.

---

## 10. Resolved Decisions

| # | Question | Decision |
|---|---|---|
| OQ-1 | Can the player be the defender? | Yes. `BattleContext.playerSide` carries the role from TBS. Camera starts on the player's side; coordinates stay fixed. |
| OQ-2 | Should zone percentages be configurable? | Yes — `BattlefieldConfig.zones` is optional; defaults to 20/10/70 when omitted. |
| OQ-3 | Formation when a pack expands? | **4 × 5 grid** within the pack's footprint. Partial packs leave trailing grid cells empty. |
| OQ-4 | Hero death → morale effect? | Yes — full aura + death penalty system (§7). Magic heroes heal/curse; non-magic heroes boost morale. Effect disappears on death + 30 s debuff. |
| OQ-5 | Time limit for assault? | No time limit. Stalemate is detected automatically (§3.3) and triggers auto-retreat for the attacker. |
| OQ-6 | Ranger aura: ranged units only, or small bonus to melee too? | Ranged-only confirmed for now; revisit in Step 7. |
| OQ-7 | Do Necromancer aura-raised Undead persist after the Necromancer dies? | No — they collapse instantly. Permanent Undead (from TBS army) survive normally. No re-raising of killed Undead in the same battle. See §7.4. |
| OQ-8 | Should the Warsmith hero personally be immune to magic debuffs? | Not immune — resists magic proportionally to level (§7.8). Max 75% resistance at level 32. |
| OQ-9 | Dendrite special abilities? | **Reach Attack** — 360° targeting, ignores unit/terrain obstruction, one chosen target, damage falls off with distance. Not AoE. See §6.11. |
| OQ-10 | War machine capture: any crew type or optimal only? | Wrong crew type → machine **destroyed**. Only correct crew type can capture Catapult / Ballista. Battering Ram and Siege Tower become landscape — not capturable. See §6.10.3. |
| OQ-11 | Siege Tower anchored: who can use it, can it be destroyed? | Once anchored → **indestructible permanent bridge, attacker only**. Defender cannot use or capture it (meaningless to them). Crew unmounts at wall top proportional to surviving HP. Halted-in-transit tower becomes inert obstacle. See §6.10.5. |

---

---

## 11. Unit Type Reference

Copied from the TBS shared types for quick reference. The RTS spec is written against these values.

```typescript
// Regular unit types
export const RegularUnitName = {
  WARD_HANDS: 'Ward-hands',
  WARRIOR:    'Warrior',
  DWARF:      'Dwarf',
  ORC:        'Orc',
  HALFLING:   'Halfling',
  ELF:        'Elf',
  DARK_ELF:   'Dark-Elf',
  // Driven Doctrine units
  GOLEM:      'Golem',
  GARGOYLE:   'Gargoyle',
  DENDRITE:   'Dendrite',
  // Available only via SUMMON UNDEAD Spell or Necromancer aura
  UNDEAD:     'Undead',
} as const;

// War machine types
export const WarMachineName = {
  BALLISTA:     'Ballista',      // piercing bolt, line damage
  CATAPULT:     'Catapult',      // arc projectile, area damage
  BATTERING_RAM: 'Battering Ram', // melee vs. gate/walls only
  SIEGE_TOWER:  'Siege Tower',   // allows units to bypass walls
} as const;

// Hero types
export const HeroUnitName = {
  // Non-mage heroes
  FIGHTER:     'Fighter',      // Battle Cry aura
  HAMMER_LORD: 'Hammer-lord',  // Iron Resolve aura
  RANGER:      'Ranger',       // Eagle Eye aura (ranged units only)
  SHADOW_BLADE:'Shadowblade',  // Shadow Veil aura
  OGR:         'Ogr',          // Terror aura (enemy debuff)
  // Mage heroes
  PYROMANCER:  'Pyromancer',   // Infernal Aura (fire damage to enemies)
  CLERIC:      'Cleric',       // Divine Blessing (HP regen, strongest)
  DRUID:       'Druid',        // Nature's Ward (HP regen + enemy slow)
  ENCHANTER:   'Enchanter',    // Arcane Empowerment (all-stat buff)
  NECROMANCER: 'Necromancer',  // Death's Embrace (curse + Undead rise)
  // Non-magic / DRIVEN Doctrine (rejects magic entirely)
  WARSMITH:    'Warsmith',     // Command Radius (DRIVEN faction leader; no aura; magic resistance)
} as const;

export const MAX_HERO_LEVEL = 32;
```

### War Machine — Crew Requirements

| War machine | Crew unit type | Crew count | Combat role |
|---|---|---|---|
| **Ballista** | Elf / Dark-Elf (ranged) | 2 | Long-range piercing, anti-hero |
| **Catapult** | Warrior / Dwarf (strong) | 3 | Area siege, wall damage |
| **Battering Ram** | Warrior / Orc (heavy) | 4 | Gate/wall only; no ranged attack |
| **Siege Tower** | Ward-hands / Halfling | 4 | Allows units to scale walls; no direct attack |

> Crew types are suggestions — actual requirements should be confirmed by TBS game design.
> The RTS reads crew type from `WarMachineState`; these are documentation defaults.
>
> **DRIVEN armies never field war machines.** Golem fills the wall-busting role;
> Gargoyle fills the aerial assault role. If a `BattleArmy` with DRIVEN units contains
> `warMachines`, they should be ignored by the RTS.

---

*Last updated: 2026-03-14*
