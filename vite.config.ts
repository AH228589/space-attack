import { defineConfig } from "vitest/config";

export default defineConfig({
  server: { port: 5194, strictPort: true },
  test: { environment: "node" },
});
