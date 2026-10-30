# Slice 09 — Upload experience

**Status:** NOT STARTED  
**Prerequisite:** Slices 07 and 08 verified.

## Objective
Build drag/drop, file selection, client prevalidation, controlled concurrency (max 3), actual byte progress, cancellation, retry, transfer creation/finalize orchestration. Use File objects; never read all files into JS memory.

## Allowed changes
Feature UI, upload transport service, hooks/controller, tests.

## Dependency policy
Upload transport with real progress support only; justify any package.

## Acceptance criteria
Limits and errors shown; upload retries safe; progress real; success only after server READY; no polling for upload progress.

## Required verification
Browser E2E 1/10 files, 100 MB boundary, 500 MB total, interruption, cancellation, mobile file picker.

## Forbidden scope
No upload through Next.js or NestJS server routes.

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
