#!/usr/bin/env bash
# Usage: scripts/push-photo-to-emulator.sh <file> [<file> ...]
#
# Pushes image files to the connected Android emulator / device
# (prefers emulator if both are attached) into /sdcard/Pictures/
# and triggers a media scan so the gallery picks them up.

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <file> [<file> ...]" >&2
  exit 1
fi

pick_device() {
  local lines
  lines=$(adb devices | awk 'NR>1 && $2=="device" {print $1}')
  if [ -z "$lines" ]; then
    echo "No connected Android devices." >&2
    return 1
  fi
  # Prefer an emulator if both are attached.
  local emulator
  emulator=$(echo "$lines" | grep '^emulator-' | head -n1 || true)
  if [ -n "$emulator" ]; then
    echo "$emulator"
  else
    echo "$lines" | head -n1
  fi
}

device=$(pick_device)
echo "device: $device"

count=0
for src in "$@"; do
  if [ ! -f "$src" ]; then
    echo "skip (not a file): $src" >&2
    continue
  fi
  base=$(basename "$src")
  dest="/sdcard/Pictures/$base"
  adb -s "$device" push "$src" "$dest" >/dev/null
  adb -s "$device" shell am broadcast \
    -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d "file://$dest" >/dev/null
  bytes=$(stat -f %z "$src" 2>/dev/null || stat -c %s "$src")
  printf '  → %s (%s bytes)\n' "$dest" "$bytes"
  count=$((count + 1))
done

echo "done: $count file(s) pushed"
