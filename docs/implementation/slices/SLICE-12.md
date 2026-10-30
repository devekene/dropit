# Slice 12 — Reliability and release

**Status:** NOT STARTED  
**Prerequisite:** Slices 01–11 verified.

## Objective
Implement retryable cleanup of expired/abandoned objects, operational metrics, abuse alarms, failure recovery, security/load/E2E tests, production env and deployment runbook. Verify budget assumptions and incident response.

## Allowed changes
Cleanup jobs, runbooks, CI/CD, E2E/perf evidence, final ADR updates.

## Dependency policy
No queue/Redis unless measurements establish need.

## Acceptance criteria
No expired share grants; orphan objects cleaned; tests and CI green; deployable with rollback; measured latency/memory and documented exceptions.

## Required verification
Load tests, fault injection, storage cleanup verification, full browser E2E, dependency audit, deployment smoke test.

## Forbidden scope
Do not declare production ready on mocks alone; no hidden manual steps.

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
