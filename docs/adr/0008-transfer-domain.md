# ADR-0008 — Transfer domain policy and state transitions

Date: 2026-10-30
Status: Accepted for Slice 04.

## Context

Slice 04 establishes transfer rules before adding object-storage behavior or HTTP
endpoints. The rules must remain independent of NestJS, Fastify, Drizzle and R2,
while the PostgreSQL adapter needs an atomic transition contract that cannot lose
a concurrent update. Accepted ADR-0004 resolves the earlier MB/MiB ambiguity in
favor of decimal byte limits.

## Decision

- Keep the transfer domain under `apps/api/src/domain/transfers`. It is plain
  TypeScript and imports no framework, transport, database or storage package.
- Define one domain policy source for 1–10 files, 1–100,000,000 bytes per file,
  500,000,000 bytes per transfer, a 24-hour default expiry and an inclusive
  1–168-hour expiry range. These are decimal MB limits. The Drizzle schema imports
  the per-file constant so database and domain limits cannot drift.
- Calculate expiry from an explicit creation time. Treat `now >= expiresAt` as
  expired. Active stored states resolve effectively to EXPIRED at that threshold
  even before cleanup persists the state.
- Allow only the lifecycle transitions documented by the architecture. CREATED,
  UPLOADING and VERIFYING may fail or be cancelled; READY may be cancelled; and
  CREATED, UPLOADING, VERIFYING and READY may expire. EXPIRED, CANCELLED and FAILED
  are terminal. Authorization for READY cancellation remains an API/service
  responsibility; this state machine expresses lifecycle validity only.
- Normalize filenames to Unicode NFC and trim outer whitespace. Reject empty
  names, `.`/`..`, path separators, control characters, bidirectional controls,
  and names longer than 255 UTF-8 bytes. Preserve ordinary display characters,
  including HTML metacharacters, as data. Later presentation and download code
  must still escape HTML and encode `Content-Disposition`; filename validation is
  not a substitute for output encoding. Storage keys remain server-owned and do
  not derive from these names.
- Define the repository port in the domain. State writes use compare-and-swap on
  transfer ID, expected status and expected version, increment the version, and
  use the PostgreSQL clock for the timestamp guard in the same SQL statement.
  Transitioning to READY also
  requires every expected file to be VERIFIED with a verification timestamp.
  A stale version, expired non-expiry transition, early expiry, or readiness
  failure returns no update. This preserves atomicity for competing callers.
- Use dependency-free validation in this slice. Zod would become useful at an
  HTTP trust boundary, but adding it for already typed internal functions would
  add install and audit cost without improving this slice's boundary enforcement.

## Consequences

The domain can be tested without starting NestJS, PostgreSQL or R2. Pure tests
cover all state pairs and exact limit/expiry/filename boundaries. PGlite
integration tests execute competing compare-and-swap requests and verify only one
wins, but a real PostgreSQL provider concurrency check remains required before
deployment as recorded by ADR-0007.

No OpenAPI route, storage signing, password behavior, UI, schema migration or new
dependency is introduced. Slice 05 will consume the port for storage verification;
Slice 06 will own endpoint orchestration and contract conformance.
