# Test plan and release gates

## Test pyramid
- Unit: size/count/expiry, token digest, password policy, state machine, retry decisions, safe filenames.
- Integration: Drizzle migrations, concurrency-safe transitions, idempotency replay, storage HEAD verification, cleanup retry.
- Contract: OpenAPI request/response validation and error taxonomy.
- E2E: select 10 files, reject 11th; 100,000,000 bytes/file max; 500,000,000 bytes aggregate; create→upload→finalize→share→download; password flow; expiry; cancelled/failed transfer; QR opens same link.
- Security: cases in `SECURITY.md`, including authorization bypass, cross-transfer access, malicious filename, content-type spoof, race conditions.
- Performance: scenarios and budgets in `PERFORMANCE.md`.

## CI merge gates (once apps exist)
1. Format + lint + strict typecheck.
2. Unit/integration tests with coverage of critical security and state transitions.
3. OpenAPI schema lint + contract conformance.
4. Build + dependency boundaries + audit + secret scan.
5. Playwright smoke E2E in ephemeral DB and S3 emulator; verify emulator limitations vs real provider.
6. Staging load tests before public release (not necessarily every PR).

## Definition of release-ready
No critical/high unmitigated vulnerabilities, all threat-model tests green, rate limits tested at edge and app, object lifecycle verified, backup/restore rehearsed, documented abuse response, measurable budgets satisfied or explicit exception ADR.

## Slice 06 verification boundary

Normal Vitest runs include the Nest/Fastify injection contract suite against a
migrated disposable PGlite database and the real R2 adapter with a deterministic
S3 transport double. `pnpm test:r2` additionally runs the HTTP transfer flow with
real private R2 PUT/HEAD/delete, rejects a forged extra-key upload, and verifies
missing/wrong-size failures and cleanup. Test credentials remain in the ignored
API environment file. No normal API process exposes transfer routes yet.

OpenAPI component schemas compile with strict AJV; exercised HTTP responses are
validated against their documented operation/status. Request tests cover decimal
boundaries, invalid fields, body limits and unsupported passwords. This is schema
and response conformance evidence, not a hosted OpenAPI lint-service result.
Race coverage includes duplicate creation, finalize/cancel/expiry, interrupted
verification, stale leases and failed cleanup retry. PGlite parity with a live
multi-connection PostgreSQL deployment, browser abort behavior, complete password
and download E2E, cleanup workers, load tests and hosted CI remain separate gates.
