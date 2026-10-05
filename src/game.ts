import { overlaps } from "./collision";
import {
  BULLET_DAMAGE,
  COL_GAP,
  ENTER_TIME,
  EXTRA_LIFE_EVERY,
  FIRE_COOLDOWN,
  FORMATION_TOP,
  HIT_INVULN,
  MAX_ENERGY,
  MAX_LIVES,
  MAX_PLAYER_BULLETS,
  PEEL_RADIUS,
  PEEL_TIME,
  PLAYER_ACCEL,
  PLAYER_BULLET_SPEED,
  PLAYER_MAX_X,
  PLAYER_MIN_X,
  PLAYER_SPEED,
  PLAYER_Y,
  RAM_DAMAGE,
  RESPAWN_DELAY,
  RESPAWN_INVULN,
  RETURN_SPEED,
  ROW_GAP,
  START_LIVES,
  SWAY_AMP,
  VIEW_H,
  VIEW_W,
  WAVE_CLEAR_REFILL,
  WAVE_GRACE,
} from "./config";
import { SCORES, enemyCount, waveConfig, waveTagline, type EnemyKind, type WaveConfig } from "./difficulty";

export type Phase = "title" | "playing" | "paused" | "gameover";
export type EnemyState = "entering" | "formation" | "peel" | "attack" | "returning";

export type GameEvent =
  | "shoot"
  | "enemyShoot"
  | "enemyHit"
  | "enemyKill"
  | "dive"
  | "playerHit"
  | "playerDie"
  | "waveStart"
  | "waveClear"
  | "extraLife"
  | "gameOver"
  | "beat"
  | "pause";

/** What the player is doing this step. `*Pressed` fields are true only on the step the key went down. */
export interface Controls {
  left: boolean;
  right: boolean;
  fire: boolean;
  firePressed: boolean;
  start: boolean;
  pause: boolean;
  quit: boolean;
}

export const NO_CONTROLS: Controls = {
  left: false,
  right: false,
  fire: false,
  firePressed: false,
  start: false,
  pause: false,
  quit: false,
};

export interface Player {
  x: number;
  y: number;
  vx: number;
  hw: number;
  hh: number;
  energy: number;
  alive: boolean;
  invuln: number;
  cooldown: number;
  hitFlash: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  row: number;
  /** Horizontal slot in the formation, in columns from the centre. */
  gx: number;
  x: number;
  y: number;
  hw: number;
  hh: number;
  hp: number;
  state: EnemyState;
  /** Seconds spent in the current state. */
  t: number;
  /** Fly-in: wait this long, then follow a curve from (sx, sy) through (cx, cy) to the slot. */
  delay: number;
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  /** Dive: side it peels toward, velocity, where it aims relative to the player, shots left. */
  dir: number;
  vx: number;
  vy: number;
  aim: number;
  shotsLeft: number;
  nextShotY: number;
  flash: number;
  dead: boolean;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hw: number;
  hh: number;
  dead: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Burst {
  x: number;
  y: number;
  t: number;
  color: string;
  big: boolean;
}

export interface Popup {
  x: number;
  y: number;
  t: number;
  text: string;
  color: string;
}

export interface Star {
  x: number;
  y: number;
  speed: number;
  phase: number;
  color: string;
}

export interface Banner {
  text: string;
  sub: string;
  t: number;
  max: number;
}

export interface Stats {
  shots: number;
  hits: number;
  kills: number;
}

export const ENEMY_COLORS: Record<EnemyKind, string> = {
  drone: "#3ee05a",
  hornet: "#ff3b3b",
  flagship: "#ffd23a",
};

const STAR_COLORS = ["#ffd23a", "#ffd23a", "#ffd23a", "#e8ecff", "#7fa8ff", "#ff8a8a"];

export interface GameOptions {
  rng?: () => number;
  onEvent?: (e: GameEvent) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step);
const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);

/**
 * The whole simulation. It never touches the DOM, so it runs the same in the browser and in tests;
 * the outside world hears about sounds and milestones through `onEvent`.
 */
