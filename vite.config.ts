import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vitest/config";
import { BOARD_SIZE, sortEntries, validateEntry, type ScoreEntry } from "./src/leaderboard";

/**
 * In production /api/scores is a Vercel function backed by Blob storage. The dev server answers
 * the same requests from memory, so the leaderboard can be played with locally.
 */
function devLeaderboard(): Plugin {
  const scores: (ScoreEntry & { at: number })[] = [];
  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  };
  const readBody = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
    });
  return {
    name: "dev-leaderboard",
    configureServer(server) {
      server.middlewares.use("/api/scores", async (req, res) => {
        if (req.method === "POST") {
          let body: unknown;
          try {
            body = JSON.parse(await readBody(req));
          } catch {
            return send(res, 400, { error: "expected JSON" });
          }
          const entry = validateEntry(body);
          if (typeof entry === "string") return send(res, 400, { error: entry });
          const at = Date.now();
          scores.push({ ...entry, at });
          const sorted = sortEntries(scores);
          const rank = sorted.findIndex((e) => e.at === at) + 1;
          return send(res, 200, { board: sorted.slice(0, BOARD_SIZE), rank });
        }
        send(res, 200, { board: sortEntries(scores).slice(0, BOARD_SIZE) });
      });
    },
  };
}

export default defineConfig({
  plugins: [devLeaderboard()],
  server: { port: 5194, strictPort: true },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
