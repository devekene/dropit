# ADR-0004 — Security architecture (accepted)

Date: 2026-10-30
Status: Accepted for MVP. Changes require a new ADR and security review.

## Deployment and trust boundaries
- Browser at `https://dropit.example` and API at `https://api.dropit.example` (placeholder domains; production must be same-site subdomains). TLS only, HSTS after rollout verification.
- NestJS/Fastify controls transfer policy, metadata, credentials, presigning, and readiness. Browser transfers bytes directly to/from private Cloudflare R2. PostgreSQL is source of truth for access and expiry.
- No browser-accessible R2 credentials; R2 CORS allowlists the exact production/staging web origins, PUT/GET and required signed headers. No wildcard origins. Use a separate storage origin from the app.
- `Content-Security-Policy`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` on sensitive pages/API, safe attachment disposition, and no third-party scripts/analytics on share pages.

## Capability and password model
- Independently generate share and management secrets with >=32 random bytes each from OS CSPRNG. Base64url encode. Persist only HMAC-SHA256 digests keyed by an environment-managed secret (versioned key ID for rotation). No raw token persistence or logging.
- Share URL uses `/t/<share-secret>` for MVP. URL fragments are deferred because SSR/deep-link and client bootstrap complexity outweigh their partial leakage reduction. Redact path tokens at CDN, reverse proxy, API, tracing, and error-reporting layers. Never embed share links in third-party URLs.
- Sender management secret is returned once at creation, held only in session memory by default (loss means no resume/management); optionally allow user-initiated local persistence in a later ADR. Send management credential in an `Authorization: Bearer` header, never query strings. Management operations are scoped to exactly one transfer.
- For password-protected shares, the initial lookup returns only a generic locked state, never filenames, sizes, storage URLs, or existence details. Passwords are hashed using calibrated Argon2id parameters; verify with constant-time-safe library behavior and uniform generic errors.
- After successful password check, API sets a random opaque grant in `HttpOnly; Secure; SameSite=Strict; Path=/v1/transfers` cookie. Store only grant digest and transfer scope/expiry in DB; grant expires in <=15 minutes and never after transfer expiry. Use exact Origin validation for all cookie-authenticated state-changing routes, reject missing/invalid Origin, and require `Content-Type: application/json` where applicable. Cookie grant is **not** accepted as sender management authorization. Same-site subdomain topology is required; do not enable cross-site credentialed CORS.
- Unprotected shares require valid share secret for metadata/download authorization. Password grant alone does not grant access to unrelated transfers. Protect GET responses from caches.

## Upload and integrity
- Validate 1–10 files, each >0 and <=100,000,000 bytes, total <=500,000,000 bytes; limits are decimal MB. Expiry default 24h, max 168h. Validate Unicode filenames, length, and extension/display handling. Do not trust MIME type or filename for security decisions.
- Create transfer/file rows in a transaction after admission/quota checks. Allocate random, server-owned object keys, never based on filenames. Return single-object, exact-key presigned PUT URLs with 5-minute TTL and signed headers where supported. Browser concurrency <=3. No API file proxy.
- Cloudflare R2 presigned PUT alone must **not** be assumed to enforce content-length-range or prevent oversized PUTs. Verify each object with HEAD (actual size, expected key, and checksum if supported and validated). If any mismatch, fail transfer and enqueue/delete objects; never mark READY. Residual risk: abusive bytes may reach R2 before verification; mitigate via short TTL, per-IP admission quotas, global budget alarms, and provider-side controls where available. No unsupported claim of hard storage ingress limits.
- Complete endpoint requires management authorization; transition to VERIFYING with DB compare-and-swap; verify exactly the expected objects, reject missing/mismatched files, then transition to READY atomically if not expired/cancelled. Idempotent repeat completion returns current state. Concurrent finalize/cancel/expiry must not publish invalid transfers.
- Refresh expired upload capability only for management-authorized, non-READY, non-expired transfers; enforce cooldown and max refresh count. Presigned URLs may still work until TTL and cannot be individually revoked.

## Downloads and expiry
- Authorize every metadata/file download request against READY state, unexpired timestamp, share capability, and password grant when configured. Generate presigned GET URL TTL <=60 seconds, with attachment disposition and safe encoded filename. URLs may remain usable briefly after expiry or cancellation; explicitly document this residual risk.
- Individual downloads unlimited until expiry; no download-count gate. ZIP is deferred; when added, browser-side streaming only after compatibility and memory tests. Do not stream ZIP through NestJS.
- Cleanup worker scans indexed expired/abandoned transfers, deletes objects with retries and idempotent tombstones; add R2 lifecycle rules as fallback. Failure to delete raises alerts. Never rely on deletion job for access control.

## Abuse and rate-limit policy (initial values, configurable and to be load-tested)
- Edge/WAF first, with API enforcement independent of edge. Only trust forwarded IP from explicitly configured proxy hops.
- Transfer creation: <=10/hour and <=30/day per IP; concurrent incomplete transfers <=3/IP; reserved bytes <=1 GB/IP/day; aggregate active storage budget/kill switch at deployment level.
- Password attempts: <=5/15 minutes per (share, IP), <=20/hour per share globally; progressive delay and challenge/temporary block; use privacy-preserving keyed IP hashes with limited retention.
- Upload URL refresh: <=3 per file per hour; download signing: <=60/minute per (share, IP). Request JSON body <=32 KiB; API timeouts and bounded DB pool.
- Multi-instance deployments MUST use a shared atomic limiter (PostgreSQL atomic counters/transactions or approved edge durable limiter); in-memory-only throttling is insufficient. Rate-limit keys expire and cleanup regularly. Exact numbers require measured review before public launch.

## Verification and release gates
- Tests: token isolation/guessing, password metadata leakage and brute force, CSRF/Origin, oversized direct PUT, wrong object, cross-transfer key, concurrent finalize, expiry race, expired grants, URL leakage, storage cleanup retry, abuse budget enforcement.
- Release blocked without: HTTPS and correct origins, private R2 bucket, scoped credentials, production secret management, redacted access logs, no-store headers, effective edge/API rate limiting, alerting, automated cleanup, tested recovery, and successful E2E protected/unprotected transfer flows.
- This design does not include malware scanning; do not describe uploads as scanned/safe. Publish acceptable-use and abuse-reporting contact before public availability.
