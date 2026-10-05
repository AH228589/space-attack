# Space Attack

A small retro arcade shooter for the browser, inspired by *Space Attack* on the Emerson Arcadia 2001.
Hold the bottom of the screen against an alien formation whose members break off and dive at you,
wave after wave, a little faster and angrier every time. Every 10th wave a boss turns the game into a
bullet hell. Between waves you build your ship from random upgrade cards, and a good run puts your
initials on a high score table every player shares.

Plain TypeScript and the Canvas 2D API, built with Vite. No game engine, no image or audio files:
sprites are text grids and every sound is synthesised with WebAudio. The leaderboard is a single
Vercel function backed by Vercel Blob.

## Play

Live: https://space-attack-gilt.vercel.app

Run it locally:

```bash
npm install
npm run dev
```

Then open http://localhost:5194. The dev server answers the leaderboard API from memory, so the whole
game, high scores included, works offline.

| Key | Action |
| --- | --- |
| Left / Right arrows, or A / D | Move (and choose a card, change a letter) |
| Space, or click / hold the mouse on the game (hold for auto-fire) | Fire (and take a card, next letter) |
| 1, 2, 3 | Take that upgrade card |
| Type letters, Backspace | Enter initials |
| Enter, or click the game | Start, restart, resume |
| P or Esc | Pause and resume (Esc skips initials) |
| Q (while paused) | Quit to the title screen |
| M | Sound on or off |

On phones and tablets, on-screen buttons appear as soon as you touch the screen: left and right
under your left thumb, a big FIRE button under your right, plus pause and sound. Tapping the game
screen also fires, starts and resumes. Upright, the buttons sit below the game; sideways, they flank it.

Upgrade cards work like buttons on any pointer: touch or click a card to highlight it, slide to another
if you change your mind, and lift on a card to take it (lifting anywhere else cancels). On phones the
FIRE button turns into TAKE while cards are up, and into NEXT while entering initials.

## What is in it

- **Start screen** with the score table and the full controls list, alternating with an enemy roster and
  the high score table like an arcade attract mode. **Pause screen** repeats the controls and shows your build so far,
  and a hint strip shows the controls again for the first seconds of a game.
- **Enemy waves**: a formation of drones, hornets and flagships flies in, drifts side to side, and sends
  enemies diving at the ship in looping attack runs. Flagships can bring hornet escorts.
- **Collisions**: your shots against enemies, enemy shots against you, and divers ramming you.
- **Score, energy and lives**: score, ships left and hi-score at the top. The energy bar at the bottom left drains
  when you are hit; when it empties you lose a ship. Ships left are shown bottom right, with an extra
  ship every 10,000 points. Diving enemies are worth double, and the last few enemies of a wave attack
  non-stop so a wave never stalls.
- **Increasing difficulty**: every wave dives more often, with more divers at once, faster divers and
  faster bullets, more shots per dive, a formation that starts shooting from wave 2, armoured
  flagships from wave 3, escorts that grow more common, and bigger formations. A thinning formation
  also gets bolder within a wave. All of it lives in one pure function, `waveConfig()` in
  `src/difficulty.ts`, and a line under each wave banner says what just got harder.
- **Every screen size**: the page is laid out in rem and viewport units only, the game screen keeps its
  shape and grows or shrinks to fit, and the in-game wording switches between keyboard and touch.

### Enemy types and bosses

- **Drones, Hornets and Flagships** from the start; Flagships take two hits from wave 3.
- **Gunners** (wave 4) fire aimed three-shot spreads, even from the formation.
- **Splitters** (wave 5) burst into two fast **Mites** that home in and never return.
- **Tanks** (wave 7) take three hits, dive slowly and fire a wide five-shot fan.
- **Bosses every 10th wave** (Mothership, Hive Queen, Void Ark, Star Eater) play as a bullet hell:
  slow, dense patterns of round shots in three phases (an aimed fan and a ring with a gap, then a
  two-armed spiral with wing cannons and Mites, then a counter-rotating flower). Round shots only hurt
  the small core shown on your ship, so the patterns can be weaved through. A boss enrages after 75
  seconds, and beating one clears its bullets for bonus points and deals a reward draft with rarer cards.
- **Sectors**: after each boss every enemy needs one more hit, and the speed and fire-rate ceilings rise.

### Roguelike runs

- **Upgrade draft**: after every cleared wave, pick one of three random cards (common, rare or epic).
  Twin Shot, Rapid Fire, Piercing, Plating, Nano Repair, Thrusters, Bounty, Deflector, Salvage, Shield
  and Extra Ship, most of them stackable. Upgrades last the whole run and are lost with it.
- **Anomalies**: from wave 3, every wave rolls a twist such as Bullet Storm, Armored Hornets, Swarm,
  Hyperspeed or Kamikaze, or a windfall like Bounty Wave (double points) or Supply Run. The banner
  announces it and the HUD keeps it on screen.
- **Energy drops**: destroyed enemies sometimes drop energy cells to catch.

### Arcade high scores

- A score that makes the top 10 earns initials: three letters, picked with the arrows and fire (or typed),
  as on an arcade cabinet. The device remembers your last initials.
- The results screen after every run shows the shared top 10 with your entry highlighted, plus the
  build you ran with. If the server cannot be reached, the game keeps a top 10 on the device and says so.
- `api/scores.ts` stores each score as its own tiny file in a private Vercel Blob store, with score,
  time, wave and initials in the file name. Two players finishing at once can never overwrite each
  other, and one listing returns the whole table. Submissions are validated (three allowed characters,
  whole multiples of ten, a points-per-wave ceiling) and storage is pruned to the best 200.

## How it is built

```
api/
  scores.ts       GET the top 10, POST a score (Vercel function, Blob storage)
src/
  config.ts       reference resolution and tuning constants
  difficulty.ts   waveConfig(n), enemy introductions, bosses and the wave anomalies (pure)
  perks.ts        upgrade cards and the draft deal (pure)
  leaderboard.ts  score validation, ranking and storage keys, shared by game, API and dev server (pure)
  game.ts         the simulation: phases, player, formation, dives, boss patterns, upgrades, initials, scoring
  collision.ts    box overlap test
  render.ts       canvas drawing: world, HUD, title, draft, initials, results, pause screens
  sprites.ts      sprite grids and a cache that renders them at the current screen scale
  input.ts        keyboard, mouse and touch merged into actions: held, freshly pressed, typed, tapped
  audio.ts        WebAudio sound effects
  scores.ts       leaderboard client with an on-device fallback
  main.ts         wiring, fixed-step game loop, storage
  game.test.ts    tests for rules, flow, upgrades, initials and the leaderboard rules
```

- **The simulation never touches the DOM or the network.** `Game` takes controls in and emits events
  (`shoot`, `enemyKill`, `submit`, ...) out, and the leaderboard is handed in with `setBoard()`, so the
  same code runs in the browser and in headless tests, with injectable randomness for repeatable runs.
- **Fixed time step** (1/120 s) with an accumulator, so the game plays the same at 60 Hz, 144 Hz or
  on a slow machine. Key presses are delivered to exactly one step.
- **Reference resolution.** The game runs on a 256 x 288 virtual grid that is scaled to fit the window.
  The canvas backing store matches the real screen and positions snap to the screen's own grid,
  so the blocky art and the arcade font stay sharp at any size.

## Checks

```bash
npm test          # Vitest: game rules and flow, bosses, enemy types, upgrades, anomalies, initials, leaderboard validation, random-input soaks
npm run typecheck
npm run build
```
