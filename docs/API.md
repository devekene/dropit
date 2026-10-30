# API design and conventions

**Transport:** HTTPS REST/JSON, `/v1`, OpenAPI-first. No GraphQL for MVP. All requests have `X-Request-Id` generated/echoed and server-side correlation. JSON errors use `{error:{code,message,requestId}}`; no stack traces.

## Endpoints
- `POST /v1/transfers`: create anonymous transfer, validate metadata, return upload capabilities and one-time management token. Requires `Idempotency-Key`.
- `POST /v1/transfers/{id}/complete`: verify objects and finalize; management token in `Authorization: Bearer ...`; idempotent.
- `DELETE /v1/transfers/{id}`: cancel, management token required.
- `GET /v1/public/transfers/{token}`: minimal recipient view, challenge when password protected, deny if expired/not READY.
- `POST /v1/public/transfers/{token}/unlock`: password verification; return scoped grant via secure cookie or response token (choose one in implementation ADR).
- `POST /v1/public/transfers/{token}/download-urls`: grant when protected, return signed URLs for requested file IDs.

## Error taxonomy
`VALIDATION_ERROR` 400; `UNAUTHORIZED` 401; `FORBIDDEN` 403; `NOT_FOUND` 404 (including expired where non-disclosure preferred); `CONFLICT` 409; `PAYLOAD_TOO_LARGE` 413; `RATE_LIMITED` 429; `STORAGE_UNAVAILABLE` 503. Include `Retry-After` for throttling and temporary outages.

## Contracts
`contracts/openapi.yaml` is the initial design contract, not a generated, runtime-verified artifact. Update it and implementation together. Never return raw storage keys, hashes, internal errors or password material. Use opaque file IDs and signed capabilities only.

## Retries
Use idempotency keys scoped to caller+operation, persisted with TTL and request fingerprint. Duplicate key + different body => 409. Signed URL refresh for expired PUT capability requires a management-authorized endpoint before public launch; do not retry with expired URL indefinitely.
