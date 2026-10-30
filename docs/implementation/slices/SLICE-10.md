# Slice 10 — Sharing experience

**Status:** NOT STARTED  
**Prerequisite:** Slice 09 verified.

## Objective
Build success state with copyable link, QR, expiry summary and optional password state; ensure management secrets never included in share URL.

## Allowed changes
Share UI and QR rendering component, tests.

## Dependency policy
Small QR generator if needed.

## Acceptance criteria
Share URL resolves; QR decodes to same URL; copy and error states accessible; protected transfer does not leak filenames.

## Required verification
E2E share/copy/QR, responsive and keyboard tests.

## Forbidden scope
No analytics trackers on sensitive share pages.

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
