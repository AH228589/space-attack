export type EnemyKind = "drone" | "hornet" | "flagship";

export interface WaveConfig {
  wave: number;
  /** Formation rows from top to bottom. */
  rows: { kind: EnemyKind; count: number }[];
  /** Speed of the formation's side to side drift (radians per second). */
  swaySpeed: number;
  /** Average seconds between dive launches. */
  diveInterval: number;
  /** How many enemies may be diving at once. */
  maxDivers: number;
  diveSpeed: number;
  bulletSpeed: number;
  /** Shots each diver fires on its way down. */
  shotsPerDive: number;
  /** Average seconds between shots from the formation itself (Infinity = it holds fire). */
  formationFireInterval: number;
  /** Chance a diving flagship brings hornet escorts. */
  escortChance: number;
  flagshipHp: number;
}

/** Points for a kill: [sitting in formation, in flight]. */
export const SCORES: Record<EnemyKind, [number, number]> = {
  drone: [30, 60],
  hornet: [50, 100],
  flagship: [150, 300],
};

/** Everything that makes wave `n` harder than wave `n - 1`. Pure, so it can be tested. */
export function waveConfig(wave: number): WaveConfig {
  const n = Math.max(1, Math.floor(wave));
  const k = n - 1;

  const rows: WaveConfig["rows"] = [
    { kind: "flagship", count: Math.min(2 + Math.floor(k / 3), 4) },
    { kind: "hornet", count: n >= 3 ? 8 : 6 },
    { kind: "drone", count: n >= 2 ? 10 : 8 },
    { kind: "drone", count: n >= 4 ? 10 : 8 },
  ];
  if (n >= 6) rows.splice(2, 0, { kind: "hornet", count: 8 });

  return {
    wave: n,
    rows,
    swaySpeed: Math.min(0.55 + 0.05 * k, 1.1),
    diveInterval: Math.max(0.45, 2.4 * Math.pow(0.86, k)),
    maxDivers: Math.min(2 + Math.floor(k / 2), 7),
    diveSpeed: Math.min(78 + 9 * k, 160),
    bulletSpeed: Math.min(95 + 10 * k, 190),
    shotsPerDive: Math.min(1 + Math.floor(k / 2), 4),
    formationFireInterval: n < 2 ? Infinity : Math.max(0.55, 3 - 0.35 * (n - 2)),
    escortChance: n < 2 ? 0 : Math.min(0.3 + 0.1 * k, 0.8),
    flagshipHp: n >= 3 ? 2 : 1,
  };
}

export function enemyCount(cfg: WaveConfig): number {
  return cfg.rows.reduce((sum, r) => sum + r.count, 0);
}

const TAGLINES = [
  "GET READY",
  "THE FORMATION OPENS FIRE",
  "FLAGSHIPS TAKE TWO HITS",
  "THEY DIVE IN PACKS NOW",
  "FASTER AND ANGRIER",
  "A SECOND HORNET WING",
];

/** One line under the wave banner telling the player what just got harder. */
export function waveTagline(wave: number): string {
  return TAGLINES[wave - 1] ?? "DIFFICULTY UP";
}
