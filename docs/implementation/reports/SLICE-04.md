# Slice 04 completion report

Slice: 04 — Transfer domain.
Status: COMPLETE / VERIFIED locally, 2026-10-30.
Next slice: 05 — R2 adapter, NOT STARTED.

## Files changed

- Pure transfer-domain errors, state machine, limits, expiration calculations,
  safe filename policy, aggregate invariant checks and repository port under
  `apps/api/src/domain/transfers/`.
- Drizzle transfer adapter compare-and-swap transitions and readiness guards.
- Database schema imports of domain-owned status tuples and decimal file limit.
- Unit and PGlite integration tests for policy boundaries and state races.
- ADR-0008, Slice 04 status, implementation progress and this report.

No HTTP controller, OpenAPI route, R2 adapter, presigned URL, token generator,
password flow, frontend code, schema migration or future-slice implementation was
added.

## Dependencies added (and why)

None. The domain uses TypeScript and platform APIs. Zod was not added because
Slice 04 has no HTTP trust boundary and dependency-free validation fully covers
the internal typed inputs. A request schema library can be reviewed with the
OpenAPI endpoint slice if it materially improves runtime contract enforcement.

## Architecture and security decisions

ADR-0008 records the decisions. One domain policy source owns the accepted
decimal limits: 10 files, 100,000,000 bytes per file and 500,000,000 bytes per
transfer. Expiry is an inclusive threshold at `now >= expiresAt`, with a 24-hour
default and 1–168-hour range. The persistence adapter uses PostgreSQL
`CURRENT_TIMESTAMP` for transition guards and completion time.

Filenames are NFC-normalized, outer whitespace is trimmed, and path separators,
control/bidirectional characters, relative path segments and values beyond 255
UTF-8 bytes are rejected. Ordinary display metacharacters remain data and still
require contextual output encoding in later UI/download work. Storage keys remain
separate server-owned values.

The domain port requires status/version compare-and-swap. The Drizzle adapter
increments the version atomically, rejects early/late transitions using the same
SQL write, and will not publish READY unless at least one file exists and every
stored file is VERIFIED with a non-null, non-future verification timestamp.
Lifecycle permission for READY to CANCELLED does not grant authorization; Slice
06/07 services must still require the management capability.

## Tests and checks

| Status | Command / evidence |
| --- | --- |
| PASS | `pnpm check`: formatting, lint, strict API/web typecheck, 166 Vitest tests in 7 files, Drizzle migration consistency, API/web production builds and 4 foundation startup tests. The sandboxed startup attempt failed only because loopback binding returned `EPERM`; the identical startup suite passed with loopback permission. |
| PASS | Domain table tests cover every non-expiry state pair, every legal expiry source, terminal-state rejection, effective timestamp expiry, exact 1/10-file, 1/100,000,000-byte and 500,000,000-byte boundaries, decimal-vs-binary rejection, and 1/24/168-hour expiry. |
| PASS | Filename tests cover NFC, trimming, exact 255 UTF-8 bytes, empty/whitespace, `.`/`..`, traversal separators, NUL/control/newline, bidi override and oversized names. |
| PASS | Aggregate tests cover digest/version/lifetime, ownership, unique IDs/keys, normalized names, verification/completion timestamps, and READY requiring all verified files. |
| PASS | PGlite integration proves one winner for competing status/version CAS writes, database-clock expiry guards, READY denial for missing/future verification, safe-name persistence and hostile-name rollback. |
| PASS | `pnpm check:enforcement`, `pnpm check:governance`, `pnpm db:generate` (no schema drift), `git diff --check`, and production dependency audit (no known vulnerabilities). |
| NOT RUN | Real PostgreSQL concurrent transition test: no live disposable server or provider URL is configured. PGlite executes the PostgreSQL-dialect statements but provider concurrency parity remains a pre-deployment gate. |
| NOT APPLICABLE | R2, HTTP/OpenAPI conformance, authorization, browser E2E, cleanup, load and deployment verification belong to later slices. |

## Manual verification

Reviewed the final dependency direction: API domain imports only its own plain
TypeScript modules; Drizzle schema/adapter depend on the domain; the domain does
not import NestJS, Drizzle, R2 or web code. Reviewed generated migration state and
confirmed the refactor requires no schema change. No UI or storage behavior exists
in this slice to verify manually.

## Open issues and risks

- PGlite may serialize work differently from a deployed multi-connection
  PostgreSQL provider. Repeat the CAS race suite against disposable live
  PostgreSQL before deployment.
- READY currently proves database file-verification metadata only. Slice 05 must
  set that metadata from exact-key object HEAD verification; it must never trust
  a client completion claim.
- Filename validation does not make a filename safe for HTML or an HTTP header.
  Later consumers must escape rendering and encode attachment disposition.

Next slice (not started): 05 — R2 adapter.
