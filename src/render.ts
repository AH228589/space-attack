import { COLORS, FIRE_COOLDOWN, MAX_ENERGY, VIEW_H, VIEW_W } from "./config";
import { SCORES } from "./difficulty";
import { ENEMY_COLORS, type Game } from "./game";
import { SpriteCache, spriteSize, type SpriteName } from "./sprites";

// Canvas fonts need a CSS length, but text is drawn under the screen transform, so the "px" in
// these font strings are reference-grid cells that scale with the screen, not screen pixels.
const FONT = '"Press Start 2P", monospace';
const pad = (n: number, len: number) => String(n).padStart(len, "0");

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
    if (g.phase !== "paused") this.drawBanner(g);
    if (g.hintT > 0 && g.phase === "playing") {
      ctx.globalAlpha = Math.min(1, g.hintT);
      this.drawControlsHint(206);
      ctx.globalAlpha = 1;
    }
    if (g.phase === "paused") this.drawPause();
    if (g.phase === "gameover") this.drawGameOver(g);
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

    for (const b of g.bullets) {
      this.rect(b.x - 0.5, b.y - 3, 1, 6, COLORS.white);
      ctx.globalAlpha = 0.45;
      this.rect(b.x - 0.5, b.y + 3, 1, 3, COLORS.cyan);
      ctx.globalAlpha = 1;
    }
    const flicker = Math.floor(g.time * 20) % 2 === 0;
    for (const b of g.enemyBullets) {
      this.rect(b.x - 0.75, b.y - 2.5, 1.5, 5, flicker ? COLORS.white : "#ff8a8a");
    }

    const p = g.player;
    if (p.alive && (p.invuln <= 0 || Math.floor(g.time * 16) % 2 === 0)) {
      const flame = 1 + Math.floor((g.time * 30) % 3);
      this.rect(p.x - 2.5, p.y + 4, 1, flame, COLORS.orange);
      this.rect(p.x + 1.5, p.y + 4, 1, flame, COLORS.orange);
      this.sprite("player", 0, p.x, p.y);
      if (p.cooldown > FIRE_COOLDOWN - 0.05) this.rect(p.x - 1, p.y - 7, 2, 2, COLORS.white);
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
    const show1up = g.phase !== "playing" || Math.floor(g.time * 2.5) % 2 === 0;
    if (show1up) this.text("1UP", 58, 4, 6, COLORS.label);
    this.text(pad(g.score, 6), 58, 13, 8, COLORS.score);
    this.text("HI-SCORE", 194, 4, 6, COLORS.label);
    this.text(pad(Math.max(g.hiScore, g.score), 6), 194, 13, 8, COLORS.score);
  }

  private drawBottomHud(g: Game): void {
    const p = g.player;
    const y = 270;
    this.text("E", 8, y, 8, COLORS.label, "left");

    const frac = p.alive ? p.energy / MAX_ENERGY : 0;
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
    this.text(b.text, VIEW_W / 2, 136, 12, COLORS.cyan);
    this.text(b.sub, VIEW_W / 2, 156, 6, COLORS.yellow);
    this.ctx.globalAlpha = 1;
  }

  private drawMute(muted: boolean): void {
    if (muted) this.text(this.touch ? "SOUND OFF" : "SOUND OFF (M)", VIEW_W / 2, 24, 5, COLORS.dim);
  }

  // ---------------------------------------------------------------- screens

  private drawTitle(g: Game): void {
    const { ctx } = this;
    const bob = Math.sin(g.time * 2) * 1.5;
    this.logo("SPACE", 40 + bob, 24);
    this.logo("ATTACK", 68 + bob, 24);

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

    const prompt = this.touch ? "TAP TO START" : "ENTER OR CLICK TO START";
    if (Math.floor(g.time * 2) % 2 === 0) this.text(prompt, VIEW_W / 2, 238, 8, COLORS.yellow);
    this.text("EXTRA SHIP EVERY 10000 PTS", VIEW_W / 2, 256, 5, COLORS.dim);
    this.text("SURVIVE THE WAVES. THEY ONLY GET FASTER.", VIEW_W / 2, 268, 4, COLORS.dim);
    ctx.globalAlpha = 1;
  }

  private drawPause(): void {
    this.dim(0.65);
    this.text("PAUSED", VIEW_W / 2, 92, 16, COLORS.cyan);
    this.drawControlsPanel(128);
    this.text(this.touch ? "TAP TO RESUME" : "P, ENTER OR CLICK TO RESUME", VIEW_W / 2, 196, 6, COLORS.yellow);
    if (!this.touch) this.text("Q TO QUIT TO TITLE", VIEW_W / 2, 210, 6, COLORS.dim);
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

    if (g.phaseT > 1.2) {
      const again = this.touch ? "TAP TO PLAY AGAIN" : "ENTER OR CLICK TO PLAY AGAIN";
      if (Math.floor(g.time * 2) % 2 === 0) this.text(again, VIEW_W / 2, 196, 7, COLORS.yellow);
      this.text(this.touch ? "PAUSE BUTTON FOR TITLE" : "ESC FOR TITLE SCREEN", VIEW_W / 2, 212, 6, COLORS.dim);
    }
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
