# ADR-0003 — Decision register
Status: Superseded in part by ADR-0004 (2026-10-30)

1. **Storage provider:** ACCEPTED — Cloudflare R2, private S3-compatible bucket; verify exact signing and checksum behavior against deployed provider. See ADR-0004.
2. **Password unlock grant:** ACCEPTED — short-lived, scoped opaque grant in HttpOnly Secure SameSite=Strict cookie; same-site subdomains, exact Origin checks. See ADR-0004.
3. **ZIP:** DEFERRED — browser streaming only after compatibility/memory testing; feature disabled until validated.
4. **Anonymous rate limits:** ACCEPTED initial quotas — edge + atomic PostgreSQL counters, reviewed by load/abuse tests. See ADR-0004.
5. **Upload capability refresh:** ACCEPTED — sender management authorization, <=3 refreshes/file/hour, unexpired unfinished transfers only. See ADR-0004.
6. **Share token location:** ACCEPTED — path-based high-entropy bearer token with full redaction and no-referrer; fragment approach deferred. See ADR-0004.
