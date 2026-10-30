# DropIt — mandatory agent instructions

These instructions apply to human and AI contributors. **MUST** = merge blocker; **SHOULD** = deviation requires explanation.

## Before coding
1. Read `README.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/API.md`, `docs/PERFORMANCE.md`, `docs/DEPENDENCIES.md`.
2. State files to change, architecture impact, risk, and tests. Do not implement unrelated refactors.
3. If requirements conflict, stop and request a decision. Never silently relax limits or security.
4. Record material changes in `docs/adr/` with context, options, consequences.

## Non-negotiable boundaries
- `apps/web` may import `packages/contracts`, `packages/ui`; never `apps/api` or database/storage adapters.
- `apps/api` owns authorization, policy, metadata, and signing. Domain modules do not depend on NestJS controllers.
- `packages/contracts` contains framework-neutral schemas/types only; no secrets, DB clients, Node-only or browser-only dependencies.
- Object bytes MUST NOT pass through the API on normal upload/download; no Base64 payloads; no full-file buffers.
- No Redis, queues, GraphQL, WebSockets, microservices or new infrastructure without an approved ADR.
- No dependency additions without explaining bundle size, security, maintenance and alternative.

## Design governance

For every frontend, UI, styling, accessibility, or interaction change, **read and obey `docs/design/DESIGN_ENGINEERING.md`**. This supplements root `AGENTS.md`. **Cohesion and separation of responsibilities take precedence over file length**: UI components must not combine rendering, network requests, file processing, and transfer orchestration. Around 500 lines triggers review, not an automatic rejection. Refactor god components regardless of length. Avoid gratuitous gradients, glassmorphism, glows, and ornamental animation. If the root rules still contain a 500-line hard limit, replace that older rule with this policy; do not append conflicting instructions.


## Security gates
- Every API input validated at trust boundary; every sensitive operation authorized server-side.
- No secret in logs, URL query strings (except unavoidable presigned storage URL credentials), analytics, browser console or source control.
- Public tokens and management tokens are distinct, CSPRNG-generated (>= 192 bits), stored as keyed hashes or cryptographic digests; compare safely.
- Passwords: Argon2id, server-side rate-limited verification; never return password hashes.
- Enforce count, per-file size, total size, expiration, state transitions and quota in API AND storage policy where possible.
- Never treat client-supplied MIME or filename as trusted; escape display names, use safe download Content-Disposition.
- No public buckets. Presigned URLs short-lived and scoped to exact object/key/method; verify objects before READY.
- For password-protected transfers, do not issue download URLs without an authorized, short-lived access grant.
- No untrusted file previews inline in app origin; downloads served as attachments from isolated storage origin.
- All routes including metadata must honor expiry and password disclosure policy; do not leak file lists before password verification.

## Performance gates
- No polling for upload progress; browser reports actual transmitted bytes.
- Concurrency: at most 3 active uploads per client, configurable; backpressure and abort support required.
- Bounded request body, memory, timeouts, concurrency and DB pool. Avoid N+1 queries and unbounded fanout.
- Avoid client JS for server-only content; keep upload components isolated.
- No server-side ZIP generation. Browser ZIP only if streaming and compatibility/memory tests pass; otherwise disable ZIP with a documented limitation.

## Implementation workflow
1. Add/update OpenAPI and schemas before endpoints.
2. Add tests for happy path, invalid input, expired, password-protected, concurrent, retry, aborted, and unauthorized cases.
3. Implement smallest change; format/lint/typecheck/test/build; inspect dependency boundaries.
4. Report tests run, results, limitations and unverified claims. Never claim benchmark targets met without measurement.
5. Update diagrams, docs and ADR when behavior changes.

## Forbidden shortcuts
- `any` without explicit documented justification; `@ts-ignore` to bypass errors; swallowing errors; hardcoded secrets; permissive CORS; wildcard S3 access; unchecked non-null assertions at boundaries; unchecked user paths; fake progress; optimistic READY before HEAD verification; automatic retry of non-idempotent writes without idempotency key.

## Definition of done
- Contract, implementation, unit/integration/E2E/security tests, logging/metrics, docs, threat-model delta, and performance impact reviewed. All applicable gates in `docs/TESTING.md` pass.

## Accepted security architecture
Read `docs/adr/0004-security-architecture.md` before any API, upload, storage, password, token, cookie, logging, or deployment change. Deviations require a new approved ADR. Enforce decimal byte limits (100,000,000/file; 500,000,000/transfer), signed GET TTL <=60 seconds, signed PUT TTL <=5 minutes, no READY before object verification, and server-side shared atomic abuse limits.
