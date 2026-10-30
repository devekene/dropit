# Slice 03 — Database foundation

**Status:** NOT STARTED  
**Prerequisite:** Slice 02 verified; PostgreSQL available.

## Objective
Add Drizzle/Postgres connectivity, migrations and minimal repository interfaces. Define transfers/files tables and indexes consistent with existing DATABASE.md; resolve any schema mismatch before coding.

## Allowed changes
API database module, schema/migrations, DB test helpers.

## Dependency policy
drizzle-orm, drizzle-kit, PostgreSQL driver.

## Acceptance criteria
Migrations apply to empty database; foreign keys and expiry indexes exist; no raw file bytes stored.

## Required verification
Migration up on disposable DB; repository integration and rollback/rebuild instructions.

## Forbidden scope
No R2 integration or public API endpoints.

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
