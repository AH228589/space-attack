import { BOARD_SIZE, sortEntries, type ScoreEntry } from "./leaderboard";

const LOCAL_KEY = "space-attack-board";
const TIMEOUT_MS = 6000;

export interface BoardResult {
  board: ScoreEntry[];
  online: boolean;
  /** 1-based place of a just-submitted score, if known. */
  rank?: number;
}

/**
 * Talks to /api/scores. When the network or the server is unavailable the game keeps working on
 * a table stored in this browser, and says so on screen.
 */
export async function loadBoard(): Promise<BoardResult> {
  try {
    const res = await request("/api/scores");
    const data = (await res.json()) as { board: ScoreEntry[] };
    return { board: data.board, online: true };
  } catch {
    return { board: readLocal(), online: false };
  }
}

export async function submitScore(entry: ScoreEntry): Promise<BoardResult> {
  const local = saveLocal(entry);
  try {
    const res = await request("/api/scores", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry) });
    const data = (await res.json()) as { board: ScoreEntry[]; rank: number };
    return { board: data.board, rank: data.rank, online: true };
  } catch {
    return { board: local.board, rank: local.rank, online: false };
  }
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

type LocalEntry = ScoreEntry & { at: number };

function readAllLocal(): LocalEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLocal(): ScoreEntry[] {
  return readAllLocal().slice(0, BOARD_SIZE).map(({ name, score, wave }) => ({ name, score, wave }));
}

function saveLocal(entry: ScoreEntry): { board: ScoreEntry[]; rank: number } {
  const at = Date.now();
  const all = sortEntries([...readAllLocal(), { ...entry, at }]).slice(0, 50);
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: the table still shows for this session */
  }
  const rank = all.findIndex((e) => e.at === at) + 1;
  return { board: all.slice(0, BOARD_SIZE).map(({ name, score, wave }) => ({ name, score, wave })), rank };
}