export class Game {
  phase: Phase = "title";
  /** Seconds in the current phase (drives title and game over animations). */
  phaseT = 0;
  /** Seconds since the page loaded; drives flapping and blinking. */
  time = 0;

  wave = 0;
  cfg: WaveConfig = waveConfig(1);
  waveT = 0;
  waveTotal = 0;
  score = 0;
  hiScore = 0;
  newHi = false;
  lives = START_LIVES;
  nextLifeAt = EXTRA_LIFE_EVERY;
  stats: Stats = { shots: 0, hits: 0, kills: 0 };

  player: Player = this.freshPlayer();
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  enemyBullets: Bullet[] = [];
  particles: Particle[] = [];
  bursts: Burst[] = [];
  popups: Popup[] = [];
  stars: Star[] = [];
  banner: Banner | null = null;

  /** Counts down after a wave is cleared; the next wave starts when it runs out. */
  clearT = -1;
  /** Counts down after the ship is destroyed. */
  respawnT = -1;
  /** Seconds left on the on-screen controls hint shown at the start of a game. */
  hintT = 0;
  shake = 0;

  private swayT = 0;
  private diveT = 0;
  private formFireT = 0;
  private beatT = 0;
  private nextId = 1;
  private readonly rng: () => number;
  private readonly emit: (e: GameEvent) => void;

