# EMBERFALL — Persistent Online RPG Starter Kit

**Working title. Rename anytime.** This folder is the complete operating system for building a persistent online RPG with Claude Code: the design doc, the architecture, the roadmap, the rules Claude Code follows, and the exact prompt to start Session 1.

The game synthesizes the best mechanics from World of Warcraft, Old School RuneScape, Guild Wars 1/2, FFXIV, Albion Online, EVE, and Path of Exile — sequenced so the foundation ships first and the dream features land on top of a working game instead of a pile of half-built systems. Full mapping in `docs/INSPIRATION_MAP.md`.

## What's in this kit

| File | Purpose |
|---|---|
| `CLAUDE.md` | Rules Claude Code auto-reads every session |
| `BOOTSTRAP.md` | Paste-ready Session 1 prompt (scaffolds the codebase) |
| `docs/GDD.md` | Game design document — what the game IS |
| `docs/ROADMAP.md` | Phases P0–P12, each with exit criteria |
| `docs/ARCHITECTURE.md` | Technical blueprint — server, netcode, data |
| `docs/INSPIRATION_MAP.md` | Which feature comes from which game, and when |
| `docs/WORKFLOW.md` | How YOU drive Claude Code on this project |
| `docs/PROGRESS.md` | Living log — current phase, decisions, next up |

## Quickstart (do this on a computer, not your phone)

1. Install **Git**, **Node.js LTS**, and **pnpm** (`npm i -g pnpm`).
2. Install **Claude Code** — current instructions at https://code.claude.com/docs (npm package: `@anthropic-ai/claude-code`).
3. Create an empty folder, e.g. `emberfall/`, and copy this entire kit's contents into it (`CLAUDE.md` at the root).
4. Run `git init` inside it.
5. Launch Claude Code in that folder and paste the **Session 1 prompt** from `BOOTSTRAP.md`.
6. When Phase 0's exit test passes (two browser tabs walking around the same world, position survives a server restart), work the roadmap **one item per session** using the templates in `docs/WORKFLOW.md`.

## The three opinionated calls baked into this kit

1. **600ms tick, tile-based world (OSRS-style).** This single decision makes netcode, anti-cheat, pathfinding, AFK-friendly skilling, and mobile play all dramatically easier. It's the cheat code that let RuneScape run an MMO in a browser in 2001.
2. **8-slot ability bar from a growing pool (Guild Wars-style), no class lock.** Build depth without designing 400 abilities. One character learns everything (FFXIV/RuneScape-style) — alts optional, not mandatory.
3. **All content is data, not code.** Items, mobs, drops, quests, dialogue live in `/content/*.json` validated by schemas. This is how one person + Claude Code produces MMO-scale content.

Disagree with any of these? Edit `docs/GDD.md` before Session 1 — after P2, these decisions are concrete.

## Ground rules for the long haul

- **Order is law, dates are not.** No timeline pressure. But never skip a phase — every skipped foundation gets paid back at 10x.
- **Playable every phase.** Each phase ends with something you can show a friend on their phone.
- **First 10 real players is the milestone that matters**, not feature count. That happens at P5, not P12.
