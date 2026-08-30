#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/Screen-Remote"
./gradlew :app:compileDebugKotlin --quiet 2>&1 | tail -n 50
