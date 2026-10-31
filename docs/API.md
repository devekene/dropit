# API design and conventions

**Transport:** HTTPS REST/JSON, `/v1`, OpenAPI-first. No GraphQL for MVP. All requests have `X-Request-Id` generated/echoed and server-side correlation. JSON errors use `{error:{code,message,requestId}}`; no stack traces.

## Endpoints
- `POST /v1/transfers`: create anonymous transfer, validate metadata, return upload capabilities, one-time management token and share URL (inactive until READY). Requires `Idempotency-Key`.
- `POST /v1/transfers/{id}/complete`: verify objects and finalize; management token in `Authorization: Bearer ...`; idempotent.
- `DELETE /v1/transfers/{id}`: cancel, management token required.
- `GET /v1/public/transfers/{token}`: minimal recipient view, challenge when password protected, deny if expired/not READY.
- `POST /v1/public/transfers/{token}/unlock`: password verification; return scoped grant via secure cookie or response token (choose one in implementation ADR).
- `POST /v1/public/transfers/{token}/download-urls`: grant when protected, return signed URLs for requested file IDs.

## Error taxonomy
`VALIDATION_ERROR` 400; `UNAUTHORIZED` 401; `FORBIDDEN` 403; `NOT_FOUND` 404 (including expired where non-disclosure preferred); `CONFLICT` 409; `PAYLOAD_TOO_LARGE` 413; `RATE_LIMITED` 429; `STORAGE_UNAVAILABLE` 503. Include `Retry-After` for throttling and temporary outages.

## Contracts
`contracts/openapi.yaml` version 0.2.0 is checked against the Slice 06 HTTP
responses with AJV. Never return raw storage keys, hashes, internal errors or
password material. Use opaque file IDs and signed capabilities only. Object keys
and signing credentials necessarily occur inside scoped presigned storage URLs.

## Slice 06 activation boundary

Create, complete, cancel and public metadata are implemented in a test-only Nest
module. `AppModule` deliberately does not import it, and its factory rejects
non-test environments. Normal API startup still exposes no transfer routes.
Slice 07 must implement shared atomic abuse limits and the remaining security
controls before activation; no environment flag bypasses this boundary.

Non-null create passwords return 400, never an unprotected transfer. Existing
protected records return only `{passwordRequired:true}` after READY; the grant
flow, download signing and upload refresh are not exposed in this slice. The
future unlock/download paths in OpenAPI remain design contracts, not live routes.

Creation accepts 1–10 files, each 1–100,000,000 bytes, aggregate <=500,000,000 bytes;
expiry defaults to 24h and is bounded at 168h. Upload responses include PUT,
`uploadHeaders`, and `uploadExpiresAt`. The browser supplies the declared-size
body directly to storage; it must not attempt to set the forbidden browser
`Content-Length` header itself. Extra create properties, hostile names, malformed
media types, nonempty complete/cancel bodies and query parameters are rejected.

Completion returns only `{status:"VERIFYING"}` or `{status:"READY"}`. A 60-second
database lease allows recovery after process loss; transient storage failure
returns 503 and releases the lease for an explicit retry. Missing/mismatched
objects result in FAILED/409 and exact-key deletion. Repeating completion of a
FAILED transfer retries cleanup. Repeating cancellation retries cleanup and
returns 204; expired operations deny access regardless of persisted status.

All API errors contain only a fixed code/message and a bounded request ID;
`X-Request-Id` is echoed/generated, sensitive responses are `no-store`, and
temporary capacity/storage errors include `Retry-After: 5`. Request admission is
bounded at eight in-flight handlers per process. This is resource protection,
not the production shared abuse limiter. Logs are disabled; service counters
contain only fixed operation/outcome labels, not IDs, paths or credentials.

## Retries
ADR-0010 reconciles anonymous creation: keys are globally scoped to that
operation, with only keyed key/request digests and an opaque transfer reference
persisted. Use a fresh random key for each intended new transfer. Any replay of a
retained key, with the same or different body, returns generic 409 and cannot
create a second transfer. Records expire no earlier than transfer expiry plus
24h; this slice does not purge or reuse them. A lost creation response is
unrecoverable because raw management/share secrets are never persisted. Do not
automatically retry an ambiguous create with a new key. Signed URL refresh for
expired PUT capability requires a management-authorized endpoint before public
launch; do not retry with expired URLs indefinitely.
