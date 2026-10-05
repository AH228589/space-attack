/**
 * Blocky retro sprites, drawn as text grids so they stay easy to tweak.
 * "." is empty; every other character maps to a colour in the sprite's palette.
 */
export interface SpriteDef {
  frames: string[][];
  palette: Record<string, string>;
}

/**
 * Left half of the boss, centre column last. It is mirrored into the full sprite so the big ship
 * stays perfectly symmetric.
 */
const BOSS_HALF = [
  "..............XXX",
  "...........XXXXXX",
  ".........XXXXXXXX",
  "........XXwwXXXXX",
  ".......XXXwwXXXXr",
  ".....XXXXXXXXXrrr",
  "...XXXXXXXXXXXrrr",
  ".XXXXooXXXXXXXXrr",
  "XXXXXooXXXXXXXXXX",
  "XXXXXXXXXXXXXXXXX",
  "XXdXXXXdXXXXdXXXX",
  "X...XX...XX...XX.",
  "....X.....X......",
];

function mirrored(half: string[]): string[] {
  return half.map((row) => row + [...row.slice(0, -1)].reverse().join(""));
}

export const SPRITES = {
  drone: {
    palette: { X: "#3ee05a", o: "#eaffd0" },
    frames: [
      [
        "...X...X...",
        "X...X.X...X",
        "X.XXXXXXX.X",
        "XXXoXXXoXXX",
        "XXXXXXXXXXX",
        "..XX.X.XX..",
        ".XX.....XX.",
        "X.........X",
      ],
      [
        "...X...X...",
        "....X.X....",
        "..XXXXXXX..",
        ".XXoXXXoXX.",
        "XXXXXXXXXXX",
        "X.XX.X.XX.X",
        "X.X.....X.X",
        "..XX...XX..",
      ],
    ],
  },
  hornet: {
    palette: { X: "#ff3b3b", o: "#ffd23a" },
    frames: [
      [
        "XX.......XX",
        ".XX.XXX.XX.",
        "..XXXXXXX..",
        "XXXoXXXoXXX",
        "XXXXXXXXXXX",
        "...XXXXX...",
        "..X.X.X.X..",
        ".X.......X.",
      ],
      [
        "...........",
        "XXX.XXX.XXX",
        ".XXXXXXXXX.",
        "..XoXXXoX..",
        ".XXXXXXXXX.",
        "X..XXXXX..X",
        "..X.X.X.X..",
        "...X...X...",
      ],
    ],
  },
  flagship: {
    palette: { X: "#ffd23a", r: "#ff3b3b" },
    frames: [
      [
        ".....X.....",
        "..X.XXX.X..",
        "..XXXrXXX..",
        ".XXrXXXrXX.",
        "XXXXXXXXXXX",
        "XX.XXXXX.XX",
        "X..X.X.X..X",
        "...X...X...",
      ],
      [
        ".....X.....",
        "X.X.XXX.X.X",
        "XXXXXrXXXXX",
        ".XXrXXXrXX.",
        "..XXXXXXX..",
        "..XXXXXXX..",
        ".X.X.X.X.X.",
        "X.........X",
      ],
    ],
  },
  gunner: {
    palette: { X: "#b45cff", o: "#ffd23a" },
    frames: [
      [
        "....XXX....",
        "..XXXXXXX..",
        ".XXoXXXoXX.",
        "XXXXXXXXXXX",
        "XX.XXXXX.XX",
        "X..XXXXX..X",
        "....XXX....",
        ".....X.....",
      ],
      [
        "....XXX....",
        "..XXXXXXX..",
        ".XXoXXXoXX.",
        "XXXXXXXXXXX",
        ".X.XXXXX.X.",
        ".X.XXXXX.X.",
        "....XXX....",
        ".....X.....",
      ],
    ],
  },
  splitter: {
    palette: { X: "#ff8a1f", o: "#fff1b8" },
    frames: [
      [
        ".XX.....XX.",
        "XXXX...XXXX",
        "XoXXX.XXXoX",
        "XXXXXXXXXXX",
        ".XXXXXXXXX.",
        "..XX.X.XX..",
        ".X..X.X..X.",
        "X.........X",
      ],
      [
        ".XX.....XX.",
        "XXXX...XXXX",
        "XoXXX.XXXoX",
        "XXXXXXXXXXX",
        ".XXXXXXXXX.",
        "..XX.X.XX..",
        "..X.X.X.X..",
        "..X.....X..",
      ],
    ],
  },
  tank: {
    palette: { X: "#5aa0ff", o: "#d8e8ff", w: "#ffd23a" },
    frames: [
      [
        "..XXXXXXX..",
        ".XoooooooX.",
        "XXXXXXXXXXX",
        "XwXXXXXXXwX",
        "XXXXXXXXXXX",
        "XX.XX.XX.XX",
        "X.X.X.X.X.X",
        "...........",
      ],
      [
        "..XXXXXXX..",
        ".XoooooooX.",
        "XXXXXXXXXXX",
        "XwXXXXXXXwX",
        "XXXXXXXXXXX",
        "XX.XX.XX.XX",
        ".X.X.X.X.X.",
        "...........",
      ],
    ],
  },
  mite: {
    palette: { X: "#ffb347", o: "#ffffff" },
    frames: [
      ["X.....X", ".XXXXX.", "XXoXoXX", ".XXXXX.", "X.X.X.X"],
      [".X...X.", ".XXXXX.", "XXoXoXX", ".XXXXX.", ".X.X.X."],
    ],
  },
  boss: {
    palette: { X: "#ff4fd8", w: "#ffffff", o: "#2ee6e6", r: "#ff3b3b", y: "#ffd23a", d: "#7a1f6a" },
    frames: [mirrored(BOSS_HALF), mirrored(BOSS_HALF.map((row) => row.replace(/r/g, "y")))],
  },
  player: {
    palette: { X: "#2ee6e6", w: "#ffffff", b: "#1a7fd6" },
    frames: [
      [
        ".....w.....",
        ".....w.....",
        "....XXX....",
        "....XwX....",
        ".X.XXXXX.X.",
        ".XXXXbXXXX.",
        "XXXXbbbXXXX",
        "XX.XX.XX.XX",
      ],
    ],
  },
  burst: {
    palette: { X: "#ffffff" },
    frames: [
      [
        "...........",
        "...X...X...",
        "....X.X....",
        "..X.....X..",
        "....X.X....",
        "...X...X...",
        "...........",
      ],
      [
        "X....X....X",
        ".X...X...X.",
        "...X...X...",
        "XX.......XX",
        "...X...X...",
        ".X...X...X.",
        "X....X....X",
      ],
    ],
  },
} satisfies Record<string, SpriteDef>;

