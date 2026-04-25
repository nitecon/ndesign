## Getting started

The runtime ships as two files: `ndesign.min.css` and `ndesign.min.js`,
with two optional theme stylesheets. They are distributed via a public
GCS bucket at `https://storage.googleapis.com/ndesign-cdn/`. Agents
building an ndesign application SHOULD load the bundle directly from
the CDN — no build step, no package manager, no vendoring required.

### CDN URLs

Two prefix conventions exist in the bucket:

| Prefix                  | Mutability              | Cache  | Use when                               |
|-------------------------|-------------------------|--------|----------------------------------------|
| `ndesign/latest/`       | mutable, evolves        | 5 min  | active development, demos, prototypes  |
| `ndesign/v<semver>/`    | immutable once uploaded | 1 year | production, reproducible agent handoffs |

The files under each prefix are:

```
ndesign/<prefix>/ndesign.min.js       # runtime bundle (IIFE, exposes window.NDesign)
ndesign/<prefix>/ndesign.min.css      # base stylesheet
ndesign/<prefix>/themes/light.min.css # optional light theme
ndesign/<prefix>/themes/dark.min.css  # optional dark theme
ndesign/<prefix>/SPEC.md              # this document
```

**Pinned SPEC URL for agent handoffs.** Point any coding agent at
`https://storage.googleapis.com/ndesign-cdn/ndesign/v<semver>/SPEC.md` —
that URL is immutable. An agent reading the pinned spec is guaranteed to
build against the same runtime forever.

The CDN sets `Cache-Control: public, max-age=31536000, immutable` on
versioned assets and `public, max-age=300, must-revalidate` on the
`latest/` prefix, so browsers will not re-fetch pinned bundles across
reloads.

### Self-hosting

If CDN delivery is not acceptable (air-gapped environments, CSP
constraints, or policy), download the four files and host them under any
same-origin or cross-origin path of your choice. The same `<link>` and
`<script>` tags apply — only the URLs change. No other configuration is
required.

### Minimal page

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My App</title>

    <!-- Core stylesheet (pinned version — swap v0.3.0 for your target). -->
    <link rel="stylesheet"
          href="https://storage.googleapis.com/ndesign-cdn/ndesign/v0.3.0/ndesign.min.css">

    <!-- Optional theme. class="theme" is REQUIRED so the theme switcher
         can find and swap the link element. -->
    <link rel="stylesheet"
          href="https://storage.googleapis.com/ndesign-cdn/ndesign/v0.3.0/themes/light.min.css"
          class="theme" data-theme="light">
    <meta name="nd-theme" content="light"
          data-href="https://storage.googleapis.com/ndesign-cdn/ndesign/v0.3.0/themes/light.min.css">
    <meta name="nd-theme" content="dark"
          data-href="https://storage.googleapis.com/ndesign-cdn/ndesign/v0.3.0/themes/dark.min.css">

    <!-- Store configuration via meta tags. Agents SHOULD prefer this over
         NDesign.configure() because it keeps URLs declarative. -->
    <meta name="endpoint:api" content="https://test.nitecon.org">
    <meta name="var:userId" content="2">

    <!-- CSRF token. Read by buildHeaders() for every fetch and XHR upload. -->
    <meta name="csrf-token" content="REPLACE_WITH_SERVER_TOKEN">
  </head>
  <body>
    <!-- App markup here -->

    <!-- Runtime bundle. Loads synchronously and auto-initialises on
         DOMContentLoaded (or immediately if the DOM is already parsed). -->
    <script src="https://storage.googleapis.com/ndesign-cdn/ndesign/v0.3.0/ndesign.min.js"></script>
  </body>
</html>
```

For active development, substitute `latest` for `v0.3.0` in every URL
above. For a production deployment, always pin to a specific
`v<semver>` so your app does not silently upgrade when the CDN's
`latest/` pointer moves.

Notes:

- The CSS MUST be in `<head>` to avoid FOUC.
- The JS SHOULD be at the end of `<body>`. It is an IIFE that exposes
  `window.NDesign`.
- `NDesign.configure(...)` MAY be called before or after init.

### Hello, data binding

The simplest possible data-bound element is a single `<span>` whose text
content is the result of a JSON GET:

```html
<meta name="endpoint:api" content="https://test.nitecon.org">

<p>API version:
  <strong data-nd-bind="${api}/api/stats" data-nd-field="version">…</strong>
</p>
```

When the page loads, the runtime fetches `https://test.nitecon.org/api/stats`,
parses the JSON, reads the `version` field, and writes it into the
`<strong>` as text. No JavaScript is required from the page author.

The `${api}` token is resolved against the `<meta name="endpoint:api">`
tag at fetch time. If you write the URL out in full
(`data-nd-bind="https://test.nitecon.org/api/stats"`), the meta tag is
not required.

### Meta-tag setup at a glance

Two meta-tag namespaces drive store configuration:

| Meta name            | Purpose                                                       |
|----------------------|---------------------------------------------------------------|
| `endpoint:NAME`      | Registers a URL base under `NAME`, resolvable via `${NAME}`. |
| `var:NAME`           | Registers an initial value under `NAME`, resolvable via `${NAME}`. |
| `csrf-token`         | Read by `buildHeaders()`; sent as `X-CSRF-Token` on every fetch and upload. |
| `nd-theme`           | Registers a named theme; `data-href` points at its stylesheet. |

Pages SHOULD declare every backend the page talks to as an
`endpoint:NAME` meta tag, then use `${NAME}/...` in attribute URLs.
This keeps the URL bases in one place and lets the same HTML run
against staging or production by swapping a single meta tag.

### Where to go next

- For the page skeleton, see [Layouts](#layouts) — pick one of the three
  canonical starting layouts before writing markup.
- For the full runtime model, see [Data binding](#data-binding) — every
  attribute, lifecycle hook, and edge case lives there.
- For an alphabetical lookup of every attribute, meta tag, runtime CSS
  class, JS API method, and event, see [Reference](#reference).
