# Emberfall — Steam Submission Runbook

Everything in this folder is ready-made: capsule art at Steam's exact
dimensions (`capsules/`), six 1920×1080 store screenshots (`screenshots/`),
and the store copy below. The shippable Windows build comes from
`desktop/` (see "Build the depot"). What remains are the account steps only
the owner can do.

## 0. What ships at launch

The **single-player** game (v1.0: full combat/skilling/quests/dungeon/raid/
economy/events, offline, saves locally). Multiplayer becomes a free update
when a game server is stood up again — do NOT mention multiplayer on the
store page until then.

## 1. Owner steps (one-time)

1. Create a Steamworks account: https://partner.steamgames.com
   (needs identity + tax/bank info — Steam pays revenue monthly).
2. Pay the **$100 Steam Direct fee** → you receive an **App ID**.
   (The fee is recouped after $1,000 gross revenue.)
3. In the app's Steamworks settings create one **depot** (Windows 64-bit).

## 2. Build the depot (repeatable)

```powershell
# from the repo root
$env:VITE_SOLO="1"; npm run build -w @mmo/client; $env:VITE_SOLO=$null
Remove-Item -Recurse -Force desktop\app -ErrorAction SilentlyContinue
Copy-Item -Recurse client\dist desktop\app
Remove-Item desktop\app\assets\*.map -ErrorAction SilentlyContinue
cd desktop; npm run pack     # → desktop/release/win-unpacked/  (the depot)
```

Verify before every upload:
```powershell
$env:EMBERFALL_SMOKE="1"; .\release\win-unpacked\Emberfall.exe   # prints SMOKE_OK
```

## 3. Upload with SteamPipe

Download the Steamworks SDK, then in `sdk/tools/ContentBuilder` create:

`app_build.vdf`
```
"AppBuild" {
  "AppID" "YOUR_APPID"
  "Desc"  "Emberfall v1.0"
  "ContentRoot" "C:\\...\\mmo\\desktop\\release\\win-unpacked"
  "BuildOutput" ".\\output"
  "Depots" { "YOUR_DEPOTID" { "FileMapping" { "LocalPath" "*" "DepotPath" "." "recursive" "1" } } }
}
```

Run: `builder\steamcmd.exe +login <account> +run_app_build ..\scripts\app_build.vdf +quit`
Then in Steamworks → Builds, set the uploaded build live on the `default` branch.

Launch option (Steamworks → Installation → General):
executable `Emberfall.exe`, no arguments.

## 4. Store page checklist

- Upload `capsules/*` to their matching slots (names carry the sizes).
- Upload all six `screenshots/*` (Steam minimum is 5).
- A short gameplay trailer is REQUIRED for release (30–60s screen capture of
  town → forest combat → Ashreach → raid boss is plenty; OBS is fine).
- Genre: RPG · Tags: Action RPG, Top-Down, Fantasy, Singleplayer, 2D,
  Procedural Generation, Character Customization
- Pricing suggestion: $4.99–$9.99 launch (or free at first to build reviews).
- Steam review takes ~2–5 business days for the store page, and again for
  the build. The page must be "Coming Soon" for at least 2 weeks before
  release day.

## 5. Store copy (paste-ready)

**Short description (≤300 chars):**
> Emberfall is a combat-first top-down RPG. Level five skills, forge your
> gear, clear a telegraph-dodging dungeon, break the five-boss Molten Throne
> raid, and survive the lawless Ashreach — in a hand-crafted world lit by
> dying embers.

**About This Game:**
> The frontier of Emberfall is a world lit by dying embers — a mossy
> heartland ringed by burnt wilds, where every road out of town is a
> risk-and-reward decision.
>
> **Fight deliberately.** Tab-target combat on a global cooldown: commit to
> strikes, weave heals, and step out of telegraphed boss slams.
>
> **Master five skills.** Mining, Fishing, Smithing, Cooking and Melee feed
> one another — gather, craft, eat, fight, repeat.
>
> **Climb the world.** Quiet Meadowbrook → wolf-run Greenreach → the tangled
> deep forest → the instanced Cinder Depths dungeon → the lawless PvE-risk
> Ashreach → the Molten Throne: a five-boss gauntlet with a weekly relic.
>
> **Live economy.** Durability, repair costs, vendors, a bank, and an
> order-book Exchange — every coin created or destroyed is accounted for.
>
> **A living frontier.** Slayer-style hunts, achievements with wearable
> titles, mounts, waystone fast travel, zone invasions, and an Ironman mode
> for the self-sufficient.

**System requirements (minimum):**
> OS: Windows 10 64-bit · Processor: any dual-core from the last decade ·
> Memory: 4 GB · Graphics: anything that runs a browser · Storage: 400 MB

## 6. After the App ID exists (follow-up work for Claude)

- Wire `steamworks.js` into `desktop/` for achievements + rich presence
  (the game's achievement system already exists server/solo-side).
- Replace the default Electron icon with an Emberfall `.ico`.
- Add a Quit button to the title screen (desktop builds can't rely on the
  browser chrome; `window.emberfallDesktop` is already exposed as the seam).
