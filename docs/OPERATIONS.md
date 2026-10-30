# Operations, configuration, failure handling

## Secrets and configuration
Use a secret manager; `.env.example` documents names only. Required: `DATABASE_URL`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `TOKEN_HMAC_KEY`, `APP_ORIGIN`, `API_ORIGIN`. Never commit real values.

## Observability
Structured JSON logs: requestId, route template, status, duration, sanitized transfer ID; redact public/management tokens, raw filenames if unnecessary, passwords, presigned URLs, Authorization headers and cookies. Metrics: request p95, 4xx/5xx, rate-limits, DB pool, object HEAD/PUT errors, active/expired transfers, cleanup backlog, storage bytes and costs. No file payload traces.

## Jobs
Run scheduled cleanup every 15 minutes initially, bounded 100-transfer batches; retries with exponential backoff; alerts if backlog grows. Use DB leases to avoid duplicate workers. Provider lifecycle policy as last resort, with grace period long enough to avoid deleting active uploads.

## Incidents
- Abuse: toggle upload creation off, preserve download access where safe, revoke signing credentials if compromised.
- Leaked tokens: no immediate revocation of issued signed URLs; cancel transfer, delete objects, rotate signer if necessary.
- Storage outage: return 503 + Retry-After, no premature READY.
- DB outage: fail closed; do not issue new signed URLs.

## Deployment checklist
TLS/HSTS, private bucket/public access block, least-privilege IAM, S3 CORS, origin allowlist, reverse proxy trusted hops, request size limit, database migrations, backup/restore, monitoring/alerts, abuse contact, privacy/retention notices, actual object-storage lifecycle tests.
