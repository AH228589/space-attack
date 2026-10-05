import type { GameEvent } from "./game";

const BEAT_NOTES = [98, 87.3, 77.8, 73.4];

/** Every sound is synthesised with WebAudio, so the game ships with no audio files. */
export class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private beatIndex = 0;
  /** Last time a boss hit tick played, so a stream of hits does not become noise. */
  private lastBossHit = 0;

  /** Browsers only allow audio after a user gesture, so this runs on the first key press. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
  }

  play(e: GameEvent): void {
    if (!this.ctx || this.muted) return;
    switch (e) {
      case "shoot":
        this.tone("square", 1100, 260, 0.09, 0.07);
        break;
      case "enemyShoot":
        this.tone("triangle", 520, 300, 0.06, 0.035);
        break;
      case "enemyHit":
        this.tone("square", 700, 900, 0.06, 0.06);
        break;
      case "enemyKill":
        this.noise(0.18, 0.16, 3200, 400);
        this.tone("square", 260, 50, 0.16, 0.06);
        break;
      case "dive":
        this.tone("sine", 1400, 380, 0.55, 0.05);
        break;
      case "playerHit":
        this.tone("sawtooth", 320, 90, 0.22, 0.1);
        this.noise(0.12, 0.1, 1800, 300);
        break;
      case "playerDie":
        this.noise(0.9, 0.26, 2400, 80);
        this.tone("sawtooth", 220, 30, 0.8, 0.1);
        break;
      case "waveStart":
        [523, 659, 784, 1047].forEach((f, i) => this.tone("square", f, f, 0.09, 0.05, i * 0.09));
        break;
      case "waveClear":
        [784, 988, 1175, 1568].forEach((f, i) => this.tone("square", f, f, 0.1, 0.05, i * 0.08));
        break;
      case "extraLife":
        [1047, 1319, 1568, 2093, 1568, 2093].forEach((f, i) => this.tone("square", f, f, 0.07, 0.05, i * 0.07));
        break;
      case "gameOver":
        [392, 330, 262, 196].forEach((f, i) => this.tone("triangle", f, f * 0.98, 0.28, 0.1, i * 0.26));
        break;
      case "beat": {
        const f = BEAT_NOTES[this.beatIndex++ % BEAT_NOTES.length];
        this.tone("triangle", f, f, 0.12, 0.12);
        break;
      }
      case "pause":
        this.tone("square", 660, 660, 0.05, 0.04);
        this.tone("square", 440, 440, 0.05, 0.04, 0.07);
        break;
      case "pickup":
        [880, 1320, 1760].forEach((f, i) => this.tone("square", f, f, 0.05, 0.05, i * 0.05));
        break;
      case "shieldBreak":
        this.tone("sine", 1800, 300, 0.3, 0.08);
        this.noise(0.15, 0.08, 4000, 800);
        break;
      case "draft":
        [523, 784, 1047, 1568].forEach((f, i) => this.tone("triangle", f, f, 0.12, 0.06, i * 0.07));
        break;
      case "select":
        this.tone("square", 990, 990, 0.035, 0.04);
        break;
      case "confirm":
        this.tone("square", 1320, 1760, 0.08, 0.05);
        break;
      case "split":
        this.tone("square", 520, 1200, 0.07, 0.05);
        break;
      case "bossWarning":
        for (let i = 0; i < 4; i++) {
          this.tone("sawtooth", 440, 440, 0.22, 0.06, i * 0.5);
          this.tone("sawtooth", 330, 330, 0.22, 0.06, i * 0.5 + 0.25);
        }
        break;
      case "bossHit": {
        const now = this.ctx.currentTime;
        if (now - this.lastBossHit < 0.07) break;
        this.lastBossHit = now;
        this.tone("square", 180, 120, 0.04, 0.035);
        break;
      }
      case "bossPhase":
        this.tone("sawtooth", 900, 120, 0.6, 0.09);
        this.noise(0.5, 0.12, 3000, 200);
        break;
      case "bossDie":
        this.noise(1.6, 0.3, 4000, 60);
        this.tone("sawtooth", 300, 25, 1.5, 0.12);
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone("square", f, f, 0.12, 0.05, 0.6 + i * 0.1));
        break;
      case "submit":
        [784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => this.tone("square", f, f, 0.08, 0.05, i * 0.08));
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, f0: number, f1: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