  constructor(opts: GameOptions = {}) {
    this.rng = opts.rng ?? Math.random;
    this.emit = opts.onEvent ?? (() => {});
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: this.rng() * VIEW_W,
        y: this.rng() * VIEW_H,
        speed: 6 + this.rng() * 22,
        phase: this.rng() * Math.PI * 2,
        color: STAR_COLORS[Math.floor(this.rng() * STAR_COLORS.length)],
      });
    }
  }

  // ---------------------------------------------------------------- flow

  update(dt: number, c: Controls): void {
    this.time += dt;
    this.phaseT += dt;

    switch (this.phase) {
      case "title":
        this.updateStars(dt);
        if (c.start || c.firePressed) this.startGame();
        break;
      case "paused":
        if (c.pause || c.start || c.firePressed) this.setPhase("playing");
        else if (c.quit) this.toTitle();
        break;
      case "playing":
        if (c.pause) {
          this.pause();
          break;
        }
        this.updateStars(dt);
        this.updateWorld(dt, c);
        break;
      case "gameover":
        this.updateStars(dt);
        this.updateWorld(dt, NO_CONTROLS);
        if (this.phaseT > 1.2 && (c.start || c.firePressed)) this.startGame();
        else if (c.quit || c.pause) this.toTitle();
        break;
    }
  }

  startGame(): void {
    this.score = 0;
    this.newHi = false;
    this.lives = START_LIVES;
    this.nextLifeAt = EXTRA_LIFE_EVERY;
    this.stats = { shots: 0, hits: 0, kills: 0 };
    this.player = this.freshPlayer();
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.bursts = [];
    this.popups = [];
    this.respawnT = -1;
    this.shake = 0;
    this.hintT = 7;
    this.wave = 0;
    this.setPhase("playing");
    this.nextWave();
  }

  pause(): void {
    if (this.phase !== "playing") return;
    this.setPhase("paused");
    this.emit("pause");
  }

  toTitle(): void {
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.bursts = [];
    this.popups = [];
    this.banner = null;
    this.setPhase("title");
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  private nextWave(): void {
    this.wave++;
    this.cfg = waveConfig(this.wave);
    this.waveT = 0;
    this.clearT = -1;
    this.diveT = WAVE_GRACE;
    this.formFireT = WAVE_GRACE + this.cfg.formationFireInterval;
    this.spawnFormation();
    this.waveTotal = this.enemies.length;
    this.banner = { text: `WAVE ${this.wave}`, sub: waveTagline(this.wave), t: 0, max: 2.6 };
    this.emit("waveStart");
  }

  private gameOver(): void {
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      this.newHi = true;
    }
    this.banner = null;
    this.setPhase("gameover");
    this.emit("gameOver");
  }

  private freshPlayer(): Player {
    return {
      x: VIEW_W / 2,
      y: PLAYER_Y,
      vx: 0,
      hw: 4.5,
      hh: 3,
      energy: MAX_ENERGY,
      alive: true,
      invuln: 0,
      cooldown: 0,
      hitFlash: 0,
    };
  }

  // ---------------------------------------------------------------- world

  private updateWorld(dt: number, c: Controls): void {
    this.waveT += dt;
    this.swayT += dt * this.cfg.swaySpeed;
    this.hintT = Math.max(0, this.hintT - dt);
    this.shake = Math.max(0, this.shake - dt * 18);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.max) this.banner = null;
    }

    this.updatePlayer(dt, c);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.collide();
    this.updateEffects(dt);
    this.updateBeat(dt);

    this.enemies = this.enemies.filter((e) => !e.dead);
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.enemyBullets = this.enemyBullets.filter((b) => !b.dead);

    if (this.phase !== "playing") return;

    if (this.enemies.length === 0 && this.clearT < 0) {
      this.clearT = 2;
      this.banner = { text: `WAVE ${this.wave} CLEAR`, sub: "ENERGY RECHARGED", t: 0, max: 1.9 };
      if (this.player.alive) this.player.energy = Math.min(MAX_ENERGY, this.player.energy + WAVE_CLEAR_REFILL);
      this.emit("waveClear");
    }
    if (this.clearT >= 0) {
      this.clearT -= dt;
      if (this.clearT < 0) this.nextWave();
    }

    if (this.respawnT >= 0) {
      this.respawnT -= dt;
      if (this.respawnT < 0) {
        if (this.lives > 0) this.respawn();
        else this.gameOver();
      }
    }
  }

  private updateStars(dt: number): void {
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > VIEW_H) {
        s.y -= VIEW_H;
        s.x = this.rng() * VIEW_W;
      }
    }
  }

  private updatePlayer(dt: number, c: Controls): void {
    const p = this.player;
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (!p.alive) return;
    p.invuln = Math.max(0, p.invuln - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);

    const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    p.vx = approach(p.vx, dir * PLAYER_SPEED, PLAYER_ACCEL * dt);
    p.x += p.vx * dt;
    if (p.x < PLAYER_MIN_X || p.x > PLAYER_MAX_X) {
      p.x = clamp(p.x, PLAYER_MIN_X, PLAYER_MAX_X);
      p.vx = 0;
    }

    if (c.fire && p.cooldown <= 0 && this.bullets.length < MAX_PLAYER_BULLETS) {
      this.bullets.push({ x: p.x, y: p.y - 6, vx: 0, vy: -PLAYER_BULLET_SPEED, hw: 1, hh: 3, dead: false });
      p.cooldown = FIRE_COOLDOWN;
      this.stats.shots++;
      this.emit("shoot");
    }
  }

  private respawn(): void {
    this.player = this.freshPlayer();
    this.player.invuln = RESPAWN_INVULN;
    this.enemyBullets = [];
  }

  /** Where an enemy's formation slot is right now (the formation drifts and breathes). */
  slotOf(e: Pick<Enemy, "gx" | "row">): { x: number; y: number } {
    const spread = 1 + 0.06 * Math.sin(this.time * 1.7);
    return {
      x: VIEW_W / 2 + e.gx * COL_GAP * spread + Math.sin(this.swayT) * SWAY_AMP,
      y: FORMATION_TOP + e.row * ROW_GAP,
    };
  }

  private spawnFormation(): void {
    this.enemies = [];
    this.cfg.rows.forEach((r, row) => {
      for (let c = 0; c < r.count; c++) {
        const centre = c - (r.count - 1) / 2;
        const gx = r.kind === "flagship" ? centre * 2 : centre;
        const side = centre < 0 ? -1 : 1;
        this.enemies.push({
          id: this.nextId++,
          kind: r.kind,
          row,
          gx,
          x: side < 0 ? -16 : VIEW_W + 16,
          y: 70 + row * 8,
          hw: 5.5,
          hh: r.kind === "flagship" ? 4.5 : 4,
          hp: r.kind === "flagship" ? this.cfg.flagshipHp : 1,
          state: "entering",
          t: 0,
          delay: row * 0.32 + Math.abs(centre) * 0.07,
          sx: side < 0 ? -16 : VIEW_W + 16,
          sy: 70 + row * 8,
          cx: VIEW_W / 2 + side * 30,
          cy: 175,
          dir: side,
          vx: 0,
          vy: 0,
          aim: 0,
          shotsLeft: 0,
          nextShotY: 0,
          flash: 0,
          dead: false,
        });
      }
    });
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    for (const e of this.enemies) {
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      switch (e.state) {
        case "entering": {
          const u = clamp((e.t - e.delay) / ENTER_TIME, 0, 1);
          const k = easeOutCubic(u);
          const slot = this.slotOf(e);
          const a = (1 - k) * (1 - k);
          const b = 2 * (1 - k) * k;
          const d = k * k;
          e.x = a * e.sx + b * e.cx + d * slot.x;
          e.y = a * e.sy + b * e.cy + d * slot.y;
          if (u >= 1) this.setState(e, "formation");
          break;
        }
        case "formation": {
          const slot = this.slotOf(e);
          e.x = slot.x;
          e.y = slot.y;
          break;
        }
        case "peel": {
          // Loop up and outward before swooping down.
          const a = clamp(e.t / PEEL_TIME, 0, 1) * Math.PI;
          e.x = e.cx - e.dir * PEEL_RADIUS * Math.cos(a);
          e.y = e.cy - PEEL_RADIUS * Math.sin(a);
          if (e.t >= PEEL_TIME) {
            this.setState(e, "attack");
            e.vx = e.dir * 30;
            e.vy = this.cfg.diveSpeed * 0.5;
          }
          break;
        }
        case "attack": {
          e.vy = approach(e.vy, this.cfg.diveSpeed, 140 * dt);
          const targetX = p.x + e.aim + Math.sin(e.t * 2.6 + e.id) * 14;
          const maxVx = 60 + this.wave * 4;
          e.vx = clamp(e.vx + clamp(targetX - e.x, -60, 60) * 3.2 * dt, -maxVx, maxVx);
          e.x = clamp(e.x + e.vx * dt, 6, VIEW_W - 6);
          e.y += e.vy * dt;
          if (e.shotsLeft > 0 && e.y >= e.nextShotY && e.y < PLAYER_Y - 36 && p.alive) {
            this.enemyShoot(e, 0.7);
            e.shotsLeft--;
            e.nextShotY += 22 + this.rng() * 14;
          }
          if (e.y > VIEW_H + 12) {
            this.setState(e, "returning");
            e.y = -12;
          }
          break;
        }
        case "returning": {
          const slot = this.slotOf(e);
          const dx = slot.x - e.x;
          const dy = slot.y - e.y;
          const dist = Math.hypot(dx, dy);
          const step = RETURN_SPEED * dt;
          if (dist <= step) this.setState(e, "formation");
          else {
            e.x += (dx / dist) * step;
            e.y += (dy / dist) * step;
          }
          break;
        }
      }
    }

    if (this.phase === "playing") this.launchAttacks(dt);
  }

  private setState(e: Enemy, s: EnemyState): void {
    e.state = s;
    e.t = 0;
  }

  private launchAttacks(dt: number): void {
    if (!this.player.alive || this.clearT >= 0 || this.waveT < WAVE_GRACE) return;
    const formation = this.enemies.filter((e) => e.state === "formation");
    if (formation.length === 0) return;

    const alive = this.enemies.length;
    const divers = this.enemies.filter((e) => e.state === "peel" || e.state === "attack").length;
    // The last few enemies attack non-stop, so a wave can never stall.
    const frenzy = alive <= 3;
    // A thinning formation gets bolder.
    const aggression = 1 + 1.3 * (1 - alive / Math.max(1, this.waveTotal));

    this.diveT -= dt * aggression;
    if (this.diveT <= 0 && divers < (frenzy ? alive : this.cfg.maxDivers)) {
      this.launchDive(formation);
      this.diveT = (frenzy ? 0.5 : this.cfg.diveInterval) * (0.7 + 0.6 * this.rng());
    }

    this.formFireT -= dt;
    if (this.formFireT <= 0) {
      this.formFireT = this.cfg.formationFireInterval * (0.6 + 0.8 * this.rng());
      // Only enemies with a clear line of fire (nobody below them) shoot from the formation.
      const front = formation.filter(
        (e) => !formation.some((o) => o.row > e.row && Math.abs(o.gx - e.gx) < 0.6),
      );
      if (front.length) this.enemyShoot(front[Math.floor(this.rng() * front.length)], 0.25);
    }
  }

  private launchDive(formation: Enemy[]): void {
    const flagships = formation.filter((e) => e.kind === "flagship");
    let leader: Enemy;
    if (flagships.length && this.rng() < 0.25) {
      leader = flagships[Math.floor(this.rng() * flagships.length)];
    } else {
      // Enemies on the edges of the formation break off more often, as in the arcade original.
      const weights = formation.map((e) => 1 + Math.abs(e.gx));
      let roll = this.rng() * weights.reduce((a, b) => a + b, 0);
      let i = 0;
      while (i < formation.length - 1 && roll >= weights[i]) roll -= weights[i++];
      leader = formation[i];
    }

    const dir = leader.gx < 0 ? -1 : 1;
    this.startDive(leader, dir, 0);

    if (leader.kind === "flagship" && this.rng() < this.cfg.escortChance) {
      const escorts = formation
        .filter((e) => e.kind === "hornet" && Math.abs(e.gx - leader.gx) <= 2.5)
        .sort((a, b) => Math.abs(a.gx - leader.gx) - Math.abs(b.gx - leader.gx))
        .slice(0, 2);
      escorts.forEach((e, i) => this.startDive(e, dir, i === 0 ? -13 : 13));
    }
    this.emit("dive");
  }

  private startDive(e: Enemy, dir: number, aim: number): void {
    this.setState(e, "peel");
    e.dir = dir;
    e.cx = e.x + dir * PEEL_RADIUS;
    e.cy = e.y;
    e.aim = aim;
    e.shotsLeft = this.cfg.shotsPerDive;
    e.nextShotY = 95 + this.rng() * 50;
  }

  /** `lead` is how much of the player's offset the shot corrects for (0 = straight down). */
  private enemyShoot(e: Enemy, lead: number): void {
    const vy = this.cfg.bulletSpeed;
    const flight = Math.max(0.2, (PLAYER_Y - e.y) / vy);
    const vx = clamp(((this.player.x - e.x) / flight) * lead, -45, 45);
    this.enemyBullets.push({ x: e.x, y: e.y + 5, vx, vy, hw: 1, hh: 2.5, dead: false });
    this.emit("enemyShoot");
  }

  private updateBullets(dt: number): void {
    for (const b of this.bullets) {
      b.y += b.vy * dt;
      if (b.y < 18) b.dead = true;
    }
    for (const b of this.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > VIEW_H + 6) b.dead = true;
    }
  }

  private collide(): void {
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead || e.y < 0 || !overlaps(b, e)) continue;
        b.dead = true;
        this.hitEnemy(e);
        break;
      }
    }

    const p = this.player;
    if (!p.alive || p.invuln > 0) return;

    for (const b of this.enemyBullets) {
      if (b.dead || !overlaps(b, p)) continue;
      b.dead = true;
      this.damagePlayer(BULLET_DAMAGE);
      if (!p.alive || p.invuln > 0) return;
    }

    for (const e of this.enemies) {
      if (e.dead || e.state === "formation" || !overlaps(e, p)) continue;
      this.destroyEnemy(e, false);
      this.damagePlayer(RAM_DAMAGE);
      return;
    }
  }

  private hitEnemy(e: Enemy): void {
    this.stats.hits++;
    e.hp--;
    if (e.hp > 0) {
      e.flash = 0.15;
      this.sparks(e.x, e.y, ENEMY_COLORS[e.kind], 6);
      this.emit("enemyHit");
      return;
    }
    this.destroyEnemy(e, true);
  }

  private destroyEnemy(e: Enemy, award: boolean): void {
    e.dead = true;
    this.stats.kills++;
    const inFlight = e.state !== "formation" && e.state !== "entering";
    if (award) {
      const pts = SCORES[e.kind][inFlight ? 1 : 0];
      this.addScore(pts);
      if (inFlight) this.popups.push({ x: e.x, y: e.y, t: 0, text: String(pts), color: ENEMY_COLORS[e.kind] });
    }
    this.bursts.push({ x: e.x, y: e.y, t: 0, color: ENEMY_COLORS[e.kind], big: e.kind === "flagship" });
    this.sparks(e.x, e.y, ENEMY_COLORS[e.kind], e.kind === "flagship" ? 22 : 12);
    this.shake = Math.max(this.shake, e.kind === "flagship" ? 3 : 1.2);
    this.emit("enemyKill");
  }

  private addScore(pts: number): void {
    this.score += pts;
    if (this.score >= this.nextLifeAt) {
      this.nextLifeAt += EXTRA_LIFE_EVERY;
      if (this.lives < MAX_LIVES) {
        this.lives++;
        this.popups.push({ x: this.player.x, y: this.player.y - 14, t: 0, text: "EXTRA SHIP", color: "#3ee05a" });
        this.emit("extraLife");
      }
    }
  }

  private damagePlayer(amount: number): void {
    const p = this.player;
    p.energy = Math.max(0, p.energy - amount);
    p.hitFlash = 0.3;
    this.shake = Math.max(this.shake, 4);
    if (p.energy > 0) {
      p.invuln = HIT_INVULN;
      this.sparks(p.x, p.y, "#2ee6e6", 10);
      this.emit("playerHit");
      return;
    }
    p.alive = false;
    p.vx = 0;
    this.lives--;
    this.respawnT = RESPAWN_DELAY;
    if (this.lives > 0) {
      const sub = this.lives === 1 ? "LAST SHIP!" : `${this.lives} SHIPS LEFT`;
      this.banner = { text: "SHIP DESTROYED", sub, t: 0, max: RESPAWN_DELAY };
    }
    this.shake = 9;
    this.bursts.push({ x: p.x, y: p.y, t: 0, color: "#2ee6e6", big: true });
    this.sparks(p.x, p.y, "#2ee6e6", 26);
    this.sparks(p.x, p.y, "#ff8a1f", 18);
    this.sparks(p.x, p.y, "#ffffff", 10);
    this.emit("playerDie");
  }

  private sparks(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const sp = 20 + this.rng() * 70;
      const life = 0.35 + this.rng() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        max: life,
        color,
        size: this.rng() < 0.3 ? 2 : 1,
      });
    }
  }

  private updateEffects(dt: number): void {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 2.2 * dt;
      pt.vy *= 1 - 2.2 * dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const b of this.bursts) b.t += dt;
    this.bursts = this.bursts.filter((b) => b.t < 0.36);
    for (const pop of this.popups) {
      pop.t += dt;
      pop.y -= 14 * dt;
    }
    this.popups = this.popups.filter((pop) => pop.t < 1);
  }

  /** A four-note bass march that speeds up as the formation thins out. */
  private updateBeat(dt: number): void {
    if (this.phase !== "playing" || this.enemies.length === 0 || this.waveT < 1) return;
    this.beatT -= dt;
    if (this.beatT <= 0) {
      this.beatT = 0.22 + 0.6 * (this.enemies.length / Math.max(1, this.waveTotal));
      this.emit("beat");
    }
  }

  get accuracy(): number {
    return this.stats.shots ? Math.round((100 * this.stats.hits) / this.stats.shots) : 0;
  }

  get enemyTotal(): number {
    return enemyCount(this.cfg);
  }
}
