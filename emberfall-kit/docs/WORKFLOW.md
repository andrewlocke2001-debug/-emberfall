# EMBERFALL — Claude Code Workflow (your operating manual)

This file is for **you**, not Claude Code. It's how you run the project so quality stays high for years. Claude Code docs live at https://code.claude.com/docs if you need command specifics.

## The session ritual (every time)

1. **One item.** Open `docs/ROADMAP.md` + `docs/PROGRESS.md`, pick exactly one feature/bug/content batch.
2. **Prompt with context pointers** (templates below). Claude Code auto-loads `CLAUDE.md`; you point it at the *specific* doc sections that matter for this task.
3. **Plan first.** For anything non-trivial, have it plan before touching code (plan mode) and read the plan. Killing a bad plan costs 1 minute; killing bad code costs an evening.
4. **Verify the Definition of Done** from CLAUDE.md yourself: run `pnpm test`, `pnpm typecheck`, and *actually playtest with two tabs*.
5. **Commit, update PROGRESS.md, then `/clear`.** One task per context. Stale context is where weird bugs come from.

## Session prompt templates

**Feature session**
```
Current phase: P<X>. Read docs/PROGRESS.md, then the "<section>" section of docs/GDD.md and the relevant parts of docs/ARCHITECTURE.md.
Task: implement <ONE roadmap bullet>.
Plan first and show me the plan. Scope strictly to this item — if you find prerequisite work missing, stop and tell me instead of building it.
Done means the CLAUDE.md Definition of Done, including the exploit pass.
```

**Bugfix session**
```
Bug: <exact behavior, exact error text, repro steps>.
First: reproduce it, then write a failing regression test, then list 2–3 hypotheses ranked by likelihood BEFORE changing code. Fix the top one, prove the test passes, run the full suite.
```

**Content batch session**
```
Read docs/GDD.md sections: <Items/Mobs/Quests>. Generate <N> <mobs for Tanglewood, level 20–30> as /content JSON.
Constraints: follow the tier curves; every reference must resolve; run content validation + balance guardrail tests.
Then give me a flat summary table (name, level, hp, max hit, notable drop) for my review — I approve numbers before commit.
```

**Refactor/upgrade session**
```
Goal: <refactor X / upgrade dependency Y>. No behavior changes.
Run the full test suite + bot smoke test before AND after; diff the results. If tests are too thin to prove safety, write the missing tests first.
```

## Using models deliberately

Architecture, combat math, refactors, anything security/economy-touching → run those sessions on the most capable model available in Claude Code. Bulk content generation and rote tasks → a faster model is fine. Design debates (should death drop items? how should Hunts points price unlocks?) → hash out in a Claude chat first, then bring conclusions into a build session. Check `/model` in Claude Code for what's available on your plan.

## Reviewing AI-built code when you're not a pro programmer

You don't need to read every line. You need to verify behavior:
- Playtest the feature *adversarially* — try to break it the way a hostile player would (spam clicks, trade-cancel timing, walking out of range mid-cast).
- Ask Claude Code: "Walk me through how this works in plain language, and tell me the three most likely ways it breaks." It's good at honest answers to direct questions.
- Watch the tests: a feature with no new tests is not done (CLAUDE.md says so — hold the line).
- Git is your safety net: commit small, and never hesitate to `git reset --hard` a bad session and re-prompt smarter.

## When Claude Code goes sideways

- Going in circles on a bug → `/clear`, restate the problem fresh with the exact error text.
- Touching files outside the task → tighten the prompt: "Only modify these paths: ..."
- Confident-but-wrong library usage → "Check the actually installed version's types/docs and adapt."
- Big scary refactor proposal mid-feature → decline, finish the feature, schedule the refactor as its own session.

## Cadence that survives real life

This project has no deadline — protect that. The unit of progress is the *session*, not the week. One clean feature session beats five rushed ones; the roadmap's exit criteria mean you can disappear for a month and `docs/PROGRESS.md` tells you exactly where you left off. The only schedule rule worth having: **never end a session with a broken build.** Commit green or reset.
