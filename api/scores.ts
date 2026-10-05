import { del, list, put } from "@vercel/blob";
import { BOARD_SIZE, entryKey, parseKey, sortEntries, validateEntry } from "../src/leaderboard.js";

/**
 * GET  /api/scores  -> { board }            the global top 10
 * POST /api/scores  -> { board, rank }      add a score: { name: "ABC", score: 1230, wave: 4 }
 *
 * Each score is one tiny file in a private Vercel Blob store, with the score, wave and initials in
 * its name. Separate files mean two players finishing at the same moment can never overwrite each
 * other, and a single listing returns the whole table.
 */

/** Scores kept in storage; the rest are pruned so listing stays a single fast call. */
const KEEP = 200;

async function readAll() {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "scores/", limit: 1000, cursor });
    keys.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && keys.length < 5000);
  const entries = keys.map((key) => ({ key, entry: parseKey(key) })).filter((x) => x.entry !== null);
  const sorted = sortEntries(entries.map((x) => ({ ...x.entry!, key: x.key })));
  return sorted;
}

const json = (body: unknown, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": cache },
  });

const publicEntry = ({ name, score, wave }: { name: string; score: number; wave: number }) => ({ name, score, wave });

export async function GET(): Promise<Response> {
  try {
    const all = await readAll();
    // A short shared cache keeps a burst of title screens from listing the store every time.
    return json({ board: all.slice(0, BOARD_SIZE).map(publicEntry) }, 200, "public, s-maxage=5, stale-while-revalidate=10");
  } catch (err) {
    console.error("leaderboard read failed", err);
    return json({ error: "leaderboard unavailable" }, 503);
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "expected JSON" }, 400);
  }
  const entry = validateEntry(body);
  if (typeof entry === "string") return json({ error: entry }, 400);

  try {
    const at = Date.now();
    const key = entryKey(entry, at);
    await put(key, JSON.stringify({ ...entry, at }), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
    });

    let all = await readAll();
    // A listing straight after a write may not include it yet; make sure it counts.
    if (!all.some((e) => e.key === key)) all = sortEntries([...all, { ...entry, at, key }]);
    const rank = all.findIndex((e) => e.key === key) + 1;

    if (all.length > KEEP) await del(all.slice(KEEP).map((e) => e.key));
    return json({ board: all.slice(0, BOARD_SIZE).map(publicEntry), rank });
  } catch (err) {
    console.error("leaderboard write failed", err);
    return json({ error: "leaderboard unavailable" }, 503);
  }
}
