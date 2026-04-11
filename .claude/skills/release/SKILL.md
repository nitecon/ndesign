---
name: release
description: Cut a new ndesign version and deploy to CDN. Analyzes commits since the last v* tag, proposes a semver bump with evidence, confirms with the user, then runs `npm version <level>` to trigger the automated release pipeline (test → bump → CDN deploy → tag push). Use when the user asks to "cut a release", "ship a version", "publish to CDN", or "deploy a new version".
---

# release — Cut a new ndesign version and deploy to CDN

## Purpose

Ship a new ndesign release to the public GCS bucket at `gs://ndesign-cdn/`
with immutable pinned URLs AND a refreshed `latest/` pointer. The pinned
`v<semver>/SPEC.md` URL is the agent-handoff artifact — downstream coding
agents are pointed at it and expect it to be stable forever.

The skill does NOT do anything the user couldn't do by hand; it just makes
the release deliberate, auditable, and safe. Every mutating step runs
through the existing `package.json` lifecycle hooks:

- `preversion` → `npm test` (143 JS + 8 browser — aborts the bump on failure)
- `npm version <level>` → bumps `package.json`, creates commit, tags `vX.Y.Z`
- `postversion` → `npm run deploy:cdn && git push --follow-tags`

## When to use

Invoke this skill when the user says any of:
- "cut a release"
- "ship a version" / "ship v0.2.0"
- "publish to the CDN"
- "deploy a new version"
- "release ndesign"
- "bump the version and deploy"

Do NOT invoke it for:
- Plain CDN re-uploads of the current version (use `npm run deploy:cdn` directly)
- Rolling `latest/` to point at an older version (use `VERSION=x.y.z npm run deploy:cdn`)
- Dry-runs (the skill always ends in a real deploy if the user confirms)

## Preflight checks — MUST run ALL of these before proposing a bump

Run these commands and report the results before asking the user for a
version level. If any check fails, STOP and report the specific problem;
do NOT attempt to "fix" git state (stash, reset, force-push, commit) unless
the user explicitly asks.

```bash
# 1. Working tree clean
git status --porcelain
# Expected: empty output. Any modified/untracked files = abort.

# 2. On the main branch
git branch --show-current
# Expected: "main" (or whatever the user confirms is their release branch).

# 3. Up to date with origin
git fetch origin
git rev-list --left-right --count origin/main...HEAD
# Expected: "0\t0". Non-zero left = behind (pull first); non-zero right = ahead
# and NOT yet pushed (that's normal — the release commit will push too).

# 4. gcloud auth is live
gcloud auth list --filter=status:ACTIVE --format='value(account)'
gcloud config get-value project
# Expected: a non-empty account and a non-empty project.

# 5. npm test passes (preversion re-runs this but catch it early)
# Only run if the user wants to front-load the test check. Otherwise trust
# preversion to catch it. Running tests twice wastes 8+ seconds.
```

## Step 1 — Inventory changes since the last release

```bash
# Find the last release tag. Returns "" if there are no v* tags.
LAST_TAG=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || echo "")

# List commits in the release window
if [[ -n "$LAST_TAG" ]]; then
  git log "${LAST_TAG}..HEAD" --oneline --no-merges
else
  # First release — list everything
  git log --oneline --no-merges
fi
```

Capture the commit subjects. You'll need them for the classification report.

If the output is empty (no commits since the last tag), STOP and tell the
user: "Nothing to release — HEAD is at $LAST_TAG and there are no new
commits." Do NOT proceed with a version bump.

## Step 2 — Classify and propose a bump level

Walk through the commit list and classify each commit into one of three
buckets:

### MAJOR (breaking)

Any commit that:
- Mentions `breaking`, `BREAKING CHANGE`, `!:` in the subject
- Removes a `data-nd-*` directive (search the diff for deletions in `js/`)
- Removes or renames a `NDesign.*` public method
- Removes a documented CSS class family
- Changes a default value in `config` that silently alters existing behavior
- Removes a `<meta name="endpoint:*">` or `<meta name="var:*">` convention
- Renames a public file path in the CDN layout (e.g. moving `ndesign.min.js`)
- Drops support for a browser / environment previously documented

### MINOR (backward-compatible feature)

Any commit that:
- Adds a new `data-nd-*` directive
- Adds a new `NDesign.*` public method or config key
- Adds a new CSS class family, theme, or directive
- Adds a new `<meta name="*">` convention
- Adds a new recipe to the SPEC (materially new capability, not just a
  rewording)
