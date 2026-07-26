"""Filesystem paths for monorepo layout.

backend/     — Python API (this package)
"""

from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent

# Canonical resource probes for security / smoke tests (not page-BFF).
RESOURCE_PROBES = frozenset({
    "base-metrics/bounds",
    "base-metrics/snapshot",
    "sales/snapshot",
    "stock/snapshot",
    "foodcost/snapshot",
    "targets",
})
