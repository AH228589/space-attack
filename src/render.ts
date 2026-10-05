import { CARD_H, CARD_W, CARD_Y, COLORS, FIRE_COOLDOWN, VIEW_H, VIEW_W, cardX } from "./config";
import { ANOMALIES, SCORES, type EnemyKind } from "./difficulty";
import { ENEMY_COLORS, type Game } from "./game";
import { ordinal } from "./leaderboard";
import { cardDef, describeBuild, type CardId, type Rarity } from "./perks";
import { SpriteCache, spriteSize, type SpriteName } from "./sprites";

// Canvas fonts need a CSS length, but text is drawn under the screen transform, so the "px" in
// these font strings are reference-grid cells that scale with the screen, not screen pixels.
const FONT = '"Press Start 2P", monospace';
const pad = (n: number, len: number) => String(n).padStart(len, "0");

const RARITY_COLOR: Record<Rarity, string> = { common: "#3ee05a", rare: "#2ee6e6", epic: "#ffd23a" };
/** A big symbol for each card, in the arcade font. */
const CARD_GLYPH: Record<CardId, string> = {
  twin: "||",
  rapid: ">>",
  pierce: "->",
  plating: "[]",
  repair: "+",
  thrusters: "<>",
  bounty: "$",
  deflector: "X",
  salvage: "E",
  shield: "()",
  extra: "1UP",
  fix: "+E",
};
const PODIUM = ["#ffd23a", "#d8deff", "#ff9a52"];

