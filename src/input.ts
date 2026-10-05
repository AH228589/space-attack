import { VIEW_H, VIEW_W } from "./config";
import type { Controls } from "./game";

type Action = "left" | "right" | "up" | "down" | "fire" | "start" | "pause" | "quit" | "back" | "mute";

const BINDINGS: Record<string, Action> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  Backspace: "back",
  Space: "fire",
  KeyZ: "fire",
  KeyJ: "fire",
  Enter: "start",
  NumpadEnter: "start",
  KeyP: "pause",
  Escape: "pause",
  KeyQ: "quit",
  KeyM: "mute",
};

/** Keeps a pointer's events coming to `el` after it leaves it; harmless if the browser refuses. */
function capture(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* pointer already gone */
  }
}

/** Actions a finger may slide onto while held; pause and mute only react to a fresh press. */
const SLIDABLE = new Set<Action>(["left", "right", "fire"]);

/**
 * Keyboard, mouse and touch, merged into one set of actions: which are held, and which went down
 * since the game last read them. Each pointer (mouse or finger) holds at most one action.
 */
export class Input {
  /** True when the last input came from a finger or pen; decides which hints and buttons show. */
  touchMode: boolean;
  /** Called on every key press or pointer event; used to unlock audio on the first interaction. */
  onAnyInput: () => void = () => {};

  private keys = new Set<Action>();
  private pointers = new Map<number, Action | null>();
  private pressed = new Set<Action>();
  /** Last letter or digit typed (for entering initials and picking cards with 1 to 3). */
  private typed = "";
  /** Where the game screen was last pressed, on the reference grid. */
  private tap: { x: number; y: number } | null = null;
  /** Where a press on the game screen was let go, on the reference grid. */
  private lift: { x: number; y: number } | null = null;
  /** The mouse over the game screen, or a finger held on it, on the reference grid. */
  private point: { x: number; y: number } | null = null;
  /** Pointers currently pressing the game screen (not the on-screen buttons). */
  private screenPointers = new Set<number>();
  private buttons: HTMLElement[] = [];

  constructor(target: Window) {
    this.touchMode = target.matchMedia("(pointer: coarse)").matches;
    target.addEventListener("keydown", (ev) => {
      this.onAnyInput();
      if (!ev.repeat && !ev.ctrlKey && !ev.metaKey && !ev.altKey && /^[a-z0-9]$/i.test(ev.key)) {
        this.typed = ev.key.toUpperCase();
        this.touchMode = false;
      }
      const action = BINDINGS[ev.code];
      if (!action) return;
      this.touchMode = false;
      ev.preventDefault();
      if (!ev.repeat) this.pressed.add(action);
      this.keys.add(action);
    });
    target.addEventListener("keyup", (ev) => {
      const action = BINDINGS[ev.code];
      if (action) this.keys.delete(action);
    });
    // Releasing keys or fingers while the window is in the background never reports the release.
    target.addEventListener("blur", () => {
      this.keys.clear();
      this.pointers.clear();
      this.refreshButtons();
    });
  }

  /** Pressing (or holding) the game screen with the mouse or a finger fires. */
  bindScreen(el: HTMLElement): void {
    const toGrid = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * VIEW_W, y: ((ev.clientY - r.top) / r.height) * VIEW_H };
    };
    el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      this.notePointer(ev);
      capture(el, ev.pointerId);
      this.tap = this.point = toGrid(ev);
      this.screenPointers.add(ev.pointerId);
      this.hold(ev.pointerId, "fire");
    });
    el.addEventListener("pointermove", (ev) => {
      // A finger only points while it is down; a mouse points whenever it is over the screen.
      if (ev.pointerType === "mouse" || this.screenPointers.has(ev.pointerId)) this.point = toGrid(ev);
    });
    el.addEventListener("pointerleave", (ev) => {
      if (ev.pointerType === "mouse" && !this.screenPointers.has(ev.pointerId)) this.point = null;
    });
    const release = (ev: PointerEvent) => {
      this.onAnyInput();
      if (this.screenPointers.delete(ev.pointerId)) {
        if (ev.type === "pointerup") this.lift = toGrid(ev);
        if (ev.pointerType !== "mouse") this.point = null;
      }
      this.release(ev.pointerId);
    };
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("lostpointercapture", release);
  }

  /**
   * On-screen buttons. A pad captures its pointers, so a thumb can slide from one button to the
   * next (left to right, say) without lifting.
   */
  bindPad(pad: HTMLElement): void {
    this.buttons.push(...pad.querySelectorAll<HTMLElement>("[data-action]"));
    const actionAt = (ev: PointerEvent): Action | null => {
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-action]");
      return hit && pad.contains(hit) ? (hit.dataset.action as Action) : null;
    };
    pad.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      this.notePointer(ev);
      capture(pad, ev.pointerId);
      this.hold(ev.pointerId, actionAt(ev));
    });
    pad.addEventListener("pointermove", (ev) => {
      if (!this.pointers.has(ev.pointerId)) return;
      const action = actionAt(ev);
      if (action === null || SLIDABLE.has(action)) this.hold(ev.pointerId, action);
    });
    const release = (ev: PointerEvent) => {
      this.onAnyInput();
      this.release(ev.pointerId);
    };
    pad.addEventListener("pointerup", release);
    pad.addEventListener("pointercancel", release);
    pad.addEventListener("lostpointercapture", release);
    pad.addEventListener("contextmenu", (ev) => ev.preventDefault());
  }

  controls(): Controls {
    return {
      left: this.isHeld("left"),
      right: this.isHeld("right"),
      fire: this.isHeld("fire"),
      firePressed: this.pressed.has("fire"),
      leftPressed: this.pressed.has("left"),
      rightPressed: this.pressed.has("right"),
      upPressed: this.pressed.has("up"),
      downPressed: this.pressed.has("down"),
      start: this.pressed.has("start"),
      pause: this.pressed.has("pause"),
      quit: this.pressed.has("quit"),
      back: this.pressed.has("back"),
      typed: this.typed,
      tap: this.tap,
      lift: this.lift,
      point: this.point,
    };
  }

  /** True once per press of the mute key or button. */
  takeMute(): boolean {
    return this.pressed.delete("mute");
  }

  clearPressed(): void {
    this.pressed.clear();
    this.typed = "";
    this.tap = null;
    this.lift = null;
  }

  private notePointer(ev: PointerEvent): void {
    this.onAnyInput();
    if (ev.pointerType !== "mouse") this.touchMode = true;
  }

  private hold(id: number, action: Action | null): void {
    if (action && this.pointers.get(id) !== action) this.pressed.add(action);
    this.pointers.set(id, action);
    this.refreshButtons();
  }

  private release(id: number): void {
    if (this.pointers.delete(id)) this.refreshButtons();
  }

  private isHeld(action: Action): boolean {
    if (this.keys.has(action)) return true;
    for (const a of this.pointers.values()) if (a === action) return true;
    return false;
  }

  private refreshButtons(): void {
    for (const b of this.buttons) b.classList.toggle("held", this.isHeld(b.dataset.action as Action));
  }
}
