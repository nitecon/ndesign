#!/usr/bin/env bash
#
# Build ndesign dist assets and publish them to a public GCS bucket
# so they can be served as a (Cloud-CDN-ready) origin.
#
# Layout in the bucket:
#   ndesign/<version>/...   immutable, long cache
#   ndesign/latest/...      mutable, short cache
#
# Env overrides:
#   BUCKET    GCS bucket name           (default: ndesign-cdn)
#   PROJECT   gcloud project            (default: current gcloud config)
#   LOCATION  bucket location           (default: US)
#   VERSION   semantic version to tag   (default: package.json version,
#             then most recent git tag matching v*, then error)
#
# Version resolution order:
#   1. VERSION env var (explicit)
#   2. package.json "version" field
#   3. git describe --tags --abbrev=0 --match 'v*' (strip leading v)
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BUCKET="${BUCKET:-ndesign-cdn}"
PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
LOCATION="${LOCATION:-US}"

# Version resolution — env override wins, then package.json, then latest tag.
if [[ -z "${VERSION:-}" ]]; then
  if VERSION="$(node -p "require('./package.json').version" 2>/dev/null)" && [[ -n "$VERSION" && "$VERSION" != "undefined" ]]; then
    :
  elif VERSION="$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null)"; then
    VERSION="${VERSION#v}"
  else
    echo "ERROR: no VERSION resolved. Set VERSION=x.y.z or add a version to package.json" >&2
    exit 1
  fi
fi

# Basic semver sanity check (x.y.z with optional -prerelease / +build)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
  echo "ERROR: VERSION '$VERSION' is not a valid semver (expected x.y.z)" >&2
  exit 1
fi

if [[ -z "$PROJECT" ]]; then
  echo "ERROR: no gcloud project set. Run: gcloud config set project <id>" >&2
  exit 1
fi

echo "==> project=$PROJECT  bucket=gs://$BUCKET  version=$VERSION  location=$LOCATION"

# 1. Build prod assets (minified JS, CSS, themes)
echo "==> Building dist/ (prod)"
npm run build:prod

if [[ ! -f dist/ndesign.min.js || ! -f dist/ndesign.min.css ]]; then
  echo "ERROR: expected dist/ndesign.min.js and dist/ndesign.min.css after build" >&2
  exit 1
fi

# 2. Ensure bucket exists, public, uniform access
if ! gcloud storage buckets describe "gs://$BUCKET" --project="$PROJECT" >/dev/null 2>&1; then
  echo "==> Creating bucket gs://$BUCKET in $LOCATION"
  gcloud storage buckets create "gs://$BUCKET" \
    --project="$PROJECT" \
    --location="$LOCATION" \
    --uniform-bucket-level-access
else
  echo "==> Bucket gs://$BUCKET already exists"
fi

echo "==> Granting public read (allUsers:objectViewer)"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --project="$PROJECT" \
  --member=allUsers \
  --role=roles/storage.objectViewer >/dev/null

# 3. Upload dist/ to versioned + latest prefixes
#    Versioned assets get a year of immutable caching, latest gets 5 minutes.
#    Version prefix uses a leading "v" so URLs read ndesign/v0.1.0/ — this
#    is the convention agents are pointed at (see SPEC.md Section 2).
VERSIONED_CACHE="public, max-age=31536000, immutable"
LATEST_CACHE="public, max-age=300, must-revalidate"
VERSION_PREFIX="ndesign/v$VERSION"
LATEST_PREFIX="ndesign/latest"

upload_tree() {
  local prefix="$1" cache="$2"
  echo "==> Uploading dist/* -> gs://$BUCKET/$prefix  (cache: $cache)"
  gcloud storage cp --recursive \
    --cache-control="$cache" \
    --project="$PROJECT" \
    "dist/*" "gs://$BUCKET/$prefix/"
}

upload_tree "$VERSION_PREFIX" "$VERSIONED_CACHE"
upload_tree "$LATEST_PREFIX"  "$LATEST_CACHE"

# 3b. Upload the SPEC document alongside the assets. This is the
#     agent-consumption artifact — an agent pointed at SPEC.md can build
#     an entire ndesign app without touching the source tree.
upload_spec() {
  local prefix="$1" cache="$2"
  if [[ ! -f docs/SPEC.md ]]; then
    echo "WARNING: docs/SPEC.md not found — skipping spec upload for $prefix" >&2
    return 0
  fi
  echo "==> Uploading docs/SPEC.md -> gs://$BUCKET/$prefix/SPEC.md"
  gcloud storage cp \
    --cache-control="$cache" \
    --content-type="text/markdown; charset=utf-8" \
    --project="$PROJECT" \
    "docs/SPEC.md" "gs://$BUCKET/$prefix/SPEC.md"
}

upload_spec "$VERSION_PREFIX" "$VERSIONED_CACHE"
upload_spec "$LATEST_PREFIX"  "$LATEST_CACHE"

# 4. Validate the headline assets are publicly fetchable
BASE="https://storage.googleapis.com/$BUCKET"
TARGETS=(
  "$BASE/$VERSION_PREFIX/ndesign.min.js"
  "$BASE/$VERSION_PREFIX/ndesign.min.css"
  "$BASE/$VERSION_PREFIX/themes/light.min.css"
  "$BASE/$VERSION_PREFIX/themes/dark.min.css"
  "$BASE/$VERSION_PREFIX/SPEC.md"
  "$BASE/$LATEST_PREFIX/ndesign.min.js"
  "$BASE/$LATEST_PREFIX/ndesign.min.css"
  "$BASE/$LATEST_PREFIX/SPEC.md"
)

echo "==> Validating public availability"
fail=0
for url in "${TARGETS[@]}"; do
  if line=$(curl -fsSI "$url" | awk 'BEGIN{IGNORECASE=1}/^(HTTP|content-type|content-length|cache-control)/' | tr -d '\r' | paste -sd' | ' -); then
    printf "  OK  %s\n        %s\n" "$url" "$line"
  else
    printf "  FAIL %s\n" "$url"
    fail=1
  fi
done

if (( fail )); then
  echo "==> One or more assets failed validation" >&2
  exit 1
fi

echo
echo "==> Done. Public URLs:"
echo
echo "  LATEST (mutable, 5 min cache):"
echo "    JS         : $BASE/$LATEST_PREFIX/ndesign.min.js"
echo "    CSS        : $BASE/$LATEST_PREFIX/ndesign.min.css"
echo "    Light theme: $BASE/$LATEST_PREFIX/themes/light.min.css"
echo "    Dark theme : $BASE/$LATEST_PREFIX/themes/dark.min.css"
echo "    SPEC       : $BASE/$LATEST_PREFIX/SPEC.md"
echo
echo "  PINNED v$VERSION (immutable, 1 year cache):"
echo "    JS         : $BASE/$VERSION_PREFIX/ndesign.min.js"
echo "    CSS        : $BASE/$VERSION_PREFIX/ndesign.min.css"
echo "    Light theme: $BASE/$VERSION_PREFIX/themes/light.min.css"
echo "    Dark theme : $BASE/$VERSION_PREFIX/themes/dark.min.css"
echo "    SPEC       : $BASE/$VERSION_PREFIX/SPEC.md"
echo
echo "  Agent handoff — point any coding agent at the pinned SPEC URL:"
echo "    $BASE/$VERSION_PREFIX/SPEC.md"
