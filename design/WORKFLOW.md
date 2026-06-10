# EMBERFALL — Claude Code Workflow (your operating manual)

This file is for **you**, not Claude Code. It's how you run the project so
quality stays high for years.

## The session ritual (every time)

1. **One item.** Open `design/ROADMAP.md` + `design/PROGRESS.md`, pick exactly
   one feature/bug/content batch.
2. **Prompt with context pointers** (templates below). Claude Code auto-loads
   `CLAUDE.md`; you point it at the *specific* doc sections for this task.
3. **Plan first.** For anything non-trivial, have it plan before touching code
   (plan mode) and read the plan. Killing a bad plan costs 1 minute; killing
   bad code costs an evening.
4. **Verify the Definition of Done** from CLAUDE.md yourself: `npm test`,
   `npm run typecheck`, and *actually playtest with two tabs*
   (`npm run dev`, open http://localhost:5173 twice).
5. **Commit, update PROGRESS.md, then `/clear`.** One task per context.

## Session prompt templates

**Feature session**
```
Current phase: P<X>. Read design/PROGRESS.md, then the "<section>" section of
design/GDD.md.
Task: implement <ONE roadmap bullet>.
Plan first and show me the plan. Scope strictly to this item — if you find
prerequisite work missing, stop and tell me instead of building it.
Done means the CLAUDE.md Definition of Done, including the exploit pass.
```

**Bugfix session**
```
Bug: <exact behavior, exact error text, repro steps>.
First: reproduce it, then write a failing regression test, then list 2–3
hypotheses ranked by likelihood BEFORE changing code. Fix the top one, prove
the test passes, run the full suite.
```

**Content batch session**
```
Read design/GDD.md sections: <Items/Mobs/Quests>. Generate <N> <mobs for
Tanglewood, level 20–30> as typed data modules in shared/src/data/.
Constraints: follow the tier curves; every reference must resolve (compile
check); run content validation + balance guardrail tests.
Then give me a flat summary table (name, level, hp, max hit, notable drop)
for my review — I approve numbers before commit.
```

**Refactor/upgrade session**
```
Goal: <refactor X / upgrade dependency Y>. No behavior changes.
Run the full test suite before AND after; diff the results. If tests are too
thin to prove safety, write the missing tests first.
```

## Using models deliberately

Architecture, combat math, refactors, anything security/economy-touching →
the most capable model available. Bulk content generation and rote tasks → a
faster model is fine. Design debates (should death drop items? how should
Hunt points price unlocks?) → hash out in a Claude chat first, then bring
conclusions into a build session.

## Reviewing AI-built code when you're not a pro programmer

You don't need to read every line. You need to verify behavior:
- Playtest *adversarially* — break it like a hostile player would (spam
  clicks, walk out of range mid-action, disconnect at bad moments).
- Ask: "Walk me through how this works in plain language, and tell me the
  three most likely ways it breaks."
- Watch the tests: a feature with no new tests is not done. Hold the line.
- Git is your safety net: commit small; never hesitate to reset a bad
  session and re-prompt smarter.

## When Claude Code goes sideways

- Going in circles on a bug → `/clear`, restate fresh with exact error text.
- Touching files outside the task → "Only modify these paths: …"
- Confident-but-wrong library usage → "Check the actually installed version's
  types in node_modules and adapt." (Colyseus especially — see CLAUDE.md
  gotchas.)
- Big scary refactor proposal mid-feature → decline, finish the feature,
  schedule the refactor as its own session.

## Cadence that survives real life

No deadline — protect that. The unit of progress is the *session*, not the
week. The roadmap's exit criteria mean you can disappear for a month and
`design/PROGRESS.md` tells you exactly where you left off. The only schedule
rule worth having: **never end a session with a broken build.** Commit green
or reset.
