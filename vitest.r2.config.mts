import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root,
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["apps/api/src/**/*.live.test.ts"],
    testTimeout: 60_000,
  },
});
