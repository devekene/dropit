import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";

const probes = [
  {
    name: "typecheck",
    path: "apps/api/src/enforcement-probe.ts",
    source: 'export const invalid: number = "type-probe";\n',
    diagnostic: /TS2322/,
  },
  {
    name: "lint",
    path: "apps/api/src/enforcement-probe.ts",
    source: "export const invalid: any = 1;\n",
    diagnostic: /@typescript-eslint\/no-explicit-any/,
  },
  {
    name: "test",
    path: "apps/api/src/enforcement-probe.test.ts",
    source:
      'import { expect, it } from "vitest";\nit("enforcement sentinel", () => { expect(1).toBe(2); });\n',
    diagnostic: /enforcement sentinel/,
  },
];

for (const probe of probes) {
  assert.equal(
    existsSync(probe.path),
    false,
    `Refusing to overwrite ${probe.path}`,
  );
  try {
    writeFileSync(probe.path, probe.source, { flag: "wx" });
    const result = spawnSync("pnpm", [probe.name], {
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null, `${probe.name} was interrupted`);
    assert.ok(
      result.status !== null && result.status > 0,
      `${probe.name} must reject the failing fixture`,
    );
    assert.match(result.stdout + result.stderr, probe.diagnostic);
    console.info(
      `PASS: ${probe.name} rejected its intentional failing fixture`,
    );
  } finally {
    unlinkSync(probe.path);
  }
}
