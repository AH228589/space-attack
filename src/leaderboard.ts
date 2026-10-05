/**
 * Leaderboard rules shared by the game, the Vercel function in api/ and the dev server.
 * Pure: no storage, no network.
 */
export interface ScoreEntry {
  name: string;
  score: number;
  wave: number;
}

/** How many scores the arcade table shows. */
export const BOARD_SIZE = 10;
/** Characters allowed in initials, in the order the arcade picker cycles through them. */
export const NAME_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
export const MAX_SCORE = 9_999_990;
/** Generous ceiling on points per wave, so obviously forged scores are rejected. */
const MAX_POINTS_PER_WAVE = 40_000;

/** A few initials an arcade operator would not want on the attract screen. */
const BLOCKED = new Set(["ASS", "FUK", "FUC", "FCK", "SEX", "KKK", "NIG", "FAG", "CUM", "TIT", "DIK", "COK", "SHT", "XXX", "NAZ"]);

/** Returns a clean entry, or a string explaining why the submission was refused. */
export function validateEntry(input: unknown): ScoreEntry | string {
  if (!input || typeof input !== "object") return "expected a JSON object";
  const { name, score, wave } = input as Record<string, unknown>;
  if (typeof name !== "string" || name.length !== 3 || [...name].some((ch) => !NAME_CHARS.includes(ch)) || !name.trim()) {
    return "name must be three letters or digits";
  }
  if (typeof score !== "number" || !Number.isInteger(score) || score <= 0 || score > MAX_SCORE || score % 10 !== 0) {
    return "invalid score";
  }
  if (typeof wave !== "number" || !Number.isInteger(wave) || wave < 1 || wave > 999) return "invalid wave";
  if (score > wave * MAX_POINTS_PER_WAVE) return "score is not possible by that wave";
  return { name: BLOCKED.has(name) ? "ACE" : name, score, wave };
}

/** Highest score first; on a tie the earlier entry keeps the higher place. */
export function sortEntries<T extends ScoreEntry & { at: number }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.score - a.score || a.at - b.at);
}

/** Would this score earn a place on the table? */
export function qualifies(board: ScoreEntry[], score: number): boolean {
  if (score <= 0) return false;
  return board.length < BOARD_SIZE || score > board[board.length - 1].score;
}

/** 1-based place a new score would take (ties go below existing entries). */
export function placeFor(board: ScoreEntry[], score: number): number {
  return board.filter((e) => e.score >= score).length + 1;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}TH`;
  return `${n}${["TH", "ST", "ND", "RD"][n % 10] ?? "TH"}`;
}

/**
 * Storage key for one score. Everything the table needs lives in the key itself, so listing the
 * store returns the whole board without opening a single file. Spaces in names become "_".
 */
export function entryKey(e: ScoreEntry, at: number): string {
  const inverted = String(MAX_SCORE - e.score).padStart(7, "0");
  return `scores/${inverted}-${at.toString(36).padStart(9, "0")}-${String(e.wave).padStart(3, "0")}-${e.name.replace(/ /g, "_")}`;
}

export function parseKey(key: string): (ScoreEntry & { at: number }) | null {
  const m = /^scores\/(\d{7})-([0-9a-z]{9})-(\d{3})-([A-Z0-9_]{3})$/.exec(key);
  if (!m) return null;
  return { score: MAX_SCORE - Number(m[1]), at: parseInt(m[2], 36), wave: Number(m[3]), name: m[4].replace(/_/g, " ") };
}
