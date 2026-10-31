import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const requireWeb = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);

function launch(args, cwd, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, NODE_ENV: "production", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => {
      output = (output + chunk.toString()).slice(-16_384);
    });
  }
  const exited = once(child, "exit");
  return {
    child,
    exited,
    output: () => output,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      await Promise.race([exited, delay(2000, undefined, { ref: false })]);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await exited;
      }
    },
  };
}

async function ready(server, marker) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.output().includes(marker)) return;
    assert.equal(server.child.exitCode, null, "Server exited before readiness");
    await delay(100);
  }
  assert.fail("Server did not become ready within 15 seconds");
}

// Sequential: each application is exercised while the other is stopped.
for (const app of [
  {
    name: "API",
    cwd: "apps/api",
    args: ["dist/main.js"],
    port: 3001,
    marker: "DropIt API listening",
    rootStatus: 404,
  },
  {
    name: "web",
    cwd: "apps/web",
    args: [
      requireWeb.resolve("next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3000",
    ],
    port: 3000,
    marker: "Ready",
    rootStatus: 200,
  },
]) {
  test(
    `${app.name} boots independently, rejects missing routes and an occupied port`,
    { timeout: 30_000 },
    async (t) => {
      const server = launch(app.args, app.cwd, { API_PORT: String(app.port) });
      t.after(() => server.stop());
      await ready(server, app.marker);
      const root = await fetch(`http://127.0.0.1:${app.port}/`, {
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(root.status, app.rootStatus);
      await root.text();
      const missing = await fetch(
        `http://127.0.0.1:${app.port}/foundation-route-does-not-exist`,
        { signal: AbortSignal.timeout(5000) },
      );
      assert.equal(missing.status, 404);
      await missing.text();
      if (app.name === "API") {
        const disabled = await fetch(
          `http://127.0.0.1:${app.port}/v1/transfers`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: [] }),
            signal: AbortSignal.timeout(5000),
          },
        );
        assert.equal(disabled.status, 404);
        assert.equal(disabled.headers.get("cache-control"), "no-store");
        const result = await disabled.json();
        assert.equal(result.error.code, "NOT_FOUND");
        assert.equal(typeof result.error.requestId, "string");
      }
      const duplicate = launch(app.args, app.cwd, {
        API_PORT: String(app.port),
      });
      t.after(() => duplicate.stop());
      const result = await Promise.race([
        duplicate.exited,
        delay(10_000, undefined, { ref: false }).then(() => {
          throw new Error("Occupied-port startup did not terminate");
        }),
      ]);
      assert.notEqual(result[0], 0);
      if (app.name === "API") {
        assert.match(duplicate.output(), /DropIt API failed to start/);
        assert.doesNotMatch(duplicate.output(), /\n\s+at /);
      }
    },
  );
  test(
    `${app.name} rejects invalid environment without exposing its value`,
    { timeout: 15_000 },
    async (t) => {
      const sentinel = "private-env-sentinel";
      const invalid = launch(app.args, app.cwd, { NODE_ENV: sentinel });
      t.after(() => invalid.stop());
      const result = await Promise.race([
        invalid.exited,
        delay(10_000, undefined, { ref: false }).then(() => {
          throw new Error("Invalid environment startup did not terminate");
        }),
      ]);
      assert.equal(result[0], 1);
      assert.doesNotMatch(invalid.output(), /private-env-sentinel/);
      assert.match(
        invalid.output(),
        app.name === "API"
          ? /DropIt API failed to start/
          : /Invalid configuration: NODE_ENV/,
      );
    },
  );
}
