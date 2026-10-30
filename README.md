# DropIt Engineering Governance Pack

Drop this folder's contents into the repository root. This is an **architecture and policy pack**, not an implemented application. All controls labeled MUST are release gates; some require CI and application code before they are enforceable.

## Decisions locked
- Next.js / Tailwind; NestJS with Fastify; PostgreSQL + Drizzle; S3-compatible private object storage; pnpm monorepo.
- REST/JSON over HTTPS; OpenAPI contract; no GraphQL/WebSockets/Redis/queues for MVP.
- Anonymous; max 10 files, 100 MiB per file, 500 MiB per transfer; 24h default, 7d maximum; unlimited downloads until expiry.
- Files move browser ↔ object storage, not through NestJS; ZIP must not route through API.

## Read order
1. `AGENTS.md` — coding-agent rules and change protocol
2. `docs/ARCHITECTURE.md` — boundaries, states and system topology
3. `docs/SECURITY.md` — threat model and security gates
4. `docs/DATA_FLOW.md` — precise upload/download and expiration flows
5. `docs/API.md` and `contracts/openapi.yaml` — HTTP contract
6. `docs/DATABASE.md` — schema and invariants
7. `docs/PERFORMANCE.md` — budgets and load scenarios
8. `docs/DEPENDENCIES.md` — dependency constraints
9. `docs/TESTING.md` and `docs/OPERATIONS.md` — release and operational controls
10. `docs/diagrams/*.mmd` — Mermaid source graphs

## Integration
- Copy all files into project root; merge `.github/workflows` carefully.
- Implement code and configure secrets/CI per docs. Run `python3 scripts/check_governance.py` to validate pack structure and banned-language placeholders.
- Adapt the CI example after the pnpm workspace and scripts exist. Do not enable it unchanged if no app exists.
- Review ADRs for choices that are deliberately provisional.

**Security caveat:** A public bearer share link grants access; passwords are optional. A previously issued signed download URL can outlive transfer expiry by up to its short TTL. Do not promise instant revocation or malware-free files.
