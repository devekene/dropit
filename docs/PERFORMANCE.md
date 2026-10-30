# Performance budgets and test methodology

All values are **targets**, not proven benchmarks. Test staging with production-like storage latency and a realistic DB pool.

| Metric | Initial target | How measured |
|---|---|---|
| Metadata API p95 | <200ms at 50 RPS | k6/Artillery, excluding storage uploads |
| Create transfer p95 | <300ms at 20 RPS | k6 with quota controls |
| Browser concurrent PUTs | ≤3 | upload queue unit + E2E |
| API file bytes proxied | 0 | integration network trace |
| API memory growth with file size | O(1) | RSS heap comparison 1/50/100 MiB |
| Initial app LCP | <2.5s p75 mobile | Lighthouse/field RUM |
| CLS | <0.1 p75 | Lighthouse/field RUM |
| JS budget | set baseline, then enforce regression ≤10% | bundle analyzer |
| Error rate | <1% under accepted load | load run metrics |

## Request strategy
- One create request per transfer (up to 10 files), returns signed upload capabilities; batch rather than N initiation requests.
- Max 3 concurrent PUTs/browser; exponential backoff + jitter for transient 429/5xx/network failures; do not blindly retry after ambiguous completion—HEAD/reconcile via finalize.
- One finalize call; idempotency key and state CAS. No progress polling. Cancel outstanding PUTs on abort.
- GET transfer metadata once on page load; no polling. Password challenge only on user action.
- Signed GET per requested file; for Download All, request a batch of scoped URLs once after authorization.
- Bounded API JSON request size (e.g. 32KiB), server timeout, max concurrency, DB pool and storage HEAD fanout (≤3).

## Load cases
A. 50 RPS metadata read for 5 min; B. 20 RPS create for 5 min with quota test fixture; C. 100 simultaneous recipients; D. 30 concurrent clients uploading 3 files each direct to storage; E. expiration cleanup of 10k rows in bounded batches; F. transient storage failures.

## Release gates
Collect p50/p95/p99, CPU, RSS, DB pool saturation, errors, S3 request rates and cost estimates. Fail release if accepted-load target missed without an approved exception ADR. Never infer upload speed from API latency.
