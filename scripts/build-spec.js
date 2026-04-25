#!/usr/bin/env node
// Concatenates docs/spec/*.md fragments into docs/SPEC.md.
//
// Source of truth: docs/spec/_manifest.txt lists fragment filenames in
// build order. Fragments are joined with a blank line separator. The
// resulting docs/SPEC.md is the canonical artifact uploaded to the CDN
// alongside dist/* — agents fetch it from a pinned `v<semver>/SPEC.md` URL.
//
// Run manually:
//   npm run build:spec
//
// Runs automatically:
//   - As the first step of `npm run build:prod` (and therefore `npm run deploy:cdn`)
//   - In the `version` lifecycle hook of `npm version <level>`, which then
//     `git add`s the regenerated SPEC.md so it's part of the version commit
//     and tagged release.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SRC_DIR = join(REPO_ROOT, 'docs/spec');
const MANIFEST = join(SRC_DIR, '_manifest.txt');
const OUT = join(REPO_ROOT, 'docs/SPEC.md');

if (!existsSync(MANIFEST)) {
  console.error(`build-spec: ${MANIFEST} not found — nothing to do`);
  process.exit(0);
}

const fragments = readFileSync(MANIFEST, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

if (fragments.length === 0) {
  console.error('build-spec: manifest is empty — nothing to do');
  process.exit(0);
}

const parts = fragments.map((name) => {
  const path = join(SRC_DIR, name);
  if (!existsSync(path)) {
    console.error(`build-spec: missing fragment ${path}`);
    process.exit(1);
  }
  return readFileSync(path, 'utf8').replace(/\n+$/, '');
});

const out = parts.join('\n\n') + '\n';
writeFileSync(OUT, out);
console.log(
  `build-spec: wrote ${OUT} from ${fragments.length} fragment(s) (${out.length} bytes)`
);
