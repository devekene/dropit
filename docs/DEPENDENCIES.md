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

## R2 adapter dependencies

- `@aws-sdk/client-s3`: server-only S3-compatible client for exact-key `HEAD`
  and deletion and for constructing PUT/GET signing commands.
- `@aws-sdk/s3-request-presigner`: server-only AWS Signature V4 URL presigner.

Both are Apache-2.0 AWS SDK v3 packages. At the Slice 05 installed versions the
published unpacked sizes are approximately 3.3 MB and 33 KB respectively; neither
is imported by `apps/web`. A hand-written SigV4 implementation was rejected
because maintaining canonical request and signing behavior locally would create
more security and maintenance risk than these provider-maintained packages.
