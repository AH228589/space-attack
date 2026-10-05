/**
 * Upgrades offered between waves. A run starts with none; after every cleared wave the player
 * picks one of three random cards, so no two runs build the same ship.
 */
export type PerkId =
  | "twin"
  | "rapid"
  | "pierce"
  | "plating"
  | "repair"
  | "thrusters"
  | "bounty"
  | "deflector"
  | "salvage"
  | "shield"
  | "extra";

/** "fix" is the fallback card offered when too few upgrades are left to fill a hand. */
export type CardId = PerkId | "fix";

export type Rarity = "common" | "rare" | "epic";

export interface PerkDef {
  name: string;
  /** Two short lines for the card face. */
  desc: [string, string];
  rarity: Rarity;
  max: number;
}

export const PERKS: Record<PerkId, PerkDef> = {
  twin: { name: "TWIN SHOT", desc: ["+1 BULLET", "EVERY SHOT"], rarity: "rare", max: 2 },
  rapid: { name: "RAPID FIRE", desc: ["SHOOT FASTER,", "+1 SHOT ALOFT"], rarity: "common", max: 3 },
  pierce: { name: "PIERCING", desc: ["SHOTS PASS", "THROUGH 1 MORE"], rarity: "rare", max: 2 },
  plating: { name: "PLATING", desc: ["+20 MAX", "ENERGY"], rarity: "common", max: 3 },
  repair: { name: "NANO REPAIR", desc: ["REGAIN 1", "ENERGY A SEC"], rarity: "common", max: 3 },
  thrusters: { name: "THRUSTERS", desc: ["MOVE 20%", "FASTER"], rarity: "common", max: 2 },
  bounty: { name: "BOUNTY", desc: ["+25% POINTS", "PER KILL"], rarity: "common", max: 3 },
  deflector: { name: "DEFLECTOR", desc: ["YOUR SHOTS", "STOP BULLETS"], rarity: "rare", max: 1 },
  salvage: { name: "SALVAGE", desc: ["KILLS DROP", "MORE ENERGY"], rarity: "common", max: 2 },
  shield: { name: "SHIELD", desc: ["BLOCKS FIRST", "HIT EACH WAVE"], rarity: "rare", max: 1 },
  extra: { name: "EXTRA SHIP", desc: ["+1 SHIP", ""], rarity: "epic", max: 2 },
};

export const FIX_CARD: PerkDef = { name: "FIELD FIX", desc: ["REFILL ALL", "ENERGY"], rarity: "common", max: Infinity };

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 6, rare: 3, epic: 1 };
/** Odds after beating a boss: rare and epic cards come up far more often. */
export const BOSS_RARITY_WEIGHT: Record<Rarity, number> = { common: 2, rare: 4, epic: 3 };

export type PerkLevels = Partial<Record<PerkId, number>>;

export function cardDef(id: CardId): PerkDef {
  return id === "fix" ? FIX_CARD : PERKS[id];
}

/** Deals `count` different cards, weighted by rarity, skipping upgrades already maxed out. */
export function dealCards(levels: PerkLevels, rng: () => number, count = 3, bossReward = false): CardId[] {
  const pool = (Object.keys(PERKS) as PerkId[]).filter((id) => (levels[id] ?? 0) < PERKS[id].max);
  const odds = bossReward ? BOSS_RARITY_WEIGHT : RARITY_WEIGHT;
  const hand: CardId[] = [];
  while (hand.length < count && pool.length) {
    const weights = pool.map((id) => odds[PERKS[id].rarity]);
    let roll = rng() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < pool.length - 1 && roll >= weights[i]) roll -= weights[i++];
    hand.push(pool.splice(i, 1)[0]);
  }
  while (hand.length < count) hand.push("fix");
  return hand;
}

/** "TWIN SHOT 2, RAPID FIRE 1" for the pause and results screens. */
export function describeBuild(levels: PerkLevels): string[] {
  return (Object.keys(PERKS) as PerkId[])
    .filter((id) => (levels[id] ?? 0) > 0)
    .map((id) => (PERKS[id].max > 1 ? `${PERKS[id].name} ${levels[id]}` : PERKS[id].name));
}
