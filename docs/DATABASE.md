# PostgreSQL data model and invariants

## Tables
`transfers(id uuid pk, public_token_digest bytea unique, management_token_digest bytea unique, status enum, password_hash text null, expires_at timestamptz, created_at timestamptz, completed_at timestamptz null, version int, cleanup_claim_until timestamptz null)`

`transfer_files(id uuid pk, transfer_id uuid fk on delete cascade, original_filename text, storage_key text unique, content_type_claimed text, size_bytes bigint check >0 and <=100000000, status enum, created_at timestamptz, verified_at timestamptz null, checksum text null)`

`idempotency_records(id uuid pk, operation text, scope_digest bytea, key_digest bytea, request_fingerprint bytea, response_ref jsonb, expires_at timestamptz, unique(operation,scope_digest,key_digest))`

Optional `abuse_counters` using bounded per-IP hashed identifier, window and count; prefer edge rate limit where available. No download analytics table by default.

## Indexes
- unique token digests; `transfers(status,expires_at)` for cleanup; `transfer_files(transfer_id)`; `idempotency_records(expires_at)`.
- DB constraints plus transactional aggregate check ensure ≤10 files and ≤500000000 bytes per transfer. Serialize creation within transaction; never rely only on frontend. These are decimal byte limits, as required by accepted ADR-0004.

## Queries
- Drizzle parameterized SQL only. Avoid SELECT * for public responses. Single query transfer+files where possible; bounded rows (≤10).
- CAS state update: `UPDATE ... WHERE status IN (...) AND expires_at > now() AND version = ? RETURNING ...`.
- Cleanup: `FOR UPDATE SKIP LOCKED`, bounded batches, lease and retries; avoid long transactions during S3 delete.
- UTC timestamps, DB clock as authority. Never assume cron timing is authorization.

## Migration rules
Every schema change must include migration, rollback/forward-fix plan, index impact and test against realistic row counts.
