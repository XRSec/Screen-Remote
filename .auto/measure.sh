#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/Screen-Remote/app/src/main/java"

START_TIME=$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1e9))')

# Run python metric counter
RESULT=$(python3 - << 'EOF'
import os, re, sys

BASE = "Screen-Remote/app/src/main/java"

WHITELIST = {
    "androidx.compose.material3.Icon",
    "androidx.compose.material3.IconButton",
    "androidx.compose.material3.CircularProgressIndicator",
    "androidx.compose.material3.LinearProgressIndicator",
    "androidx.compose.material3.OutlinedTextField",
    "androidx.compose.material3.Surface",
    "androidx.compose.material3.FloatingActionButton",
    "androidx.compose.material3.FloatingActionButtonDefaults",
    "androidx.compose.material3.SmallFloatingActionButton",
    "androidx.compose.material3.FilterChip",
    "androidx.compose.material3.FilterChipDefaults",
    "androidx.compose.material3.Badge",
    "androidx.compose.material3.BadgedBox",
    "androidx.compose.material3.MaterialTheme",
    "androidx.compose.material3.darkColorScheme",
    "androidx.compose.material3.lightColorScheme",
    "androidx.compose.material3.Typography",
    "androidx.compose.material3.ExperimentalMaterial3Api",
    "androidx.compose.material3.LocalContentColor",
    "androidx.compose.material3.LocalTextStyle",
    "androidx.compose.material3.Slider",
    "androidx.compose.material3.SliderDefaults",
    "androidx.compose.material3.Text",
    "androidx.compose.material3.Scaffold",
    "androidx.compose.material3.TopAppBar",
    "androidx.compose.material3.DropdownMenu",
    "androidx.compose.material3.DropdownMenuItem",
}

TARGET_M3_PATTERNS = {
    "androidx.compose.material3.Card",
    "androidx.compose.material3.CardDefaults",
    "androidx.compose.material3.HorizontalDivider",
    "androidx.compose.material3.AlertDialog",
    "androidx.compose.material3.Button",
    "androidx.compose.material3.ButtonDefaults",
    "androidx.compose.material3.TextButton",
    "androidx.compose.material3.OutlinedButton",
    "androidx.compose.material3.Checkbox",
}

unmigrated_targets = 0
non_whitelisted_imports = 0
miuix_usages = 0

for root, _, files in os.walk(BASE):
    for f in files:
        if f.endswith(".kt"):
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8") as file:
                lines = file.readlines()
            for line in lines:
                m = re.search(r"import\s+(androidx\.compose\.material3\.[A-Za-z0-9_]+)", line)
                if m:
                    imp = m.group(1)
                    if imp not in WHITELIST:
                        non_whitelisted_imports += 1
                    if imp in TARGET_M3_PATTERNS:
                        unmigrated_targets += 1
                if "top.yukonga.miuix.kmp" in line:
                    miuix_usages += 1

print(f"{unmigrated_targets} {non_whitelisted_imports} {miuix_usages}")
EOF
)

END_TIME=$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1e9))')
DURATION_MS=$(( (END_TIME - START_TIME) / 1000000 ))

read -r UNMIGRATED NON_WHITELISTED MIUIX_COUNT <<< "$RESULT"

echo "METRIC unmigrated_targets=$UNMIGRATED"
echo "METRIC non_whitelisted=$NON_WHITELISTED"
echo "METRIC miuix_count=$MIUIX_COUNT"
echo "METRIC measure_ms=$DURATION_MS"
