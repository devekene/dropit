# Slice 08 — Design system

**Status:** NOT STARTED  
**Prerequisite:** Slice 02 verified; can be built after security but must precede upload UI.

## Objective
Define semantic tokens, typography, spacing, focus and error states, responsive layout and accessible primitives following design governance. No generic dashboard styling.

## Allowed changes
Web styles, primitives, documentation and accessibility tests.

## Dependency policy
Only essential UI dependencies after justification.

## Acceptance criteria
Works at 320px and desktop; keyboard/focus usable; no unnecessary gradients, glass effects or god components.

## Required verification
Component interaction/accessibility tests, visual manual review, reduced-motion check.

## Forbidden scope
No API calls in presentational components; no speculative component library.

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
