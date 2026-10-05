import { describe, expect, it } from "vitest";
import { overlaps } from "./collision";
import { BULLET_DAMAGE, MAX_ENERGY, RESPAWN_DELAY, START_LIVES, STEP } from "./config";
import { enemyCount, waveConfig } from "./difficulty";
import { Game, NO_CONTROLS, type Controls, type GameEvent } from "./game";

/** Small seeded generator so every test run plays out the same way. */
function seeded(seed = 1): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run(g: Game, seconds: number, c: Partial<Controls> = {}): void {
  const controls = { ...NO_CONTROLS, ...c };
  for (let t = 0; t < seconds; t += STEP) g.update(STEP, controls);
}

function newGame(events: GameEvent[] = []): Game {
  const g = new Game({ rng: seeded(7), onEvent: (e) => events.push(e) });
  g.update(STEP, { ...NO_CONTROLS, start: true });
  return g;
}

/** Puts an enemy bullet right on top of the player. */
function shootPlayer(g: Game): void {
  const p = g.player;
  g.enemyBullets.push({ x: p.x, y: p.y, vx: 0, vy: 0, hw: 1, hh: 2.5, dead: false });
  g.update(STEP, NO_CONTROLS);
}

describe("collision", () => {
  it("detects overlapping and separated boxes", () => {
    expect(overlaps({ x: 0, y: 0, hw: 2, hh: 2 }, { x: 3, y: 0, hw: 2, hh: 2 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, hw: 2, hh: 2 }, { x: 4, y: 0, hw: 2, hh: 2 })).toBe(false);
    expect(overlaps({ x: 0, y: 0, hw: 2, hh: 2 }, { x: 0, y: 5, hw: 2, hh: 2 })).toBe(false);
  });
});

describe("difficulty", () => {
  it("never gets easier from one wave to the next", () => {
    for (let n = 1; n < 30; n++) {
      const a = waveConfig(n);
      const b = waveConfig(n + 1);
      expect(b.diveInterval).toBeLessThanOrEqual(a.diveInterval);
      expect(b.maxDivers).toBeGreaterThanOrEqual(a.maxDivers);
      expect(b.diveSpeed).toBeGreaterThanOrEqual(a.diveSpeed);
      expect(b.bulletSpeed).toBeGreaterThanOrEqual(a.bulletSpeed);
      expect(b.shotsPerDive).toBeGreaterThanOrEqual(a.shotsPerDive);
      expect(b.formationFireInterval).toBeLessThanOrEqual(a.formationFireInterval);
      expect(enemyCount(b)).toBeGreaterThanOrEqual(enemyCount(a));
    }
  });

  it("is clearly harder by wave 5 than wave 1", () => {
    const a = waveConfig(1);
    const b = waveConfig(5);
    expect(b.diveSpeed).toBeGreaterThan(a.diveSpeed);
    expect(b.diveInterval).toBeLessThan(a.diveInterval);
    expect(a.formationFireInterval).toBe(Infinity);
    expect(b.formationFireInterval).toBeLessThan(Infinity);
  });
});

