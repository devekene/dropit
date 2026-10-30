import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root,
  test: {
    projects: [
      {
        test: {
          name: "api",
          root,
          environment: "node",
          include: ["apps/api/src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "web",
          root,
          environment: "node",
          include: ["apps/web/src/**/*.test.ts"],
        },
      },
    ],
  },
});
