# Slice 01 — Monorepo foundation

**Status:** VERIFIED — see [completion report](../reports/SLICE-01.md)
**Prerequisite:** No application workspace is required yet; repository governance exists.

## Objective
Initialize pnpm workspace with `apps/web` (Next.js App Router + Tailwind), `apps/api` (NestJS Fastify), root workspace scripts and Turborepo. Use compatible stable versions; inspect existing files before scaffolding. Keep initial apps minimal.

## Allowed changes
Root workspace manifests, app scaffolds, shared TS baseline only if necessary.

## Dependency policy
Next.js, React, Tailwind, NestJS, Fastify adapter, TypeScript, pnpm, Turborepo and framework-required packages.

## Acceptance criteria
Both apps boot independently; root scripts resolve; no governance docs overwritten; lockfile committed.

## Required verification
Boot both apps, request health/root pages, verify workspace installation and build.

## Forbidden scope
Do not install DB/R2/auth/QR/ZIP libraries; no feature endpoints.

## Execution checklist
- [x] Read governance and verify prerequisites.
- [x] Inspect existing code and document plan.
- [x] Implement only the stated objective.
- [x] Add negative-path tests, not only happy-path tests.
- [x] Run and report all applicable checks.
- [x] Update `PROGRESS.md` with evidence only when verified.
- [x] Stop and request approval before the next slice.

## Universal requirements
- Read root `AGENTS.md`, accepted ADRs, design/security/performance specifications and `AGENT_PROTOCOL.md` before changes.
- Preserve unrelated code/docs. Implement no future slice. Add dependencies only for demonstrated need.
- Maintain separation of concerns, strict typing, security checks and tests.
- Run applicable `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` if those scripts exist; report missing commands as NOT RUN, not PASS.
- Produce the required completion report and stop for approval.
