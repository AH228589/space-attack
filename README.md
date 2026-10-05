# Space Attack

A small retro arcade shooter for the browser, inspired by *Space Attack* on the Emerson Arcadia 2001.
Hold the bottom of the screen against an alien formation whose members break off and dive at you,
wave after wave, a little faster and angrier every time.

Plain TypeScript and the Canvas 2D API, built with Vite. No game engine, no image or audio files:
sprites are text grids and every sound is synthesised with WebAudio.

## Play

```bash
npm install
npm run dev
```

Then open http://localhost:5194.

| Key | Action |
| --- | --- |
| Left / Right arrows, or A / D | Move |
| Space (hold for auto-fire) | Fire |
| Enter | Start, restart |
| P or Esc | Pause and resume |
| Q (while paused) | Quit to the title screen |
| M | Sound on or off |

## What is in it

- **Start screen** with the score table and the full controls list. **Pause screen** repeats the controls,
  and a hint strip shows them again for the first seconds of a game.
- **Enemy waves**: a formation of drones, hornets and flagships flies in, drifts side to side, and sends
  enemies diving at the ship in looping attack runs. Flagships can bring hornet escorts.
- **Collisions**: your shots against enemies, enemy shots against you, and divers ramming you.
- **Score, energy and lives**: score and hi-score at the top (hi-score is saved in the browser).
  The energy bar at the bottom left drains when you are hit; when it empties you lose a ship.
  Ships left are shown bottom right, with an extra ship every 10,000 points.
  Diving enemies are worth double, and the last few enemies of a wave attack non-stop so a wave never stalls.
- **Increasing difficulty**: every wave dives more often, with more divers at once, faster divers and
  faster bullets, more shots per dive, a formation that starts shooting from wave 2, armoured
  flagships from wave 3, escorts that grow more common, and bigger formations. A thinning formation
  also gets bolder within a wave. All of it lives in one pure function, `waveConfig()` in
  `src/difficulty.ts`, and a line under each wave banner says what just got harder.
- **Game over screen** with score, wave reached, kills and accuracy, then Enter to play again.
- Auto-pause when the tab loses focus, sound toggle remembered between visits.

## How it is built

```
src/
  config.ts       reference resolution and tuning constants
  difficulty.ts   waveConfig(n): everything that ramps per wave (pure)
  game.ts         the simulation: phases, player, formation, dives, bullets, collisions, scoring
  collision.ts    box overlap test
  render.ts       canvas drawing: world, HUD, title, pause and game over screens
  sprites.ts      sprite grids and a cache that renders them at the current screen scale
  input.ts        keyboard bindings, held keys and fresh presses
  audio.ts        WebAudio sound effects
  main.ts         wiring, fixed-step game loop, hi-score storage
  game.test.ts    tests for rules, flow and the difficulty curve
```

- **The simulation never touches the DOM.** `Game` takes controls in and emits events (`shoot`,
  `enemyKill`, `playerDie`, ...) out, so the same code runs in the browser and in headless tests,
  and randomness is injectable for deterministic test runs.
- **Fixed time step** (1/120 s) with an accumulator, so the game plays the same at 60 Hz, 144 Hz or
  on a slow machine. Key presses are delivered to exactly one step.
- **Reference resolution.** The game runs on a 256 x 288 virtual grid that is scaled to fit the window.
  The canvas backing store matches the real screen and positions snap to the screen's own grid,
  so the blocky art and the arcade font stay sharp at any size.

## Checks

```bash
npm test          # Vitest: collisions, difficulty never easing, waves, damage, lives, game over, restart, pause, a 10 minute random-input soak
npm run typecheck
npm run build
```
