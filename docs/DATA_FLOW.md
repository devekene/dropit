# Data movement and lifecycle

## Upload
1. Browser validates count/size/expiry locally for UX only.
2. `POST /v1/transfers` with file descriptors, password, expiry and idempotency key.
3. API validates and applies quotas; inserts CREATED transfer and expected files transactionally; returns separate management secret and per-file short-lived upload capabilities.
4. Browser performs direct PUT/POST to private storage with at most 3 concurrent uploads; shows local progress; abort/retry bounded.
5. Browser calls `POST /v1/transfers/{id}/complete` with management credential.
6. API atomically claims VERIFYING; HEADs each expected object (bounded fanout), checks size/key and available checksums; transitions READY only if valid and unexpired; else FAILED or retryable VERIFYING.
7. API returns public share URL only when READY (public token may be created earlier but not useful until READY).

## Download
1. Recipient opens `/t/{publicToken}`; no-store, no-referrer page.
2. `GET /v1/public/transfers/{token}` returns minimal metadata or password challenge; expiry checked on every request.
3. Password submission yields short-lived scoped grant, bound to transfer and expiry.
4. `POST /v1/public/transfers/{token}/download-urls` with file IDs and grant if needed; API checks READY/expiry, returns short-lived signed GET URLs.
5. Browser downloads from storage directly. No API file bytes. Download all may use browser-side streaming ZIP only after validated capability test.

## Cleanup
1. Scheduled job claims expired/abandoned transfers in batches using row locks/lease.
2. Mark logically expired (access already denied by timestamp), delete objects by exact stored keys, retry failures with backoff.
3. Purge tombstones after retention policy; storage lifecycle cleans orphan objects as safety net.

## Request graph
See `docs/diagrams/sequence-upload.mmd`, `sequence-download.mmd`, `state-machine.mmd`.