describe("game flow", () => {
  it("starts on the title screen and begins wave 1 on start", () => {
    const g = new Game({ rng: seeded() });
    expect(g.phase).toBe("title");
    g.update(STEP, { ...NO_CONTROLS, start: true });
    expect(g.phase).toBe("playing");
    expect(g.wave).toBe(1);
    expect(g.enemies.length).toBe(enemyCount(waveConfig(1)));
    expect(g.lives).toBe(START_LIVES);
  });

  it("moves the ship with left and right and keeps it on screen", () => {
    const g = newGame();
    const x0 = g.player.x;
    run(g, 0.5, { right: true });
    expect(g.player.x).toBeGreaterThan(x0);
    run(g, 5, { left: true });
    expect(g.player.x).toBeGreaterThanOrEqual(10);
  });

  it("fires, kills an enemy and scores it", () => {
    const events: GameEvent[] = [];
    const g = newGame(events);
    run(g, 4); // let the formation settle
    const target = g.enemies.find((e) => e.state === "formation")!;
    g.bullets.push({ x: target.x, y: target.y, vx: 0, vy: 0, hw: 1, hh: 3, dead: false });
    const before = g.enemies.length;
    g.update(STEP, NO_CONTROLS);
    expect(g.enemies.length).toBe(before - 1);
    expect(g.score).toBeGreaterThan(0);
    expect(events).toContain("enemyKill");

    run(g, 0.05, { fire: true });
    expect(events).toContain("shoot");
    expect(g.stats.shots).toBe(1);
  });

  it("clearing every enemy advances to the next, harder wave", () => {
    const g = newGame();
    g.enemies = [];
    run(g, 2.5);
    expect(g.wave).toBe(2);
    expect(g.enemies.length).toBe(enemyCount(waveConfig(2)));
    expect(g.cfg.diveInterval).toBeLessThan(waveConfig(1).diveInterval);
  });

  it("enemy hits drain energy, then cost a life, then the ship respawns", () => {
    const g = newGame();
    shootPlayer(g);
    expect(g.player.energy).toBe(MAX_ENERGY - BULLET_DAMAGE);
    expect(g.player.invuln).toBeGreaterThan(0);

    // Invulnerable right after a hit.
    shootPlayer(g);
    expect(g.player.energy).toBe(MAX_ENERGY - BULLET_DAMAGE);

    while (g.player.alive) {
      g.player.invuln = 0;
      shootPlayer(g);
    }
    expect(g.lives).toBe(START_LIVES - 1);
    run(g, RESPAWN_DELAY + 0.1);
    expect(g.player.alive).toBe(true);
    expect(g.player.energy).toBe(MAX_ENERGY);
  });

  it("losing the last life ends the game and records the hi-score; restart works", () => {
    const events: GameEvent[] = [];
    const g = newGame(events);
    g.score = 1234;
    g.lives = 1;
    while (g.player.alive) {
      g.player.invuln = 0;
      shootPlayer(g);
    }
    run(g, RESPAWN_DELAY + 0.1);
    expect(g.phase).toBe("gameover");
    expect(g.hiScore).toBe(1234);
    expect(g.newHi).toBe(true);
    expect(events).toContain("gameOver");

    // Restart is ignored for a moment so a held fire key does not skip the screen.
    g.update(STEP, { ...NO_CONTROLS, start: true });
    expect(g.phase).toBe("gameover");
    run(g, 1.5);
    g.update(STEP, { ...NO_CONTROLS, start: true });
    expect(g.phase).toBe("playing");
    expect(g.score).toBe(0);
    expect(g.lives).toBe(START_LIVES);
    expect(g.wave).toBe(1);
  });

  it("pauses and resumes", () => {
    const g = newGame();
    g.update(STEP, { ...NO_CONTROLS, pause: true });
    expect(g.phase).toBe("paused");
    const t = g.waveT;
    run(g, 1);
    expect(g.waveT).toBe(t);
    g.update(STEP, { ...NO_CONTROLS, pause: true });
    expect(g.phase).toBe("playing");
  });

  it("survives ten minutes of random play without breaking", () => {
    const rng = seeded(99);
    const g = new Game({ rng: seeded(3) });
    let maxWave = 0;
    for (let t = 0; t < 600; t += STEP) {
      g.update(STEP, {
        left: rng() < 0.4,
        right: rng() < 0.4,
        fire: rng() < 0.7,
        firePressed: false,
        start: g.phase !== "playing" && rng() < 0.01,
        pause: false,
        quit: false,
      });
      maxWave = Math.max(maxWave, g.wave);
      for (const e of g.enemies) {
        expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
      }
      expect(Number.isFinite(g.player.x)).toBe(true);
    }
    expect(maxWave).toBeGreaterThanOrEqual(1);
  });
});