- Adds a new event emitted by the runtime (`nd:*`)

### PATCH (bug fix, internal, or docs-only)

Everything else:
- Bug fixes
- Test additions / improvements
- Docs updates (including SPEC.md rewording that doesn't document new
  features)
- Refactors that preserve the public surface exactly
- Build script changes
- CI / script changes
- SCSS changes that preserve class names and visual behavior

### Reporting the proposal

ALWAYS show the evidence. Example:

> Based on 12 commits since v0.1.0, I'm proposing a **MINOR** bump:
> `0.1.0` → `0.2.0`.
>
> **Adds (MINOR):**
> - `feat: add data-nd-body template for button actions` — new directive
> - `feat: store module with ${var} interpolation` — new NDesign.store API
> - `feat: data-nd-model two-way form binding` — new directive
> - `feat: data-nd-set with arithmetic grammar` — new directive
> - `feat: data-nd-defer skip-on-init bind attribute` — new directive
>
> **Fixes (PATCH):**
> - `fix: +/- buttons now update data-nd-model inputs via nd:var-change`
> - `fix: NDesign.store.set routes through setVar`
>
> **Internal (no version impact):**
> - `docs: update SPEC.md for store features` — spec rewrite
> - `chore: remove baseURL and NDESIGN_CONFIG` — pre-release cleanup
>
> No breaking changes detected. Proceed with `npm version minor`?

## Step 3 — Confirm with the user

ALWAYS ask for explicit confirmation before running `npm version`. A
CDN publish is a high-blast-radius action (1-year immutable caching);
silent releases are forbidden.

Valid user responses:
- "yes" / "go" / "proceed" / "ship it" → run the proposed level
- "patch" / "minor" / "major" → override the level, then run
- "no" / "wait" / "not yet" / any change request → STOP and discuss

Do NOT assume consent from silence, from "ok", or from prior
conversation context. The user must acknowledge the specific version
transition (`0.1.0 → 0.2.0`) before you touch `npm version`.

## Step 4 — Verify SPEC.md is current

Before running the bump, remind the user that `docs/SPEC.md` is the
authoritative agent-handoff document. If new features were added (MINOR
or MAJOR) but `SPEC.md` wasn't updated in the release window:

1. Point out the gap: "The following features were added since v0.1.0
   but I don't see corresponding updates in `docs/SPEC.md`: ..."
2. Offer to update the spec first — but let the user decide.
3. If they say "ship it anyway", note that the pinned SPEC at
   `v<new>/SPEC.md` will be immutable for 1 year and may undersell the
   release. Their call.

Detection heuristic: check whether `docs/SPEC.md` was touched in any
commit in the release window:
```bash
git log "${LAST_TAG}..HEAD" --name-only --pretty=format: -- docs/SPEC.md | sort -u
```
If empty AND you classified any commit as MINOR or MAJOR, flag it.

## Step 5 — Run the release

Once the user has confirmed the level, run:

```bash
npm version <level>
```

Where `<level>` is exactly `patch`, `minor`, or `major` (no `v` prefix,
no explicit version number — let npm compute it from the lifecycle).

This is a SINGLE command. Do not run `preversion`, the bump, and
`postversion` separately — the lifecycle runs them atomically. If the
user asked for a specific version string (e.g. "ship 0.2.0"), use
`npm version 0.2.0` instead; npm accepts a literal semver.

Do NOT pass `--no-git-tag-version` or `--allow-same-version`. Those
bypass the tag creation that the CDN relies on for the `v<semver>/`
prefix.

Stream the command output so the user sees each phase fire: tests,
bump, build, upload, validation, push.

## Step 6 — Report the result

### On success

Print a concise summary:

```
Released v0.2.0 (up from v0.1.0).

Test: 143 JS + 8 browser passed
Build: dist/ndesign.min.js 54.5 KB, dist/ndesign.min.css 81 KB
Deploy: 8 URLs validated, all HTTP 200

Agent handoff URL (immutable):
  https://storage.googleapis.com/ndesign-cdn/ndesign/v0.2.0/SPEC.md

Latest pointer (mutable, 5-min cache):
  https://storage.googleapis.com/ndesign-cdn/ndesign/latest/SPEC.md

Git tag v0.2.0 pushed to origin.
```

### On failure

Identify which phase failed and give the exact recovery command. Do NOT
attempt automatic recovery without asking first.

