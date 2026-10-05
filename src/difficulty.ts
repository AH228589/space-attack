export type EnemyKind = "drone" | "hornet" | "flagship" | "gunner" | "splitter" | "tank" | "mite";

export interface WaveConfig {
  wave: number;
  /** Every 10th wave is a boss fight instead of a formation. */
  boss: boolean;
  /** Completed boss cycles (0 for waves 1 to 10, 1 for 11 to 20, ...). Each one toughens everything. */
  tier: number;
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
  /** Average seconds between each gunner's spread shots from the formation. */
  gunnerInterval: number;
  /** Chance a diving flagship brings hornet escorts. */
  escortChance: number;
  flagshipHp: number;
  hornetHp: number;
  tankHp: number;
  /** Extra hits every enemy needs, from the tier. */
  armor: number;
}

/** Points for a kill: [sitting in formation, in flight]. */
export const SCORES: Record<EnemyKind, [number, number]> = {
  drone: [30, 60],
  hornet: [50, 100],
  flagship: [150, 300],
  gunner: [80, 160],
  splitter: [40, 80],
  tank: [100, 200],
  mite: [20, 40],
};

/** Waves that introduce a new enemy type (no anomaly on those, so the new type gets the spotlight). */
export const INTRO_WAVES: Record<number, string> = {
  4: "NEW: GUNNERS FIRE SPREAD SHOTS",
  5: "NEW: SPLITTERS BURST INTO MITES",
  7: "NEW: ARMORED TANKS",
};

export const isBossWave = (wave: number) => wave > 0 && wave % 10 === 0;

/** Everything that makes wave `n` harder than wave `n - 1`. Pure, so it can be tested. */
export function waveConfig(wave: number): WaveConfig {
  const n = Math.max(1, Math.floor(wave));
  const k = n - 1;
  const tier = Math.floor(k / 10);

  const rows: WaveConfig["rows"] = [{ kind: "flagship", count: Math.min(2 + Math.floor(k / 3), 4) }];
  if (n >= 4) rows.push({ kind: "gunner", count: n >= 8 ? 6 : 4 });
  if (n >= 7) rows.push({ kind: "tank", count: n >= 12 ? 8 : 6 });
  rows.push({ kind: "hornet", count: n >= 3 ? 8 : 6 });
  rows.push({ kind: n >= 5 ? "splitter" : "drone", count: n >= 2 ? 10 : 8 });
  rows.push({ kind: "drone", count: n >= 4 ? 10 : 8 });

  return {
    wave: n,
    boss: isBossWave(n),
    tier,
    rows,
    swaySpeed: Math.min(0.55 + 0.05 * k, 1.1 + 0.1 * tier),
    diveInterval: Math.max(0.45 / (1 + 0.2 * tier), 2.4 * Math.pow(0.86, k)),
    maxDivers: Math.min(2 + Math.floor(k / 2), 7 + tier),
    diveSpeed: Math.min(78 + 9 * k, 160 + 10 * tier),
    bulletSpeed: Math.min(95 + 10 * k, 190 + 12 * tier),
    shotsPerDive: Math.min(1 + Math.floor(k / 2), 4 + tier),
    formationFireInterval: n < 2 ? Infinity : Math.max(0.55 / (1 + 0.25 * tier), 3 - 0.35 * (n - 2)),
    gunnerInterval: Math.max(1.6, 4.2 - 0.15 * k) / (1 + 0.2 * tier),
    escortChance: n < 2 ? 0 : Math.min(0.3 + 0.1 * k, 0.8),
    flagshipHp: n >= 3 ? 2 : 1,
    hornetHp: 1,
    tankHp: 3,
    armor: tier,
  };
}

export function enemyCount(cfg: WaveConfig): number {
  return cfg.rows.reduce((sum, r) => sum + r.count, 0);
}

const TAGLINES = ["GET READY", "THE FORMATION OPENS FIRE", "FLAGSHIPS TAKE TWO HITS"];

/** One line under the wave banner telling the player what just got harder. */
export function waveTagline(wave: number): string {
  if (INTRO_WAVES[wave]) return INTRO_WAVES[wave];
  if (wave > 10 && wave % 10 === 1) return `SECTOR ${Math.floor(wave / 10) + 1}: THEY ARE TOUGHER`;
  return TAGLINES[wave - 1] ?? "DIFFICULTY UP";
}

/** Boss names, one per boss cycle (they repeat after the last). */
export const BOSS_NAMES = ["MOTHERSHIP", "HIVE QUEEN", "VOID ARK", "STAR EATER"];

export function bossFor(wave: number): { name: string; hp: number; tier: number } {
  const tier = Math.floor((wave - 1) / 10);
  return { name: BOSS_NAMES[tier % BOSS_NAMES.length], hp: 340 + 260 * tier, tier };
}

/**
 * From wave 3 most waves roll a random anomaly, a twist that changes how that one wave plays.
 * Most make it harder; a couple are windfalls.
 */
export type AnomalyId = "storm" | "armored" | "swarm" | "hyper" | "kamikaze" | "bounty" | "supply";

export const ANOMALIES: Record<AnomalyId, { name: string; desc: string; good: boolean }> = {
  storm: { name: "BULLET STORM", desc: "THEY FIRE FAR MORE OFTEN", good: false },
  armored: { name: "ARMORED HORNETS", desc: "HORNETS TAKE TWO HITS", good: false },
  swarm: { name: "SWARM", desc: "MORE OF THEM DIVE AT ONCE", good: false },
  hyper: { name: "HYPERSPEED", desc: "EVERYTHING MOVES FASTER", good: false },
  kamikaze: { name: "KAMIKAZE", desc: "THEY RAM INSTEAD OF SHOOTING", good: false },
  bounty: { name: "BOUNTY WAVE", desc: "EVERY KILL SCORES DOUBLE", good: true },
  supply: { name: "SUPPLY RUN", desc: "KILLS DROP MORE ENERGY", good: true },
};

const ANOMALY_IDS = Object.keys(ANOMALIES) as AnomalyId[];

export function rollAnomaly(wave: number, rng: () => number, previous: AnomalyId | null = null): AnomalyId | null {
  // Calm waves: the first two, new enemy introductions, boss fights and the start of each sector.
  if (wave < 3 || INTRO_WAVES[wave] || isBossWave(wave) || wave % 10 === 1) return null;
  const options = ANOMALY_IDS.filter((id) => id !== previous);
  return options[Math.floor(rng() * options.length)];
}

export function applyAnomaly(cfg: WaveConfig, id: AnomalyId | null): WaveConfig {
  const c = { ...cfg };
  switch (id) {
    case "storm":
      c.shotsPerDive += 2;
      c.formationFireInterval = Math.min(c.formationFireInterval, 3) * 0.55;
      break;
    case "armored":
      c.hornetHp = 2;
      break;
    case "swarm":
      c.maxDivers += 2;
      c.diveInterval *= 0.7;
      break;
    case "hyper":
      c.diveSpeed *= 1.25;
      c.bulletSpeed *= 1.15;
      c.swaySpeed *= 1.3;
      break;
    case "kamikaze":
      c.shotsPerDive = 0;
      c.formationFireInterval = Infinity;
      c.diveSpeed *= 1.35;
      c.maxDivers += 1;
      break;
  }
  return c;
}
