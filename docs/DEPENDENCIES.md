# Dependency rules and package graph

```text
apps/web ──> packages/ui ──> packages/contracts
    └───────────────────────> packages/contracts
apps/api ───────────────────> packages/contracts
apps/api ──> internal domain ──> repository/storage ports
                              └──> PostgreSQL/S3 adapters
```

Allowed: web → ui/contracts; api → contracts; ui → contracts; domain → ports; adapters → ports. Forbidden: contracts → apps; web → api/DB/storage SDK secrets; domain → web/NestJS controller; circular imports.

## Dependency governance
- pnpm frozen lockfile; exact or bounded versions with deliberate upgrades.
- Prefer native browser APIs and standard library before new packages.
- Each new runtime dependency needs purpose, size, license, maintenance, vulnerability and replacement analysis in PR.
- Keep S3 SDK server-side; upload uses browser HTTP signed request, not secret-bearing SDK.
- Run dependency cycle check (e.g. dependency-cruiser) once code exists; fail CI on forbidden edges.
