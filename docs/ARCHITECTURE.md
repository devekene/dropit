# Architecture v1

## Components
Browser (Next.js) ↔ NestJS/Fastify API ↔ PostgreSQL. Browser ↔ private S3-compatible storage by short-lived signed requests. API ↔ storage for signing/HEAD/delete. Cleanup worker runs as scheduled API-adjacent process with DB lease/lock; no external queue MVP.

## Ownership
- Web: selection, upload queue, progress, abort, QR, recipient UI; never decides authorization.
- API: admission control, transfer lifecycle, credential checks, presigning, verification, quota, expiration, cleanup orchestration.
- DB: authoritative state, policy, expiration, file metadata, idempotency records.
- Storage: encrypted-at-rest private object bytes; provider lifecycle safety net.

## State machine
`CREATED → UPLOADING → VERIFYING → READY → EXPIRED`;
`CREATED|UPLOADING|VERIFYING → CANCELLED`;
`CREATED|UPLOADING|VERIFYING → FAILED`;
`READY → CANCELLED` only with valid management credential (future optional sender UI).
Expiry is effective at `now >= expires_at` regardless of asynchronous state update. Terminal transitions must be atomic and guarded.

## Availability & consistency
- Metadata first; files remain private until READY.
- READY only after HEAD each expected object, size/key checks, and optional checksum validation where supported.
- Reconciliation handles partial uploads and interrupted verification; never trusts client completion.
- Cleanup uses DB claims and retries; object deletion is idempotent. Storage lifecycle is a fallback, not the authorization authority.
- Download URLs are bearer credentials valid until their TTL; use ≤60s TTL and account for skew. Already-issued URLs may remain usable after expiry.

## Decisions
- No login, no realtime server push, no server file proxy, no analytics table in core MVP.
- ZIP download is conditional: client-side streaming supported/tested; otherwise individual downloads only until implementation is safe.
- See `docs/adr/0001-direct-storage.md` and `docs/adr/0002-rest.md`.
