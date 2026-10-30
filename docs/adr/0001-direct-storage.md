# ADR-0001: Direct browser-to-object-storage transfers
Status: Accepted

Context: 100 MiB files would impose avoidable API bandwidth and memory pressure.
Decision: API issues narrowly scoped presigned upload/download capabilities; browser transfers bytes directly. API HEAD-verifies expected objects before READY. ZIP never proxied through API.
Consequences: CORS/presigned URL lifecycle complexity, limited revocation, need provider-specific size enforcement and checksum strategy.
