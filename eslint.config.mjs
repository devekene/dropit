import js from "@eslint/js";
import next from "@next/eslint-plugin-next";
import globals from "globals";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "node:url";

const tsFiles = ["apps/**/*.ts", "apps/**/*.tsx", "*.mts"];
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/next-env.d.ts",
    ],
  },
  {
    ...js.configs.recommended,
    files: ["**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: tsFiles,
  })),
  {
    files: tsFiles,
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["vitest.config.mts"] },
        tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url)),
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": true, "ts-nocheck": true, "ts-expect-error": true },
      ],
    },
  },
  {
    files: ["apps/web/**/*.ts", "apps/web/**/*.tsx"],
    plugins: { "@next/next": next },
    settings: {
      next: { rootDir: fileURLToPath(new URL("./apps/web/", import.meta.url)) },
    },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@dropit/api",
            "@dropit/api/*",
            "**/apps/api/**",
            "**/api/src/**",
            "**/config/environment",
            "drizzle-orm",
            "drizzle-orm/*",
            "@aws-sdk/*",
          ],
        },
      ],
    },
  },
];
