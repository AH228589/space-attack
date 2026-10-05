import "@fontsource/press-start-2p";
import "./style.css";
import { Sfx } from "./audio";
import { STEP } from "./config";
import { Game } from "./game";
import { Input } from "./input";
import { Renderer } from "./render";

const HI_KEY = "space-attack-hi";
const MUTE_KEY = "space-attack-muted";

// Storage can be unavailable (private windows, blocked site data); the game works without it.
const load = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

const canvas = document.getElementById("game") as HTMLCanvasElement;
const sfx = new Sfx();
sfx.muted = load(MUTE_KEY) === "1";

const game = new Game({
  onEvent: (e) => {
    sfx.play(e);
    if (e === "gameOver") save(HI_KEY, String(game.hiScore));
  },
});
game.hiScore = Number(load(HI_KEY)) || 0;

const input = new Input(window);
input.onAnyInput = () => sfx.unlock();
input.bindScreen(canvas);
document.querySelectorAll<HTMLElement>(".pad").forEach((pad) => input.bindPad(pad));
const muteBtn = document.getElementById("mute-btn")!;
const renderer = new Renderer(canvas);

/** Shows the on-screen buttons only while the player is using touch. */
function syncTouchUi(): void {
  document.body.classList.toggle("touch", input.touchMode);
  muteBtn.classList.toggle("muted", sfx.muted);
}

// Leaving the tab mid-game pauses it instead of letting the player die off screen.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.pause();
});
window.addEventListener("blur", () => game.pause());

let last = performance.now();
let acc = 0;

function frame(now: number): void {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;

  if (input.takeMute()) {
    sfx.setMuted(!sfx.muted);
    save(MUTE_KEY, sfx.muted ? "1" : "0");
  }

  // Fixed steps keep the game identical at any frame rate. Key presses are delivered to the
  // first step only, and kept until at least one step has run.
  const c = input.controls();
  let stepped = false;
  while (acc >= STEP) {
    game.update(STEP, c);
    c.firePressed = c.start = c.pause = c.quit = false;
    acc -= STEP;
    stepped = true;
  }
  if (stepped) input.clearPressed();

  syncTouchUi();
  renderer.resize();
  renderer.draw(game, sfx.muted, input.touchMode);
  requestAnimationFrame(frame);
}

// Wait for the arcade font so the first frames are not drawn in a fallback face.
Promise.race([document.fonts.load('1rem "Press Start 2P"'), new Promise((r) => setTimeout(r, 1500))]).finally(() => {
  last = performance.now();
  requestAnimationFrame(frame);
});

if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
