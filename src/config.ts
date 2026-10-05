/**
 * Reference resolution. Every position, speed and size in the game lives on this virtual grid;
 * the renderer scales the grid up to fit whatever screen it is shown on.
 */
export const VIEW_W = 256;
export const VIEW_H = 288;

/** Fixed simulation step (seconds). The game always advances in steps of this size. */
export const STEP = 1 / 120;

export const PLAYER_Y = 252;
export const PLAYER_MIN_X = 10;
export const PLAYER_MAX_X = VIEW_W - 10;
export const PLAYER_SPEED = 120;
export const PLAYER_ACCEL = 1400;
export const PLAYER_BULLET_SPEED = 280;
export const FIRE_COOLDOWN = 0.2;
export const MAX_PLAYER_BULLETS = 2;

export const MAX_ENERGY = 100;
export const BULLET_DAMAGE = 34;
export const RAM_DAMAGE = 50;
export const HIT_INVULN = 1;
export const RESPAWN_INVULN = 2.5;
export const RESPAWN_DELAY = 2.2;
export const WAVE_CLEAR_REFILL = 34;

export const START_LIVES = 3;
export const MAX_LIVES = 6;
export const EXTRA_LIFE_EVERY = 10000;

export const FORMATION_TOP = 44;
export const COL_GAP = 16;
export const ROW_GAP = 13;
export const SWAY_AMP = 36;
export const ENTER_TIME = 1.3;
export const PEEL_TIME = 0.55;
export const PEEL_RADIUS = 11;
export const RETURN_SPEED = 95;
/** Seconds after a wave starts before anyone breaks formation (fly-in plus a breather). */
export const WAVE_GRACE = 3.4;

export const COLORS = {
  bg: "#02030a",
  score: "#ffd23a",
  label: "#ff3b3b",
  text: "#e8ecff",
  dim: "#7a82a8",
  cyan: "#2ee6e6",
  green: "#3ee05a",
  red: "#ff3b3b",
  yellow: "#ffd23a",
  orange: "#ff8a1f",
  white: "#ffffff",
} as const;

/** Upgrade cards shown between waves (shared by the renderer and the click hit test). */
export const CARD_W = 74;
export const CARD_H = 112;
export const CARD_Y = 82;
export const CARD_GAP = 8;
export const cardX = (i: number) => (VIEW_W - (3 * CARD_W + 2 * CARD_GAP)) / 2 + i * (CARD_W + CARD_GAP);

/** Energy cells dropped by destroyed enemies. */
export const DROP_ENERGY = 20;
export const DROP_SPEED = 38;
