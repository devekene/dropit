# Slice 04 — Transfer domain

**Status:** VERIFIED — see [completion report](../reports/SLICE-04.md)
**Prerequisite:** Slice 03 verified.

## Objective
Implement pure transfer state machine, limits, expiration calculations, safe filenames, invariant checks, repository contracts and validation. Decide decimal MB vs MiB explicitly.

## Allowed changes
Domain services, pure validation functions, tests; shared contracts only if truly shared.

## Dependency policy
Zod if aligned with governance; avoid others.

## Acceptance criteria
Invalid transitions rejected; file count/size/total/expiry boundaries tested; domain code independent of HTTP and R2.

## Required verification
Table-driven tests for boundary values, concurrency/state races where applicable.

## Forbidden scope
No presigned URLs or frontend UI.

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
