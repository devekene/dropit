# ADR-0007 — PostgreSQL and Drizzle database foundation

Date: 2026-10-30
Status: Accepted for Slice 03.

## Context

Slice 03 introduces the metadata database before transfer domain behavior or
public endpoints. `docs/DATABASE.md` used binary MiB values for file and transfer
limits, while accepted ADR-0004 and root governance require the stricter decimal
limits. ADR-0004 is normative, so the database specification is reconciled to
100,000,000 bytes per file and 500,000,000 bytes per transfer before migration.

## Decision

- PostgreSQL is the authoritative metadata store. Object bytes are absent from
  the schema and continue to flow directly between browser and private storage.
- Drizzle owns typed schema/query construction and SQL migrations. `postgres.js`
  is the runtime driver; it is server-only and never available to the web app.
- Store UUID identifiers, UTC `timestamptz` values, and byte-sized values in
  `bigint`. Application values remain safe integers because policy limits are
  below JavaScript's maximum safe integer.
- Store only token/key/request digests as `bytea`. Raw capabilities and passwords
  are not columns. Password hashes may be stored only in the dedicated nullable
  password-hash column by later authorized domain code.
- Create transfer and file metadata in one transaction. The repository rejects
  empty batches, more than 10 files, per-file sizes outside 1–100,000,000 bytes,
  and aggregate size above 500,000,000 bytes before any insert. The transaction
  means a rejected batch leaves no partial transfer or file rows. Database checks
  independently enforce the per-row size and basic timestamp/version invariants.
- Unique constraints protect public/management token digests, storage keys, and
  idempotency operation/scope/key tuples. A foreign key cascades transfer-file
  deletion. Explicit indexes cover transfer cleanup, transfer-file lookup, and
  idempotency expiration.
- Repository interfaces contain persistence-shaped records only and remain free
  of NestJS controllers. Slice 04 will own state-machine/domain policies.
- `DATABASE_URL` is validated only at database connection and migration
  boundaries in this slice. API startup does not silently invent a connection or
  require a database before any route consumes it. Later integration must wire
  the database module explicitly.

## Migration and rollback plan

The initial forward migration creates enums, tables, constraints, and indexes in
dependency order. On an empty disposable database, rollback/rebuild is `DROP
SCHEMA public CASCADE; CREATE SCHEMA public;` followed by migration apply. This
is destructive and restricted to an explicitly disposable database. Production
rollback is a forward fix; do not drop metadata tables. Future large-table index
changes must evaluate concurrent index creation and locking separately.

## Verification boundary

Migration and repository integration tests run against disposable PGlite, which
is PostgreSQL compiled to WebAssembly and uses Drizzle's PostgreSQL dialect. This
gives deterministic local and CI tests without a host daemon. A real PostgreSQL
server was not available on the implementation host; provider/daemon parity must
be checked before deployment. The migration SQL remains standard PostgreSQL and
the optional live test command accepts an explicit disposable `DATABASE_URL`.

## Dependency consequences

- `drizzle-orm` (Apache-2.0) provides typed PostgreSQL schema and queries.
- `postgres` (Unlicense) is the small server runtime driver and connection pool.
- `drizzle-kit` (MIT, development only) generates/checks migration artifacts.
- `@electric-sql/pglite` (Apache-2.0, development only) supplies the disposable
  PostgreSQL test runtime. It adds installation/CI weight but no production or
  browser bundle code. Docker or a system PostgreSQL service would add external
  setup and was unavailable on this host.

All versions are exact in the lockfile. Dependency audit and migration checks are
release inputs, not proof of production database capacity or provider parity.
The current Drizzle Kit release retains a development-only legacy esbuild loader
with moderate advisory GHSA-67mh-4wv8-2f99. DropIt does not run esbuild's affected
development server. Production dependencies report no known vulnerability at
this verification point; track upstream rather than forcing a breaking downgrade
or an unverified transitive override.
