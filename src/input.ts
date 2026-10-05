import type { Controls } from "./game";

type Action = "left" | "right" | "fire" | "start" | "pause" | "quit" | "mute";

const BINDINGS: Record<string, Action> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
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

/** Keyboard state: which actions are held, and which went down since the game last read them. */
export class Input {
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  /** Called on every key press; used to unlock audio on the first interaction. */
  onAnyKey: () => void = () => {};

  constructor(target: Window) {
    target.addEventListener("keydown", (ev) => {
      const action = BINDINGS[ev.code];
      this.onAnyKey();
      if (!action) return;
      ev.preventDefault();
      if (!ev.repeat) this.pressed.add(action);
      this.held.add(action);
    });
    target.addEventListener("keyup", (ev) => {
      const action = BINDINGS[ev.code];
      if (action) this.held.delete(action);
    });
    // Releasing keys while the window is in the background never fires keyup.
    target.addEventListener("blur", () => this.held.clear());
  }

  controls(): Controls {
    return {
      left: this.held.has("left"),
      right: this.held.has("right"),
      fire: this.held.has("fire"),
      firePressed: this.pressed.has("fire"),
      start: this.pressed.has("start"),
      pause: this.pressed.has("pause"),
      quit: this.pressed.has("quit"),
    };
  }

  /** True once per press of the mute key. */
  takeMute(): boolean {
    return this.pressed.delete("mute");
  }

  clearPressed(): void {
    this.pressed.clear();
  }
}
