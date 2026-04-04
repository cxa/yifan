#!/bin/bash
set -e

cd "$(dirname "$0")/../android"

VERSION=$(grep versionName app/build.gradle | grep -o '".*"' | tr -d '"')

echo "Building release APK for version $VERSION (arm64)..."
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a

SRC="app/build/outputs/apk/release/app-release.apk"
DST="app/build/outputs/apk/release/yifan-${VERSION}.apk"
mv "$SRC" "$DST"

echo "Done: $DST"
