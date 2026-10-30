#!/usr/bin/env python3
"""Basic pack integrity gate; NOT a substitute for code security tests."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
required = ['AGENTS.md','docs/ARCHITECTURE.md','docs/SECURITY.md','docs/PERFORMANCE.md','docs/DATA_FLOW.md','docs/API.md','docs/DATABASE.md','docs/DEPENDENCIES.md','docs/TESTING.md','docs/OPERATIONS.md','contracts/openapi.yaml','docs/diagrams/system.mmd','docs/diagrams/sequence-upload.mmd','docs/diagrams/sequence-download.mmd','docs/diagrams/state-machine.mmd','docs/diagrams/dependency-graph.mmd']
missing = [p for p in required if not (root/p).is_file()]
if missing: raise SystemExit('Missing governance files: '+', '.join(missing))
print(f'Governance pack integrity OK ({len(required)} required files).')
