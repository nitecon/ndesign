#!/usr/bin/env node
// Concatenates docs/spec/*.md fragments into docs/SPEC.md AND renders
// docs/SPEC.html for browser-navigable anchor links.
//
// Source of truth: docs/spec/_manifest.txt lists fragment filenames in
// build order. Fragments are joined with a blank line separator. The
// resulting docs/SPEC.md is the canonical artifact uploaded to the CDN
// alongside dist/* — agents fetch it from a pinned `v<semver>/SPEC.md` URL.
//
// docs/SPEC.html is the same content rendered as HTML with auto-generated
// `id="..."` attributes on every heading so anchor links like #modals
// actually resolve in a browser. The HTML loads ndesign's own CSS for
// presentation (eat-our-own-dogfood). Agents that follow markdown anchor
// links via HTTP can fetch SPEC.html instead of SPEC.md.
//
// Run manually:
//   npm run build:spec
//
// Runs automatically:
//   - As the first step of `npm run build:prod` (and therefore `npm run deploy:cdn`)
//   - In the `version` lifecycle hook of `npm version <level>`, which then
//     `git add`s the regenerated SPEC.md / SPEC.html so they're part of
//     the version commit and tagged release.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SRC_DIR = join(REPO_ROOT, 'docs/spec');
const MANIFEST = join(SRC_DIR, '_manifest.txt');
const OUT_MD = join(REPO_ROOT, 'docs/SPEC.md');
const OUT_HTML = join(REPO_ROOT, 'docs/SPEC.html');

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

const md = parts.join('\n\n') + '\n';
writeFileSync(OUT_MD, md);

// Slug rule must match the convention agents use when authoring `[Text](#anchor)`
// links across the fragments: lowercase, strip non-word chars (incl. em-dashes
// and backticks), replace EACH whitespace char with a hyphen (so `foo — bar`
// becomes `foo--bar`). This matches GitHub's slugger behaviour.
function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Render markdown -> HTML with default marked, then post-process to add
// `id="..."` to every heading. The slug is derived from the heading's
// rendered text content (HTML tags stripped, HTML entities decoded) so
// it matches the anchor links agents author across the fragments.
marked.use({ gfm: true });

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const rendered = marked.parse(md);
const body = rendered.replace(
  /<(h[1-6])>([\s\S]*?)<\/\1>/g,
  (match, tag, inner) => {
    const text = decodeEntities(inner.replace(/<[^>]+>/g, ''));
    const id = slug(text);
    return `<${tag} id="${id}">${inner}</${tag}>`;
  }
);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ndesign — Frontend Specification</title>
<link rel="stylesheet" href="ndesign.min.css">
<link rel="stylesheet" href="themes/light.min.css" class="theme" data-theme="light">
<meta name="nd-theme" content="light" data-href="themes/light.min.css">
<meta name="nd-theme" content="dark" data-href="themes/dark.min.css">
<style>
  body { padding-bottom: 4rem; }
  main { max-width: 60rem; margin: 0 auto; padding: 1.5rem 1.5rem 4rem; }
  h1, h2, h3, h4, h5, h6 { scroll-margin-top: 1rem; }
  h2 { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--nd-border, #ddd); }
  table { display: block; max-width: 100%; overflow-x: auto; }
</style>
</head>
<body class="app-page">
<main class="nd-prose">
${body}
</main>
<script src="ndesign.min.js"></script>
</body>
</html>
`;

writeFileSync(OUT_HTML, html);

console.log(
  `build-spec: wrote ${OUT_MD} (${md.length} chars) and ${OUT_HTML} (${html.length} chars) from ${fragments.length} fragment(s)`
);
