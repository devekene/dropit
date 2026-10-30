# Mandatory agent execution protocol

## Before any edits
1. Read root `AGENTS.md`, applicable `docs/` specifications and accepted ADRs.
2. Read `ROADMAP.md`, `PROGRESS.md`, and **only the assigned slice**.
3. Inspect current files and scripts. Never assume the repository is empty.
4. Check prerequisites. If missing, stop and report.
5. Propose concise change plan, dependencies, affected files and tests.

## During implementation
- Implement only assigned acceptance criteria; do not prebuild future slices.
- Respect existing files, naming, module boundaries, security requirements and design governance.
- Ask before destructive operations, replacing configurations, migrations that drop data, changing public contracts, or adding significant dependencies.
- Do not use `any`, `@ts-ignore`, disabled lint rules or skipped tests to hide defects.
- Use explicit errors and bounded retries; never leak secrets in logs.
- Separate view, state orchestration, API transport and domain processing.
- Preserve existing unrelated changes; do not reset the user's worktree.

## Completion gate
Run applicable typecheck, lint, tests, build, and slice-specific verification. Mark each **PASS / FAIL / NOT RUN** with evidence; never claim unrun checks passed. Update `PROGRESS.md` only for verified work. Stop after current slice and request approval.

## Required completion report
```
Slice:
Status: COMPLETE / BLOCKED / PARTIAL
Files changed:
Dependencies added (and why):
Architecture/security decisions:
Tests and checks (PASS/FAIL/NOT RUN, command):
Manual verification:
Open issues / risks:
Next slice (not started):
```

## Conflict policy
Security and accepted ADRs supersede convenience. If a slice contradicts the root governance, pause, describe the conflict and request a decision. No silent policy changes.
