# Slice 06 — Transfer API

**Status:** NOT STARTED  
**Prerequisite:** Slices 03–05 verified.

## Objective
Implement REST create, upload URL issuance, finalize/verify, transfer metadata and management operations per existing OpenAPI; idempotency and bounded concurrency. Never return public download URLs before authorization.

## Allowed changes
NestJS controllers/DTOs/services, API contract changes only with explicit reconciliation, integration tests.

## Dependency policy
Only dependencies justified by API contract implementation.

## Acceptance criteria
Create → signed upload → verify → READY succeeds; missing/extra/wrong-size objects fail; retries cannot duplicate state; management token enforced.

## Required verification
Contract tests and integration against DB/storage adapter; verify sanitized errors.

## Forbidden scope
No password bypass or unprotected public download endpoints.

## Execution checklist
- [ ] Read governance and verify prerequisites.
- [ ] Inspect existing code and document plan.
- [ ] Implement only the stated objective.
- [ ] Add negative-path tests, not only happy-path tests.
- [ ] Run and report all applicable checks.
- [ ] Update `PROGRESS.md` with evidence only when verified.
- [ ] Stop and request approval before the next slice.

## Universal requirements
- Read root `AGENTS.md`, accepted ADRs, design/security/performance specifications and `AGENT_PROTOCOL.md` before changes.
- Preserve unrelated code/docs. Implement no future slice. Add dependencies only for demonstrated need.
- Maintain separation of concerns, strict typing, security checks and tests.
- Run applicable `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` if those scripts exist; report missing commands as NOT RUN, not PASS.
- Produce the required completion report and stop for approval.
