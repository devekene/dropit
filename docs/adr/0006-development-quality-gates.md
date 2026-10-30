# ADR-0006 — Slice 02 development quality gates

Date: 2026-10-30
Status: Accepted for the user-authorized Slice 02 implementation.

## Context

The foundation is committed in `3fe0993`. Slice 02 requires reproducible lint,
format, type, test and build checks, environment validation, and CI. Application
features, database/storage adapters, and deployment remain outside this slice.

## Decision and alternatives

- Use ESLint 10 with typescript-eslint's type-aware recommended rules and the
  matching Next.js core/web-vitals plugin. Explicit `any`, non-null assertions,
  and TypeScript error-suppression comments are errors. Lint warnings fail CI.
  Scoped import restrictions catch known API/database/storage imports in web
  source. This is an initial import guard, not a complete dependency-cycle or
  arbitrary alias analysis; expand graph enforcement as shared source appears.
- Use Prettier separately from lint. Its scope excludes existing governance
  documents/contracts and generated output. Existing source/config files are
  normalized once. New documentation remains manually reviewed.
- Use Vitest Node projects for API/web environment units. Tests are explicitly
  imported, and an empty suite fails. Node's built-in test runner exercises built
  applications and startup failures without a browser/test framework dependency.
  Nest production compilation excludes test files; normal typechecking includes
  them. No SWC/decorator transformer is needed because Vitest units test pure
  configuration parsers; Nest smoke tests execute actual TypeScript build output.
- Keep runtime environment validation app-owned and dependency-free. A general
  schema package or Nest Config module would add overhead for two scalar inputs.
  API validates `NODE_ENV` and decimal integer `API_PORT` (1–65535; default 3001).
  Next's config validates `NODE_ENV` before build/start. Valid modes are
  development/test/production, with development only when absent. Empty or
  malformed supplied settings fail. No speculative database/storage secrets or
  public client variables are introduced. Unknown process variables are not
  copied into returned configuration.
- API remains loopback-only and validates before creating/listening. API startup
  logs only a generic failure; parser errors name the key, never its value.
  Web configuration is imported by next.config.ts, not client UI. Browser-facing
  environment is currently empty. Future client settings require explicit
  allowlisting; never serialize process.env or put secrets in NEXT_PUBLIC_*.
- API consumes exported variables rather than implicitly loading .env files.
  Example files document this distinction. Next retains its built-in env loading.
- Turbo includes the consumed environment keys in task cache inputs. Lint and
  unit tests run directly without task-output caching, so failure probes cannot
  be bypassed by a previous passing result.
- CI uses pinned checkout/setup-node commits, read-only contents permission,
  no persisted checkout credentials, frozen pnpm installation, timeouts, and
  cancellation of superseded runs. It runs quality checks, enforcement probes,
  governance checks, and dependency audit. It does not deploy or access secrets.

## Dependency cost and alternatives

All additions are development dependencies and add no browser/API runtime code.
Installation and CI time increase; no measured runtime-performance claim is made.
Exact versions are recorded in package.json and the lockfile.

| Dependency | Purpose / maintenance and security / alternative |
| --- | --- |
| ESLint + @eslint/js | Supported ESLint 10 rules and runner; upstream security updates and lockfile audit required. ESLint 9 was rejected because the registry marks it unsupported. Compiler-only checks do not cover lint rules. |
| typescript-eslint | Type-aware TypeScript linting compatible with TypeScript 6.0.3; official upstream plugin/parser. Plain JS parsing cannot enforce TypeScript rules. |
| @next/eslint-plugin-next | Next rules matched to installed Next version. Direct plugin avoids the broader preset's unrelated plugins/installation surface; future interactive React code may require hooks/a11y-specific rules. |
| globals | Maintained Node global declarations for linting scripts; no runtime code shipped. A hand-maintained globals list is an unnecessary maintenance burden. |
| Prettier | Deterministic formatting, dev-only MIT tool. Manual formatting cannot provide the requested reproducible check. |
| Vitest | Unit runner with named app projects, dev-only MIT tool and transitive Vite/native compiler surface. Node test alone is used for smoke tests, but Vitest provides the requested unit tooling. |

No new runtime dependency or broad lifecycle-script approval is introduced.

## Threat model and verification

Invalid configuration must fail without echoing values. Unit tests cover defaults,
valid modes/port boundary, malformed/out-of-range inputs, and exclusion of unrelated
values. Subprocess tests verify invalid mode rejects real startup without printing
a sentinel value. Foundation tests verify 404s and occupied-port failure.

The enforcement script creates one temporary failing fixture at a time, verifies
nonzero exit plus the expected diagnostic, and removes each fixture in finally.
It refuses to overwrite a pre-existing fixture. No failure is skipped or hidden.

Hosted CI has not run until these changes are committed/pushed. Domain/API contract,
security, database, storage, browser E2E, and load gates remain future-slice work;
these checks do not establish production readiness. See the Slice 02 report for
commands and measured outcomes.
