# Slice 02 — Developer tooling

**Status:** NOT STARTED  
**Prerequisite:** Slice 01 verified.

## Objective
Configure strict TypeScript, ESLint, Prettier, test runners and environment variable validation boundaries. Establish CI quality jobs and consistent package scripts.

## Allowed changes
Tooling configs, shared config only where useful, CI workflows, sample env docs.

## Dependency policy
ESLint, Prettier, Vitest and required framework/test adapters; environment validation dependency only if used.

## Acceptance criteria
Lint, typecheck, unit test and build commands are reproducible; invalid env is rejected without leaking secrets.

## Required verification
Run checks on clean install; introduce one failing type/lint/test fixture temporarily to verify enforcement then remove.

## Forbidden scope
No business domain or storage code.

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
