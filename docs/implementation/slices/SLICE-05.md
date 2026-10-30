# Slice 05 — R2 storage adapter

**Status:** VERIFIED
**Prerequisite:** Slice 04 verified; R2 credentials available for local integration.

## Objective
Implement private R2 S3-compatible adapter, presigned PUT/GET, HEAD verification, deletion, CORS documentation and storage-key isolation. Validate actual R2 constraints rather than assuming signed PUT enforces size.

## Allowed changes
Storage adapter, config, isolated integration tests, R2 setup documentation and ADR if needed.

## Dependency policy
AWS SDK S3 client and presigner only.

## Acceptance criteria
Browser direct PUT works; backend can HEAD and delete; wrong keys cannot be signed; credentials never exposed; oversize/object mismatch cannot become READY.

## Required verification
R2 integration using disposable objects, CORS preflight, bad MIME/size and expired URL behavior; cleanup test objects.

## Forbidden scope
No proxying file bytes through API; no public bucket.

## Execution checklist
- [x] Read governance and verify prerequisites.
- [x] Inspect existing code and document plan.
- [x] Implement only the stated objective.
- [x] Add negative-path tests, not only happy-path tests.
- [x] Run and report all applicable checks.
- [x] Update `PROGRESS.md` with evidence only when verified.
- [x] Stop and request approval before the next slice.

## Universal requirements
- Read root `AGENTS.md`, accepted ADRs, design/security/performance specifications and `AGENT_PROTOCOL.md` before changes.
- Preserve unrelated code/docs. Implement no future slice. Add dependencies only for demonstrated need.
- Maintain separation of concerns, strict typing, security checks and tests.
- Run applicable `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` if those scripts exist; report missing commands as NOT RUN, not PASS.
- Produce the required completion report and stop for approval.
