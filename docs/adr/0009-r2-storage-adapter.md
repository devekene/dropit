# ADR-0009 — Private R2 storage adapter

Date: 2026-10-30
Status: Accepted for Slice 05.

## Context

DropIt must move object bytes directly between the browser and a private
Cloudflare R2 bucket while the API retains control of authorization, key
allocation, signing, verification, and deletion. ADR-0004 caps upload capability
TTL at five minutes and download capability TTL at 60 seconds, and explicitly
forbids treating a successful presigned PUT as proof that an object is valid.

The implementation needs an S3-compatible adapter without coupling the transfer
domain to AWS, Cloudflare, NestJS, or HTTP controllers. Live provider behavior,
including CORS and size mismatch handling, must be tested rather than inferred
from SDK types.

## Decision

- Define a framework-neutral object-storage port under
  `apps/api/src/domain/storage`. Implement the R2 dependency at
  `apps/api/src/storage`; domain code does not import the AWS SDK.
- Add only `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`. They are
  Apache-2.0 server dependencies, maintained as part of the AWS SDK v3. The S3
  client package is about 3.3 MB unpacked and the presigner about 33 KB unpacked
  at the installed versions. They are excluded from the browser graph. A custom
  SigV4 implementation was rejected because it would duplicate security-critical
  canonicalization, expiry, and signing behavior.
- Read R2 configuration from the API process environment. Require an HTTPS
  `r2.cloudflarestorage.com` endpoint, region `auto`, a valid bucket name, both
  credential fields, and an exact HTTP(S) app origin. Configuration errors name
  only the invalid variable and never echo its value.
- Allocate versioned random keys with transfer and file UUID segments and no
  user filename. Validate the full key shape and embedded ownership before every
  sign, `HEAD`, or delete operation. Do not expose list operations through the
  port.
- Sign exact-key PUT requests for at most 300 seconds and bind content length,
  content type, and optional `Content-MD5`. Sign exact-key GET requests for at
  most 60 seconds, forcing `application/octet-stream` and a safely encoded
  attachment disposition. The secret access key remains API-only; the access-key
  identifier necessarily appears inside the SigV4 credential field of a
  presigned URL.
- Treat content type as untrusted metadata. `Content-MD5`, when supplied, is an
  upload integrity check and is compared to the single-part object ETag during
  `HEAD`; it is not a malware or content-safety assertion.
- Make exact-key `HEAD` authoritative for storage verification. Compare actual
  byte length and optional checksum, return explicit missing/mismatch results,
  and never allow mismatch metadata to become a verified file. Slice 06 will
  orchestrate this result with the transfer repository before READY.
- Keep the bucket private. Use an exact-origin CORS policy for browser GET/PUT,
  signed headers, and ETag exposure. The application object credential is scoped
  to object read/write and intentionally cannot administer bucket CORS.
- The 2026-10-30 live R2 run rejected a body whose actual `Content-Length`
  differed from the signed length with HTTP 403, rejected a changed signed MIME
  type with 403, rejected a bad `Content-MD5` with 400, and rejected an expired
  one-second URL with 403. Direct CORS PUT/GET, `HEAD`, attachment response
  overrides, exact-key deletion, and cleanup all passed. These observations pin
  the current integration test but do not replace mandatory `HEAD` verification;
  future provider behavior or other clients must not be assumed equivalent.
- Use two bounded SDK attempts for backend storage calls. Map unexpected provider
  failures to a generic storage-unavailable error so credentials, keys, and raw
  provider details cannot escape through future API responses.

## Consequences

Browser bytes do not traverse NestJS, and storage SDK code remains server-only.
Wrong-transfer and malformed keys fail before signing. Provider acceptance alone
cannot publish a transfer because readiness still depends on authoritative
`HEAD` evidence and the repository's READY guard.

R2 may accept bytes before a later size mismatch is detected. Short URL TTLs,
admission quotas, mandatory verification, immediate mismatch deletion, storage
budget alerts, and the global kill switch from ADR-0004 remain required. The live
test records actual provider behavior and cleans up disposable objects, but it
does not prove production origins, lifecycle rules, alarms, or deployment secret
management.
