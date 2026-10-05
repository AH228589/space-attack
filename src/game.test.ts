import { describe, expect, it } from "vitest";
import { overlaps } from "./collision";
import { BULLET_DAMAGE, MAX_ENERGY, RESPAWN_DELAY, START_LIVES, STEP } from "./config";
import { applyAnomaly, enemyCount, rollAnomaly, waveConfig } from "./difficulty";
import { Game, NO_CONTROLS, type Controls, type GameEvent } from "./game";
import { entryKey, ordinal, parseKey, qualifies, sortEntries, validateEntry } from "./leaderboard";
import { PERKS, dealCards } from "./perks";

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
  g.enemyBullets.push({ x: p.x, y: p.y, vx: 0, vy: 0, hw: 1, hh: 2.5, dead: false, pierce: 0, lastHit: -1 });
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
    g.bullets.push({ x: target.x, y: target.y, vx: 0, vy: 0, hw: 1, hh: 3, dead: false, pierce: 0, lastHit: -1 });
    const before = g.enemies.length;
    g.update(STEP, NO_CONTROLS);
    expect(g.enemies.length).toBe(before - 1);
    expect(g.score).toBeGreaterThan(0);
    expect(events).toContain("enemyKill");

    run(g, 0.05, { fire: true });
    expect(events).toContain("shoot");
    expect(g.stats.shots).toBe(1);
  });

  it("clearing every enemy opens an upgrade draft, then the next, harder wave", () => {
    const events: GameEvent[] = [];
    const g = newGame(events);
    g.enemies = [];
    run(g, 2);
    expect(g.phase).toBe("draft");
    expect(g.draft?.cards).toHaveLength(3);
    expect(events).toContain("draft");

    // Presses are ignored for a moment so a held fire key cannot pick a card by accident.
    g.update(STEP, { ...NO_CONTROLS, firePressed: true });
    expect(g.phase).toBe("draft");
    run(g, 0.6);
    const card = g.draft!.cards[1];
    g.update(STEP, { ...NO_CONTROLS, firePressed: true });
    expect(g.phase).toBe("playing");
    if (card !== "fix") expect(g.level(card)).toBe(1);
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

    // An empty table means any score earns initials.
    g.setBoard([], "online");
    run(g, 2.5);
    expect(g.phase).toBe("entry");
    run(g, 0.6);
    for (const ch of "ZED") g.update(STEP, { ...NO_CONTROLS, typed: ch });
    expect(g.phase).toBe("results");
    expect(g.playerName).toBe("ZED");
    expect(g.board[0]).toEqual({ name: "ZED", score: 1234, wave: 1 });
    expect(g.highlight).toBe(0);
    expect(events).toContain("submit");

    // Restart is ignored for a moment so a held fire key does not skip the table.
    g.update(STEP, { ...NO_CONTROLS, start: true });
    expect(g.phase).toBe("results");
    run(g, 1.1);
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

    // A click or tap (a fresh fire press) also resumes.
    g.update(STEP, { ...NO_CONTROLS, pause: true });
    g.update(STEP, { ...NO_CONTROLS, fire: true, firePressed: true });
    expect(g.phase).toBe("playing");
  });

  it("a click or tap starts the game from the title screen", () => {
    const g = new Game({ rng: seeded() });
    g.update(STEP, { ...NO_CONTROLS, fire: true, firePressed: true });
    expect(g.phase).toBe("playing");
  });

  it("survives ten minutes of random play without breaking", () => {
    const rng = seeded(99);
    const g = new Game({ rng: seeded(3) });
    let maxWave = 0;
    for (let t = 0; t < 600; t += STEP) {
      g.update(STEP, {
        ...NO_CONTROLS,
        left: rng() < 0.4,
        right: rng() < 0.4,
        fire: rng() < 0.7,
        firePressed: rng() < 0.02,
        leftPressed: rng() < 0.01,
        typed: rng() < 0.005 ? "B" : "",
        start: g.phase !== "playing" && rng() < 0.01,
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

describe("arcade initials", () => {
  const full = Array.from({ length: 10 }, (_, i) => ({ name: "CPU", score: 5000 - i * 100, wave: 3 }));

  function overWith(score: number, events: GameEvent[] = []): Game {
    const g = newGame(events);
    g.setBoard(full, "online");
    g.score = score;
    g.lives = 1;
    while (g.player.alive) {
      g.player.invuln = 0;
      shootPlayer(g);
    }
    run(g, RESPAWN_DELAY + 2.6);
    return g;
  }

  it("skips initials when the score does not make the table", () => {
    const g = overWith(100);
    expect(g.phase).toBe("results");
    expect(g.highlight).toBe(-1);
  });

  it("cycles letters with left and right, confirms with fire, and places the entry", () => {
    const g = overWith(4550);
    expect(g.phase).toBe("entry");
    expect(g.place).toBe(6);
    g.playerName = "AAA";
    run(g, 0.6);
    g.update(STEP, { ...NO_CONTROLS, rightPressed: true }); // A -> B
    g.update(STEP, { ...NO_CONTROLS, firePressed: true });
    g.update(STEP, { ...NO_CONTROLS, leftPressed: true }); // A -> space
    g.update(STEP, { ...NO_CONTROLS, leftPressed: true }); // space -> 9
    g.update(STEP, { ...NO_CONTROLS, firePressed: true });
    g.update(STEP, { ...NO_CONTROLS, back: true });
    g.update(STEP, { ...NO_CONTROLS, typed: "X" });
    g.update(STEP, { ...NO_CONTROLS, typed: "Y" });
    expect(g.phase).toBe("results");
    expect(g.playerName).toBe("BXY");
    expect(g.highlight).toBe(5);
    expect(g.board).toHaveLength(10);
  });

  it("Esc skips saving", () => {
    const events: GameEvent[] = [];
    const g = overWith(9000, events);
    run(g, 0.6);
    g.update(STEP, { ...NO_CONTROLS, pause: true });
    expect(g.phase).toBe("results");
    expect(events).not.toContain("submit");
  });
});

describe("roguelike upgrades and anomalies", () => {
  it("deals three different cards and never a maxed upgrade", () => {
    const rng = seeded(5);
    for (let i = 0; i < 200; i++) {
      const hand = dealCards({ twin: 2, extra: 2, deflector: 1 }, rng);
      expect(new Set(hand).size).toBe(3);
      expect(hand).not.toContain("twin");
      expect(hand).not.toContain("extra");
      expect(hand).not.toContain("deflector");
    }
  });

  it("fills the hand with Field Fix once everything is maxed", () => {
    const maxed = Object.fromEntries(Object.entries(PERKS).map(([id, p]) => [id, p.max]));
    expect(dealCards(maxed, seeded())).toEqual(["fix", "fix", "fix"]);
  });

  it("twin shot fires a volley, plating raises max energy, shield eats a hit", () => {
    const g = newGame();
    g.perks = { twin: 1, plating: 2, shield: 1 };
    g.shieldUp = true;
    g.update(STEP, { ...NO_CONTROLS, fire: true });
    expect(g.bullets).toHaveLength(2);
    expect(g.maxEnergy).toBe(MAX_ENERGY + 50);

    const before = g.player.energy;
    shootPlayer(g);
    expect(g.player.energy).toBe(before);
    expect(g.shieldUp).toBe(false);
  });

  it("piercing shots pass through an enemy and hit the next", () => {
    const g = newGame();
    run(g, 4);
    g.perks = { pierce: 1 };
    const [a, b] = g.enemies.filter((e) => e.state === "formation" && e.kind === "drone");
    // Two divers stacked in mid-air (in formation they would snap back to their slots).
    for (const e of [a, b]) Object.assign(e, { state: "attack", x: 128, y: 150, vx: 0, vy: 0, shotsLeft: 0 });
    g.bullets.push({ x: 128, y: 150, vx: 0, vy: 0, hw: 1, hh: 3, dead: false, pierce: 1, lastHit: -1 });
    g.update(STEP, NO_CONTROLS);
    expect(g.stats.kills).toBe(2);
  });

  it("waves from 3 roll an anomaly that changes the wave", () => {
    expect(rollAnomaly(2, seeded())).toBeNull();
    expect(rollAnomaly(3, seeded())).not.toBeNull();
    const base = waveConfig(5);
    expect(applyAnomaly(base, "swarm").maxDivers).toBe(base.maxDivers + 2);
    expect(applyAnomaly(base, "armored").hornetHp).toBe(2);
    expect(applyAnomaly(base, "kamikaze").shotsPerDive).toBe(0);
  });
});

describe("leaderboard rules", () => {
  it("accepts clean entries and rejects forged or malformed ones", () => {
    expect(validateEntry({ name: "ABC", score: 1230, wave: 3 })).toEqual({ name: "ABC", score: 1230, wave: 3 });
    expect(typeof validateEntry({ name: "AB", score: 10, wave: 1 })).toBe("string");
    expect(typeof validateEntry({ name: "ABCD", score: 10, wave: 1 })).toBe("string");
    expect(typeof validateEntry({ name: "ABC", score: 15, wave: 1 })).toBe("string");
    expect(typeof validateEntry({ name: "ABC", score: 900000, wave: 1 })).toBe("string");
    expect(typeof validateEntry({ name: "   ", score: 10, wave: 1 })).toBe("string");
    expect(typeof validateEntry("nope")).toBe("string");
  });

  it("stores everything in the key and reads it back", () => {
    const at = Date.now();
    const key = entryKey({ name: "A B", score: 12340, wave: 7 }, at);
    expect(parseKey(key)).toEqual({ name: "A B", score: 12340, wave: 7, at });
    // Higher scores sort first by key alone.
    expect(entryKey({ name: "AAA", score: 9000, wave: 1 }, at) < entryKey({ name: "AAA", score: 800, wave: 1 }, at)).toBe(true);
  });

  it("ranks ties by who got there first and knows who qualifies", () => {
    const sorted = sortEntries([
      { name: "B", score: 500, wave: 1, at: 2 },
      { name: "A", score: 500, wave: 1, at: 1 },
      { name: "C", score: 900, wave: 1, at: 3 },
    ]);
    expect(sorted.map((e) => e.name)).toEqual(["C", "A", "B"]);
    expect(qualifies([], 10)).toBe(true);
    expect(qualifies([], 0)).toBe(false);
    expect(ordinal(1)).toBe("1ST");
    expect(ordinal(2)).toBe("2ND");
    expect(ordinal(3)).toBe("3RD");
    expect(ordinal(11)).toBe("11TH");
  });
});
