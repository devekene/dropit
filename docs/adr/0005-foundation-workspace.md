# ADR-0005 — Slice 01 workspace foundation

Date: 2026-10-30
Status: Accepted for the requested local workspace bootstrap.

## Context

Slice 01 needs independently runnable Next.js and NestJS applications, pnpm
workspaces, Turborepo tasks, and shared TypeScript settings. Existing engineering
documents and the API contract must remain unchanged. This additive record does
not revise the accepted security architecture or authorize deployment.

## Decision and alternatives

- Use `apps/web` for Next.js App Router with Tailwind's PostCSS integration and
  `apps/api` for NestJS with its Fastify adapter. No application imports the other.
- Put compiler presets in `packages/typescript-config`, a private configuration
  package consumed through `workspace:*`. Avoid empty UI/contracts packages until
  there is actual shared source. The root tsconfig is an empty solution config;
  application typechecking is performed by workspace scripts.
- Use Node 24 (pinned local version in `.node-version`) and pnpm 10.33.0. Exact
  dependency versions and a frozen lockfile make installs reproducible. Retain
  TypeScript 6.0.3, also compatible with the Nest CLI's TypeScript 6 dependency.
- Use Turbo for build dependency ordering and output caching. Development and
  start tasks are persistent and uncached. Shared compiler presets participate
  in cache keys. A recursive pnpm-only runner would be simpler, but would not
  fulfill the requested Turbo setup or provide output caching.
- Use the supported Next.js Webpack path for development and production builds.
  The local host blocks the port used by Turbopack's PostCSS worker, including
  on an elevated retry. This does not affect Turborepo task orchestration and
  adds no dependency; reconsider the default bundler when the host supports it.
- Disable Next.js managed agent-rule generation so development startup does not
  add or rewrite engineering instruction files.
- Bootstrap manually to preserve the existing repository and avoid generator
  extras. The web route is a static server component with no upload controls,
  external fonts, client requests, or implied transfer functionality.
- API listens on loopback port 3001, web on loopback port 3000. No database,
  credentials, environment variables, infrastructure, or CORS access is required.
  The API has no controllers: an HTTP 404 proves the listener is reachable without
  introducing an undocumented health endpoint. Its default framework 404 is not
  the future domain error contract. API contracts and error handling precede any
  transfer endpoints in a later slice.

## Dependency review

Direct packages use MIT licenses except TypeScript, reflect-metadata, and RxJS,
which use Apache-2.0 (verified from installed manifests). Exact versions are in
package manifests and `pnpm-lock.yaml`; registry audit results are point-in-time
checks, not proof of absence of vulnerabilities.

| Packages | Purpose, size impact, maintenance/security, alternative |
| --- | --- |
| `next`, `react`, `react-dom` | Required web runtime. These account for framework browser/server cost; no additional client library is added. Maintained upstream; security updates and bundle review remain required. Native HTML alone would not satisfy the requested Next.js architecture. |
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-fastify` | Required API framework/adapter, server-only with zero web-bundle contribution. Fastify is supplied by the adapter. Maintained together at matching versions; server transitive packages remain an audit surface. Express or raw Fastify would violate the selected stack. |
| `reflect-metadata`, `rxjs` | Nest runtime peers, server-only. Metadata enables Nest decorators; RxJS supports Nest's request pipeline. Omitting them is not a supported replacement for Nest. |
| `tailwindcss`, `@tailwindcss/postcss` | Required Tailwind compiler, development-only. Generated CSS is served; no Tailwind browser runtime. Native compiler dependencies require supply-chain review. Handwritten CSS is a smaller-toolchain alternative, but does not meet the Tailwind requirement. |
| `turbo` | Requested workspace task runner/cache, development-only native executable. Adds installation cost, no browser code. pnpm recursion is the alternative noted above. |
| `typescript`, `@types/node`, `@types/react`, `@types/react-dom` | Compiler and type declarations only; no runtime bundle cost. Node types match the selected Node major. Omitting type packages undermines strict checking. |
| `@nestjs/cli` | Development-only compiler/watch orchestration. Uses the TypeScript compiler to preserve Nest decorator metadata; adds CLI/transitive installation cost. A custom compiler/watch supervisor would reduce dependencies but add process-lifecycle maintenance. |

pnpm lifecycle scripts are allowlisted for Nest core, Tailwind oxide, and Sharp
(the latter is a Next.js transitive image dependency). No broad script approval
or extra bundler/UI/testing library is added. Absolute bundle and performance
budgets have not been benchmarked by this slice.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm dev:web       # http://127.0.0.1:3000, API not required
pnpm dev:api       # http://127.0.0.1:3001, web not required; routes return 404
pnpm dev           # both applications through Turbo
pnpm typecheck
pnpm build         # both production builds
pnpm build:web
pnpm build:api
pnpm start:web     # requires the web build
pnpm start:api     # requires the API build
pnpm start         # builds, then starts both through Turbo
pnpm check:governance
pnpm check:ui
```

## Consequences and scope

No authorization, token, cookie, storage, upload, database, or transfer behavior
is implemented. API request logging is disabled, proxy headers are not trusted,
and request body/connection/request/keep-alive limits are bounded. There is no
public exposure or production security claim. Admission concurrency, shared abuse
limits, domain validation, safe errors, and security headers remain release gates
before implementing/exposing sensitive routes.

ESLint, Prettier, Vitest, and environment validation belong to slice 02;
PostgreSQL, Drizzle, migrations, and repositories belong to slice 03. Those gates
are not falsely represented by no-op scripts. Foundation checks are strict
application typechecking, production builds, independent development/production
HTTP startup, workspace task wiring, dependency audit, and existing-document
hash comparison. Future application tests must cover the cases in TESTING.md.

## Verification recorded for slice 01

- Frozen-lockfile installation, both strict typechecks, and both Turbo-managed
  production builds passed on Node 24.22.1 / pnpm 10.33.0.
- Independent development startup: web HTTP 200 with API stopped; API HTTP 404
  with web stopped. Combined `pnpm start` started both built applications and
  returned the same expected HTTP statuses. Verification servers were stopped.
- Browser screenshots reviewed at 1280x800 and 320x640. The static heading/copy
  renders at both widths; measured document width equals viewport width at 320px.
  This is placeholder-page evidence, not transfer accessibility or performance proof.
- Dependency audit reported no known vulnerabilities. Governance integrity,
  UI cohesion advisory, and diff whitespace checks passed.
- SHA-256 comparison confirmed all 23 pre-existing README, AGENTS, docs, and
  contract files remain byte-for-byte unchanged. Only this new ADR was added.
- Slice 02 lint/format/test tooling and all transfer/database/security release
  tests remain unimplemented; no production-readiness claim is made.
