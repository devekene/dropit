# Slice 05 completion report

Slice: 05 — R2 storage adapter.
Status: COMPLETE / VERIFIED locally and against development R2, 2026-10-30.
Next slice: 06 — API contracts and upload flow, NOT STARTED.

## Files changed

- Framework-neutral object-storage port under `apps/api/src/domain/storage/`.
- R2 environment validation, versioned random key allocation and ownership
  validation, AWS S3-compatible adapter, bounded presigned PUT/GET, exact-key
  `HEAD` verification, and deletion under `apps/api/src/`.
- Unit tests and an isolated credentialed R2 integration suite with a dedicated
  Vitest configuration and `pnpm test:r2` command.
- Ignored local-environment placeholders, dependency lockfile, R2 setup guide,
  dependency analysis, ADR-0009, slice status, progress and this report.
- The development bucket's CORS policy now allowlists the exact configured local
  origin, GET/PUT/HEAD, Content-Type/Content-MD5 and ETag exposure. Its public
  development URL remains disabled.

No API controller, OpenAPI endpoint, browser upload UI, transfer-completion
service, public bucket, file-byte proxy, queue, worker, Redis, WebSocket or future
slice implementation was added. Slice 04's existing uncommitted files were
preserved.

## Dependencies added (and why)

- `@aws-sdk/client-s3@3.1160.0` for S3-compatible commands, backend `HEAD`, and
  delete.
- `@aws-sdk/s3-request-presigner@3.1160.0` for AWS Signature V4 presigned URLs.

Both are Apache-2.0 server-only AWS SDK v3 packages. Published unpacked sizes at
these versions are approximately 3.3 MB and 33 KB. They do not enter the web
bundle. A hand-written SigV4 implementation was rejected because it would
duplicate security-critical canonical request, expiry, and signing behavior.
The frozen lockfile install passed and the production audit found no known
vulnerabilities.

## Architecture and security decisions

ADR-0009 records the decisions. The domain depends only on a plain TypeScript
storage port; the R2 adapter owns AWS SDK details. Storage keys use transfer ID,
file ID and a random UUID, never a user filename. Every sign, verify and delete
operation validates the key shape and embedded transfer/file ownership first.
No list operation is exposed.

Upload capabilities bind the exact key, expected content length, content type and
optional Content-MD5 for at most 300 seconds. Download capabilities last at most
60 seconds and force an attachment response with `application/octet-stream` and
an encoded safe filename. Configuration rejects non-R2/non-HTTPS endpoints,
non-`auto` region, invalid buckets and non-origin app URLs without echoing values.
The secret access key remains server-only.

Successful PUT is not readiness evidence. Exact-key `HEAD` compares actual length
and optional checksum and returns explicit missing or mismatch results. Slice 06
must consume that result before recording VERIFIED and before the existing READY
repository guard can succeed. Unexpected provider errors are mapped to a generic
storage-unavailable error.

## Tests and checks

| Status | Command / evidence |
| --- | --- |
| PASS | `pnpm test:r2`: one isolated live suite against the private development R2 bucket; all disposable objects were deleted in `finally`. |
| PASS | Live exact-origin CORS preflight allowed PUT plus `Content-Type` and `Content-MD5`; direct browser-style PUT and signed attachment GET returned the configured CORS origin. |
| PASS | Live `HEAD` verified byte length and MD5/ETag; exact-key deletion produced MISSING on the following `HEAD`. |
| PASS | Live changed signed MIME returned HTTP 403; changed body with signed MD5 returned 400 and no object; four bytes through a URL signed for three returned 403 and no object; a one-second URL used after expiry returned 403. |
| PASS | `pnpm check`: formatting, lint, strict API/web typecheck, 201 normal Vitest tests in 10 files, Drizzle schema check, API/web production builds and four independent-startup/invalid-environment foundation tests. Live tests are intentionally excluded from the normal suite. |
| PASS | `pnpm check:enforcement`, `pnpm check:governance`, `pnpm db:generate` (no schema drift), frozen offline install, `git diff --check`, and production dependency audit (no known vulnerabilities). |

## Manual verification

Cloudflare's bucket settings confirmed the bucket has no custom domain, its
Public Development URL is disabled, and the exact local CORS rule saved
successfully. The application credential could perform object read/write but a
read-only bucket-CORS request returned 403 AccessDenied, confirming it does not
carry bucket-administration permission.

Reviewed the final dependency direction: the domain imports no AWS, R2, NestJS,
Drizzle or web code; the R2 adapter imports the domain port; `apps/web` imports no
storage SDK. Reviewed generated signed URLs only through assertions that redact
the secret; no credential or full signed URL was printed or committed.

## Open issues and risks

- The current live run shows R2 rejects an actual content-length mismatch with a
  signature error, but this remains provider behavior rather than a portable
  content-length-range policy. Mandatory `HEAD`, mismatch deletion, admission
  quotas, storage alarms and the global kill switch remain required.
- Content-MD5 validates transport integrity for the tested single-part upload. It
  is not content safety or malware scanning, and future multipart support would
  require a separate checksum design.
- Production and staging CORS origins, secrets, lifecycle fallback, storage
  alarms and deployment-level abuse controls remain release gates. Only the
  local development origin and bucket were verified here.
- Slice 05 exposes the storage port but deliberately does not wire a public API
  flow. Slice 06 must authorize requests and orchestrate repository transitions
  without proxying object bytes.

Next slice (not started): 06 — API contracts and upload flow.
