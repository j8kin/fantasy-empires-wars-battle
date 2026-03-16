# Fantasy Empires Wars: Battle Module

This repository contains the real-time strategy (RTS) battle sub-game for the Fantasy Empires Wars turn-based strategy (TBS) application. 

It is built as a Phaser 3 scene group embedded inside a React application, providing a high-performance combat engine with a modern UI overlay.

## 🎮 Game Overview

The battle module handles tactical combat between two armies, triggered from the strategic TBS layer. For a complete technical breakdown, see the [RTS Battle Specification](docs/rts-battle-spec.md).

### Key Phases
1. **Deploy Phase**: Strategic placement of units (organized as packs) within the designated deploy zone.
2. **Battle Phase**: Real-time resolution of combat. Units expand from their pack formation into individual entities with unique AI, pathfinding, and combat logic.

### Core Systems
- **Pack System**: Efficiently manages large armies by grouping up to 20 units into single deployment slots.
- **Hero Aura System**: Heroes project dynamic area-of-effect buffs (or debuffs) that modify unit morale, attack, armor, and more.
- **DRIVEN Faction**: A unique mechanic where units require a **Command Radius** from a Warsmith to remain active; otherwise, they become dormant.
- **War Machine System**: Destructible and capturable siege equipment (Catapults, Ballistas) with a two-phase HP model (Crew and Structure).

## 🛠 Tech Stack

- **Engine**: [Phaser 3.90](https://phaser.io/)
- **UI Layer**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: CSS Modules and standard CSS

## 📂 Project Structure

- `src/game`: Core Phaser logic, scenes, entity classes, and configuration.
    - `src/game/scenes`: `PreloadScene`, `DeployScene`, `BattleScene`.
    - `src/game/config`: Centralized `BATTLE_CONFIG` and `WORLD_CONFIG` for easy tuning.
- `src/components`: React UI components (overlays, popups, army panels).
- `src/assets`: Static images and Vite-specific assets.
- `sprites/`: Game-ready sprites and animations organized by unit type.
- `docs/`: Technical specifications and documentation.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (latest LTS recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation
```bash
yarn
```

### Development
Start the development server with HMR:
```bash
yarn dev
```

### Build
Generate a production-ready build in the `dist/` directory:
```bash
yarn build
```

### Linting
Check for code quality and style issues:
```bash
yarn lint
```

## 📜 Full Specification

Refer to [rts-battle-spec.md](docs/rts-battle-spec.md) for the authoritative design decisions, formulas, unit types, and architectural details.
