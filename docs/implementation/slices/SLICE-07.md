# Slice 07 — Security and abuse controls

**Status:** NOT STARTED  
**Prerequisite:** Slice 06 verified.

## Objective
Implement separate share/manage token hashes, Argon2id optional passwords, short-lived access grants, rate limits and quotas, authorization for every signed GET, CSRF/origin controls, log redaction. Validate cookie strategy for deployment origins.

## Allowed changes
Auth/authorization/quotas modules, tests, security ADR clarifications.

## Dependency policy
argon2 and minimal rate-limit support where needed; no Redis by default.

## Acceptance criteria
Protected metadata inaccessible before password; revoked/expired transfers deny new grants; password attempts and quotas enforced atomically; no secrets logged.

## Required verification
Adversarial integration tests, concurrent quota tests, CSRF and cookie-origin tests, timing-safe checks as relevant.

## Forbidden scope
Do not rely solely on frontend checks, cookies without CSRF analysis, or IP as a strong identity.

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