/** Breaks text into lines of at most `max` characters, at spaces. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Draws the game. All coordinates are on the VIEW_W x VIEW_H reference grid; the canvas
 * transform scales that grid to the real screen, and positions are snapped to the screen's own
 * grid so the blocky art stays crisp at any size.
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprites = new SpriteCache();
  private s = 1;
  /** Show touch wording ("TAP TO START") instead of keyboard wording. */
  private touch = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
  }

  /** Matches the canvas's backing store to its on-screen size so nothing is upscaled blurrily. */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(VIEW_W, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.round((w * VIEW_H) / VIEW_W);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.s = w / VIEW_W;
  }

  draw(g: Game, muted: boolean, touch: boolean): void {
    const { ctx, s } = this;
    this.touch = touch;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const shake = g.phase === "paused" ? 0 : g.shake;
    const ox = shake ? (Math.random() - 0.5) * shake : 0;
    const oy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(s, 0, 0, s, Math.round(ox * s), Math.round(oy * s));

    this.drawStars(g);

    if (g.phase === "title") {
      ctx.setTransform(s, 0, 0, s, 0, 0);
      this.drawTopHud(g);
      this.drawTitle(g);
      this.drawMute(muted);
      return;
    }

    this.drawWorld(g);
    ctx.setTransform(s, 0, 0, s, 0, 0);

    if (g.player.hitFlash > 0) {
      ctx.globalAlpha = Math.min(0.35, g.player.hitFlash);
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }

    this.drawTopHud(g);
    this.drawBottomHud(g);
    if (g.phase === "playing") this.drawBanner(g);
    if (g.hintT > 0 && g.phase === "playing") {
      ctx.globalAlpha = Math.min(1, g.hintT);
      this.drawControlsHint(206);
      ctx.globalAlpha = 1;
    }
    if (g.phase === "paused") this.drawPause(g);
    if (g.phase === "gameover") this.drawGameOver(g);
    if (g.phase === "draft") this.drawDraft(g);
    if (g.phase === "entry") this.drawEntry(g);
    if (g.phase === "results") this.drawResults(g);
    this.drawMute(muted);
  }

  // ---------------------------------------------------------------- world

  private drawStars(g: Game): void {
    const { ctx } = this;
    for (const st of g.stars) {
      ctx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(g.time * 1.6 + st.phase));
      this.rect(st.x, st.y, 1, 1, st.color);
    }
    ctx.globalAlpha = 1;
  }

  private drawWorld(g: Game): void {
    const { ctx } = this;
    const slowFlap = Math.floor(g.time * 2.2) % 2;
    const fastFlap = Math.floor(g.time * 7) % 2;

    for (const e of g.enemies) {
      const calm = e.state === "formation" || e.state === "entering";
      this.sprite(e.kind, calm ? slowFlap : fastFlap, e.x, e.y, e.flash > 0 ? COLORS.white : undefined);
    }

    const boss = g.boss;
    if (boss && (boss.dying < 0 || Math.floor(boss.dying * 14) % 2 === 0)) {
      const tint = boss.flash > 0 || boss.dying >= 0 ? COLORS.white : undefined;
      this.sprite("boss", Math.floor(g.time * 4) % 2, boss.x, boss.y, tint);
    }

    for (const b of g.bullets) {
      this.rect(b.x - 0.5, b.y - 3, 1, 6, COLORS.white);
      ctx.globalAlpha = 0.45;
      this.rect(b.x - 0.5, b.y + 3, 1, 3, COLORS.cyan);
      ctx.globalAlpha = 1;
    }
    const flicker = Math.floor(g.time * 20) % 2 === 0;
    for (const b of g.enemyBullets) {
      if (b.style === "orb") {
        ctx.fillStyle = b.color ?? COLORS.red;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        this.rect(b.x - 0.75, b.y - 0.75, 1.5, 1.5, COLORS.white);
      } else {
        this.rect(b.x - 0.75, b.y - 2.5, 1.5, 5, flicker ? COLORS.white : "#ff8a8a");
      }
    }

    for (const d of g.drops) {
      const blink = Math.floor(d.t * 8) % 2 === 0;
      this.rect(d.x - 3.5, d.y - 2.5, 7, 5, COLORS.green);
      this.rect(d.x - 0.5, d.y - 1.5, 1, 3, blink ? COLORS.white : "#0b3d16");
      this.rect(d.x - 1.5, d.y - 0.5, 3, 1, blink ? COLORS.white : "#0b3d16");
    }

    const p = g.player;
    if (p.alive && g.shieldUp) {
      ctx.globalAlpha = 0.45 + 0.25 * Math.sin(g.time * 6);
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (p.alive && (p.invuln <= 0 || Math.floor(g.time * 16) % 2 === 0)) {
      const flame = 1 + Math.floor((g.time * 30) % 3);
      this.rect(p.x - 2.5, p.y + 4, 1, flame, COLORS.orange);
      this.rect(p.x + 1.5, p.y + 4, 1, flame, COLORS.orange);
      this.sprite("player", 0, p.x, p.y);
      if (p.cooldown > FIRE_COOLDOWN - 0.05) this.rect(p.x - 1, p.y - 7, 2, 2, COLORS.white);
      if (g.boss) {
        // In a bullet hell only this core counts against round shots, so show it.
        this.rect(p.x - 1.5, p.y - 1, 3, 3, COLORS.red);
        this.rect(p.x - 0.5, p.y, 1, 1, COLORS.white);
      }
    }

    for (const pt of g.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      this.rect(pt.x, pt.y, pt.size, pt.size, pt.color);
    }
    ctx.globalAlpha = 1;

    for (const b of g.bursts) {
      this.sprite("burst", b.t < 0.12 ? 0 : 1, b.x, b.y, b.color);
      if (b.big) {
        ctx.globalAlpha = 1 - b.t / 0.36;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4 + b.t * 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    for (const pop of g.popups) {
      ctx.globalAlpha = Math.min(1, (1 - pop.t) * 2);
      this.text(pop.text, pop.x, pop.y - 3, 5, pop.color);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- HUD

  private drawTopHud(g: Game): void {
    // Ships left, where arcades put the blinking 1UP. Turns orange on the last ship.
    const ships = Math.max(0, g.lives);
    this.text(ships === 1 ? "LAST SHIP" : `SHIPS ${ships}`, 58, 4, 6, ships === 1 ? COLORS.orange : COLORS.label);
    this.text(pad(g.score, 6), 58, 13, 8, COLORS.score);
    this.text("HI-SCORE", 194, 4, 6, COLORS.label);
    this.text(pad(Math.max(g.hiScore, g.score), 6), 194, 13, 8, COLORS.score);
    if (g.anomaly && (g.phase === "playing" || g.phase === "paused")) {
      const a = ANOMALIES[g.anomaly];
      this.text(a.name, VIEW_W / 2, 24, 5, a.good ? COLORS.green : COLORS.red);
    }
    const boss = g.boss;
    if (boss && boss.dying < 0 && boss.y > 0) {
      this.text(boss.name, 28, 25, 5, "#ff4fd8", "left");
      const enraged = boss.t > 75;
      this.text(enraged ? "ENRAGED" : `PHASE ${boss.phase}`, 228, 25, 5, enraged ? COLORS.red : COLORS.dim, "right");
      this.rect(28, 32, 200, 3, "#3a1036");
      this.rect(28, 32, 200 * (boss.hp / boss.maxHp), 3, boss.flash > 0 ? COLORS.white : "#ff4fd8");
    }
  }

  private drawBottomHud(g: Game): void {
    const p = g.player;
    const y = 270;
    this.text("E", 8, y, 8, COLORS.label, "left");

    const frac = p.alive ? p.energy / g.maxEnergy : 0;
    const low = frac <= 0.34;
    this.rect(18, y, 74, 8, "#16241a");
    if (frac > 0 && (!low || Math.floor(g.time * 6) % 2 === 0)) {
      const color = frac > 0.5 ? COLORS.green : low ? COLORS.red : COLORS.yellow;
      this.rect(18, y, 74 * frac, 8, color);
    }

    this.text(`WAVE ${pad(Math.max(1, g.wave), 2)}`, VIEW_W / 2, y + 1, 6, COLORS.dim);

    this.text(String(Math.max(0, g.lives)), 250, y, 8, COLORS.label, "right");
    const icons = Math.min(Math.max(0, g.lives), 5);
    for (let i = 0; i < icons; i++) this.sprite("player", 0, 234 - i * 13, y + 4, COLORS.green);
  }

  private drawBanner(g: Game): void {
    const b = g.banner;
    if (!b) return;
    this.ctx.globalAlpha = Math.max(0, Math.min(1, b.t / 0.2, (b.max - b.t) / 0.35));
    if (!b.blink || Math.floor(b.t * 4) % 2 === 0) this.text(b.text, VIEW_W / 2, 136, 12, b.color ?? COLORS.cyan);
    this.text(b.sub, VIEW_W / 2, 156, 6, b.subColor ?? COLORS.yellow);
    if (b.sub2) this.text(b.sub2, VIEW_W / 2, 167, 5, COLORS.text);
    this.ctx.globalAlpha = 1;
  }

  private drawMute(muted: boolean): void {
    if (muted) this.text(this.touch ? "SOUND OFF" : "SOUND OFF (M)", VIEW_W / 2, 259, 4, COLORS.dim);
  }

  // ---------------------------------------------------------------- screens

  private drawTitle(g: Game): void {
    const { ctx } = this;
    const bob = Math.sin(g.time * 2) * 1.5;
    this.logo("SPACE", 40 + bob, 24);
    this.logo("ATTACK", 68 + bob, 24);

    // Attract mode: instructions, the enemy roster and the high score table take turns.
    const page = Math.floor(g.phaseT / 7) % 3;
    if (page === 2) {
      this.text("HIGH SCORES", VIEW_W / 2, 104, 8, COLORS.cyan);
      this.drawBoardRows(g, 120, 11);
    } else if (page === 1) {
      this.drawRoster(g);
    } else {
      this.text("FORMATION", 150, 104, 5, COLORS.dim);
      this.text("DIVING", 212, 104, 5, COLORS.dim);
      const kinds = ["flagship", "hornet", "drone"] as const;
      const flap = Math.floor(g.time * 2.2) % 2;
      kinds.forEach((k, i) => {
        const y = 120 + i * 15;
        this.sprite(k, flap, 70, y);
        this.text(String(SCORES[k][0]), 150, y - 4, 8, ENEMY_COLORS[k]);
        this.text(String(SCORES[k][1]), 212, y - 4, 8, ENEMY_COLORS[k]);
      });
      this.drawControlsPanel(170);
    }

    const prompt = this.touch ? "TAP TO START" : "ENTER OR CLICK TO START";
    if (Math.floor(g.time * 2) % 2 === 0) this.text(prompt, VIEW_W / 2, 238, 8, COLORS.yellow);
    this.text("EXTRA SHIP EVERY 10000 PTS", VIEW_W / 2, 256, 5, COLORS.dim);
    this.text("PICK AN UPGRADE AFTER EVERY WAVE", VIEW_W / 2, 268, 4, COLORS.dim);
    ctx.globalAlpha = 1;
  }

  private drawPause(g: Game): void {
    this.dim(0.65);
    this.text("PAUSED", VIEW_W / 2, 84, 16, COLORS.cyan);
    this.drawControlsPanel(116);
    this.text(this.touch ? "TAP TO RESUME" : "P, ENTER OR CLICK TO RESUME", VIEW_W / 2, 184, 6, COLORS.yellow);
    if (!this.touch) this.text("Q TO QUIT TO TITLE", VIEW_W / 2, 198, 6, COLORS.dim);
    this.drawBuild(g, 218);
  }

  private drawGameOver(g: Game): void {
    this.dim(Math.min(0.6, g.phaseT * 0.8));
    this.text("GAME OVER", VIEW_W / 2, 72, 18, COLORS.red);
    if (g.newHi && Math.floor(g.time * 3) % 2 === 0) this.text("NEW HI-SCORE!", VIEW_W / 2, 100, 8, COLORS.yellow);

    const rows: [string, string][] = [
      ["SCORE", String(g.score)],
      ["WAVE REACHED", String(g.wave)],
      ["ENEMIES DOWN", String(g.stats.kills)],
      ["ACCURACY", `${g.accuracy}%`],
    ];
    rows.forEach(([label, value], i) => {
      const y = 124 + i * 14;
      this.text(label, 52, y, 6, COLORS.text, "left");
      this.text(value, 204, y, 6, COLORS.score, "right");
    });

    if (g.phaseT > 1 && Math.floor(g.time * 2) % 2 === 0) {
      this.text(this.touch ? "TAP TO CONTINUE" : "PRESS ENTER TO CONTINUE", VIEW_W / 2, 196, 6, COLORS.yellow);
    }
  }

  /** Between waves: three upgrade cards to choose from. */
  private drawDraft(g: Game): void {
    const d = g.draft;
    if (!d) return;
    this.dim(0.6);
    if (d.bonus) {
      this.text(`${g.bossBeaten} DEFEATED`, VIEW_W / 2, 38, 9, "#ff4fd8");
      this.text("BOSS REWARD: RARER CARDS", VIEW_W / 2, 58, 6, COLORS.yellow);
    } else {
      this.text(`WAVE ${g.wave} CLEAR`, VIEW_W / 2, 38, 10, COLORS.cyan);
      this.text("CHOOSE AN UPGRADE", VIEW_W / 2, 58, 7, COLORS.yellow);
    }
    // Cards fade in while they are not yet armed, so an early tap visibly does nothing.
    this.ctx.globalAlpha = Math.min(1, g.phaseT / 0.5);
    d.cards.forEach((id, i) => this.drawCard(g, id, i, i === d.sel, i === d.press));
    this.ctx.globalAlpha = 1;

    if (this.touch) {
      this.text("TOUCH A CARD, LIFT TO TAKE IT", VIEW_W / 2, 204, 5, COLORS.text);
      this.text("OR USE THE ARROWS AND TAKE", VIEW_W / 2, 214, 4, COLORS.dim);
    } else {
      const y = 204;
      this.key("LEFT", 58, y);
      this.key("RIGHT", 71, y);
      this.text("CHOOSE", 86, y + 3, 5, COLORS.text, "left");
      this.key("SPACE", 128, y, 34);
      this.text("TAKE", 166, y + 3, 5, COLORS.text, "left");
      this.text("OR CLICK A CARD, OR PRESS 1, 2 OR 3", VIEW_W / 2, y + 16, 4, COLORS.dim);
    }
    this.drawBuild(g, 236);
  }

  private drawCard(g: Game, id: CardId, i: number, selected: boolean, pressed: boolean): void {
    const { ctx } = this;
    const def = cardDef(id);
    const color = RARITY_COLOR[def.rarity];
    const x = cardX(i);
    // Selected cards lift; a card under a finger or held mouse sinks back like a pressed button.
    const y = CARD_Y + (pressed ? 0 : selected ? -3 : 0);
    const cx = x + CARD_W / 2;

    const fade = ctx.globalAlpha;
    ctx.fillStyle = pressed ? "#26307a" : selected ? "#18205a" : "#0d1130";
    ctx.strokeStyle = pressed ? COLORS.white : color;
    ctx.lineWidth = selected || pressed ? 1.5 : 0.6;
    ctx.globalAlpha = fade * (selected ? 1 : 0.85);
    ctx.beginPath();
    ctx.roundRect(x, y, CARD_W, CARD_H, 4);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = fade;

    this.text(def.rarity.toUpperCase(), cx, y + 7, 4, color);
    this.text(CARD_GLYPH[id], cx, y + 20, 14, color);
    this.text(def.name, cx, y + 44, def.name.length > 10 ? 5 : 6, COLORS.white);
    this.text(def.desc[0], cx, y + 60, 4, "#c3c9ec");
    this.text(def.desc[1], cx, y + 68, 4, "#c3c9ec");

    if (id !== "fix" && def.max > 1) {
      // One pip per level: owned levels filled, the level this card adds blinking.
      const have = g.level(id);
      const pipW = 6;
      const startX = cx - (def.max * pipW + (def.max - 1) * 3) / 2;
      for (let k = 0; k < def.max; k++) {
        const px = startX + k * (pipW + 3);
        const next = k === have && Math.floor(g.time * 4) % 2 === 0;
        this.rect(px, y + 84, pipW, 3, k < have ? color : next ? COLORS.white : "#2a3166");
      }
    }
    if (!this.touch) this.text(String(i + 1), cx, y + CARD_H - 13, 5, selected ? COLORS.yellow : COLORS.dim);
  }

  /** Arcade initials: three letters, picked one at a time. */
  private drawEntry(g: Game): void {
    this.dim(0.88);
    if (Math.floor(g.time * 3) % 3 !== 0) this.text("NEW HIGH SCORE!", VIEW_W / 2, 38, 10, COLORS.yellow);
    this.text(`YOU PLACED ${ordinal(g.place)}`, VIEW_W / 2, 56, 7, COLORS.cyan);
    this.text(`SCORE ${g.score}`, VIEW_W / 2, 70, 6, COLORS.text);
    this.text("ENTER YOUR INITIALS", VIEW_W / 2, 92, 7, COLORS.white);

    const { letters, slot } = g.entry;
    letters.forEach((ch, i) => {
      const x = VIEW_W / 2 + (i - 1) * 26;
      const current = i === slot;
      const color = current ? COLORS.yellow : i < slot ? COLORS.white : COLORS.dim;
      if (!current || Math.floor(g.time * 4) % 4 !== 0) this.text(ch === " " ? "_" : ch, x + 1, 112, 18, color);
      this.rect(x - 9, 134, 20, 1.5, current ? COLORS.yellow : "#2a3166");
      if (current) {
        this.triangle(x + 1, 106, -1);
        this.triangle(x + 1, 141, 1);
      }
    });

    if (this.touch) {
      this.key("LEFT", 66, 156);
      this.key("RIGHT", 79, 156);
      this.text("CHANGE LETTER", 94, 159, 5, COLORS.text, "left");
      this.text("FIRE OR TAP FOR THE NEXT ONE", VIEW_W / 2, 174, 5, COLORS.text);
    } else {
      this.text("TYPE THEM, OR USE THE ARROWS", VIEW_W / 2, 154, 5, COLORS.text);
      this.text("ENTER OR SPACE: NEXT LETTER", VIEW_W / 2, 166, 5, COLORS.text);
      this.text("BACKSPACE: BACK    ESC: SKIP", VIEW_W / 2, 178, 5, COLORS.dim);
    }
  }

  /** End of a run: summary, the shared top 10 (your entry highlighted) and the build you made. */
  private drawResults(g: Game): void {
    this.dim(0.88);
    this.text("GAME OVER", VIEW_W / 2, 30, 10, COLORS.red);
    this.text(`SCORE ${g.score}   WAVE ${g.wave}`, VIEW_W / 2, 46, 5, COLORS.yellow);
    this.text(`KILLS ${g.stats.kills}   ACCURACY ${g.accuracy}%`, VIEW_W / 2, 55, 5, COLORS.text);

    const title =
      g.boardStatus === "online" ? "GLOBAL TOP 10" : g.boardStatus === "offline" ? "TOP 10 ON THIS DEVICE" : "LOADING SCORES...";
    this.text(title, VIEW_W / 2, 68, 6, g.boardStatus === "offline" ? COLORS.orange : COLORS.cyan);
    this.drawBoardRows(g, 82, 10);

    this.drawBuild(g, 192);
    if (g.phaseT > 1) {
      const again = this.touch ? "TAP TO PLAY AGAIN" : "ENTER OR CLICK TO PLAY AGAIN";
      if (Math.floor(g.time * 2) % 2 === 0) this.text(again, VIEW_W / 2, 216, 6, COLORS.yellow);
      this.text(this.touch ? "PAUSE BUTTON FOR TITLE" : "ESC FOR TITLE SCREEN", VIEW_W / 2, 229, 5, COLORS.dim);
    }
  }

  /** Every enemy type, its points and the wave it first shows up. */
  private drawRoster(g: Game): void {
    this.text("ENEMY ROSTER", VIEW_W / 2, 104, 8, COLORS.cyan);
    this.text("PTS", 150, 116, 4, COLORS.dim);
    this.text("DIVING", 186, 116, 4, COLORS.dim);
    this.text("FROM", 222, 116, 4, COLORS.dim);
    const flap = Math.floor(g.time * 2.2) % 2;
    const rows: [EnemyKind, string, string][] = [
      ["drone", "DRONE", "1"],
      ["hornet", "HORNET", "1"],
      ["flagship", "FLAGSHIP", "1"],
      ["gunner", "GUNNER", "4"],
      ["splitter", "SPLITTER", "5"],
      ["tank", "TANK", "7"],
    ];
    rows.forEach(([kind, name, from], i) => {
      const y = 130 + i * 13;
      this.sprite(kind, flap, 40, y);
      this.text(name, 56, y - 3, 6, ENEMY_COLORS[kind], "left");
      this.text(String(SCORES[kind][0]), 150, y - 3, 6, COLORS.text);
      this.text(String(SCORES[kind][1]), 186, y - 3, 6, COLORS.text);
      this.text(from, 222, y - 3, 6, COLORS.dim);
    });
    this.text("EVERY 10TH WAVE: BOSS FIGHT", VIEW_W / 2, 214, 6, "#ff4fd8");
  }

  /** The leaderboard rows, shared by the title's attract mode and the results screen. */
  private drawBoardRows(g: Game, y0: number, rowH: number): void {
    if (g.board.length === 0) {
      const msg = g.boardStatus === "loading" ? "LOADING..." : "NO SCORES YET";
      this.text(msg, VIEW_W / 2, y0 + 30, 6, COLORS.dim);
      if (g.boardStatus !== "loading") this.text("BE THE FIRST ON THE TABLE", VIEW_W / 2, y0 + 44, 5, COLORS.dim);
      return;
    }
    this.text("RANK", 40, y0, 4, COLORS.dim, "left");
    this.text("NAME", 98, y0, 4, COLORS.dim, "left");
    this.text("SCORE", 182, y0, 4, COLORS.dim, "right");
    this.text("WAVE", 218, y0, 4, COLORS.dim, "right");
    g.board.forEach((e, i) => {
      const y = y0 + 8 + i * rowH;
      const mine = i === g.highlight;
      if (mine && Math.floor(g.time * 4) % 2 === 0) this.rect(34, y - 2, 188, rowH - 1, "#2a2a10");
      const color = mine ? COLORS.yellow : (PODIUM[i] ?? COLORS.text);
      this.text(ordinal(i + 1), 40, y, 6, color, "left");
      this.text(e.name, 98, y, 6, color, "left");
      this.text(String(e.score), 182, y, 6, color, "right");
      this.text(String(e.wave), 218, y, 6, color, "right");
    });
  }

  /** "BUILD: TWIN SHOT 2, RAPID FIRE 1" in small print. */
  private drawBuild(g: Game, y: number): void {
    const build = describeBuild(g.perks);
    if (!build.length) return;
    wrap(`BUILD: ${build.join(", ")}`, 52)
      .slice(0, 2)
      .forEach((line, i) => this.text(line, VIEW_W / 2, y + i * 8, 4, COLORS.dim));
  }

  /** The full controls list, used on the title and pause screens. */
  private drawControlsPanel(y: number): void {
    const keysRight = 118;
    const labelX = 130;
    if (this.touch) {
      this.key("LEFT", keysRight - 24, y);
      this.key("RIGHT", keysRight - 11, y);
      this.text("MOVE", labelX, y + 3, 6, COLORS.text, "left");
      this.key("FIRE", keysRight - 30, y + 16, 30);
      this.text("FIRE (HOLD)", labelX, y + 19, 6, COLORS.text, "left");
      this.text("OR TAP THE SCREEN", labelX, y + 28, 4, COLORS.dim, "left");
      this.key("II", keysRight - 11, y + 36);
      this.text("PAUSE", labelX, y + 39, 6, COLORS.text, "left");
      return;
    }
    // Move
    let x = keysRight - 11;
    this.key("RIGHT", x, y);
    x -= 13;
    this.key("LEFT", x, y);
    this.text("OR", x - 10, y + 3, 5, COLORS.dim);
    this.key("D", x - 32, y);
    this.key("A", x - 45, y);
    this.text("MOVE", labelX, y + 3, 6, COLORS.text, "left");
    // Fire
    const spaceW = 34;
    this.key("SPACE", keysRight - spaceW, y + 16, spaceW);
    this.text("OR", keysRight - spaceW - 10, y + 19, 5, COLORS.dim);
    this.key("CLICK", keysRight - spaceW - 50, y + 16, 30);
    this.text("FIRE (HOLD)", labelX, y + 19, 6, COLORS.text, "left");
    // Pause and sound
    this.key("P", keysRight - 11, y + 32);
    this.text("PAUSE", labelX, y + 35, 6, COLORS.text, "left");
    this.key("M", keysRight + 64 - 11, y + 32);
    this.text("SOUND", keysRight + 64 + 12, y + 35, 6, COLORS.text, "left");
  }

  /** A one-line reminder shown over the playfield at the start of a game. */
  private drawControlsHint(y: number): void {
    if (this.touch) {
      const startX = 44;
      this.key("FIRE", startX, y, 30);
      this.text("OR TAP THE SCREEN TO FIRE", startX + 34, y + 3.5, 5, COLORS.text, "left");
      return;
    }
    const startX = 34;
    this.key("LEFT", startX, y);
    this.key("RIGHT", startX + 13, y);
    this.text("MOVE", startX + 28, y + 3, 6, COLORS.text, "left");
    this.key("SPACE", startX + 64, y, 34);
    this.text("FIRE", startX + 102, y + 3, 6, COLORS.text, "left");
    this.key("P", startX + 138, y);
    this.text("PAUSE", startX + 153, y + 3, 6, COLORS.text, "left");
  }

  // ---------------------------------------------------------------- primitives

  private logo(word: string, y: number, size: number): void {
    const { ctx } = this;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const x = this.snap(VIEW_W / 2);
    ctx.fillStyle = "#5a0d16";
    ctx.fillText(word, x + 2, this.snap(y) + 2);
    const grad = ctx.createLinearGradient(0, y, 0, y + size);
    grad.addColorStop(0, "#fff38a");
    grad.addColorStop(0.45, COLORS.yellow);
    grad.addColorStop(0.75, COLORS.orange);
    grad.addColorStop(1, COLORS.red);
    ctx.fillStyle = grad;
    ctx.fillText(word, x, this.snap(y));
  }

  /** A keyboard key cap. "LEFT" and "RIGHT" draw arrows instead of text. */
  private key(label: string, x: number, y: number, w = 11): void {
    const { ctx } = this;
    const h = 11;
    ctx.fillStyle = "#121735";
    ctx.strokeStyle = "#8a93c8";
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 2);
    ctx.fill();
    ctx.stroke();
    if (label === "LEFT" || label === "RIGHT") {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const d = label === "LEFT" ? -1 : 1;
      ctx.fillStyle = COLORS.text;
      ctx.beginPath();
      ctx.moveTo(cx + d * 2.5, cy);
      ctx.lineTo(cx - d * 2, cy - 3);
      ctx.lineTo(cx - d * 2, cy + 3);
      ctx.closePath();
      ctx.fill();
    } else {
      this.text(label, x + w / 2, y + 3.5, label.length > 1 ? 4 : 5, COLORS.text);
    }
  }

  /** Small arrow above (dir -1, pointing up) or below (dir 1, pointing down) a letter. */
  private triangle(x: number, y: number, dir: number): void {
    const { ctx } = this;
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x, y + dir * 3.5);
    ctx.closePath();
    ctx.fill();
  }

  private dim(alpha: number): void {
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 26, VIEW_W, VIEW_H - 46);
    this.ctx.globalAlpha = 1;
  }

  private sprite(name: SpriteName, frame: number, x: number, y: number, tint?: string): void {
    const c = this.sprites.get(name, frame, this.s, tint);
    const { w, h } = spriteSize(name);
    this.ctx.drawImage(c, this.snap(x - w / 2), this.snap(y - h / 2), c.width / this.s, c.height / this.s);
  }

  private text(str: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center"): void {
    const { ctx } = this;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillStyle = color;
    ctx.fillText(str, this.snap(x), this.snap(y));
  }

  private rect(x: number, y: number, w: number, h: number, color: string): void {
    const x0 = this.snap(x);
    const y0 = this.snap(y);
    const min = 1 / this.s;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x0, y0, Math.max(min, this.snap(x + w) - x0), Math.max(min, this.snap(y + h) - y0));
  }

  /** Rounds a reference-grid coordinate to the nearest real screen cell. */
  private snap(v: number): number {
    return Math.round(v * this.s) / this.s;
  }
}
