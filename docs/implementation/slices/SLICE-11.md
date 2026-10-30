# Slice 11 — Recipient downloads

**Status:** NOT STARTED  
**Prerequisite:** Slices 07 and 10 verified.

## Objective
Build public transfer view, password gate, individual signed downloads, and download-all ZIP with a validated streaming implementation or documented supported-browser fallback. No server-side ZIP proxy.

## Allowed changes
Download UI, download transport, ZIP adapter, tests.

## Dependency policy
ZIP streaming library only after browser support validation.

## Acceptance criteria
Expired/missing/password-protected states correct; individual downloads work repeatedly; ZIP content matches files without unbounded JS memory.

## Required verification
E2E wrong/correct password, expiry, concurrent downloads, large ZIP, target browsers and mobile limitations.

## Forbidden scope
Do not promise streaming ZIP if actual implementation buffers whole archive.

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