export type SpriteName = keyof typeof SPRITES;

/**
 * Renders each sprite frame once at the current screen scale and reuses it, so every cell lands
 * exactly on the screen's grid and stays sharp. Rebuilt whenever the scale changes.
 */
export class SpriteCache {
  private cache = new Map<string, HTMLCanvasElement>();
  private scale = 0;

  get(name: SpriteName, frame: number, scale: number, tint?: string): HTMLCanvasElement {
    if (scale !== this.scale) {
      this.cache.clear();
      this.scale = scale;
    }
    const def: SpriteDef = SPRITES[name];
    const f = frame % def.frames.length;
    const key = `${name}:${f}:${tint ?? ""}`;
    let canvas = this.cache.get(key);
    if (!canvas) {
      canvas = renderSprite(def.frames[f], def.palette, scale, tint);
      this.cache.set(key, canvas);
    }
    return canvas;
  }
}

export function spriteSize(name: SpriteName): { w: number; h: number } {
  const rows = SPRITES[name].frames[0];
  return { w: rows[0].length, h: rows.length };
}

function renderSprite(rows: string[], palette: Record<string, string>, s: number, tint?: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(rows[0].length * s);
  canvas.height = Math.ceil(rows.length * s);
  const ctx = canvas.getContext("2d")!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      ctx.fillStyle = tint ?? palette[ch] ?? "#ffffff";
      const x0 = Math.round(x * s);
      const y0 = Math.round(y * s);
      ctx.fillRect(x0, y0, Math.round((x + 1) * s) - x0, Math.round((y + 1) * s) - y0);
    }
  });
  return canvas;
}
