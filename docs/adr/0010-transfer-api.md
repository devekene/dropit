# ADR-0010 — Slice 06 transfer API and contract reconciliation

Date: 2026-10-30
Status: Accepted by user for Slice 06; production activation is not approved.

## Context and approved decisions

The initial OpenAPI uses binary limits and assumes finalization can recover a
share secret stored only as a digest. Creation replay also cannot reproduce an
independent random, one-time management secret without persisting secret material.
The user explicitly approved the following reconciliation before implementation:

- Decimal limits: 100,000,000 bytes/file and 500,000,000 bytes/transfer.
- Return the share URL at creation; deny metadata until READY and unexpired.
  Completion returns status only. Store independent random secrets only as HMAC
  digests; do not encrypt/persist credentials to enable response replay.
- Replays of a retained creation idempotency key return generic 409, for both
  equal and different payloads. A lost successful response cannot be recovered.
- Reject non-null password creation until Slice 07. Existing protected records
  reveal only a locked state. No unlock/download/refresh endpoint in Slice 06.
- Routes are available only through an explicitly test-only module factory;
  the normal app does not import them. Slice 07 must supply shared atomic abuse
  controls, password/grant handling and deployment configuration before exposure.

## Implementation decisions and alternatives

Creation claims an anonymous-operation idempotency key and inserts transfer/files
in one transaction. Key scope is global to anonymous creation, not a spoofable or
changing client IP. Callers must use random keys; key digests and keyed request
fingerprints are persisted, never raw credentials or signed URLs. Records are
retained at least through transfer expiry plus 24 hours; Slice 06 never removes
or reuses a retained key. Cleanup/retention is later work.

The existing schema gains a nullable verification lease timestamp. A DB-clock
CAS claims UPLOADING or an abandoned VERIFYING record for 60 seconds. Completion
checks exact expected keys with at most three concurrent HEAD calls, bounded by
storage timeouts. Recording all VERIFIED files and publishing READY is one
transaction guarded by lease, version, state and DB-clock expiry. Transient
storage failure releases the lease for retry. A crashed process can be reclaimed
after lease expiry. No queue or long transaction around network work is needed.

Missing/mismatched objects fail the transfer and trigger bounded exact-key
deletion. Cancellation persists the terminal state before deletion; a repeated
cancel or completion of FAILED retries deletion after a storage outage.
Already-issued PUT URLs remain usable until TTL, including after deletion;
eventual cleanup and provider lifecycle safeguards remain release gates.

No list operation is added to the storage port, consistent with ADR-0009. Extra
objects cannot be supplied through completion (empty body only) or signed through
creation beyond its validated manifest. A forged extra key must fail storage
signature validation. Discovering objects inserted out of band by a bucket
administrator is outside this API's authority and requires later reconciliation.

## Dependencies, migration and consequences

`ajv` (MIT) and `yaml` (ISC) are development-only contract-test dependencies; neither
enters the browser or API runtime. They replace a hand-written partial schema
validator/YAML parser. Exact versions, audit and verification are recorded in the
completion report. No runtime dependency is added.

The migration adds one nullable column without rewriting existing records or
adding an index; lookup uses the transfer primary key. Production rollback is a
forward fix leaving the nullable column intact. Realistic-volume and live
PostgreSQL concurrency checks remain pre-deployment gates.

Test request admission is bounded per process; it is explicitly not the shared
atomic abuse limiter required for production. Errors use a fixed taxonomy and
request IDs, with no raw exception details, paths, credentials or provider output.
In-memory counters contain only fixed operation/outcome names and no identifiers.
No API file-byte proxy, public download signing or frontend change is introduced.
