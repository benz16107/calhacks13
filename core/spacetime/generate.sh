#!/usr/bin/env bash
# Regenerate the client bindings after changing src/index.ts. Node runs .ts files directly, so imports need .ts.
set -euo pipefail
cd "$(dirname "$0")"
spacetime generate --lang typescript --out-dir bindings --module-path . -y >/dev/null
find bindings -name '*.ts' -exec sed -i -E 's#from "(\.{1,2}/[^"]+)"#from "\1.ts"#' {} +
