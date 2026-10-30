# Slice 03 completion report

Slice: 03 — Database foundation.
Status: COMPLETE / VERIFIED locally, 2026-10-30.
Next slice: 04 — Transfer domain, NOT STARTED.

## Files changed

- API Drizzle generate/migrate configs and initial SQL migration/snapshot.
- PostgreSQL schema for transfers, transfer files, and idempotency records.
- `postgres.js` connection factory and opt-in Nest database lifecycle module.
- Minimal transfer/idempotency repository interfaces and Drizzle adapters.
- Database environment validation and examples.
- Disposable migration/repository integration tests.
- Database scripts, root quality gate, lockfile, tooling type configuration.
- Reconciled `docs/DATABASE.md`, ADR-0007, roadmap status, and this report.

No R2 adapter, public API endpoint, transfer state-machine service, password
verification, token generation, or browser database dependency was added. The
database module is intentionally not wired into the empty API app until a route
or service consumes it; API startup therefore does not invent or require a
database connection.

## Dependencies and architecture/security decisions

Runtime: `drizzle-orm@0.45.4` and `postgres@4.0.0`, server-only. Development:
`drizzle-kit@0.31.11`, `@electric-sql/pglite@0.5.13`, and root visibility of the
existing `@types/node@24.19.2` for typed config linting. Licenses verified from
installed manifests: Apache-2.0, Unlicense, MIT, Apache-2.0, and MIT respectively.
Purpose, cost, alternatives, schema decisions, migration/rollback policy, and
the development-only advisory are recorded in ADR-0007.

ADR-0004 governs decimal limits. `docs/DATABASE.md` was corrected from binary
MiB values to 100,000,000 bytes/file and 500,000,000 bytes/transfer before schema
generation. No raw token, password, or object bytes are columns; capability and
idempotency digests are 32-byte `bytea`, and `transfer_files` has no byte column.
Repository batch creation validates 1–10 files, per-file/aggregate sizes, and
digest lengths before a single transaction. Database checks independently cover
per-file size, digest length, version, operation, and timestamp invariants.

## Tests and checks

| Status | Command / evidence |
| --- | --- |
| PASS | `pnpm check` in the working tree: format, lint, strict typecheck, 47 tests in 4 files, migration consistency, both production builds, and 4 startup smoke tests. |
| PASS | `pnpm --filter @dropit/api test`: 39 API tests. Database integration applies the migration twice, inspects tables/indexes/checks/cascade FK, verifies no file-byte column, rebuilds the disposable public schema, and replays migrations. |
| PASS | Repository tests create/read/delete metadata, verify cascade, idempotency lookup, and exact file sets. Negative paths cover empty/11-file batches, zero/oversized files, oversized aggregate, duplicate storage key, duplicate public/management digests, duplicate idempotency tuple, per-row size check, and orphan FK. Rejected transactions leave no partial transfer. |
| PASS | `pnpm db:check`; `pnpm db:generate` reports no schema changes in both working and clean copies. Generated SQL contains no bind placeholder. |
| PASS | `pnpm db:migrate` with missing URL and with malformed sentinel URL exits nonzero with `Invalid configuration: DATABASE_URL`; output does not echo the sentinel. |
| PASS | `pnpm check:enforcement`: temporary type/lint/test fixtures rejected and removed. |
| PASS | Fresh temporary copy: `CI=true pnpm install --frozen-lockfile` installed 351 packages, then `pnpm check`, enforcement probes, and `pnpm db:generate` passed with no prior caches. |
| PASS | `pnpm audit --prod --audit-level=moderate`: no known production vulnerability. Full audit has one moderate development-only esbuild advisory through Drizzle Kit; no high/critical finding. |
| PASS | Governance integrity, UI cohesion advisory, `git diff --check`, and dependency-license inspection. |
| NOT RUN | A separate PostgreSQL server/provider test: no system PostgreSQL, container runtime, or `DATABASE_URL` was available. Migration/rebuild evidence uses disposable PGlite PostgreSQL. Provider parity remains required before deployment. |
| NOT RUN | Hosted GitHub Actions; changes are local until committed/pushed. |
| NOT APPLICABLE | R2, public endpoint, password, transfer state-machine, browser E2E, cleanup/load, and deployment tests belong to later slices. No production-readiness or performance claim is made. |

## Rebuild and operational limits

For an explicitly disposable database only, rebuild with `DROP SCHEMA public
CASCADE; CREATE SCHEMA public;`, then run `pnpm db:migrate` with its explicit
`DATABASE_URL`. The integration suite verifies this round trip. Production
rollback uses a reviewed forward migration; do not drop metadata tables.

The PostgreSQL pool is bounded at 10 connections with connect/idle/lifetime
limits and closes through the Nest lifecycle module when wired. Pool sizing and
realistic-row-count index impact are unmeasured and must be validated against the
deployment provider. No commit or push was made in this slice.
