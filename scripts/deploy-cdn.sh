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
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BUCKET="${BUCKET:-ndesign-cdn}"
PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
LOCATION="${LOCATION:-US}"
VERSION="$(node -p "require('./package.json').version")"

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
VERSIONED_CACHE="public, max-age=31536000, immutable"
LATEST_CACHE="public, max-age=300, must-revalidate"

upload_tree() {
  local prefix="$1" cache="$2"
  echo "==> Uploading dist/* -> gs://$BUCKET/$prefix  (cache: $cache)"
  gcloud storage cp --recursive \
    --cache-control="$cache" \
    --project="$PROJECT" \
    "dist/*" "gs://$BUCKET/$prefix/"
}

upload_tree "ndesign/$VERSION" "$VERSIONED_CACHE"
upload_tree "ndesign/latest"    "$LATEST_CACHE"

# 4. Validate the headline assets are publicly fetchable
BASE="https://storage.googleapis.com/$BUCKET"
TARGETS=(
  "$BASE/ndesign/$VERSION/ndesign.min.js"
  "$BASE/ndesign/$VERSION/ndesign.min.css"
  "$BASE/ndesign/$VERSION/themes/light.min.css"
  "$BASE/ndesign/$VERSION/themes/dark.min.css"
  "$BASE/ndesign/latest/ndesign.min.js"
  "$BASE/ndesign/latest/ndesign.min.css"
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
echo "==> Done. CDN-ish URLs:"
echo "    JS  : $BASE/ndesign/latest/ndesign.min.js"
echo "    CSS : $BASE/ndesign/latest/ndesign.min.css"
echo "    Light theme: $BASE/ndesign/latest/themes/light.min.css"
echo "    Dark  theme: $BASE/ndesign/latest/themes/dark.min.css"
echo "    Pinned version prefix: $BASE/ndesign/$VERSION/"