| Phase | Symptom | State | Recovery |
|---|---|---|---|
| `preversion` | `npm test` failed | Nothing changed. | Fix the failing test, re-invoke the skill. |
| `version` bump | git commit/tag creation failed | Rare. Usually a dirty tree slipped past preflight. | `git status`, resolve, re-invoke. |
| `postversion:deploy` | `npm run deploy:cdn` failed | Local commit + tag exist, CDN partial or empty. | Fix the CDN issue (gcloud auth, network, quota), then run `npm run deploy:cdn && git push --follow-tags`. Do NOT re-run `npm version`. |
| `postversion:push` | `git push --follow-tags` failed | CDN is updated, tag is local only. | `git push --follow-tags` when the remote is reachable. |

## Failure recovery — extended notes

### User wants to undo a just-published release

Pinned versioned URLs are IMMUTABLE for 1 year via `Cache-Control:
public, max-age=31536000, immutable`. You cannot safely unpublish a
pinned URL — downstream agents may have already cached the bytes.

Your options, in order of preference:

1. **Cut a new patch that reverts the broken change.** This is the
   idiomatic fix. It keeps history linear and doesn't break anyone
   already pinned to the bad version.

2. **Re-point `latest/` at an earlier pinned version.** Useful if the
   bad version is flagged before anyone pins to it:
   ```bash
   VERSION=0.1.0 npm run deploy:cdn
   ```
   This only touches `latest/*` — the pinned `v<bad>/` stays live.

3. **Last resort: delete the pinned objects from the bucket.** Requires
   manual `gcloud storage rm --recursive gs://ndesign-cdn/ndesign/v<bad>/`.
   Do this ONLY if the bad release was never advertised and no agent
   could possibly have pinned to it. Never silently — always tell the
   user what you're about to delete and confirm.

Never force-push to `main` to "fix" a bad release. The tag history must
stay linear.

## Anti-patterns — DO NOT

- **Do NOT skip the classification step.** "Let's just cut a patch"
  without reading the commits hides feature work behind a patch version
  and breaks semver for downstream consumers.
- **Do NOT run `npm run deploy:cdn` without a version bump** for a
  "normal" release. Manual deploys are reserved for recovery scenarios
  (step above). The intended flow is `npm version <level>` → let hooks
  do everything.
- **Do NOT force-push to main** to reshape the release commit or tag.
  Cut a new patch instead.
- **Do NOT edit the `version` field in `package.json` by hand.** `npm
  version` is the single source of truth — hand-editing breaks the
  commit + tag + hook chain.
- **Do NOT run this skill against a dirty working tree.** Commit,
  stash, or discard first — the preflight check enforces this.
- **Do NOT bypass `preversion` with `--no-verify` or similar.** The
  tests are the release contract.
- **Do NOT skip the SPEC.md review.** The pinned SPEC URL is the
  primary product of this skill; shipping a spec that doesn't match
  the code strands downstream agents on incorrect documentation.
- **Do NOT auto-run this skill on commit, push, or merge.** Release
  cadence is a human decision. The skill only fires when the user
  explicitly asks.
- **Do NOT use `npm version major` "just to be safe" on an ambiguous
  release.** Ambiguity is a signal to inventory the changes more
  carefully, not to overshoot the bump. Over-bumping wastes the version
  namespace and confuses consumers about what actually changed.
- **Do NOT delete objects from `gs://ndesign-cdn/ndesign/v*/`** without
  explicit user confirmation. Pinned URLs are a contract with
  downstream agents.

## Related files

- `package.json` — scripts: `deploy:cdn`, `preversion`, `postversion`
- `scripts/deploy-cdn.sh` — the CDN upload script invoked by
  `deploy:cdn`
- `docs/SPEC.md` — the agent-handoff artifact uploaded alongside
  `dist/*`
- `~/.claude/CLAUDE.md` — the global prohibition on git worktrees (do
  not create a worktree to "review" the release)

## Notes for the invoking agent

- This skill's output is user-visible. Keep updates short and
  structured — a couple of lines per phase is enough.
- The `preversion` test run takes ~30 seconds; the CDN deploy takes
  ~15-20 seconds including validation. Total skill runtime is under
  a minute on a warm cache.
- The skill is idempotent for recovery: re-running `npm run deploy:cdn`
  for the same version re-uploads the same bytes with the same headers.
  Re-running `npm version` is NOT idempotent — it bumps again.
- If the user asks to dry-run, politely decline — the skill has no
  dry-run mode by design. Suggest they run `git log
  $(git describe --tags --abbrev=0)..HEAD --oneline` manually and
  discuss the level before invoking.
