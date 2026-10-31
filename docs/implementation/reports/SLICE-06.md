# Slice 06 completion report

Slice: 06 — Transfer API.
Status: COMPLETE / VERIFIED within the explicitly approved test-only scope,
2026-10-31 (Africa/Lagos).
Next slice: 07 — Authorization and abuse controls, NOT STARTED.

## Files changed

- `contracts/openapi.yaml`: version 0.2.0, decimal limits, creation-time share
  URL, one-time credential/replay behavior, upload headers/expiry, completion
  status, locked metadata schema and documented errors.
- `apps/api/src/transfers/`: strict request/response types, controllers, plain
  application service, capability hashing, bounded work, sanitized HTTP boundary,
  test-only module, unit/HTTP contract/live R2 tests and test fixtures.
- `apps/api/src/domain/transfers/transfer-api-repository.ts` and the Drizzle
  adapter: transactional creation/idempotency, DB-clock reads, verification
  claims/recovery and atomic file verification/READY publication.
- Database schema and migration `0001_eager_ozymandias.sql`, with journal and
  snapshot: one nullable verification lease column; no destructive migration.
- Storage port/adapter: abort signals and bounded SDK connection/request timeouts.
- API bootstrap, test build exclusions, API dev dependencies and lockfile.
- Foundation smoke test: the built production API must reject transfer creation
  with a sanitized 404 and no-store response.
- README, API/data-flow/database/performance/dependency/testing specifications,
  upload/runtime diagrams, roadmap limit reconciliation, ADR-0010, Slice 06
  checklist and progress.

The pre-existing `apps/web/next-env.d.ts` development-path change was preserved
after Next's type/build commands regenerated that file. No UI implementation,
commit, push, deployment or Slice 07 work was performed.

## Dependencies added (and why)

- Development-only `ajv@8.20.0` (MIT): schema compilation and HTTP response
  validation. Already present transitively, now explicitly owned by API tests.
- Development-only `yaml@2.9.1` (ISC): parse the checked-in OpenAPI specification.

Licenses were verified from installed manifests. Installed directories measure
2,364 KiB and 1,276 KiB respectively, excluding separate transitive directories.
Neither enters API runtime code or the browser bundle. These maintained tools
avoid implementing an incomplete local schema validator/parser. Frozen offline
installation succeeded without lockfile changes.

## Architecture/security decisions

The user explicitly approved the reconciliation recorded in ADR-0010 before
coding: decimal byte limits; share URL returned once at creation but inaccessible
until READY; generic 409 for any retained create-key replay; rejection of non-null
password creates; transfer routes available only in tests until Slice 07.

Normal `AppModule` does not import the transfer module. Its explicit test factory
rejects development/production environments. No feature flag enables it. No
unlock, download-signing or upload-refresh endpoint is exposed.

Management and public capabilities use independent OS-random 32-byte secrets and
versioned, purpose-separated HMAC-SHA256 digests, with constant-time comparison.
Idempotency uses a separate stable key, global anonymous-operation scope, and
one transaction with transfer/file creation. Raw tokens, signed URLs and passwords
are not persisted. Replayed keys cannot recover the one-time response; the sender
must retain credentials in memory. Automatic retries with a fresh key after an
ambiguous response would create a new transfer and must not be used.

Finalization requires management authorization and a 60-second DB-clock lease.
HEAD fanout is <=3; stale lease owners cannot publish or release a newer claim.
Successful HEAD of every expected object precedes one short transaction recording
VERIFIED files and READY, guarded by exact file set, lease, version and expiry.
No storage network call runs inside that publication transaction. Missing or
wrong-size uploads fail; terminal cancellation precedes deletion. Cleanup attempts
every expected key even if individual deletes fail, and explicit retries can
finish deletion after temporary provider failure.

Extra completion fields/keys are rejected. Live R2 rejected a forged extra-key
PUT with 403. Consistent with ADR-0009, there is no bucket-list operation: this
does not claim detection of unrelated objects inserted by a bucket administrator.

HTTP JSON bodies are capped at 32 KiB; test request admission is capped at eight
handlers per process. Storage has connection/request timeouts and abort signals.
Errors use only fixed messages/codes and bounded request IDs; logs are disabled,
and counters have fixed operation/outcome names without identifiers. Protected
READY records return only `{passwordRequired:true}`. Other non-READY/expired
public metadata is unavailable. Files never pass through the API.

## Tests and checks

