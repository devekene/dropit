# Security specification / threat model

## Assets and adversaries
Assets: private file bytes, share tokens, management tokens, password grants, storage budget, API availability, metadata. Adversaries: anonymous spammer, token guesser, malicious uploader, link recipient, automated brute-force client, compromised browser extension, insider with log access.

## Controls
1. TLS/HSTS; secure headers; explicit CORS allowlist; CSRF protection for cookie-based sessions if introduced; HTTPS storage endpoints.
2. Generate public share and management secrets independently using OS CSPRNG (≥24 random bytes each); URL-safe encoding; store HMAC-SHA256 digests with server-held key and key rotation plan. Never use sequential IDs as access credentials.
3. Share link is a bearer capability. Optional password uses Argon2id with calibrated cost. Rate-limit attempts per token + IP with progressive delays. On success, issue short-lived scoped access grant via HttpOnly Secure SameSite cookie or opaque bearer; ensure grants expire no later than transfer.
4. Password-protected transfer: no filenames, sizes, signed URLs or QR-protected metadata disclosed until verification. Minimize existence oracle differences.
5. Upload initiation: validate names (length/Unicode/control chars), sizes, count, expiry, quotas; issue signed single-object PUT with exact key and signed constraints. Use checksum when provider supports it. Never trust content-type. Storage PUT policy must prevent oversized objects; if PUT provider cannot enforce size, use signed POST policy with content-length-range or verify and delete oversized objects immediately, plus provider-side quota safeguards.
6. Bucket private, block public access, encryption at rest, least-privilege IAM separated signer/cleanup. No listing allowed to anonymous clients. Configure CORS only for app origins/methods/headers needed.
7. Download: API checks READY, expiry, password grant, quota and object existence before short-lived GET signing. Set Content-Disposition attachment and `X-Content-Type-Options: nosniff`; use isolated storage origin; avoid inline HTML/SVG execution.
8. Abuse: edge/IP rate limiting, per-IP transfer creation budget, concurrent upload quotas, storage cap, global kill switch, optional CAPTCHA/challenge when thresholds trip. Document proxy trust (`X-Forwarded-For`) and avoid spoofing. Reject excess before signing.
9. URLs: share token may appear in browser history/referrers; `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, no third-party trackers on transfer pages, redact token paths in logs/telemetry. Avoid token in query parameters.
10. Malware: no claim of safe content without scanning. Default attachment downloads; optional antivirus scanning is a future gate if public exposure grows. Provide abuse reporting/contact and acceptable-use policy before public launch.
11. Dependency supply chain: lockfile committed; CI audit/SCA, secret scanning, pinned actions, least-privilege CI permissions.
12. Deletion: expired metadata tombstones may remain for reconciliation; objects deleted on retry; enforce retention cap and test eventual cleanup. Avoid storing IPs longer than necessary.

## Attack tests (required)
- Guess token, replay/reuse management token, cross-transfer object access, overwrite another transfer key.
- Oversized upload via forged metadata; direct PUT larger than declared; extra object; content-type spoof.
- Password brute force, concurrent guesses, expired grant, metadata disclosure before password.
- Race: expire during verify, cancel during upload, concurrent finalize, finalize replay, cleanup vs download.
- HTML/SVG file and hostile filename, path traversal, zip-slip on client ZIP, XSS via file names.
- DoS: transfer creation flood, 10×100MiB, slowloris, large JSON bodies, high request concurrency.

## Residual risks
Signed GET URLs are not individually revocable until TTL; users can re-share links; browsers/providers may cache downloads. Anonymous upload service may be abused even with rate limits. Document these explicitly in product copy.

## Binding MVP decisions
ADR-0004 is the accepted normative security architecture. If this document and ADR-0004 differ, follow the stricter requirement and open an ADR to reconcile the discrepancy before implementation. Numeric quotas are initial policies, not measured capacity claims.
