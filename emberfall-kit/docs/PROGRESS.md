# EMBERFALL — Progress Log

Claude Code: read this first every session; update it at the end of every session. Keep entries terse. Newest first.

## Current phase
**P0 — Foundation** (see docs/ROADMAP.md)

## Next up
- [ ] Run BOOTSTRAP.md Session 1 (scaffold + local two-tab test)
- [ ] Deploy session (server + DB + client on real hosting)
- [ ] P0 exit test: two phones over the internet

## Phase exit checklist (copy current phase's criteria here)
- [ ] Two clients see each other move over the internet
- [ ] Forged move_to rejected server-side
- [ ] Server restart → positions persist
- [ ] CI green (typecheck + test)

## Decisions log (ADR-lite: date — decision — why)
- 2026-06-09 — 600ms tile tick, no client prediction v1 — netcode/anti-cheat simplicity, OSRS-proven feel
- 2026-06-09 — 6+2 ability bar, classless skills, level cap 50 — GW-style balanceable depth
- 2026-06-09 — all content as zod-validated JSON in /content — solo-dev content scaling
- 2026-06-09 — item ledger from P3 day one — economy integrity

## Dependency justifications
(one line per new runtime dep, added when introduced)

## Known bugs / debt
(none yet)

## Session log
(newest first: date — what shipped — anything notable)