| Status | Command / evidence |
| --- | --- |
| PASS | Final `pnpm check`: formatting, lint, API/web strict typechecking, **249 tests in 12 files**, migration consistency, both production builds and all four startup smoke tests. The final run used loopback permission; the earlier sandbox-only startup attempt failed with `EPERM`. |
| PASS | 45 new HTTP/DB/storage-adapter integration tests and three capability unit tests. Coverage includes decimal boundaries, invalid input, unsupported passwords, token isolation, replay/concurrent creation, rollback, missing/wrong-size/partial uploads, extra fields, bounded HEAD concurrency, request admission, expiry, finalize/cancel races, crash/stale-lease recovery, cleanup retry and sanitized errors. |
| PASS | Strict AJV compilation of OpenAPI component schemas and validation of exercised HTTP responses against operation/status schemas; schemas enforce protected metadata as a minimal locked variant. |
| PASS | Final `pnpm test:r2`: **two live suites passed**. New HTTP flow uses migrated disposable PGlite plus real private R2 for signed direct PUT, forged extra-key 403, HEAD/READY, repeat completion, metadata, cancellation/deletion, missing upload and wrong-size rejection. Wrong-size fixture was injected through the test's backend credential, never through an API-issued oversized capability. All expected objects were confirmed missing and cleanup ran in `finally`. Existing CORS/integrity/TTL/storage-adapter suite also passed. |
| PASS | `pnpm check:enforcement`: intentional type/lint/test failures rejected and fixtures removed. |
| PASS | `pnpm check:governance`, `pnpm check:ui`, `pnpm db:generate` (no schema drift), and `git diff --check`. |
| PASS | `pnpm install --frozen-lockfile --offline --store-dir /Users/inhouse/Library/pnpm/store/v10`; frozen lockfile accepted, no dependency changes required. |
| PASS | `pnpm audit --prod --audit-level=moderate`: no known production vulnerability. `pnpm audit --audit-level=high`: no high/critical finding. |
| FINDINGS | Full `pnpm audit --json` reports two moderate development-tool findings: esbuild 0.18.20 through Drizzle Kit (`GHSA-67mh-4wv8-2f99`) and minimatch 10.2.6 through ESLint (`GHSA-g3hv-75wg-m249`). Neither is introduced by the new direct test dependencies; follow upstream compatible fixes without an unrelated toolchain upgrade here. |
| NOT RUN | Live multi-connection PostgreSQL/provider race parity; PGlite executes the PostgreSQL statements but is not deployment concurrency proof. |
| NOT RUN | Browser/device E2E, real browser abort behavior, password/grant/download E2E, shared abuse enforcement, cleanup worker, load/RSS/latency benchmarks, hosted CI and deployment verification. These are later-slice/release gates. |

## Manual verification

Reviewed API output projections and error paths for credential/metadata leakage;
reviewed the dependency direction and confirmed no web/database/storage import
crossing and no framework dependencies in the new domain port. Test-only helpers
are excluded from the production API compilation. The integration test file is
longer than 500 lines because it shares one migrated HTTP/DB fixture across related
contract and race scenarios; it remains test code with one integration boundary,
not a mixed-responsibility UI or runtime component.

The live test exercises actual private R2 objects but uses HTTP injection rather
than a browser or a publicly listening transfer API. No browser UI acceptance or
production-readiness claim is made.

## Open issues / risks

- Slice 07 must supply shared atomic quotas/rate limits, password hashing/grants,
  Origin/CSRF policy and reviewed deployment configuration before route exposure.
- Lost creation responses cannot be recovered under the approved one-time-secret
  policy. Retained idempotency keys cannot be reused; TTL cleanup is later work.
- Already-issued PUT URLs can remain valid after cancellation/deletion, so late
  uploads may recreate objects. Scheduled cleanup, abandoned-transfer recovery,
  provider lifecycle safeguards and storage budget alarms remain release gates.
- Production key provisioning/rotation must retain old capability keys for the
  intended validity period and keep idempotency hashing stable while records are
  retained. This slice only injects test keys, never production secrets.
- The nullable-column migration is validated on disposable PGlite. Deployment
  migration timing, live PostgreSQL locking/timeout behavior and realistic-volume
  performance remain unmeasured. Forward rollback leaves the column in place.
- The two moderate development dependency advisories above remain tracked.

Next slice (not started): 07 — Authorization and abuse controls. Separate user
approval is required before proceeding.
