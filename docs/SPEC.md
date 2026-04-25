# ndesign — Frontend Specification

ndesign is a small runtime that turns plain HTML attributes into data-bound,
server-talking UI. It is shipped as one CSS file and one JavaScript file that
a server-rendered page loads from a CDN. Pages declare behaviour with
`data-nd-*` attributes (HTML attributes the runtime processes at init time);
no build step, package manager, or client-side router is involved. This
document is the authoritative, self-contained specification for that runtime.
It is written to be read by coding agents that must build real applications
against the bundle alone.

Every runnable example targets the public test server at
`https://test.nitecon.org`. Examples can be pasted verbatim into an HTML
file and loaded in a browser.

This document is published in two equivalent forms at the same CDN
prefix:

- **`SPEC.md`** — raw markdown, intended for agents that consume
  markdown directly (read the file once, navigate by `## Heading` text).
- **`SPEC.html`** — the same content rendered as HTML with auto-generated
  `id="..."` anchors on every heading. Use this URL when you want
  browser-clickable navigation, or when an agent-tool resolves
  `[Title](#anchor)` links by HTTP. Both URLs serve byte-equivalent
  content; the HTML form simply wraps the markdown so anchor links
  actually work.

## How to read this document

The spec is organised as one continuous document. Read it top-to-bottom the
first time, then use the table below to jump to a specific topic.

- **[Philosophy](#philosophy)** — the framework's nature, lifecycle, and
  layout posture. Read this before writing any markup.
- **[Getting started](#getting-started)** — CDN URLs, the minimal page, and
  a first taste of data binding.
- **[Layouts](#layouts)** — the three canonical page skeletons. **Agents
  MUST ask the user which layout to use** before writing markup.
- **[Data binding](#data-binding)** — the core runtime mechanics:
  `data-nd-bind`, `data-nd-action`, `data-nd-set`, `data-nd-model`,
  `data-nd-sse`, `data-nd-ws`, the unified error envelope, lifecycle, and
  pitfalls. This section is the heart of the spec.
- **[Reference](#reference)** — alphabetical lookup tables for every
  attribute, meta tag, runtime class, JS API method, and event.

Component sections appear after **Data binding** and before
**Reference**. Each component is self-contained.

### Components

Visual primitives:

- [Typography](#typography), [Buttons](#buttons), [Forms](#forms),
  [Tables](#tables), [Cards](#cards), [Panels](#panels),
  [Wells](#wells), [Alerts](#alerts), [Badges](#badges),
  [Breadcrumbs](#breadcrumbs), [Pagination](#pagination),
  [Skeletons](#skeletons), [Progress](#progress), [Avatars](#avatars),
  [Asides](#asides).

Interactive components:

- [Modals](#modals), [Toasts](#toasts), [Tooltips](#tooltips),
  [Tabs](#tabs), [Dropdowns](#dropdowns), [Navigation](#navigation),
  [Select](#select), [Theme](#theme), [Sortable](#sortable),
  [Upload](#upload).

When this document and the runtime source diverge, the source
(`js/*.js` and the compiled `dist/ndesign.min.js` + `dist/ndesign.min.css`)
wins. Open an issue or PR against the spec when you find a mismatch.

## Philosophy

ndesign is NOT a framework in the React/Vue/Svelte sense. It is a runtime
that interprets HTML attributes. Every design decision below follows from
that premise.

### Core principles

- **Vanilla HTML + vanilla CSS + one bundled JS file.** Consumers do NOT
  run a build step. They include `ndesign.min.css` and `ndesign.min.js`
  (plus an optional theme stylesheet) and write standard HTML.
- **Server-authoritative.** The server renders the initial HTML, sets
  `<meta>` tags that declare URL bases and initial values, and answers
  fetch calls with JSON. There is no client router and no client session.
- **URLs live on the element.** Every `data-nd-bind`, `data-nd-action`,
  `data-nd-ws`, etc. carries its own URL. There is **no `baseURL` config**.
  Use absolute URLs for cross-origin APIs, or relative paths for
  same-origin. DRY is achieved with `<meta name="endpoint:NAME">` and the
  `${NAME}` token (see [Store, meta tags, and ${var} interpolation](#store-meta-tags-and-var-interpolation)).
- **No reactivity for display elements.** Mutating a store var does NOT
  re-render `data-nd-bind` elements. Only `data-nd-model` (two-way form
  binding) reacts to store changes. Everything else is lazy: URLs are
  resolved at fetch/submit time.
- **CDN-friendly.** Ship the minified bundle on any CDN. Pages configure
  the runtime via inline `<script>` or — preferred — via `<meta>` tags.

### Non-goals

ndesign deliberately does NOT do:

- SPA routing.
- Virtual DOM or general reactivity beyond `data-nd-model`.
- Client-side state management frameworks (no Redux, no signals).
- Build-step JavaScript in consumer code (no JSX, no TypeScript required).
- Offline-first sync or IndexedDB adapters.
- Client-side auth or session management — CSRF is handled via a meta
  tag, everything else is cookies or headers the backend sets.

A successful ndesign app is one where every dynamic element has its URL,
render template, and success chain visible directly in the HTML, and the
JS bundle is never forked.

### No custom CSS or JavaScript

ndesign is an **HTML-only** framework from the consumer's perspective.
The bundled `ndesign.min.css` and `ndesign.min.js` provide all styling,
interactivity, data binding, and server communication a page needs.
Consumer pages SHOULD contain **zero** `<style>` blocks, **zero** inline
`style="…"` attributes, and **zero** `<script>` blocks beyond the one
that loads the runtime.

This is a deliberate constraint, not an oversight:

- If a visual treatment requires custom CSS, the framework is missing a
  component or utility class. The correct response is to extend the
  framework — not to patch around it with one-off styles.
- If an interaction requires custom JavaScript, the framework is missing
  a `data-nd-*` attribute, a success-chain action, or a store operation.
  The correct response is to extend the runtime — not to add ad-hoc
  `<script>` handlers.

Acceptable exceptions are third-party libraries that provide capabilities
outside the framework's scope:

| Exception                | Examples                                |
|--------------------------|-----------------------------------------|
| Charting / visualization | Chart.js, D3, ECharts, Plotly           |
| Animation / motion       | GSAP, Lottie, anime.js                  |
| Rich text editing        | TipTap, ProseMirror, CodeMirror         |
| Maps                     | Leaflet, Mapbox GL                      |

Even when using these libraries, the surrounding layout, typography,
cards, forms, and controls SHOULD still come from ndesign — only the
specialised rendering surface itself should be third-party.

### Layout posture — full-width by default

ndesign is designed for full-width application layouts. The `<body>`
occupies the entire viewport width out of the box, and components
(cards, tables, grids, sidebars) are expected to fill the available
space. This is the correct default for dashboards, admin panels,
control panels, data-heavy apps, and virtually all application UIs.

The framework provides an opt-in narrow container (`.nd-container`,
max-width 900 px) and a prose wrapper (`.nd-prose`) for long-form
reading content. These exist exclusively for pages whose primary content
is text: blog posts, articles, documentation, marketing copy, and
similar editorial layouts.

**Do NOT wrap application markup in `.nd-container` by default.** This
is the single most common misuse of the framework. If the page has a
sidebar, a data table, a card grid, or any kind of multi-column
application layout, it MUST be full-width. Reserve `.nd-container` for
pages where the user is primarily reading.

See [Layouts](#layouts) for the three canonical starting skeletons.

### Lifecycle and initialisation

The runtime ships as an IIFE that exposes `window.NDesign` and
auto-initialises on `DOMContentLoaded`. If the script tag is placed at
the end of `<body>` and the DOM is already parsed, init runs
synchronously.

`NDesign.init()` MAY be called manually. When called a second time, it
tears down every subsystem first, then re-scans the DOM. The order on
init is:

1. `destroyStore()` plus every `destroy*()` (only when re-initing).
2. `initStoreFromMeta()` — reads `<meta name="endpoint:*">` and
   `<meta name="var:*">` into the store. MUST run before any directive
   that resolves a `${var}` URL.
3. `initBindings(config)` — wires `data-nd-bind`.
4. `initActions(config)` — wires `data-nd-action` on forms and buttons,
   plus `data-nd-on`.
5. `initWebSockets(config)`, `initSSE(config)`.
6. `initSelects()`, `initNav()`, `initDropdowns()`, `initModals()`,
   `initToasts()`, `initTabs()`, `initTooltips()`, `initUploads()`,
   `initSortable()`.
7. `initSetTriggers(config)` — wires click handlers for standalone
   `data-nd-set` elements.
8. `initModel(config)` — wires two-way `data-nd-model` inputs.
9. A single delegated `click` listener is attached to `document` for
   theme toggling, toast triggers, sidebar toggling, sortable sidebar
   nav active state, `data-nd-toast`, and `data-nd-bind-trigger`.

Agents calling `NDesign.init()` manually after injecting new markup
SHOULD be aware that the teardown step removes listeners on every
tracked element in the document, not just new ones. Full re-init is
safe but heavy; prefer it only after wholesale DOM replacement.

For dynamic markup that adds children to a known-live container — for
example a `data-nd-sortable` list whose rows arrive via a template
refresh — the sortable subsystem attaches a `MutationObserver` per
container at init and auto-wires new children without a full re-init.

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

## Layouts

ndesign ships **three canonical starting layouts**. Every new page begins
from one of them. Picking the wrong skeleton later means rewriting the
entire shell, so **agents MUST ask the user which of the three to start
from before writing a single line of HTML.** Do not guess from the task
description, do not default silently, do not invent a fourth. Ask.

| ID              | Best for                                                       | Key markers                                              |
|-----------------|----------------------------------------------------------------|----------------------------------------------------------|
| `control-panel` | Dashboards, admin UIs, data-heavy internal tools with a sidebar. | `.app-layout` + `.sidebar` + `.app-body` + top `<header>` |
| `app-shell`     | Multi-page SaaS apps with a fixed sidebar and per-page content. | `.sidebar.sidebar-fixed` + `.app-main`                   |
| `blog`          | Editorial content — posts, articles, docs, marketing copy.     | Top `<nav>` + `.nd-container` + `.nd-panel` + `.nd-prose` |

The required prompt to the user, before writing any markup:

> Which of the three starting layouts should this page use —
> **control-panel** (sidebar + scrollable content for a dashboard),
> **app-shell** (fixed sidebar for a multi-page SaaS app), or
> **blog** (centered prose panel for an article)?

Once the user picks, copy the matching skeleton verbatim and build
inside it. Do NOT mix layouts (e.g. do not add `.nd-container` to
`control-panel`, do not add `.sidebar` to `blog`). If the user's need
truly does not fit one of the three, flag it and discuss — do not
silently invent a hybrid.

All three skeletons share the same `<head>`. Only the `<body>` varies.

**Shared `<head>` (use for all three layouts):**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page title</title>
    <link rel="stylesheet"
          href="https://storage.googleapis.com/ndesign-cdn/ndesign/latest/ndesign.min.css">
    <link rel="stylesheet"
          href="https://storage.googleapis.com/ndesign-cdn/ndesign/latest/themes/light.min.css"
          class="theme" data-theme="light">
    <meta name="nd-theme" content="light"
          data-href="https://storage.googleapis.com/ndesign-cdn/ndesign/latest/themes/light.min.css">
    <meta name="nd-theme" content="dark"
          data-href="https://storage.googleapis.com/ndesign-cdn/ndesign/latest/themes/dark.min.css">
    <meta name="endpoint:api" content="https://test.nitecon.org">
  </head>
  <!-- body goes here — pick ONE of the three skeletons below -->
  <script src="https://storage.googleapis.com/ndesign-cdn/ndesign/latest/ndesign.min.js"></script>
</html>
```

For production, replace `latest` with a pinned `v<semver>` (see
[Getting started](#getting-started)).

### control-panel

Use for admin UIs, dashboards, operations consoles — any data-heavy
application with persistent left navigation, a top header bar, and a
scrollable content area.

Reference demo: `demo/control-panel.html`.

```html
<body class="app-page">
  <div class="app-layout nd-h-screen nd-overflow-hidden">

    <!-- Sidebar -->
    <nav class="sidebar" id="app-sidebar">
      <span class="nd-nav-brand">AppName</span>
      <p class="nd-nav-section">Main</p>
      <ul class="nd-nav-menu">
        <li><a href="#" class="nd-active">Dashboard</a></li>
        <li><a href="#">Users</a></li>
      </ul>
    </nav>

    <!-- Main column: header + scrollable content -->
    <div class="app-body">
      <header>
        <div class="app-header-left">
          <button class="hamburger"
                  data-nd-toggle="sidebar"
                  aria-label="Toggle navigation">&#9776;</button>
          <h1 class="app-header-title">Dashboard</h1>
        </div>
        <div class="app-header-right">
          <button class="nd-btn-ghost nd-btn-sm" data-nd-theme-toggle>Toggle Theme</button>
        </div>
      </header>

      <main class="app-content">
        <!-- Page content. Use .nd-row / .nd-col-* for grids.
             Do NOT wrap in .nd-container. -->
      </main>
    </div>

  </div>
</body>
```

### app-shell

Use for multi-page SaaS apps where the sidebar is always visible and
the page's primary content sits in a single main column. Simpler than
`control-panel` (no top header bar reserved as a structural region).

Reference demo: `demo/app-shell.html`.

```html
<body class="app-page">

  <!-- Fixed sidebar -->
  <nav class="sidebar sidebar-fixed">
    <span class="nd-nav-brand">AppName</span>
    <p class="nd-nav-section">Main</p>
    <ul class="nd-nav-menu">
      <li><a href="#" class="nd-active">Dashboard</a></li>
      <li><a href="#">Reports</a></li>
    </ul>
  </nav>

  <!-- Overlay for mobile sidebar toggle -->
  <div class="nd-nav-overlay"></div>

  <!-- Main content area — .app-main reserves the 16 rem sidebar gutter -->
  <div class="app-main">
    <!-- Optional top bar -->
    <nav class="nd-relative nd-mb-lg">
      <button class="nd-nav-toggle"
              aria-label="Toggle sidebar"
              data-nd-toggle="sidebar">&#9776;</button>
      <span class="nd-nav-brand">Page Title</span>
      <div class="nd-nav-end">
        <button class="nd-btn-ghost nd-btn-sm" data-nd-theme-toggle>Theme</button>
      </div>
    </nav>

    <!-- Page content. Do NOT wrap in .nd-container. -->
  </div>

</body>
```

### blog

Use for blog posts, articles, documentation, marketing copy, and
similar long-form reading. This is the only layout that uses
`.nd-container` and `.nd-prose`.

Reference demo: `demo/blog-post.html`.

```html
<body class="app-page">

  <!-- Top nav (flush to viewport edges courtesy of .app-page) -->
  <nav>
    <a href="/" class="nd-nav-brand">Brand <span class="nd-nav-brand-sub">Journal</span></a>
    <ul class="nd-nav-menu">
      <li><a href="#" class="nd-active">Home</a></li>
      <li><a href="#">Archive</a></li>
    </ul>
    <div class="nd-nav-end">
      <button class="nd-btn-secondary nd-btn-sm" data-nd-theme-toggle>Theme</button>
      <button class="nd-btn-primary nd-btn-sm">Subscribe</button>
    </div>
  </nav>

  <!-- Centered 900 px column; the article sits on a floating .nd-panel -->
  <main class="nd-container nd-mt-lg nd-mb-2xl">
    <div class="nd-panel nd-shadow-lg">
      <article class="nd-prose nd-mx-auto">
        <h1>Article title</h1>
        <p class="nd-text-lead">Lead paragraph.</p>
        <p>Long-form body text…</p>
      </article>
    </div>
  </main>

</body>
```

### Layout misuse

The framework's full-width default exists for a reason. Common
misuses, all of which MUST be avoided:

- **Do NOT wrap `control-panel` or `app-shell` content in
  `.nd-container`.** The narrow 900 px column is for prose only. Apply
  it to a dashboard and you waste horizontal space and break the grid.
- **Do NOT mix layouts.** Don't bolt a `.sidebar` onto a `blog`
  skeleton, don't drop a `.nd-prose` `<article>` into the `app-content`
  region of a `control-panel`, don't add `.app-layout` to a `blog`.
  Each skeleton's CSS assumes the structural elements it expects.
- **Do NOT invent a fourth canonical layout.** If none of the three
  fit, flag the case and discuss with the user before improvising. The
  three layouts cover dashboard, SaaS app, and editorial — most pages
  fit one of them.
- **Do NOT add custom `<style>` blocks to "tweak" a layout.** The
  framework is HTML-only (see [Philosophy](#philosophy)). If a layout
  visibly needs adjustment, the framework is missing a utility class
  or modifier and the fix belongs in the framework, not the page.

## Data binding

This section explains the entire runtime mechanics of ndesign in one
place. Every other component in the spec is built on the primitives
documented here.

### How it works

The runtime model is small enough to hold in your head:

1. The server renders an HTML page that carries `data-nd-*` attributes
   on the elements it wants to be dynamic.
2. On `DOMContentLoaded` (or immediately, if the script is at the end
   of `<body>`), the runtime scans the DOM and wires fetch / submit /
   stream behaviours per attribute.
3. URLs live on the elements themselves. Each `data-nd-bind`,
   `data-nd-action`, `data-nd-sse`, `data-nd-ws`, etc. carries its own
   URL. The `${var}` token system resolves URLs against `<meta>` tags
   at fetch time — there is no `baseURL` config.
4. There is no virtual DOM. Templates are real `<template>` elements
   cloned and interpolated into the live DOM.
5. There is no client router. Navigation is plain `<a href>` and
   `window.location`.
6. **There is no reactivity for display elements.** Writing to the
   store does NOT refresh `data-nd-bind` elements. The only reactive
   primitive is `data-nd-model`, which re-syncs a form input when the
   same top-level store key is written. Everything else is explicit:
   to refresh a bound element after a store write, dispatch
   `nd:refresh` on it (typically via `data-nd-success="refresh:#id"`).

The remainder of this section covers each subsystem in turn.

### Lifecycle and initialization

The runtime auto-initialises on `DOMContentLoaded`. If the script is
placed at the end of `<body>` and the DOM is already parsed, init runs
synchronously.

`NDesign.init()` MAY be called manually. When called a second time, it
tears down every subsystem first, then re-scans the DOM. The order on
init is:

1. `destroyStore()` plus every `destroy*()` (only when re-initing).
2. `initStoreFromMeta()` — reads `<meta name="endpoint:*">` and
   `<meta name="var:*">` into the store. MUST run before any directive
   that resolves a `${var}` URL.
3. `initBindings(config)` — wires `data-nd-bind`.
4. `initActions(config)` — wires `data-nd-action` on forms and
   buttons, plus `data-nd-on`.
5. `initWebSockets(config)`, `initSSE(config)`.
6. `initSelects()`, `initNav()`, `initDropdowns()`, `initModals()`,
   `initToasts()`, `initTabs()`, `initTooltips()`, `initUploads()`,
   `initSortable()`.
7. `initSetTriggers(config)` — wires click handlers for standalone
   `data-nd-set` elements.
8. `initModel(config)` — wires two-way `data-nd-model` inputs.
9. A single delegated `click` listener is attached to `document` for
   theme toggling, toast triggers, sidebar toggling, sortable sidebar
   nav active state, `data-nd-toast`, and `data-nd-bind-trigger`.

A full `NDesign.init()` is safe but heavy — teardown removes listeners
on every tracked element, not just new ones. Prefer it only after
wholesale DOM replacement.

For dynamic markup that adds children to a known-live container — for
example a `data-nd-sortable` list whose rows arrive via a template
refresh — the sortable subsystem attaches a `MutationObserver` per
container at init and auto-wires new children without a full re-init.

### Configuration

`NDesign.configure(userConfig)` merges runtime configuration. It MAY
be called before OR after init.

```javascript
NDesign.configure({
  headers: { 'X-Client': 'my-app' },              // merged into default headers
  onRequest:  (url, options) => {},                // before every fetch
  onResponse: (url, response) => {},               // after every fetch
  onError:    (url, envelope, err) => {},          // on fetch/ws/sse failure
  onRender:   (element, data) => {},               // after a bind/sse/ws render
  timeout: 15000,                                  // default fetch timeout (ms)
  wsProtocols: ['ndesign.v1'],                     // WebSocket sub-protocols
  wsTokenProvider: () => localStorage.token,       // appends ?token=... to WS URL
});
```

| Key               | Type                                      | Default                            | Notes |
|-------------------|-------------------------------------------|------------------------------------|-------|
| `headers`         | `Record<string,string>`                   | `{ 'X-Requested-With': 'NDesign' }` | Merged, not replaced. |
| `onRequest`       | `(url, options) => void` \| `null`        | `null`                             | Mutating `options` affects the request. |
| `onResponse`      | `(url, response) => void` \| `null`       | `null`                             | Response has not been read yet. |
| `onError`         | `(url, envelope, err) => void` \| `null`  | *default toast handler*            | Fires for bind, action, SSE, and WS errors. |
| `onRender`        | `(el, data) => void` \| `null`            | `null`                             | Fires after bind / sse / ws renders. |
| `timeout`         | `number` (ms)                             | `15000`                            | Default fetch timeout; per-element `data-nd-timeout` overrides. |
| `wsProtocols`     | `string[]`                                | `[]`                               | Passed to `new WebSocket(url, protocols)` if non-empty. |
| `wsTokenProvider` | `() => string` \| `null`                  | `null`                             | If set, WS URLs get `?token=<value>` appended. |

`onError` takes THREE arguments — `(url, envelope, err)`. The
`envelope` is the unified error envelope (see
[Error envelope](#error-envelope)), always shaped
`{ errors: { error: "..." } }`. The `err` argument is the original
thrown `Error` for fetch/ws/sse failures and MAY be `null` when the
envelope was synthesised from a non-2xx response.

The default `onError` calls `NDesign.toast(message, 'error')` using
`envelope.errors.error`, `envelope.errors._form`, or the literal
`"Something went wrong"`. Apps opt out with
`NDesign.configure({ onError: null })` or replace it with a custom
handler.

To distinguish timeout from network failure inside a custom
`onError`: `err.name === 'AbortError'` is a timeout (from
`fetchWithTimeout()`); `err instanceof TypeError` is a
network/CORS/DNS failure (thrown directly by `fetch()`).

#### Default headers applied by `buildHeaders()`

Every fetch made by bind/action routes through
`buildHeaders(config.headers)`, which produces:

```javascript
{
  'Content-Type': 'application/json',
  'X-Requested-With': 'NDesign',
  // ...any user-configured headers
  'X-CSRF-Token': '<meta name="csrf-token" content>, if present',
}
```

`data-nd-bind` (GET) deletes `Content-Type` from the header set before
sending. `data-nd-upload` does NOT use `buildHeaders`; it sets only
`X-Requested-With` and `X-CSRF-Token` manually on the XHR (multipart
body requires the browser to set its own `Content-Type` with the
boundary).

### Store, meta tags, and ${var} interpolation

#### Meta conventions

At init, `initStoreFromMeta()` scans every `<meta name>` tag and
populates two maps:

- `<meta name="endpoint:NAME" content="URL">` → `endpoints` map.
- `<meta name="var:NAME" content="VALUE">` → `vars` map.

All content is stored as a string. Numeric coercion happens at
consumption time (e.g. when writing into a `type="number"` input or
inside `data-nd-set` arithmetic).

```html
<meta name="endpoint:api"  content="https://test.nitecon.org">
<meta name="endpoint:ws"   content="wss://test.nitecon.org">
<meta name="var:userId"    content="2">
<meta name="var:pageSize"  content="25">
```

#### `${var}` grammar

The token grammar is a single regex:

```
\$\{([a-zA-Z_][\w.\-]*)\}
```

Only the braced form is recognised. **There is no `$var`.** Dot paths
are permitted on the variable side (`${user.first_name}`). Endpoint
names MUST be flat — endpoint lookup ignores dots. Resolution order
for each token is:

1. `getVar(name)` — vars take precedence.
2. `endpoints.get(name)` — exact key match only.
3. Unknown token: substitutes the empty string and emits
   `console.warn('[ndesign] unresolved var: ${<name>}')` once per name
   per `resolveVars()` call.

If a var resolves to a non-primitive (e.g. the user object itself),
the substitution is `String(obj)`, which yields `[object Object]`.
Use dot paths for scalar fields: `${user.id}`, never `${user}`.

A `null` value substitutes the empty string. An `undefined` (missing)
value falls through to endpoint lookup.

#### Where `${var}` substitution applies

`resolveVars()` is invoked on the following attribute values:

- `data-nd-bind` — the URL.
- `data-nd-action` — the URL portion (after the method).
- `data-nd-upload` — the URL portion.
- `data-nd-sse` — the URL.
- `data-nd-ws` — the URL.
- `data-nd-sortable` — the URL portion of the optional `"METHOD URL"`.
- `data-nd-body` — the full JSON template, before `JSON.parse`.
- `data-nd-set` — only inside `${ref}` tokens in the RHS (see
  [data-nd-set](#data-nd-set--write-to-the-store)).

`${var}` substitution is NOT performed in:

- Element text nodes or other attributes.
- `data-nd-confirm` values (the message is used verbatim).
- `data-nd-params` values (they are appended as-is).
- Template bodies — templates use `{{field}}` (see
  [Templates and {{field}} interpolation](#templates-and-field-interpolation)).

#### Store API

The public store is exposed as `NDesign.store` plus several top-level
aliases. `NDesign.store.set` is a thin façade over the raw `vars`
Map — it does NOT fire `nd:var-change`. `NDesign.storeSet` (alias of
the module-level `setVar`) DOES fire `nd:var-change`. Agents that need
`data-nd-model` inputs to re-sync MUST use `NDesign.storeSet`.

| Call                                              | Path support | Fires `nd:var-change`? |
|---------------------------------------------------|--------------|------------------------|
| `NDesign.store.get('k')`                          | top-level    | n/a                    |
| `NDesign.store.set('k', v)`                       | top-level    | **no**                 |
| `NDesign.store.has/delete/clear`                  | top-level    | no                     |
| `NDesign.storeGet('a.b.c')`                       | dot-path     | n/a                    |
| `NDesign.storeSet('a.b.c', v)`                    | dot-path     | **yes**                |
| `NDesign.endpoint('api')`                         | flat         | n/a                    |
| `NDesign.resolveVars(str)`                        | n/a          | n/a                    |

`nd:var-change` is a `CustomEvent` dispatched on `document` with
`detail = { path, topKey, value }`. Application code SHOULD NOT listen
for it as a general reactivity primitive — it is scoped conceptually
to the `data-nd-model` subsystem.

### Templates and {{field}} interpolation

Templates are `<template>` elements referenced by `id`. Rendering
clones the template's content and walks all text nodes and attributes,
replacing `{{path}}` tokens.

#### Token grammar

```
\{\{(\s*[\w.]+\s*)\}\}
```

- The path is `\w.` only — no pipes, no filters, no defaults. **There
  is NO `{{field|default}}` syntax.**
- `getByPath(data, path)` resolves the value.
- Missing values yield the empty string in text nodes and
  `escapeHTML(undefined) === ''` in attribute values.
- Text-node substitutions use `textContent` — the browser handles
  escaping.
- Attribute substitutions use `escapeHTML()` before assignment.

Only the row object is visible inside a template render. `${var}`
store interpolation does NOT apply inside templates.

#### Conditional `data-nd-if`

An element inside a template carrying `data-nd-if="FIELD"` is REMOVED
when the named field is falsy.

```html
<template id="user-row">
  <tr>
    <td>{{name}}</td>
    <td data-nd-if="active">
      <span class="nd-badge nd-badge-success">Active</span>
    </td>
  </tr>
</template>
```

#### Programmatic API

| Function                                              | Purpose                                    |
|-------------------------------------------------------|--------------------------------------------|
| `NDesign.render(container, templateId, data, mode?)`  | Render an array or object into a container. |
| `NDesign.renderOne(tpl, data)`                        | Clone and interpolate a template for one item. |
| `NDesign.interpolate(text, data)`                     | Interpolate a standalone string.           |

`mode` defaults to `'replace'`. See
[Render mode](#render-mode-and-data-nd-max).

### data-nd-bind — fetch and render

`data-nd-bind` fetches JSON from a URL and renders it into the
element. It is the workhorse of the framework: scalar fields, template
rendering of arrays or objects, polling, params, append/prepend modes,
empty/loading placeholders, deferred fetching, store writes via
chained `data-nd-set`, select population, and a templateless callback
mode are all supported.

#### Attribute — `data-nd-bind="URL"`

The URL MAY contain `${var}` tokens. The fetch method is always `GET`.
The request uses `buildHeaders(config.headers)` minus `Content-Type`.

Two elements with identical resolved URLs in the same tick share a
single fetch (in-flight dedup via `pendingRequests`). Re-init clears
the in-flight cache.

#### Scalar field binding — `data-nd-field="PATH"`

When `data-nd-template` is absent and `data-nd-field` is present, the
bound element's `textContent` is set to
`String(getByPath(data, PATH))`, or `''` if null/undefined.

```html
<strong data-nd-bind="${api}/api/stats"
        data-nd-field="version"></strong>
```

#### Attribute write — `data-nd-attr="NAME"`

When combined with `data-nd-field`, the resolved value is written to
the named DOM attribute instead of `textContent`. A `null` /
`undefined` value REMOVES the attribute.

```html
<img data-nd-bind="${api}/api/users/${userId}"
     data-nd-field="avatar_url"
     data-nd-attr="src"
     alt="">
```

#### Template binding — `data-nd-template="ID"`

Renders via a `<template id="ID">`. When the response is an array, one
clone is produced per item; for an object, one clone total.
Interpolation uses `{{field}}`.

```html
<tbody id="user-table"
       data-nd-bind="${api}/api/users"
       data-nd-template="user-row">
  <template id="user-row">
    <tr>
      <td>{{id}}</td>
      <td>{{name}}</td>
      <td>{{email}}</td>
    </tr>
  </template>
</tbody>
```

#### Envelope unwrap — `data-nd-select="PATH"`

When the backend returns `{ data: [...], meta: {...} }`, set
`data-nd-select` to pull the array out before rendering. The empty-state
template (`data-nd-empty`) also honours this path.

```html
<tbody data-nd-bind="${api}/api/users/paginated"
       data-nd-select="data"
       data-nd-params="page=1&per_page=5"
       data-nd-template="u-row">
  <template id="u-row"><tr><td>{{name}}</td></tr></template>
  <template data-nd-loading>
    <tr><td><span class="nd-skeleton"></span></td></tr>
  </template>
  <template data-nd-empty>
    <tr><td>No users found.</td></tr>
  </template>
</tbody>
```

#### Render mode and `data-nd-max`

`data-nd-mode` controls how template renders are inserted:

| Mode       | Behaviour                                                    |
|------------|--------------------------------------------------------------|
| `replace`  | (default) Removes all non-`<template>` children, then appends. |
| `append`   | Appends after existing children.                              |
| `prepend`  | Inserts before the first non-template child.                  |

`data-nd-max="N"`: after each render, if there are more than N
rendered (non-template) children, drop the oldest until the count is
N. "Oldest" is:

- the first child when mode is `append` or `replace`;
- the LAST child when mode is `prepend` (since new items arrive at the top).

#### Loading, empty, and error templates

Three direct-descendant `<template>` markers cover the bound
element's lifecycle:

- `<template data-nd-loading>` — a clone is inserted into the
  container while the fetch is in flight, wrapped in an element with
  `data-nd-loading-active`. It is removed before the render. The
  container also carries `nd-loading` while the fetch is active.
- `<template data-nd-empty>` — fires only when the rendered data
  (after `data-nd-select`) is an array of length 0. All non-template
  children are removed first, then the empty clone is appended.
- `<template data-nd-error>` — when a bind fetch fails, the
  unified error envelope (see [Error envelope](#error-envelope)) is
  synthesised and the template's contents are cloned into the
  container, replacing all non-template children. `.nd-error` is also
  added to the container. If no error template is present,
  `config.onError(url, envelope, err)` is invoked instead (the
  default handler toasts the global message).

These templates are matched by attribute, not `id` — they MUST be
direct descendants of the bound element and MUST NOT be referenced by
`id`.

#### Polling — `data-nd-refresh="MS"`

When `data-nd-refresh` is a positive integer, a `setInterval` is set
up and the element refetches every MS milliseconds. A
`MutationObserver` tears down the interval if the element is removed
from the DOM.

```html
<h2 data-nd-bind="${api}/api/stats/live"
    data-nd-field="cpu_usage"
    data-nd-refresh="2000">—</h2>
```

#### Deferred fetch — `data-nd-defer`

A boolean attribute on a `data-nd-bind` element. When present,
`initBindings` adds an `nd:refresh` listener but skips the initial
fetch. The element fetches on the first externally dispatched
`nd:refresh`:

```html
<div id="user-details"
     data-nd-bind="${api}/api/users/${selectedId}"
     data-nd-template="user-tpl"
     data-nd-defer>
  <template id="user-tpl"><h2>{{name}}</h2></template>
</div>

<button data-nd-set="selectedId=1"
        data-nd-success="refresh:#user-details">Show user 1</button>
```

#### Triggers — `data-nd-bind-trigger` and `data-nd-bind-mode`

The delegated click handler processes `[data-nd-bind-trigger="SELECTOR"]`.
On click:

1. `preventDefault()`.
2. If the trigger has its own `data-nd-params`, that value is copied
   onto the target element. Otherwise, if the trigger is an `<a>` with
   an `href`, the query string of the href is copied onto
   `data-nd-params` of the target and `aria-current="page"` is managed
   across sibling triggers (pagination active state — the walker finds
   the nearest ancestor holding at least two triggers).
3. If the trigger has `data-nd-bind-mode`, it is copied to the
   target's `data-nd-mode` (used for "Load more" patterns).
4. `target.dispatchEvent(new CustomEvent('nd:refresh'))`.

```html
<tbody id="feed-list"
       data-nd-bind="${api}/api/feed"
       data-nd-params="offset=0&limit=10"
       data-nd-template="feed-item"
       data-nd-mode="append"
       data-nd-max="100">
  <template id="feed-item">
    <tr><td>{{id}}</td><td>{{title}}</td></tr>
  </template>
</tbody>

<button class="nd-btn-secondary"
        data-nd-bind-trigger="#feed-list"
        data-nd-params="offset=10&limit=10"
        data-nd-bind-mode="append">Load more</button>
```

#### Select population — `data-nd-options="VALUE:LABEL"`

A `<select>` carrying both `data-nd-bind` and `data-nd-options` turns
the fetched JSON array into `<option>` children. The attribute value
is a compact dot-path shorthand into each array item.

```html
<select data-nd-bind="${api}/api/training/runs"
        data-nd-options="id:name">
  <option value="">Choose a run…</option>
</select>
```

| Attribute form                  | Items are    | Behaviour                                      |
|---------------------------------|--------------|------------------------------------------------|
| `data-nd-options`               | primitives   | item is used as BOTH `value` and label text.   |
| `data-nd-options="name"`        | objects      | `value` and label both read from `item.name`.  |
| `data-nd-options="id:name"`     | objects      | `value` from `item.id`, label from `item.name`. |
| `data-nd-options=":name"` / `"id:"` | objects  | blank side mirrors the other.                  |

Rules:

- **Static `<option>` children are preserved across fetches.** A
  leading `<option value="">Choose…</option>` placeholder survives
  refetches.
- Runtime-generated options carry an internal `data-nd-generated`
  marker and are the only ones removed when the element refetches.
- **Envelope unwrap** via `data-nd-select` applies — the array is
  extracted from the envelope before option generation.
- If the `<select>` was upgraded by the custom-dropdown module
  (`js/select.js`), its visual wrapper is rebuilt automatically after
  options are populated, so the themed UI stays in sync with the
  native element.
- `config.onRender(el, data)` still fires after the options are in
  place.
- `data-nd-options` takes precedence over the templateless callback
  branch below.

#### Templateless binding (raw JSON callback)

When a `data-nd-bind` element has **no** `data-nd-template`, **no**
`data-nd-field`, and **no** `data-nd-options`, the fetched payload is
passed to `config.onRender(el, data)` as a pure fetch-and-callback
hook.

Text-content rules for this branch:

| Payload type   | Effect on `textContent`                |
|----------------|----------------------------------------|
| `string`       | Written to `textContent` as-is.        |
| Anything else  | `textContent` is NOT touched.          |

This lets `<span data-nd-bind="/api/version"></span>` still display
the version string intuitively, while object/array payloads stay out
of the DOM and flow only to `onRender`.

The recommended pattern pairs this with `data-nd-defer` so the
callback is registered before the fetch fires:

```html
<div id="run-list"
     data-nd-bind="${api}/api/training/runs"
     data-nd-defer hidden></div>
<script>
  NDesign.configure({
    onRender(el, data) {
      if (el.id === 'run-list') populateCustomUI(data);
    }
  });
  document.getElementById('run-list')
    .dispatchEvent(new CustomEvent('nd:refresh'));
</script>
```

For the common "fill a `<select>` from an API" case, prefer
`data-nd-options` over a custom `onRender` callback.

> Behaviour change in v0.3.0: prior releases wrote
> `JSON.stringify(data)` into `textContent` for non-string payloads
> on this branch, which could dump JSON blobs into hidden containers.
> The textless behaviour documented above is now the default.
> Templated binding, scalar binding, and attribute binding are
> unchanged.

#### Edge cases

- Two bound elements with identical URLs share an in-flight request.
- The polling observer is global and re-created on init.
- Re-init clears the in-flight request cache.
- `data-nd-set` on a bound element is applied after a successful
  render; the FULL response is passed, not the `data-nd-select`
  sub-field.

### data-nd-action — forms and button actions

`data-nd-action` submits data to a REST endpoint and maps the
response (success or validation errors) back into the UI. It works on
both `<form>` and non-form elements (buttons and links).

#### Attribute grammar

```
data-nd-action = METHOD ' ' URL
```

Examples: `"POST /api/users"`, `"DELETE ${api}/api/users/${userId}"`,
`"PATCH https://test.nitecon.org/api/users/42"`. If there is no space,
the method defaults to `POST`. The URL is `${var}`-resolved at submit
time.

#### Form vs button behaviour

| Behaviour                              | `<form data-nd-action>`               | `[data-nd-action]:not(form)` |
|----------------------------------------|----------------------------------------|------------------------------|
| Event intercepted                      | `submit`                               | `click`                      |
| Body sent                              | JSON-serialised form inputs            | None, or `data-nd-body`      |
| Field validation error display         | Yes (`.nd-error`, `.nd-form-error`)    | No                           |
| `data-nd-feedback` rendering           | Yes                                    | Yes                          |
| Disables while in flight               | Submit button                           | The clicked element           |
| `data-nd-success`                      | Yes                                    | Yes                          |
| `data-nd-set` after success            | Yes                                    | Yes                          |
| `data-nd-confirm` prompt               | Yes                                    | Yes                          |

#### Button body template — `data-nd-body`

Only valid on non-form `[data-nd-action]` elements. The attribute is a
JSON template string that is `${var}`-interpolated first, then
`JSON.parse`d. On a JSON parse failure, the message
`"data-nd-body: invalid JSON after interpolation"` is written to the
feedback element (if any), the action is aborted, and the element is
re-enabled. No fetch is performed.

```html
<button data-nd-action="POST ${api}/api/orders"
        data-nd-body='{"sku":"${sku}","qty":${qty}}'
        data-nd-feedback="order-msg">Place order</button>
```

**Forms MUST NOT use `data-nd-body`.** Their body is always the
JSON-serialised form. If both are present on a form, `data-nd-body`
is ignored.

#### Feedback element — `data-nd-feedback="ID"` and the auto-slot

Every failed action produces a visible global error message adjacent
to the triggering element. The runtime guarantees this via two
mechanisms.

**1. Declared feedback — `data-nd-feedback="ID"`.** If the attribute
is present, the element with that ID is used as the feedback slot:

- empty / hidden while the request is in flight (cleared up front);
- `nd-alert nd-alert-success` with `responseData.message || 'Success'`
  on 2xx;
- `nd-alert nd-alert-error` with the global message from the unified
  envelope on failure.

**2. Auto-feedback slot — `.nd-form-feedback-auto`.** When no
`data-nd-feedback` is declared, on the FIRST error the runtime
auto-creates a feedback element and inserts it adjacent to the
triggering control:

- **Forms**: the slot is inserted immediately BEFORE the submit
  button (or, if the submit button is nested inside wrappers like
  `<menu>` or `<div class="nd-card-footer">`, before its nearest
  ancestor that is a direct child of the `<form>`).
- **Buttons**: the slot is inserted as the next sibling AFTER the
  button.
- **Class**: `nd-alert nd-form-feedback-auto` plus `nd-alert-error` /
  `nd-alert-success` per message type.
  `aria-live="assertive"`, `aria-atomic="true"`. Initially hidden.
- **Reuse**: the element is cached on `form._ndAutoFeedbackEl` /
  `btn._ndAutoFeedbackEl` and reused across subsequent submits — never
  duplicated. `clearFormErrors(form)` (called at the start of each
  submit) clears and hides it.
- **Success**: the auto-slot is populated with the success message
  ONLY if it already exists from a prior error; it auto-hides after
  ~3 seconds. The runtime never auto-creates a slot purely to display
  a success message.

**Global message priority.** The message written into the feedback
slot is chosen in this order:

1. `envelope.errors.error` (canonical) or `envelope.errors._form`
   (legacy alias) — written verbatim.
2. If exactly ONE field error is present:
   `"Please correct the highlighted field: <LABEL>"`. `<LABEL>` is
   resolved by walking from the input (`[name="<field>"]`) to its
   matching `<label for="<input-id>">` and using that label's trimmed
   `textContent`. If no `<label for>` is found, `<LABEL>` falls back
   to the field's `name` attribute.
3. If TWO OR MORE field errors are present:
   `"Please correct the N highlighted fields below."`
4. Fallback: `"Submit failed. Please try again."`

Forms ALSO map field-level errors inline to `.nd-form-error` siblings.
Button actions only show the global message — there are no fields to
highlight.

**Expected label markup** for the single-field synthesised message:

```html
<div class="nd-form-group">
  <label for="user-email">Email address</label>
  <input type="email" id="user-email" name="email">
  <div class="nd-form-error"></div>
</div>
```

With this markup and a server response of
`{"errors":{"email":"already taken"}}`, the auto-feedback slot shows
`"Please correct the highlighted field: Email address"` and the
`.nd-form-error` sibling of the input shows `"already taken"`.

#### Confirmation — `data-nd-confirm`

`data-nd-confirm` has two forms, dispatched by the leading character:

1. **Plain text** — `data-nd-confirm="Delete user James Miller?"` →
   the runtime calls `window.confirm(TEXT)` synchronously. A falsy
   result aborts the action. This is the native browser dialog.
2. **Dialog selector** — `data-nd-confirm="#confirm-delete"` → the
   runtime calls `confirmDialog('#confirm-delete')` and awaits the
   promise. The action proceeds only if the user clicks a button with
   `[data-nd-confirm-accept]`; any dismiss path
   (`.nd-modal-close`, `[data-nd-dismiss]`, backdrop, Escape, native
   close) aborts.

Both forms work identically for `<form data-nd-action>` and
`[data-nd-action]:not(form)`.

```html
<!-- Native browser confirm -->
<button class="nd-btn-danger"
        data-nd-action="DELETE ${api}/api/users/3"
        data-nd-confirm="Delete user James Miller?">Delete</button>

<!-- Custom <dialog> confirm -->
<button class="nd-btn-danger"
        data-nd-action="DELETE ${api}/api/users/3"
        data-nd-confirm="#confirm-delete">Delete</button>

<dialog id="confirm-delete" class="nd-modal">
  <p>Delete this user? This cannot be undone.</p>
  <menu>
    <button type="button" data-nd-dismiss>Cancel</button>
    <button type="button" class="nd-btn-danger"
            data-nd-confirm-accept>Delete</button>
  </menu>
</dialog>
```

#### Success chain — `data-nd-success="action[,action]*"`

After a 2xx, the value is split on commas and each action is
processed in order.

| Action              | Valid on    | Behaviour                                                                       |
|---------------------|-------------|---------------------------------------------------------------------------------|
| `reset`             | forms only  | `form.reset()`.                                                                 |
| `reload`            | any         | `window.location.reload()`. Stops the chain.                                    |
| `redirect:URL`      | any         | `window.location.href = URL`. Stops the chain.                                  |
| `refresh:SELECTOR`  | any         | Dispatches `nd:refresh` on every matching element.                             |
| `emit:EVENT`        | any         | Dispatches a bubbling `CustomEvent(EVENT, {detail: responseData})` on the element. |
| `close-modal`       | any         | Closes the nearest ancestor `<dialog>` of the triggering element (no-op if none). |

Actions not in this list are silently ignored (no warning).
`close-modal` composes with the rest of the chain — for example
`"close-modal,refresh:#user-table"` closes the enclosing dialog then
refreshes a table outside it.

#### Form serialisation rules

Inputs are iterated via `form.elements`. For each named, enabled,
non-file, non-submit, non-button element:

| Input                        | Serialised as                                       |
|------------------------------|-----------------------------------------------------|
| `type="checkbox"`            | `boolean` (`el.checked`)                            |
| `type="radio"`               | the value of the selected radio; unchecked skipped  |
| `<select multiple>`          | `Array<string>` of selected `value`s                |
| `type="number"` / `"range"`  | `Number`, or `null` if empty                        |
| everything else              | `string`                                            |

Dot-notation names produce nested objects:
`name="address.city"` → `{ address: { city: ... } }`.

File inputs are skipped. Use `data-nd-upload` (see [Upload](#upload))
instead.

#### Per-element timeout — `data-nd-timeout="MS"`

Every form and button action is submitted via `fetchWithTimeout()`
with an `AbortController`. The timeout resolves to, in order:

1. The `data-nd-timeout` attribute on the element, parsed as an
   integer.
2. `config.timeout` (default `15000`).

When the timer fires, the fetch rejects with an `AbortError` and the
synthesised envelope carries `errors.error: "Request timed out"`.

```html
<!-- Force the timeout path for demo/testing purposes -->
<button data-nd-action="GET ${api}/api/stats"
        data-nd-timeout="50"
        class="nd-btn-primary">Force timeout</button>
```

A 50 ms timeout against any real endpoint reliably hits the
`AbortError` branch, which is the easiest way to exercise the timeout
envelope without taking the network down.

#### Escape hatch — `data-nd-on`

`data-nd-on="EVENT:HANDLER"` binds an event listener that looks up
`window[HANDLER]` and calls `HANDLER(event, element)`. If the handler
is not on `window`, a warning is logged. Use this only when a
declarative directive cannot express what you need.

### data-nd-set — write to the store

`data-nd-set` performs one or more store writes. Its value is a
comma-separated list of "ops", where commas inside single-quoted
string literals are NOT split points.

#### Grammar

```
ops        ::= op ( ',' op )*
op         ::= NAME                        (response form)
             | NAME '=' rhs                (explicit form)
NAME       ::= identifier ( '.' identifier )*
rhs        ::= literal | ref | ref OP NUMBER | '$response'
literal    ::= 'null' | 'true' | 'false' | NUMBER | STRING
ref        ::= '${' NAME '}'
OP         ::= '+' | '-' | '*' | '/'
NUMBER     ::= '-'? digits ( '.' digits )?
STRING     ::= "'" ( any-char | "\\'" | "\\\\" )* "'"
```

#### Semantics

- **Response form** (`NAME` alone) writes the full `responseData`
  under `NAME`. If `responseData` is `undefined` at the moment the
  directive runs, the op is a no-op and emits a warning.
- **Explicit form** parses the RHS as an AST:
  - `literal` writes the literal value.
  - `ref` reads the var and writes its current value to `NAME`.
  - `ref OP NUMBER` coerces the referenced var to `Number`; if `NaN`
    the op throws and logs. Division by zero throws.
  - `$response` writes the full response value (same effect as the
    response form, but useful when combined with other ops in a
    single attribute).
- Dot-path LHS writes use `setByPath` on the top-level object,
  creating intermediate objects as needed.

#### When it runs

| Element context                                          | When it runs                              | `responseData` |
|----------------------------------------------------------|-------------------------------------------|----------------|
| On a `data-nd-bind` element                              | After a successful fetch.                 | parsed JSON    |
| On a `form[data-nd-action]` element                      | After a successful submit (HTTP 2xx).     | parsed JSON (or `null`) |
| On a non-form `[data-nd-action]` (button/link)           | After a successful submit.                | parsed JSON (or `null`) |
| On a `form[data-nd-upload]` element                      | NOT invoked (upload does not process set). | —              |
| Standalone (no bind/action/upload/sortable)              | On click. Response form warns.             | `undefined`    |

#### Examples

```html
<!-- Pager: +/- buttons mutate ${page}. The bound list refreshes via
     nd:refresh emitted by data-nd-success. -->
<button data-nd-set="page=${page}+1"
        data-nd-success="refresh:#user-list">Next</button>
<button data-nd-set="page=${page}-1"
        data-nd-success="refresh:#user-list">Prev</button>

<!-- After creating a user, store the whole response under 'currentUser'
     and store its id specifically under 'lastUserId'. -->
<form data-nd-action="POST ${api}/api/users"
      data-nd-set="currentUser,lastUserId=${currentUser.id}">
  ...
</form>

<!-- Write a literal string. -->
<button data-nd-set="view='list'"
        data-nd-success="refresh:#view-container">List</button>
```

#### `data-nd-success` on standalone set elements

On standalone `data-nd-set` elements (click triggers),
`data-nd-success` is evaluated after the store writes but ONLY the
following action prefixes are supported:

- `refresh:SELECTOR` — dispatch `nd:refresh` on every matching
  element.
- `emit:EVENT` — dispatch a bubbling `CustomEvent('EVENT')` on the
  element.

`reset`, `reload`, `redirect:URL`, and `close-modal` are NOT supported
on set triggers.

### data-nd-model — two-way form binding

`data-nd-model="NAME"` on a form input creates a two-way binding
between the input and a store var. This is the only reactive
primitive in ndesign — store writes propagate back to the input, and
input changes propagate to the store.

Lifecycle:

1. On init, `initModel()` reads `getVar(name)` and writes it into the
   input. If no value exists AND the input has a non-empty
   `defaultValue`, the input's current value is written into the
   store so subsequent reads see it.
2. When the user types/clicks/selects, the input's value is coerced
   and written back via `setVar(name, coerced)`, then an `nd:model`
   `CustomEvent` is dispatched on the input with
   `detail = { name, value }`.
3. When ANY other code writes the same TOP-LEVEL key (via `setVar` /
   `NDesign.storeSet` / a `data-nd-set` directive), the input
   re-syncs. A re-entrance guard prevents the sync from triggering
   its own input event.

Coercions written back to the store:

| Input                        | Stored type                                  |
|------------------------------|----------------------------------------------|
| `type="checkbox"`            | `boolean` (`el.checked`)                     |
| `type="number"` / `"range"`  | `Number`, or `null` when empty               |
| `<select multiple>`          | `Array<string>` of selected option values    |
| Everything else              | `string` (`el.value`)                        |

Event wiring: `input` for most controls; `change` for checkboxes and
selects.

`data-nd-model` is the ONLY directive that reacts to store changes.
`data-nd-bind` elements do NOT refresh when the store changes — see
[Pitfalls](#pitfalls).

### data-nd-sse — server-sent events

`data-nd-sse="URL"` subscribes to an `EventSource` and renders each
incoming message into the element, either as a scalar field or via a
template.

#### Attribute

The URL is `${var}`-resolved. Elements sharing the same resolved URL
share a single `EventSource`. A new `EventSource` is created per
unique URL.

#### Event filtering — `data-nd-sse-event="TYPE"`

If set, the element only renders messages dispatched under that named
SSE event type (`event: TYPE` in the stream). If absent, the element
renders only the unnamed default `message` event.

The init code inspects every bound element, collects the union of
named types, and registers one listener per type plus (optionally) a
`message` listener.

#### Rendering

- `data-nd-template="ID"` + `data-nd-mode="append|prepend|replace"`
  renders each message via `render()`. **Default mode is `append`**
  (not `replace`). `data-nd-max` is honoured.
- `data-nd-field="PATH"` writes a scalar to `textContent`.
- Neither → `textContent = JSON.stringify(data)` or the raw string.

#### Reconnection and errors

`EventSource` handles reconnect natively. Each dispatch updates
`el.dataset.ndSseLastId` with the last observed event id. `error`
events are logged and routed through `config.onError(url, err)`.
There is no public `getLastEventId()` helper — read
`dataset.ndSseLastId` directly.

#### Example

```html
<tbody data-nd-sse="${api}/api/events"
       data-nd-sse-event="trade"
       data-nd-template="trade-row"
       data-nd-mode="prepend"
       data-nd-max="50">
  <template id="trade-row">
    <tr><td>{{ts}}</td><td>{{symbol}}</td><td>{{price}}</td></tr>
  </template>
</tbody>
```

### data-nd-ws — WebSockets

`data-nd-ws="URL"` opens a WebSocket and renders incoming JSON
messages into the element.

#### Attribute

The URL is `${var}`-resolved. `wss://` URLs are recommended for
authenticated traffic. Elements sharing a resolved URL share one
`WebSocket`.

Before connection, `config.wsProtocols` is passed as the protocol
list (if non-empty). If `config.wsTokenProvider` is a function, its
return value is appended as `token=<encoded>` to the URL's query
string.

#### Connection state classes

Every bound element is stamped with `nd-ws-disconnected` at init.
On `open`, `nd-ws-disconnected` is removed and `nd-ws-connected` is
added; on `close`, the reverse. Style these in CSS to show a status
indicator.

#### Reconnect with backoff

On `close` (non-intentional), a reconnect timer fires after
`retryDelay` ms. `retryDelay` starts at 1000, doubles on each attempt
(plus up to 500 ms of jitter), and caps at 30000. On `open`,
`retryDelay` is reset to 1000. `destroyWebSockets()` sets
`intentionalClose = true` to prevent reconnect.

#### Message filtering — `data-nd-ws-filter="FIELD:VALUE"`

Per-element filter. The filter field is a dot-path read via
`getByPath`. If `String(actualValue) !== filterValue`, the message is
skipped for that element. Messages that are not JSON are dropped with
a console warning.

#### Rendering

Same rules as SSE. Default mode is `append`.

#### Example

```html
<div id="ws-status"
     class="nd-badge"
     data-nd-ws="wss://test.nitecon.org/ws/feed"
     data-nd-field="type">connecting…</div>

<tbody data-nd-ws="wss://test.nitecon.org/ws/feed"
       data-nd-ws-filter="type:trade"
       data-nd-template="trade-row"
       data-nd-mode="prepend"
       data-nd-max="20">
  <template id="trade-row">
    <tr><td>{{symbol}}</td><td>{{price}}</td></tr>
  </template>
</tbody>
```

### Error envelope

Every action and bind error — regardless of source — is normalised
into a single envelope shape:

```json
{ "errors": { "error": "Human-readable global message", "field": "per-field message" } }
```

- `errors.error` is the canonical global-message key.
- `errors._form` is accepted as a legacy alias for `errors.error`;
  both are routed to the feedback slot. New backends SHOULD use
  `errors.error`.
- Any other key in `errors` is treated as a field-level error,
  matched against an input by `name=` (forms only).

#### Envelope sources

| Source                                              | Envelope                                                          |
|-----------------------------------------------------|-------------------------------------------------------------------|
| non-2xx response with a server `errors` object       | used verbatim as the envelope                                      |
| non-2xx response without an `errors` object          | `{errors:{error: responseData.message \|\| "Error: <statusText>"}}` |
| thrown fetch with `err.name === 'AbortError'`        | `{errors:{error:"Request timed out"}}`                             |
| thrown fetch with `err instanceof TypeError`         | `{errors:{error:"Couldn't reach server"}}`                         |
| any other thrown error                                | `{errors:{error: err.message \|\| "Unexpected error"}}`            |

The timeout vs. network distinction is load-bearing: both are
presented as a generic message to the user, but custom `onError`
handlers can tell them apart by re-reading `err.name` /
`err instanceof TypeError` from the third argument.

#### Routing

Form and button action errors flow through
`handleActionError(el, envelope, config, feedbackId, url, err)`:

1. Add `.nd-error` to the triggering element.
2. Forms: call `displayErrors()` to map field keys to
   `.nd-form-error` siblings and add `.nd-error` to matching inputs.
3. Write the synthesised global message (see
   [data-nd-action](#data-nd-action--forms-and-button-actions)) to the
   declared feedback element if any, OR to the auto-feedback slot if
   none.
4. Call `config.onError(url, envelope, err)` as a secondary signal.
   The default handler toasts the global message.

Bind errors flow through the same envelope shape but render either a
`<template data-nd-error>` (if present) or fall through to
`config.onError(url, envelope, err)`.

#### Upload errors

Uploads are a separate code path (XHR, not fetch) and do not yet use
the unified envelope:

- 2xx → feedback shows success message; `handleSuccess` chain runs.
- non-2xx with JSON `errors` → `displayErrors` maps fields.
- non-2xx otherwise → feedback shows server message or generic
  "Upload failed" text.
- XHR network error → feedback shows "Network error. Please try
  again."
- Aborted XHR (teardown) → feedback shows "Upload cancelled."

#### Recommended backend envelope shapes

Global-only error:

```json
{ "errors": { "error": "Payment declined" } }
```

Per-field errors only:

```json
{ "errors": { "email": "already taken", "role": "invalid" } }
```

Combined global + field errors:

```json
{ "errors": { "error": "Please correct the form.", "email": "already taken" } }
```

Legacy alias (still accepted):

```json
{ "errors": { "_form": "Payment declined" } }
```

Backends MUST set `Content-Type: application/json` on error
responses — the runtime only parses JSON when the header matches.

### Pitfalls

The data-binding model is small but sharp-edged. The following
mistakes are common enough that they each have a section below.

- **Store writes do NOT auto-refresh `data-nd-bind` elements.** Only
  `data-nd-model` inputs react to store changes, and only for the
  same TOP-LEVEL key. Pair every store mutation that should refresh
  a view with an explicit `data-nd-success="refresh:#id"` or a
  manual `dispatchEvent(new CustomEvent('nd:refresh'))`.
- **`${var}` does NOT interpolate inside element text nodes.** Store
  vars use `${var}` per attribute; templates use `{{field}}` per
  row. Writing `<p>Hello ${name}</p>` does nothing — the literal
  string remains in the DOM.
- **`data-nd-body` on a `<form>` is ignored.** Forms always
  serialise their inputs. If you need a JSON body that does not
  match the form's inputs, use a non-form action (`<button>` with
  `data-nd-action`) and `data-nd-body`.
- **There is no `$var` syntax — only `${var}`.** Bare `$name` is
  treated as literal text.
- **`data-nd-params` is NOT `${var}`-resolved.** Its value is
  appended to the URL as-is. For dynamic params, prefer a dedicated
  trigger element with `data-nd-bind-trigger` and
  `data-nd-params` constructed from the trigger's own attributes,
  or refresh the bound element after mutating `${page}` and keep
  the params static.
- **Do NOT listen to `nd:var-change` for general reactivity.** It
  fires every store write and is scoped conceptually to
  `data-nd-model`. Use `nd:refresh` for view refreshes and `nd:set`
  / custom `emit:` events for cross-component signalling.
- **`data-nd-set` is NOT processed on upload forms.** Upload success
  only processes `data-nd-success` and the feedback message.
- **`NDesign.init()` tears down everything.** It is safe but heavy.
  Prefer `MutationObserver`-driven re-wiring (sortable does this
  automatically) over a full re-init for incremental DOM additions.
- **`baseURL` does not exist.** Every element carries its own URL.
  DRY via `<meta name="endpoint:NAME">` and `${NAME}/...`.
- **Relative `/api/...` URLs only work for same-origin APIs.** Use
  the full URL or `${api}/...` for cross-origin.
- **A server-driven chained-confirm flow is NOT implemented.** A
  `next_confirm` field on the response will not open a second
  confirm. Compose multi-step confirms client-side with
  `data-nd-confirm="#dialog-id"` and
  `data-nd-success="close-modal,..."`.
- **Toast messages are HTML-escaped via `textContent`.** Embedded
  HTML in the message string will not render.

### Events fired by the runtime

The data-binding subsystem dispatches the following events.
Component-specific events (modal, sortable, etc.) live in their own
fragments and are also collected in [Reference](#reference).

| Event              | Target                | When                                                      | Detail                          |
|--------------------|-----------------------|-----------------------------------------------------------|---------------------------------|
| `nd:refresh`       | bound element          | External trigger (e.g. `refresh:#id`, bind trigger).       | none — consumer refetches       |
| `nd:var-change`    | `document`            | After `setVar()` / `NDesign.storeSet` (NOT `store.set`).   | `{path, topKey, value}`         |
| `nd:model`         | model input            | After user input updates the store.                       | `{name, value}`                 |
| `nd:set`           | set-trigger element    | After a standalone `data-nd-set` click runs.              | `{el}`                          |
| user-defined `emit:X` | action / set element | When a `data-nd-success="emit:X"` step runs.              | `responseData` (`undefined` for set) |

`nd:refresh` listeners SHOULD be the only thing application code
uses to re-trigger a `data-nd-bind` fetch. `nd:var-change` is an
internal-ish event for the model subsystem; do not build general
reactivity on top of it.

## Typography

ndesign styles the full HTML5 text-level vocabulary by default. Native headings (`<h1>`–`<h6>`), inline elements (`<code>`, `<kbd>`, `<samp>`, `<abbr>`, `<cite>`, `<mark>`), and block elements (`<pre>`, `<address>`, `<figure>`, `<details>`) render correctly without any classes. Modifier classes only exist for cases the native vocabulary cannot express.

### When to use

- Use semantic HTML first: `<h2>` for a section heading, `<code>` for inline code, `<kbd>` for a key, `<mark>` for a highlight.
- Reach for a class only to alter color, weight, or alignment beyond the semantic default.

### Minimal example

```html
<h1>Account settings</h1>
<p class="nd-text-lead">Manage your profile, security, and notifications.</p>

<p>Press <kbd>Ctrl</kbd>+<kbd>S</kbd> to save. The <code>email</code> field
is <mark>required</mark>.</p>

<details>
  <summary>Advanced options</summary>
  <p>Hidden until the disclosure is opened.</p>
</details>
```

### Native elements styled by default

| Element | Treatment |
|---|---|
| `<h1>`–`<h6>` | Tight line-height, decreasing scale, semibold/bold weights |
| `<code>` | Inline mono on a tinted background |
| `<pre>` | Block mono with horizontal scroll on overflow |
| `<kbd>` | Keycap appearance (border + inset shadow) |
| `<samp>` | Same surface as `<code>` (program output) |
| `<abbr title>` | Dotted underline, help cursor |
| `<cite>` | Italic, muted color |
| `<mark>` | Highlighted on the warning tint |
| `<figure>` / `<figcaption>` | Reset margin; caption is small and muted |
| `<details>` / `<summary>` | Bordered disclosure with a rotating marker |
| `<address>` | Italic reset, treated as a normal block |

### Modifier classes

| Class | Effect |
|---|---|
| `.nd-h1` … `.nd-h6` | Apply heading styles to a non-heading element (e.g. a `<div>`) |
| `.nd-text-lead` | Larger, looser body lead-in paragraph |
| `.nd-text-small` | `font-size: sm` |
| `.nd-text-xs` | `font-size: xs` |
| `.nd-text-muted` | `color: var(--nd-text-muted)` |
| `.nd-text-secondary` | `color: var(--nd-text-secondary)` |
| `.nd-text-accent` | `color: var(--nd-accent)` |
| `.nd-text-success` / `.nd-text-warning` / `.nd-text-danger` / `.nd-text-info` | Semantic colors |
| `.nd-text-left` / `.nd-text-center` / `.nd-text-right` / `.nd-text-justify` | Alignment |
| `.nd-text-uppercase` / `.nd-text-lowercase` / `.nd-text-capitalize` | Casing |
| `.nd-text-truncate` | Single-line ellipsis (`overflow: hidden; text-overflow: ellipsis`) |
| `.nd-text-break` | `overflow-wrap: anywhere` |
| `.nd-text-nowrap` | `white-space: nowrap` |
| `.nd-font-normal` / `.nd-font-medium` / `.nd-font-semibold` / `.nd-font-bold` | Weight overrides |
| `.nd-link-muted` | Muted-color link that brightens on hover |
| `.nd-prose` | Long-form container: 75ch max-width, looser leading, styled descendants (lists, blockquote, links, images) |

### Pitfalls

- Do NOT set heading sizes manually with `.nd-text-*` classes. Use the actual `<h1>`–`<h6>` element so screen readers and document outlines work.
- `.nd-prose` deliberately constrains `max-width: 75ch`. Wrap a UI region in `.nd-prose` only if it is long-form reading content.
- The Inter / JetBrains Mono `@import` is hard-coded in `_typography.scss`. Pages served offline MUST self-host these fonts and override the `--nd-font-family-*` tokens.

### See also

- [Buttons](#buttons), [Forms](#forms)
- Source: `scss/_typography.scss`, `scss/_utilities.scss`

## Buttons

Native `<button>` elements are styled by default. Add a variant class for color, a size class for scale, and one or more `data-nd-*` attributes to wire behavior. There is no `.nd-btn` base class — `<button>` itself is the base.

### When to use

- Anywhere the user triggers an action: form submit, modal open, confirm, toast, theme switch, programmatic fetch.
- Wrap the element in `<a>` only when the target is a real URL the user could right-click → open in new tab. Use `<button>` for in-page actions.

### Minimal example

```html
<button class="nd-btn-primary">Save</button>
<button class="nd-btn-secondary">Cancel</button>
<button class="nd-btn-danger nd-btn-sm">Delete</button>
<button class="nd-btn-ghost">Dismiss</button>
```

### Variant classes

| Class | Effect |
|---|---|
| `.nd-btn-primary` | Accent-colored fill (default action) |
| `.nd-btn-secondary` | Surface fill with border (neutral action) |
| `.nd-btn-danger` | Destructive accent fill |
| `.nd-btn-ghost` | Transparent until hover (toolbar action) |

### Size and shape classes

| Class | Effect |
|---|---|
| `.nd-btn-sm` | Compact padding, `font-size: sm` |
| `.nd-btn-lg` | Roomy padding, `font-size: lg` |
| `.nd-btn-block` | `display: flex; width: 100%` |
| `.nd-btn-icon` | Square padding for an icon-only button |
| `.nd-btn-group` | Flex wrapper that joins adjacent buttons into a single segmented control |

### State classes

| Class | Effect |
|---|---|
| `.nd-loading` | Hides label, renders an inline spinner; disables pointer events. Added by the runtime during `data-nd-action` and `data-nd-bind` requests, but MAY be set manually for custom flows. |
| `.nd-disabled` | Same effect as the native `disabled` attribute. Prefer the attribute when possible. |

`<button disabled>` is fully styled. Buttons inherit `:focus-visible` outlines and `:active` press translation from the base style.

### Switch helper — `.nd-switch`

A `.nd-switch` is a `<button aria-pressed="true|false">` styled as a toggle. The runtime does NOT manage `aria-pressed`; the page's own click handler MUST flip it. Pair with `.nd-switch-sm` for a compact variant.

```html
<button class="nd-switch" aria-pressed="false" onclick="this.setAttribute('aria-pressed', this.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')">
  Notifications
</button>
```

### Dynamic bindings

Buttons participate in every declarative-runtime mechanism. Place these attributes directly on the `<button>`:

| Attribute | Purpose |
|---|---|
| `data-nd-action="METHOD URL"` | Issue a fetch on click. See [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions). |
| `data-nd-body='{...}'` | JSON template body for the action (buttons only). |
| `data-nd-modal="#dialog"` | Open a `<dialog>`. See [Modals and dialogs](#modals). |
| `data-nd-toast="msg"` | Show a toast. See [Toasts](#toasts). |
| `data-nd-theme="name"` / `data-nd-theme-toggle` | Switch theme. See [Theme switching](#theme). |
| `data-nd-confirm` | Confirm prompt before running the action. See [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions). |
| `data-nd-bind-trigger="selector"` | Refetch a bound element on click. See [Data binding → data-nd-bind](#data-nd-bind--fetch-and-render). |

### Pitfalls

- Inside a `<form>`, a bare `<button>` defaults to `type="submit"` and triggers form submission. Always set `type="button"` for buttons that are NOT the submit action.
- The `.nd-loading` spinner color is derived from `--nd-btn-text`. On `.nd-btn-ghost` and other transparent variants the spinner stroke MAY be hard to see — set `--nd-btn-text` explicitly via inline style if needed.
- `.nd-btn-group` requires the children to be direct `<button>` siblings. Wrapping any child in a `<div>` breaks the segmented border collapse.

### See also

- [Forms](#forms), [Modals and dialogs](#modals), [Toasts](#toasts)
- Source: `scss/_buttons.scss`

## Forms

Forms are plain `<form>` markup. ndesign styles native inputs, selects, and textareas, and provides `.nd-form-group` / `.nd-form-label` wrappers for tabbed labels and validation slots. Submit handling, JSON serialization, and server-error mapping live on `data-nd-action` (see [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions)) — the markup stays declarative.

### When to use

- Any user data entry: create, edit, search, filter, login.
- Combine with `data-nd-action` to submit as JSON; the runtime maps validation errors back onto each `.nd-form-group` and writes a global feedback message.

### Minimal example

```html
<form data-nd-action="POST ${api}/api/users"
      data-nd-success="toast:User created">
  <div class="nd-form-group">
    <label for="name">Name <span class="nd-required">*</span></label>
    <input name="name" id="name" required>
    <div class="nd-form-error"></div>
  </div>

  <div class="nd-form-group">
    <label for="email">Email</label>
    <input type="email" name="email" id="email">
    <small class="nd-form-help">We never share your email.</small>
    <div class="nd-form-error"></div>
  </div>

  <button type="submit" class="nd-btn-primary">Create user</button>
</form>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-form-group` | Wraps one label + input + help/error slot. Adds bottom margin and is the relative anchor for error positioning. |
| `.nd-form-group-attached` | Inline label + input joined as one segmented control (label is the left cap). |
| `.nd-form-label` | Tabbed label appearance for elements outside `.nd-form-group`. The default `<label>` inside `.nd-form-group` already gets this style. |
| `.nd-required` | Red `*` indicator inside a label. |
| `.nd-form-help` | Small muted help text below the input. |
| `.nd-form-error` | Validation error slot. Empty by default; the runtime fills it on a failed submit. Hidden via `:empty`. |
| `.nd-form-check-group` | Bordered box wrapping checkbox/radio rows. |
| `.nd-form-check` | One row inside a check group. |
| `.nd-form-check-input` | Native `<input type="checkbox">` / `<input type="radio">` with custom appearance. |
| `.nd-form-input-sm` / `.nd-form-input-lg` | Compact / roomy input sizing. |
| `.nd-form-inline` | Lay out form groups in a horizontal row. |

### Native elements styled by default

`<input>` (text, email, password, number, search, url, tel, date variants), `<textarea>`, `<select>`, and `<input type="file">` all render with consistent borders, focus rings, and placeholder colors. No class is required.

### State classes

| Class on `.nd-form-group` | Effect |
|---|---|
| `.nd-error` | Red border + red focus ring on the contained input. |
| `.nd-success` | Green border + green focus ring on the contained input. |

`.nd-error` is added by the runtime on submit failure (per-field) and on the form itself. `.nd-success` is purely for consumer use.

### Dynamic bindings

Pair every form with `data-nd-action="METHOD URL"`. The runtime intercepts the `submit` event, serializes named inputs into a JSON object (dot-notation names create nested objects), submits via `fetch`, and:

- On success: removes `nd-error` classes, runs the `data-nd-success` chain, optionally writes response data into the store via `data-nd-set`.
- On error: parses the unified error envelope, sets `.nd-error` on each field whose name appears in `errors`, writes the matching `errors[name]` message into that field's `.nd-form-error`, and writes the global error message into the form's feedback element.

If the form does NOT declare `data-nd-feedback`, the runtime auto-creates an `.nd-alert nd-form-feedback-auto` slot adjacent to the submit button on first error, so the global message is always visible. See [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions) for the full envelope shape and lifecycle.

For multipart file uploads, use `data-nd-upload="METHOD URL"` instead of `data-nd-action` and add a `<progress class="nd-upload-progress" hidden>` element. See [Upload](#upload).

### Pitfalls

- Each field input MUST have a `name` attribute. Inputs without `name` are skipped by the serializer and will silently NOT submit.
- The `.nd-form-error` slot MUST be a sibling of the input inside the same `.nd-form-group`. Errors target fields by traversing up to `.nd-form-group` and writing into the nearest `.nd-form-error`.
- File inputs are skipped by `data-nd-action`'s JSON serializer. Use `data-nd-upload` for any form that includes a file input.
- `<input type="checkbox">` serializes as a boolean (`true`/`false`), not as the `value` attribute. Multi-select serializes as an array of values.
- `<input type="number">` serializes as a `Number` (or `null` if empty), NOT as a string.

### See also

- [Buttons](#buttons), [Upload](#upload), [Modals and dialogs](#modals)
- Source: `scss/_forms.scss`, `js/action.js`

## Tables

Native `<table>` is fully styled. Add modifier classes for striping, hover, density, and overflow. The `<tbody>` is the natural target for templated rendering driven by `data-nd-bind`.

### When to use

- Tabular data with a clear row/column relationship.
- Server-fetched lists rendered through a `<template>` (one row per item).

### When NOT to use

- Page layout. Use the layout grid utilities or [Cards](#cards) instead.

### Minimal example

```html
<table class="nd-table-striped nd-table-hover">
  <thead>
    <tr><th>User</th><th>Role</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr><td>Alice</td><td>Admin</td><td>Active</td></tr>
    <tr><td>Bob</td><td>Editor</td><td>Active</td></tr>
  </tbody>
</table>
```

### Modifier classes

| Class | Effect |
|---|---|
| `.nd-table-striped` | Alternating row backgrounds via `:nth-child(even)` |
| `.nd-table-hover` | Row background changes on hover |
| `.nd-table-bordered` | Visible border around every cell |
| `.nd-table-compact` | Reduced cell padding, `font-size: sm` |
| `.nd-table-responsive` | Wrapper `<div>` that adds `overflow-x: auto` and a bordered, rounded shell |
| `.nd-table-sortable` | Visual sort indicator on `th[data-nd-sort]` (consumer wires the click handler) |
| `.nd-table-empty` | Centered, italic, muted "no data" cell |

`.nd-table-responsive` is a wrapper, not a class on the `<table>`:

```html
<div class="nd-table-responsive">
  <table>...</table>
</div>
```

### Dynamic bindings

A `<tbody>` is the canonical `data-nd-bind` target for server-fetched rows. Use a sibling `<template data-nd-template>` for the row markup; the runtime replaces `<tbody>` children with one rendered template per array element.

```html
<table class="nd-table-hover">
  <thead><tr><th>Name</th><th>Email</th></tr></thead>
  <tbody data-nd-bind="${api}/api/users">
    <template data-nd-loading>
      <tr><td colspan="2"><span class="nd-skeleton nd-skeleton-text"></span></td></tr>
    </template>
    <template data-nd-empty>
      <tr><td colspan="2" class="nd-table-empty">No users yet.</td></tr>
    </template>
    <template>
      <tr>
        <td>{{name}}</td>
        <td>{{email}}</td>
      </tr>
    </template>
  </tbody>
</table>
```

See [Data binding → data-nd-bind](#data-nd-bind--fetch-and-render) for `data-nd-mode`, `data-nd-max`, `data-nd-refresh`, and the full template syntax.

### Pitfalls

- `<thead>` and `<tfoot>` are NOT touched by `data-nd-bind` on `<tbody>`. Render headers server-side or in static HTML.
- A bare `<table>` inside `.nd-card-body` may overflow on narrow viewports. Wrap it in `.nd-table-responsive` or use `.nd-card-flush` and put the wrapper in the body.
- `.nd-table-sortable` only renders the chevron — sorting itself is not implemented. The consumer MUST handle `click` on `th[data-nd-sort]` and refetch with the appropriate query string.
- Do NOT put the `<template>` outside the `<tbody>` for tables — browsers move stray `<tr>` elements out of `<table>` when parsing, breaking the bind.

### See also

- [Cards](#cards), [Pagination](#pagination), [Skeletons](#skeletons)
- Source: `scss/_tables.scss`

## Cards

A card is a self-contained content block with optional header, body, and footer regions. Use cards for list items, dashboard tiles, settings rows, and any unit of content the user might scan in a grid. The semantically correct outer element is `<article>`, though any block element accepts `.nd-card`.

### When to use

- A discrete piece of content that stands on its own (a user, a post, a stat, a form summary).
- Dashboard grids and gallery layouts.

### When NOT to use

- Lightweight bordered grouping inside another component — use [Panels](#panels) instead.
- Recessed background regions (form sections, code samples) — use [Wells](#wells).

### Minimal example

```html
<article class="nd-card">
  <header class="nd-card-header">
    <h3 class="nd-card-title">Project Aurora</h3>
  </header>
  <div class="nd-card-body">
    <p>Last deploy: 3 hours ago.</p>
  </div>
  <footer class="nd-card-footer">
    <button class="nd-btn-primary nd-btn-sm">View</button>
  </footer>
</article>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-card` | Outer container: surface background, border, rounded corners, drop shadow, glass specular highlight |
| `.nd-card-header` | Top section with raised background and bottom border |
| `.nd-card-body` | Middle section with `flex: 1 1 auto` so the card grows to fill its row |
| `.nd-card-footer` | Bottom section with raised background and top border |
| `.nd-card-title` | Lg, semibold heading inside header or body (margin reset) |
| `.nd-card-subtitle` | Sm, muted subtitle following a title |
| `.nd-card-img` | Full-width image; `:first-child` and `:last-child` get matching corner radii |
| `.nd-card-flush` | Removes body padding (for embedded tables, lists, images) |
| `.nd-card-danger` | Red border + tinted header (destructive context) |
| `.nd-card-group` | Flex row of equal-width cards; stacks vertically on `< md` |
| `.nd-card-stack` | Vertical column of cards with consistent gap |

Headings (`<h1>`–`<h6>`) inside `.nd-card-header` have their margins reset.

### Pitfalls

- `.nd-card` uses `overflow: visible` on purpose so descendant dropdowns and `<select>` panels are NOT clipped. If you put an image at the top, use `.nd-card-img` (which carries the matching corner radii) instead of relying on `overflow: hidden`.
- Stacking many cards inside a flex container without `gap` can collapse the drop shadows visually. Use `.nd-card-stack` or set `gap` on the parent.
- The glass specular `::before` pseudo sits at `z-index: 0` and direct children at `z-index: 1`. Avoid setting `position: relative; z-index: -1` on card descendants — they will fall behind the highlight.

### See also

- [Panels](#panels), [Wells](#wells), [Tables](#tables)
- Source: `scss/_cards.scss`

## Panels

A panel is a single-region bordered content block — lighter than a card (no separate header/body/footer architecture) but visually grouped. Use panels for sidebar widgets, settings sub-sections, and bordered grouping inside another container.

### When to use

- A bordered region within a larger layout that does NOT need a header/footer split.
- Sidebar widgets, dashboard sub-sections.

### When NOT to use

- Content with a distinct header or footer band — use [Cards](#cards).
- Recessed/inset backgrounds — use [Wells](#wells).

### Minimal example

```html
<section class="nd-panel">
  <h3 class="nd-panel-title">Quick stats</h3>
  <p>Active users: 1,243</p>
  <p>Errors today: 0</p>
</section>
```

### With header and footer

```html
<section class="nd-panel">
  <header class="nd-panel-header">
    <h3>Recent events</h3>
  </header>
  <ul>
    <li>Alice signed in</li>
    <li>Bob updated profile</li>
  </ul>
  <footer class="nd-panel-footer">
    <a href="/events">View all</a>
  </footer>
</section>
```

`.nd-panel-header` and `.nd-panel-footer` use negative margins to bleed to the panel edges, so they sit flush with the border.

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-panel` | Surface background, border, rounded corners, glass specular highlight, bottom margin |
| `.nd-panel-title` | Lg, semibold title (margin reset) |
| `.nd-panel-bordered` | Replaces glass shadow with a flat border (use on dense layouts) |
| `.nd-panel-compact` | Reduced padding |
| `.nd-panel-header` | Top band with raised background, bleeds to panel edges |
| `.nd-panel-footer` | Bottom band, mirror of the header |
| `.nd-panel-group` | Flex column of panels with consistent gap (resets per-panel margin) |

### Pitfalls

- Panels and cards look similar at a glance — the practical difference is that cards expect a header/body/footer triad and panels do not. Mixing both in the same view is fine; mixing both inside the same container creates visual noise.
- `.nd-panel-header` and `.nd-panel-footer` use negative margins; they MUST be direct children of `.nd-panel`. Wrapping them in another element will break the edge-to-edge alignment.

### See also

- [Cards](#cards), [Wells](#wells), [Asides](#asides)
- Source: `scss/_panels.scss`

## Wells

A well is an inset, recessed region — visually the inverse of a card. The inner shadow simulates content carved into the surface. Use wells to set apart secondary information without giving it the visual weight of a card or panel.

### When to use

- Quoted content, code samples, supplementary info inside a card or panel.
- Empty-state placeholders ("No results — try a different filter").
- Disabled or read-only sub-sections.

### When NOT to use

- Primary content that the user acts on — use [Cards](#cards) or [Panels](#panels).
- Status messages — use [Alerts](#alerts).

### Minimal example

```html
<div class="nd-well">
  <h4 class="nd-well-title">Tip</h4>
  <p>Press <kbd>?</kbd> anywhere to see keyboard shortcuts.</p>
</div>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-well` | Inset background, border, inner shadow at the top edge, bottom margin |
| `.nd-well-sm` | Reduced padding |
| `.nd-well-lg` | Increased padding |
| `.nd-well-title` | Base-size, semibold heading (margin reset) |
| `.nd-well-inline` | Removes the bottom margin (use when nested inside another spacing container) |

### Pitfalls

- Wells deliberately have no specular highlight — they absorb light rather than catch it. Do NOT add a glass effect on top.
- Stacking a well inside a card body inside a panel produces three visually conflicting surfaces. Pick one container per region.

### See also

- [Cards](#cards), [Panels](#panels), [Alerts](#alerts)
- Source: `scss/_wells.scss`

## Alerts

An alert is a static, in-page status message — success, error, warning, or info. Alerts are also the canonical class used by the auto-feedback slot inserted by `data-nd-action` and `data-nd-upload`, so any `.nd-alert` you place adjacent to a form participates in the same visual language as runtime-emitted messages.

### When to use

- Persistent in-page status: validation summary, banner notice, post-submit confirmation.
- The feedback target for a form (`data-nd-feedback="my-alert-id"`).

### When NOT to use

- Transient notifications — use [Toasts](#toasts).
- Inline field-level errors — use `.nd-form-error` inside an `.nd-form-group` (see [Forms](#forms)).

### Minimal example

```html
<div class="nd-alert nd-alert-success" role="status">
  <strong>Saved.</strong> Your changes are live.
</div>

<div class="nd-alert nd-alert-error" role="alert">
  <div class="nd-alert-content">
    <div class="nd-alert-title">Could not save</div>
    The server rejected the request.
  </div>
</div>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-alert` | Base alert: padding, border, rounded corners, bottom margin, flex layout |
| `.nd-alert-success` | Green tint |
| `.nd-alert-warning` | Amber tint |
| `.nd-alert-error` | Red tint |
| `.nd-alert-info` | Blue tint |
| `.nd-alert-title` | Bold heading inside an alert |
| `.nd-alert-content` | Flex-1 wrapper for the message body (use alongside an icon) |
| `.nd-alert-icon` | 1.25rem icon slot, top-aligned with the first text line |
| `.nd-alert-dismissible` | Reserves right padding for a close button |
| `.nd-alert-close` | Absolute-positioned `×` button (place inside an `.nd-alert-dismissible`) |

Use `role="alert"` for error alerts (assertive announcement) and `role="status"` for non-error alerts (polite announcement). The runtime-created auto-feedback slot does NOT set a role — pages that need announcement on auto-created feedback SHOULD declare `data-nd-feedback` on a static `.nd-alert` with the appropriate role.

### Dynamic bindings

`data-nd-action` and `data-nd-upload` look up `data-nd-feedback="<id>"` and write the server's global message into that element with one of `nd-alert-success`, `nd-alert-error`, `nd-alert-warning`, or `nd-alert-info` applied. If the form omits `data-nd-feedback`, the runtime auto-creates an `.nd-alert nd-form-feedback-auto` element next to the submit button on first error so the message is always visible. See [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions).

```html
<form data-nd-action="POST ${api}/api/users"
      data-nd-feedback="user-feedback">
  <!-- form fields -->
  <div id="user-feedback" class="nd-alert" role="status" hidden></div>
  <button type="submit" class="nd-btn-primary">Create</button>
</form>
```

### Pitfalls

- `.nd-alert-close` requires `.nd-alert-dismissible` on the parent so the close button does NOT overlap the message text.
- The runtime resets `className` to `nd-alert nd-alert-<type>` when writing into a feedback target, then restores `nd-form-feedback-auto` if the slot was auto-created. Custom classes you add to a declared feedback element will be wiped on every write — use inline style or a wrapping element if you need extra styling.
- An empty `.nd-alert` is still rendered (the base class has padding and a border). Toggle visibility with the `hidden` attribute or `display: none` until populated.

### See also

- [Toasts](#toasts), [Forms](#forms), [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions)
- Source: `scss/_alerts.scss`, `js/action.js`

## Badges

Inline pill labels for status, counts, and metadata. Badges are display-only — no behavior, no JS contract.

### When to use

- Status indicators next to a name or title (`Active`, `Beta`, `Deprecated`).
- Counts on a button or nav item (`Inbox 3`).
- Tags and categories.

### Minimal example

```html
<span class="nd-badge nd-badge-success">Active</span>
<span class="nd-badge nd-badge-warning">Beta</span>
<span class="nd-badge nd-badge-danger">Deprecated</span>
<button class="nd-btn-secondary">
  Inbox <span class="nd-badge nd-badge-primary">3</span>
</button>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-badge` | Base pill: inline-flex, sm padding, xs font-size, pill border-radius |
| `.nd-badge-primary` | Accent fill |
| `.nd-badge-secondary` | Well-tinted fill, secondary text color |
| `.nd-badge-success` | Green fill |
| `.nd-badge-warning` | Amber fill |
| `.nd-badge-danger` | Red fill |
| `.nd-badge-info` | Blue fill |
| `.nd-badge-sm` | Smaller padding, 0.625rem font-size |
| `.nd-badge-lg` | Larger padding, sm font-size |
| `.nd-badge-dot` | Empty circular dot (notification indicator, no text) |

### Pitfalls

- A bare `.nd-badge` (no semantic variant) uses the muted well background — barely visible on a card surface. Always pair `.nd-badge` with a semantic variant unless that subtle treatment is intentional.
- `.nd-badge-dot` ignores its content (`width: 0.5rem; padding: 0`). Keep it empty.
- Badges inside a button inherit `vertical-align: middle`. If they appear misaligned, check that the parent has not overridden `line-height`.

### See also

- [Buttons](#buttons), [Alerts](#alerts)
- Source: `scss/_badges.scss`

## Breadcrumbs

Hierarchical location trail. Use a native `<nav>` containing an ordered list — the runtime does NOT manage breadcrumbs, but `.nd-breadcrumb` resets the top-bar `<nav>` styles inherited from `_nav.scss` so the trail renders inline.

### When to use

- Multi-level navigation where the user needs to jump back to an ancestor (`Settings → Team → Roles`).

### When NOT to use

- Two-level navigation — a back link or sidebar tree is clearer.
- Linear flows (wizards, checkout) — use a stepper pattern instead.

### Minimal example

```html
<nav class="nd-breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/settings">Settings</a></li>
    <li aria-current="page">Team</li>
  </ol>
</nav>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-breadcrumb` | Container: resets the `<nav>` top-bar style, lays out the `<ol>` as an inline flex list with chevron separators |
| `.nd-breadcrumb-slash` | Replaces the chevron with a `/` separator |
| `.nd-breadcrumb-arrow` | Replaces the chevron with an `→` separator |

The structure MUST be `<nav class="nd-breadcrumb"><ol><li>…</li></ol></nav>`. The chevron separator is generated via `li + li::before`, so the first item never gets a leading separator.

Use `aria-label="Breadcrumb"` on the `<nav>` and `aria-current="page"` on the final `<li>` (the current page, not a link).

### Pitfalls

- The class is `.nd-breadcrumb` (singular). Plural `.nd-breadcrumbs` is NOT defined.
- Breadcrumbs are NOT a `<nav class="nd-nav">` — `.nd-breadcrumb` overrides the sticky top-bar treatment. Mixing both classes produces undefined results.
- The current page MUST be plain text, not a link. A self-link breaks the `aria-current="page"` semantics and confuses assistive tech.

### See also

- [Pagination](#pagination), [Navigation](#navigation)
- Source: `scss/_breadcrumbs.scss`

## Pagination

Page-number trail for paged lists. Like breadcrumbs, pagination is a native `<nav>` containing an ordered list of links. The runtime does NOT manage page state — pair pagination with `data-nd-bind-trigger` to refetch a bound list when the user clicks a page link.

### When to use

- Server-paged lists where the URL or query string carries `?page=N`.
- Tables, search results, log viewers.

### When NOT to use

- Infinite-scroll feeds — bind once with `data-nd-mode="append"` and a "Load more" trigger instead.

### Minimal example

```html
<nav class="nd-pagination" aria-label="Pagination">
  <ul>
    <li><a href="?page=1">Prev</a></li>
    <li><a href="?page=1">1</a></li>
    <li><a href="?page=2" aria-current="page">2</a></li>
    <li><a href="?page=3">3</a></li>
    <li><span aria-hidden="true">…</span></li>
    <li><a href="?page=12">12</a></li>
    <li><a href="?page=3">Next</a></li>
  </ul>
</nav>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-pagination` | Container: resets the `<nav>` top-bar style and lays out the `<ul>` as an inline flex group |
| `.nd-pagination-sm` | Smaller buttons (1.75rem tall, xs font-size) |
| `.nd-pagination-lg` | Larger buttons (2.75rem tall, base font-size) |
| `.nd-pagination-center` | `text-align: center` on the wrapper |
| `.nd-pagination-right` | `text-align: right` on the wrapper |

Each `<li>` contains an `<a>` (or `<span>` for ellipsis). The current page is marked with `aria-current="page"` on the `<a>` — the runtime style picks this up and renders it as a filled accent button with `pointer-events: none`. Disabled boundary buttons use `aria-disabled="true"` (or the `.nd-disabled` class).

### Dynamic bindings

Pagination integrates with the bind runtime via `data-nd-bind-trigger`. Place it on each page link to refetch a bound list when clicked. Server-rendered active state plus the runtime's auto-managed `aria-current="page"` via `data-nd-bind-trigger` keep the visible state in sync.

```html
<tbody data-nd-bind="${api}/api/users" id="user-list">
  <template>...</template>
</tbody>

<nav class="nd-pagination" aria-label="Pagination">
  <ul>
    <li><a href="#" data-nd-bind-trigger="#user-list"
           data-nd-params="page=1" aria-current="page">1</a></li>
    <li><a href="#" data-nd-bind-trigger="#user-list"
           data-nd-params="page=2">2</a></li>
  </ul>
</nav>
```

See [Data binding → data-nd-bind](#data-nd-bind--fetch-and-render) for trigger semantics and `data-nd-params` merging.

### Pitfalls

- Use plain `<a>` elements (or `<button>`s with `data-nd-bind-trigger`). The default `<nav>` style is suppressed by `.nd-pagination` — do NOT add `.nd-nav` here.
- The ellipsis MUST be a `<span aria-hidden="true">` so screen readers skip it. Marking it as a link breaks the navigation order.
- A `aria-disabled="true"` link is still focusable — use it for the Prev/Next button at a boundary, but the keyboard user MUST be able to skip past it. If you need a hard stop, omit the link entirely.

### See also

- [Tables](#tables), [Breadcrumbs](#breadcrumbs)
- Source: `scss/_pagination.scss`

## Skeletons

Animated shimmer placeholders that occupy the same shape as the content they will be replaced with. The idiomatic use is inside a `<template data-nd-loading>` — the runtime renders the template into the bound element while the fetch is in flight, then replaces it with the real content.

### When to use

- The loading state for any `data-nd-bind` element where a spinner would be vague but a layout-preserving placeholder reassures the user.
- Cards, list rows, avatar + text blocks, image tiles.

### When NOT to use

- Sub-100ms operations — render the real content directly.
- Non-data-driven UI (the user clicked a button, expect a near-instant reaction) — use the button's `.nd-loading` spinner state instead.

### Minimal example

```html
<div data-nd-bind="${api}/api/profile">
  <template data-nd-loading>
    <div style="display: flex; gap: 1rem; align-items: center;">
      <span class="nd-skeleton nd-skeleton-avatar"></span>
      <div class="nd-skeleton-group" style="flex: 1;">
        <span class="nd-skeleton nd-skeleton-title"></span>
        <span class="nd-skeleton nd-skeleton-text"></span>
        <span class="nd-skeleton nd-skeleton-text"></span>
      </div>
    </div>
  </template>
  <template>
    <h2>{{name}}</h2>
    <p>{{bio}}</p>
  </template>
</div>
```

### Shape classes

| Class | Effect |
|---|---|
| `.nd-skeleton` | Base shimmer (animated linear gradient, sm border-radius). Required on every shape. |
| `.nd-skeleton-text` | 0.875rem tall line; the last sibling shrinks to 80% width |
| `.nd-skeleton-title` | 1.5rem tall, 60% width |
| `.nd-skeleton-circle` | Circular border-radius (combine with explicit width/height) |
| `.nd-skeleton-avatar` | 2rem circle |
| `.nd-skeleton-avatar-lg` | 4rem circle |
| `.nd-skeleton-button` | 2.25rem × 6rem button shape |
| `.nd-skeleton-image` | 16:9 aspect-ratio block (uses `padding-bottom: 56.25%`) |
| `.nd-skeleton-card` | 8rem tall card shape |
| `.nd-skeleton-group` | Flex column with sm gap (use to stack multiple text/title shapes) |

### Pitfalls

- `.nd-skeleton` MUST be on every shape — it carries the shimmer animation. The shape classes alone provide only dimensions.
- Skeleton elements MUST be `display: block` (or `inline-flex` inside a flex container) for width to apply. A bare `<span class="nd-skeleton">` inside flowing text will collapse.
- The shimmer uses `prefers-reduced-motion` to fall back to a static fill. Do NOT add a manual animation on top.
- `<template data-nd-loading>` is rendered by the bind runtime — it is NOT inserted into the DOM as static markup. Putting visible skeletons outside a `data-nd-loading` template and toggling them by hand is also valid, but you forfeit the runtime's automatic show/hide.

### See also

- [Tables](#tables), [Cards](#cards), [Data binding → data-nd-bind](#data-nd-bind--fetch-and-render)
- Source: `scss/_skeletons.scss`

## Progress

Native `<progress>` is fully styled — determinate (with a `value`) and indeterminate (no `value`). No wrapper class is required. The `.nd-upload-progress` class hooks into the file-upload XHR runtime, which toggles the element's visibility and updates `value` as bytes transfer.

### When to use

- File uploads (always pair with `data-nd-upload`).
- Long-running operations driven by SSE/WS where the server sends percentage updates.
- Determinate background tasks (export, import, batch).

### When NOT to use

- A loading indicator without a known percentage and inside a button — use the button's `.nd-loading` state.
- A loading indicator on a list — use [Skeletons](#skeletons).

### Minimal example — determinate

```html
<progress value="42" max="100">42%</progress>
```

### Minimal example — indeterminate

```html
<progress>Loading…</progress>
```

The indeterminate state animates an accent stripe across the track.

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-progress-sm` | 0.25rem tall |
| `.nd-progress-lg` | 0.75rem tall |
| `.nd-progress-xl` | 1.25rem tall |
| `.nd-progress-success` | Green fill |
| `.nd-progress-warning` | Amber fill |
| `.nd-progress-danger` | Red fill |
| `.nd-upload-progress` | Marker class for the upload runtime; `[hidden]` selector hides it until upload starts |

The default fill height is 0.5rem. Both WebKit (`::-webkit-progress-bar` / `::-webkit-progress-value`) and Firefox (`::-moz-progress-bar`) pseudos are styled.

### Dynamic bindings — file upload

A `<form data-nd-upload="POST /api/upload">` with a `<progress class="nd-upload-progress" hidden>` element and a `<input type="file">` produces a complete upload UI. The runtime selects the progress element via `form.querySelector('progress.nd-upload-progress')` on submit, removes the `hidden` attribute, and updates `value` from the XHR `upload.onprogress` event.

```html
<form data-nd-upload="POST ${api}/api/files"
      data-nd-feedback="upload-feedback">
  <input type="file" name="file" required>
  <progress class="nd-upload-progress" value="0" max="100" hidden></progress>
  <div id="upload-feedback"></div>
  <button type="submit" class="nd-btn-primary">Upload</button>
</form>
```

See [Upload](#upload) for the full attribute set, server payload, and CSRF behavior.

### Pitfalls

- A `<progress>` with `value=""` or no `value` attribute is indeterminate, NOT zero. Use `value="0"` for an explicit empty bar.
- The semantic color modifiers only style the WebKit/Firefox pseudo-elements. They do NOT change the indeterminate-state animation color (which is hard-coded to the accent gradient).
- `.nd-upload-progress[hidden]` is a `display: none` rule. The runtime relies on removing the `hidden` attribute (NOT toggling a class) — do NOT manually set `display: block` and expect the runtime to clean up.

### See also

- [Upload](#upload), [Forms](#forms), [Skeletons](#skeletons)
- Source: `scss/_progress.scss`, `scss/_uploads.scss`, `js/upload.js`

## Avatars

Circular badges showing user initials or a profile image. The class is `.avatar` (NOT `.nd-avatar`) — kept short because avatars appear inline in dense markup such as user lists, comment threads, and presence indicators.

### When to use

- Beside a user's name in a list, comment, or activity feed.
- In a top nav as the account-switcher trigger.

### Minimal example

```html
<span class="avatar">WH</span>

<span class="avatar avatar-lg">
  <img src="/img/alice.jpg" alt="Alice">
</span>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.avatar` | 2rem circle, accent fill, accent-text color, semibold xs font; `<img>` children fill the circle via `object-fit: cover` |
| `.avatar-sm` | 1.5rem |
| `.avatar-lg` | 4rem |
| `.avatar-xl` | 6rem |

The base `.avatar` is `display: inline-flex` and clips overflow, so an `<img>` child fills it without leaking past the rounded corner.

### Pitfalls

- The class is unprefixed (`.avatar`, not `.nd-avatar`). Do NOT add the `nd-` prefix or the styles will not apply.
- Initials should be uppercase and 1–2 characters. Longer strings overflow the small variants.
- An `<img>` inside `.avatar` MUST have an `alt` attribute (use the user's name). Empty `alt=""` is acceptable only when the avatar is purely decorative and the user's name is rendered adjacent.
- The accent fill is the default background when there is no image. Override `--nd-accent` per-avatar via inline style if you need user-specific colors.

### See also

- [Badges](#badges), [Skeletons](#skeletons)
- Source: `scss/_avatars.scss`

## Asides

Bare `<aside>` is styled by default as a simple bordered callout with a left accent strip — drop it into the document for tangentially related content. The `.fold` variant overrides this with an edge-pinned geometric callout that bleeds to the viewport edge for sidebar-style notes.

### When to use

- Plain `<aside>` for an inline callout: a tip, a note, a sidebar quote.
- `.fold` for an edge-pinned marginalia treatment in long-form content.

### When NOT to use

- Status messages (success/error/warning/info) — use [Alerts](#alerts).
- General bordered grouping — use [Panels](#panels).

### Minimal example — bare aside

```html
<aside>
  <strong>Note.</strong> The runtime initializes on <code>DOMContentLoaded</code>;
  call <code>NDesign.init()</code> after dynamic markup changes.
</aside>
```

### Minimal example — fold

```html
<aside class="fold fold-info">
  <h4 class="fold-title">Heads up</h4>
  Page binds initialize once at load. Refresh a region with
  <code>data-nd-bind-trigger</code>.
</aside>
```

### Markup and classes

| Class | Effect |
|---|---|
| (bare `<aside>`) | Surface background, border, 4px left accent strip, rounded corners |
| `.fold` | Edge-pinned variant: pins to the right edge with a negative right margin, rounds inner corners, drops outer corners square. Carries a heavier shadow. |
| `.fold-left` | Pins to the left edge instead of the right (mirrors borders and corner radii) |
| `.fold-title` | Base-size, semibold heading inside a fold (margin reset) |
| `.fold-info` | Blue accent strip (left or right depending on `.fold-left`) |
| `.fold-success` | Green accent strip |
| `.fold-warning` | Amber accent strip |
| `.fold-danger` | Red accent strip |

The default `.fold` (no semantic variant) renders without an accent — pair it with one of `.fold-info` / `.fold-success` / `.fold-warning` / `.fold-danger` to convey meaning.

### Pitfalls

- `.fold` uses negative margin to bleed to the viewport edge. It MUST be a direct child of a container whose padding is the viewport gutter (e.g. `<main>` with `--nd-container-padding`). Inside a centered card it will visibly clip.
- A bare `<aside>` and a `.fold` are visually distinct — adding `.fold` to an `<aside>` overrides the base style entirely. Do NOT expect the left-accent strip to compose with the fold geometry.
- `.fold-left` flips both the margin and the accent strip side. Setting `.fold-info.fold-left` correctly puts the accent on the right (the visible inner edge).

### See also

- [Alerts](#alerts), [Panels](#panels), [Wells](#wells)
- Source: `scss/_asides.scss`

## Modals

ndesign uses the browser's native `<dialog>` element for every modal. There
is no custom modal container, no portal, and no focus-trap implementation
beyond what the platform provides. The runtime only adds declarative open /
close triggers, backdrop-click handling, and a Promise-based confirm helper.

### When to use

- Editing a single record without leaving the current page.
- Confirming a destructive action with a yes / no choice.
- Surfacing a multi-step form whose result feeds back into the parent view.

### When NOT to use

- For transient feedback that does not require acknowledgement — use
  [Toasts](#toasts) instead.
- For navigation between sections — modals are not a substitute for routing.

### Minimal example

```html
<button class="nd-btn-primary" data-nd-modal="#edit-user">Edit</button>

<dialog id="edit-user">
  <header>
    <h3>Edit user</h3>
    <button class="nd-modal-close" aria-label="Close">&times;</button>
  </header>
  <form data-nd-action="PATCH ${api}/api/users/${userId}"
        data-nd-feedback="edit-feedback"
        data-nd-success="close-modal,refresh:#user-table">
    <div class="nd-form-group">
      <label for="name">Name</label>
      <input name="name" id="name" required>
      <div class="nd-form-error"></div>
    </div>
    <div id="edit-feedback"></div>
    <menu>
      <button type="button" data-nd-dismiss>Cancel</button>
      <button type="submit" class="nd-btn-primary">Save</button>
    </menu>
  </form>
</dialog>
```

### Markup and classes

| Class                | Effect                                                        |
|----------------------|---------------------------------------------------------------|
| `dialog`             | Native element — styled out of the box. No class required.    |
| `.nd-modal-sm`       | Narrow width variant (24 rem max).                            |
| `.nd-modal-lg`       | Wide variant (56 rem max).                                    |
| `.nd-modal-full`     | Near-full-viewport variant.                                   |
| `.nd-modal-close`    | Header close button — closes the enclosing `<dialog>`.        |

`<dialog>` accepts a `<header>`, a body `<div>`, and a `<footer>` as direct
children. The runtime does not require any class on those wrappers — the
SCSS targets them by element selector inside `dialog`.

### Dynamic bindings

| Attribute                   | Location                  | Behavior                                                                                                |
|-----------------------------|---------------------------|---------------------------------------------------------------------------------------------------------|
| `data-nd-modal="SELECTOR"`  | any clickable element     | On click: calls `document.querySelector(SELECTOR).showModal()`. Delegated, so triggers rendered later by [Data binding](#data-binding) work. |
| `data-nd-dismiss`           | inside a `<dialog>`       | On click: closes the enclosing `<dialog>`.                                                              |
| `.nd-modal-close`           | inside a `<dialog>`       | Equivalent to `data-nd-dismiss`.                                                                        |
| `data-nd-confirm-accept`    | inside a `<dialog>` opened by `confirmDialog()` | Resolves the confirm promise with `true` and closes the dialog.                                        |

A click on the `::backdrop` (detected when the click coordinates fall
outside the dialog's bounding rect) also closes the dialog.

When a [Data binding](#data-binding) form action inside a modal succeeds,
add `data-nd-success="close-modal"` to the form to close the enclosing
dialog as part of the success chain. It composes with other success steps,
e.g. `data-nd-success="close-modal,refresh:#user-table"`.

### Events fired

| Event              | Target   | Detail | When                                                                         |
|--------------------|----------|--------|------------------------------------------------------------------------------|
| `nd:modal:open`    | `dialog` | none   | After `openModal()` or `confirmDialog()` calls `showModal()`.                |
| `nd:modal:close`   | `dialog` | none   | After the dialog's `close` event (Escape, backdrop, programmatic close).     |
| `nd:modal:confirm` | `dialog` | none   | When `confirmDialog()` resolves `true`.                                      |
| `nd:modal:cancel`  | `dialog` | none   | When `confirmDialog()` resolves `false` (any dismiss path).                  |

`nd:modal:confirm` and `nd:modal:cancel` are observational — they do NOT
affect promise resolution.

### JS API

```javascript
NDesign.openModal('#my-dialog');                  // → void
NDesign.closeModal('#my-dialog');                 // → void
NDesign.confirmDialog('#confirm') /* → */ .then(ok => { /* ok: boolean */ });
```

`openModal` and `closeModal` warn and no-op if the selector does not match
a `<dialog>`. `confirmDialog()` returns a `Promise<boolean>` resolved
exactly once based on the first matching event:

| Trigger                                                     | Resolves to |
|-------------------------------------------------------------|-------------|
| Click on `[data-nd-confirm-accept]` inside the dialog       | `true`      |
| Click on `[data-nd-dismiss]` or `.nd-modal-close`           | `false`     |
| Click on the dialog backdrop                                | `false`     |
| Escape key                                                  | `false`     |
| Programmatic `dialog.close()` / `NDesign.closeModal()`      | `false`     |

Listeners for a `confirmDialog()` call are scoped to a local
`AbortController` and removed on resolution, so calling it repeatedly on
the same dialog is safe.

### Accessibility

- `<dialog>` provides a native focus trap, Escape-to-close, and inert
  background semantics — the runtime does not re-implement them.
- Use `<header>` + `<h2>`/`<h3>` inside the dialog to label the modal for
  screen readers, or set `aria-labelledby` explicitly.
- `.nd-modal-close` MUST carry an `aria-label` (e.g. `aria-label="Close"`)
  because its visible text is a `&times;` glyph.
- Confirm dialogs SHOULD include both an accept button
  (`data-nd-confirm-accept`) and a cancel button (`data-nd-dismiss`) so
  keyboard users can dismiss without reaching for Escape.

### Pitfalls

- Calling `openModal()` on an element that is not a `<dialog>` emits a
  console warning and does nothing. Custom `<div class="modal">` markup is
  not supported — use the native element.
- Server-driven chained confirmation (a `next_confirm` field on the
  response opening another confirm dialog) is NOT implemented.
- Closing a `<dialog>` programmatically inside a `confirmDialog()` session
  resolves the promise as `false`. To resolve as `true`, the user MUST
  click an element with `data-nd-confirm-accept`.

### See also

- [Data binding](#data-binding) — `data-nd-success="close-modal"` and the
  full success chain.
- [Toasts](#toasts) — for non-blocking feedback.
- Source: `js/modal.js`, `scss/_modals.scss`

## Toasts

Toasts are transient, non-blocking notifications that slide in from the
top-right of the viewport. The runtime auto-creates a single
`.nd-toast-container` in `<body>` on first use; individual toasts append to
it and dismiss themselves after a configurable duration.

### When to use

- Acknowledging a successful action ("Saved", "Copied to clipboard").
- Surfacing a recoverable error from a background operation.
- Showing a transient warning that does not require interaction.

### When NOT to use

- For confirmations or destructive choices — use a confirm
  [Modal](#modals) so the user must acknowledge.
- For form-field validation messages — those belong inline next to the
  field; see [Data binding](#data-binding) for `displayErrors` mechanics.
- For information the user must read in full — toasts auto-dismiss.

### Minimal example

```html
<button class="nd-btn-primary"
        data-nd-toast="Saved"
        data-nd-toast-type="success">Save</button>
```

```javascript
NDesign.toast('Saved!', 'success');
NDesign.toast('Network error', 'error', 8000);
NDesign.toast('Heads up', 'info', 0);  // 0 = persistent until manually closed
```

### Markup and classes

Toasts are created by the runtime — applications SHOULD NOT author toast
markup directly. The classes below document what gets rendered for
theming reference only.

| Class                  | Effect                                                       |
|------------------------|--------------------------------------------------------------|
| `.nd-toast-container`  | Fixed top-right overlay area. Auto-created in `<body>`.       |
| `.nd-toast`            | Single toast row. Slides in, auto-dismisses.                 |
| `.nd-toast-success`    | Green left border accent.                                    |
| `.nd-toast-error`      | Red left border accent.                                      |
| `.nd-toast-warning`    | Amber left border accent.                                    |
| `.nd-toast-info`       | Blue left border accent.                                     |
| `.nd-toast-message`    | The message `<span>` inside a toast.                         |
| `.nd-toast-close`      | The `&times;` close button.                                  |
| `.nd-toast-exit`       | Applied during the 200 ms exit animation.                    |

### Dynamic bindings

The single delegated click handler fires `NDesign.toast()` for any
element carrying `data-nd-toast`. Toasts may also be triggered as part of
a [Data binding](#data-binding) action's `data-nd-success` chain via
`toast:<message>`.

| Attribute                  | Location              | Behavior                                                          |
|----------------------------|-----------------------|-------------------------------------------------------------------|
| `data-nd-toast`            | any clickable element | Click fires `toast(MESSAGE, type, duration)`. Calls `e.preventDefault()`. |
| `data-nd-toast-type`       | sibling on the trigger | One of `success` / `error` / `warning` / `info`. Optional — neutral when omitted. |
| `data-nd-toast-duration`   | sibling on the trigger | Milliseconds as integer. Defaults to `5000`. `0` = persistent.    |

### JS API

```javascript
NDesign.toast(message, type, duration);  // → HTMLElement (the toast)
```

| Parameter   | Type    | Default | Notes                                                       |
|-------------|---------|---------|-------------------------------------------------------------|
| `message`   | string  | —       | Required. HTML-escaped via `textContent`.                   |
| `type`      | string  | `''`    | One of `success` / `error` / `warning` / `info` / omitted.  |
| `duration`  | number  | `5000`  | Milliseconds. `0` keeps the toast until the user dismisses. |

Returns the created toast element so callers can attach observers or
mutate it after creation.

### Accessibility

- Error toasts (`type === 'error'`) are rendered with `role="alert"` and
  `aria-live="assertive"`, interrupting screen readers immediately.
- All other toasts use `role="status"` with `aria-live="polite"` so they
  announce when the current speech finishes.
- Every toast also carries `aria-atomic="true"` so the full message is
  re-announced on update.
- The close button is a real `<button>` and is keyboard-focusable; tab
  order is determined by document order in the container.

### Pitfalls

- Toast text is set via `textContent` after `escapeHTML()` — HTML in the
  message is escaped twice and rendered as literal entities. Pass plain
  text only; do not embed `<strong>`, `<a>`, etc.
- The container is fixed and sits at `z-index: $nd-z-toast`. If a custom
  overlay sits above it, the toast will be hidden — fix the overlay's
  z-index, do not move the toast.
- Calling `NDesign.toast(...)` before `DOMContentLoaded` works only if
  the script is loaded with `defer` or at the end of `<body>`; the
  container is appended to `document.body` lazily.
- `destroyToasts()` removes the container and every active toast — any
  pending dismiss timer becomes a no-op.

### See also

- [Modals](#modals) — for blocking acknowledgement.
- [Data binding](#data-binding) — `toast:MESSAGE` in `data-nd-success`.
- Source: `js/toast.js`, `scss/_toasts.scss`

## Tooltips

Tooltips are short descriptive popups that anchor to an element on hover
or focus. ndesign uses a single shared `<div class="nd-tooltip">`
appended to `<body>` and re-positioned for each anchor; there is no
per-element tooltip DOM and no external positioning library.

### When to use

- Clarifying an icon-only button or compact control.
- Surfacing supplementary information that is not essential to read.
- Annotating tabular data with extra context per cell.

### When NOT to use

- For interactive content (links, buttons, form fields) — tooltips are
  pointer-events: none and cannot receive focus. Use a [Dropdown](#dropdowns)
  or [Modal](#modals) for content that must be clicked.
- For critical information — tooltips disappear on scroll, resize, and
  Escape; users on touch devices may not see them at all.
- For long-form text — content is plain text only and capped at ~18 rem
  wide.

### Minimal example

```html
<button data-nd-tooltip="Save the document">Save</button>

<a href="/docs"
   data-nd-tooltip="Opens in a new tab"
   data-nd-tooltip-placement="bottom">Docs</a>
```

### Markup and classes

The runtime creates and reuses a single tooltip element. Applications
SHOULD NOT author tooltip markup directly. Classes below document the
runtime-generated DOM for theming reference.

| Class                    | Effect                                                       |
|--------------------------|--------------------------------------------------------------|
| `.nd-tooltip`            | The shared tooltip element appended to `<body>`.             |
| `.nd-tooltip-visible`    | Added via `requestAnimationFrame` to trigger the fade-in.    |
| `.nd-tooltip-top`        | Arrow points down — tooltip above the anchor (default).      |
| `.nd-tooltip-bottom`     | Arrow points up — tooltip below the anchor.                  |
| `.nd-tooltip-left`       | Arrow points right — tooltip left of the anchor.             |
| `.nd-tooltip-right`      | Arrow points left — tooltip right of the anchor.             |

### Dynamic bindings

| Attribute                       | Location              | Behavior                                                                     |
|---------------------------------|-----------------------|------------------------------------------------------------------------------|
| `data-nd-tooltip="TEXT"`        | any element           | Anchor for the shared tooltip. `TEXT` is shown on hover/focus after a 200 ms delay. Empty values are ignored. |
| `data-nd-tooltip-placement`     | same element          | One of `top` (default), `bottom`, `left`, `right`. Unknown values fall back to `top`. |

Listeners are delegated on `document`, so anchors rendered by
[Data binding](#data-binding) after init pick up tooltip behavior with no
additional wiring.

### Accessibility

- The shared element has `id="nd-tooltip-active"` and `role="tooltip"`.
  When a tooltip is shown, the runtime sets `aria-describedby` on the
  anchor to reference that id; on hide, the attribute is removed.
- Pressing **Escape** while a tooltip is visible hides it.
- Scroll and resize hide the tooltip — it would otherwise mis-position.
- Tooltip text is set via `textContent`; HTML markup in the value is
  rendered as literal characters (XSS-safe).

### Pitfalls

- Do NOT put a `data-nd-tooltip` on a `<div>` or `<span>` that is not
  focusable. Keyboard users will never see it. Apply tooltips to
  natively focusable elements (`<button>`, `<a href>`, form fields) or
  add `tabindex="0"` to the anchor.
- The tooltip is `pointer-events: none` — hovering the tooltip itself
  does NOT keep it open, so do not embed links or buttons in tooltip
  text. Use a [Dropdown](#dropdowns) instead.
- Only one tooltip is visible at a time. Showing a second tooltip
  immediately hides the first — there is no stacking.
- Setting `data-nd-tooltip=""` (empty string) is a silent no-op — the
  anchor will not show a tooltip even on hover.

### See also

- [Dropdowns](#dropdowns) — for tooltip content that needs interaction.
- Source: `js/tooltip.js`, `scss/_tooltips.scss`

## Tabs

Tabs partition a single screen into mutually exclusive content panels.
ndesign implements the WAI-ARIA Authoring Practices tab pattern with
**manual activation**: arrow keys move focus between tabs, but the panel
only changes when the user presses Enter, Space, or clicks. Both
horizontal (default) and vertical layouts are supported.

### When to use

- Switching between views of the same record (Profile / Security /
  Notifications on a settings page).
- Showing alternate representations of one dataset (Table / Chart /
  Raw JSON).

### When NOT to use

- For top-level page navigation — use [Navigation](#navigation) instead.
- For a long sequence of steps — use a stepper / wizard pattern; tabs
  imply equal peers, not progression.

### Minimal example

```html
<div class="nd-tabs">
  <div role="tablist" aria-label="Account settings">
    <button role="tab" id="tab-profile"  aria-controls="p-profile"  aria-selected="true">Profile</button>
    <button role="tab" id="tab-security" aria-controls="p-security">Security</button>
    <button role="tab" id="tab-notif"    aria-controls="p-notif"   disabled>Notifications</button>
  </div>
  <section role="tabpanel" id="p-profile"  aria-labelledby="tab-profile">Profile content</section>
  <section role="tabpanel" id="p-security" aria-labelledby="tab-security" hidden>Security content</section>
  <section role="tabpanel" id="p-notif"    aria-labelledby="tab-notif"    hidden>Notifications content</section>
</div>
```

Vertical layout: replace `.nd-tabs` with `.nd-tabs-vertical`. The runtime
sets `aria-orientation="vertical"` on the tablist automatically.

### Markup and classes

| Class                  | Effect                                                       |
|------------------------|--------------------------------------------------------------|
| `.nd-tabs`             | Horizontal tablist + panels. Tabs along the top.             |
| `.nd-tabs-vertical`    | Vertical tablist on the left, panel on the right.            |

ARIA roles drive the runtime — class names are visual only.

| Role           | Required on                | Notes                                                            |
|----------------|----------------------------|------------------------------------------------------------------|
| `tablist`      | container of the tab buttons | Direct child of `.nd-tabs`. The runtime sets `aria-orientation`. |
| `tab`          | each tab button             | MUST carry `aria-controls="PANEL_ID"`. Use `<button>`.           |
| `tabpanel`     | each panel                  | MUST carry an `id` matching some tab's `aria-controls`.          |

Disabled tabs MUST carry the standard `disabled` attribute. The runtime
skips them during keyboard navigation and refuses to activate them.

### Dynamic bindings

Tabs do not consume any `data-nd-*` attributes — the contract is pure
ARIA. Tab panels MAY contain [Data binding](#data-binding) elements
(e.g. `data-nd-bind`) that are wired the moment the runtime initializes;
hidden panels still have their bindings active so that switching to a
panel reveals already-rendered content.

### Events fired

Tabs do not dispatch custom events. Listen for `click` on
`[role="tab"]` if a host application needs to react to activation, or
observe the `hidden` attribute on panels.

### JS API

Tabs are wired automatically by `NDesign.init()` and exposed only via
internal `initTabs()` / `destroyTabs()` lifecycle hooks. There is no
public method to programmatically activate a tab — call
`tabElement.click()` to activate one from script.

### Accessibility

The runtime applies the WAI-ARIA pattern in full:

- **Initial state** — the tab marked `aria-selected="true"` (or the
  first non-disabled tab if none is marked) gets `tabindex="0"`; every
  other tab gets `tabindex="-1"`. The matching panel is shown; all
  others receive `hidden`.
- **Activation** — clicking or pressing Enter / Space on a focused tab
  flips `aria-selected` and `tabindex` on every tab and toggles
  `hidden` on every panel.

Keyboard map (focus must be on a tab):

| Key                   | Effect                                                            |
|-----------------------|-------------------------------------------------------------------|
| `ArrowRight` / `ArrowDown` | Move focus to the next non-disabled tab. Wraps at the end.   |
| `ArrowLeft`  / `ArrowUp`   | Move focus to the previous non-disabled tab. Wraps at the start. |
| `Home`                | Focus the first non-disabled tab.                                 |
| `End`                 | Focus the last non-disabled tab.                                  |
| `Enter` / `Space`     | Activate the focused tab.                                         |

For `.nd-tabs-vertical`, both axes are accepted regardless of
orientation — the runtime uses ArrowRight/ArrowLeft and ArrowUp/ArrowDown
interchangeably for user convenience.

### Pitfalls

- A tab whose `aria-controls` does not match any panel id will activate
  but will not reveal a panel — no warning is logged.
- Disabled tabs MUST use the HTML `disabled` attribute, not
  `aria-disabled="true"`. The runtime checks the attribute, not the
  ARIA state.
- Do not nest `.nd-tabs` containers and expect arrow keys to "stop" at
  the inner boundary. The runtime scopes by closest `.nd-tabs` /
  `.nd-tabs-vertical` ancestor of the focused tab; design tab content
  to avoid nested tab widgets where possible.
- Activation is manual on purpose. Auto-activation on focus is
  inappropriate when panels are expensive to render or contain
  side-effecting content. To opt into auto-activation, attach a `focus`
  listener that calls `tab.click()` — but accept the accessibility
  trade-off.

### See also

- [Navigation](#navigation) — for cross-page navigation.
- [Dropdowns](#dropdowns) — for compact tab-like menus that do not need
  panel switching.
- Source: `js/tabs.js`, `scss/_tabs.scss`

## Dropdowns

A dropdown is a click-to-toggle menu anchored to a trigger button. ndesign
wires `role="menu"` and `role="menuitem"` automatically, supports keyboard
navigation, and closes on outside click. The trigger is a real `<button>`,
the menu is a `<ul>` or `<ol>` — no custom elements.

### When to use

- Action menus on a row or card (Edit / Duplicate / Delete).
- Account menus in a navigation bar.
- Compact lists of secondary commands that would clutter a toolbar.

### When NOT to use

- For form input — use the [Select](#select) component, which wraps a
  native `<select>` and keeps form validation semantics.
- For navigation between top-level pages — use [Navigation](#navigation).
- For long lists requiring filtering — build a search-driven menu using
  [Data binding](#data-binding) instead.

### Minimal example

```html
<div class="nd-dropdown">
  <button type="button">Actions</button>
  <ul class="nd-dropdown-menu">
    <li><a href="/edit">Edit</a></li>
    <li><a href="/duplicate">Duplicate</a></li>
    <li class="nd-dropdown-divider"></li>
    <li><a href="/delete">Delete</a></li>
  </ul>
</div>
```

### Markup and classes

A `.nd-dropdown` wraps exactly two children:

1. A direct-child `<button>` (the trigger). Other content before the
   list is ignored.
2. A `<ul>`, `<ol>`, or any element whose class includes
   `nd-dropdown-menu`.

| Class                    | Effect                                                       |
|--------------------------|--------------------------------------------------------------|
| `.nd-dropdown`           | Wrapper. `position: relative`.                               |
| `.nd-dropdown-menu`      | The popup list. Hidden until `.nd-open` is on the wrapper.    |
| `.nd-dropdown.nd-open`   | Runtime-applied when the dropdown is expanded.                |
| `.nd-dropdown-right`     | Right-align the menu under the trigger.                      |
| `.nd-dropdown-up`        | Open upward instead of downward.                             |
| `.nd-dropdown-divider`   | Horizontal separator inside the menu.                        |
| `.nd-active` (on `<li>`) | Highlight the current item.                                  |
| `.nd-highlighted`        | Runtime-applied while keyboard navigation hovers an item.    |

### Dynamic bindings

Dropdowns do not consume `data-nd-*` attributes directly. Menu items
typically link to URLs or carry [Data binding](#data-binding) attributes
themselves (`data-nd-action`, `data-nd-modal`, `data-nd-toast`, etc.) —
the dropdown is purely presentational scaffolding.

### Events fired

Dropdowns do not dispatch custom events. Listen for `click` on the menu
items if a host application needs to react to a selection.

### JS API

Dropdowns are wired automatically by `NDesign.init()`; there is no
public method to open / close one programmatically. To toggle from
script, call `wrapper.classList.toggle('nd-open')` and update
`aria-expanded` on the trigger button.

### Accessibility

ARIA wiring applied at init:

- The trigger gets `aria-expanded="false"`, flipped to `"true"` while
  open.
- The list element gets `role="menu"`.
- Each `<li> a` and `<li> button` gets `role="menuitem"`.

Keyboard map (focus on the trigger):

| Key            | Effect                                                                 |
|----------------|------------------------------------------------------------------------|
| `ArrowDown`    | Open the menu if closed; advance the highlighted item; wraps.           |
| `ArrowUp`      | Move highlight up; wraps.                                              |
| `Enter`        | Activate the highlighted item (`.click()`) and close the menu.         |
| `Escape`       | Close the menu and return focus to the trigger.                        |

Outside click — anywhere not inside a `.nd-dropdown` — closes every open
dropdown. Opening a second dropdown closes any already-open one.

### Pitfalls

- The trigger MUST be a direct-child `<button>`. A `<button>` nested
  inside another wrapper inside `.nd-dropdown` is ignored — the runtime
  uses `:scope > button` selection.
- Items MUST be `<li> <a>` or `<li> <button>`. A bare `<a>` directly
  under the menu element will not receive `role="menuitem"`.
- Tab does NOT cycle between the trigger and the menu items — focus
  remains on the trigger and ArrowUp/ArrowDown drive the highlight.
  This matches the WAI-ARIA menubar pattern but differs from listbox
  semantics.
- The dropdown does not flip automatically when it would overflow the
  viewport. Use `.nd-dropdown-up` or `.nd-dropdown-right` declaratively
  when you know the trigger sits near a viewport edge.

### See also

- [Select](#select) — for form-bound option lists.
- [Navigation](#navigation) — for top-bar and sidebar navigation.
- [Tooltips](#tooltips) — for read-only contextual hints.
- Source: `js/dropdown.js`, `scss/_dropdowns.scss`

## Navigation

ndesign styles the native `<nav>` element by default and provides
responsive top-bar and sidebar layouts. The runtime wires hamburger
toggles, side-nav overlays, and an auto-close on resize above the large
breakpoint. There is no SPA router — every menu link is a regular `<a>`.

### When to use

- Top-bar navigation across pages of an application.
- Persistent sidebar navigation in admin panels and dashboards.
- Mobile collapse of either layout into a hamburger menu.

### When NOT to use

- For switching between panels of a single screen — use [Tabs](#tabs).
- For action menus — use [Dropdowns](#dropdowns).

### Minimal example — top bar with mobile collapse

```html
<nav>
  <a href="/" class="nd-nav-brand">Acme</a>

  <button class="nd-nav-toggle" aria-label="Toggle menu" aria-expanded="false">&#9776;</button>

  <ul class="nd-nav-menu">
    <li><a href="/dashboard" class="nd-active">Dashboard</a></li>
    <li><a href="/users">Users</a></li>
    <li><a href="/settings">Settings</a></li>
  </ul>

  <div class="nd-nav-end">
    <button class="nd-btn-ghost" data-nd-theme-toggle>Theme</button>
  </div>
</nav>
```

### Minimal example — sidebar

```html
<nav class="sidebar">
  <a href="/" class="nd-nav-brand">Acme</a>

  <div class="nd-nav-section">Workspace</div>
  <ul class="nd-nav-menu">
    <li><a href="/dashboard" class="nd-active">Dashboard</a></li>
    <li><a href="/projects">Projects</a></li>
  </ul>

  <div class="nd-nav-section">Account</div>
  <ul class="nd-nav-menu">
    <li><a href="/profile">Profile</a></li>
    <li><a href="/billing">Billing</a></li>
  </ul>
</nav>
```

### Markup and classes

| Class                    | Effect                                                                  |
|--------------------------|-------------------------------------------------------------------------|
| `<nav>`                  | Native element — sticky top bar by default.                             |
| `.sidebar`               | Resets top-bar styles and applies vertical sidebar layout.              |
| `.sidebar-fixed`         | `position: fixed` sidebar pinned to the viewport.                       |
| `.nd-nav-brand`          | The brand label / logo block.                                           |
| `.nd-nav-brand-sub`      | Muted sub-line under the brand.                                         |
| `.nd-nav-menu`           | Flex (top bar) or column (sidebar) list of links.                       |
| `.nd-nav-end`            | Right-aligned trailing slot for actions.                                |
| `.nd-nav-section`        | Section header inside a sidebar (uppercase, muted).                     |
| `.nd-nav-toggle`         | Hamburger button. Hidden above `1280 px`.                               |
| `.nd-nav-side`           | Apply to a `<nav>` to enable the overlay-driven side-drawer behavior.   |
| `.nd-nav-open`           | Runtime-applied while the nav is expanded.                              |
| `.nd-nav-overlay`        | Auto-created behind a `.nd-nav-side` while it is open.                  |
| `.nd-active` (on `<a>`)  | Marks the current-page link.                                            |

### Dynamic bindings

| Attribute                       | Location                | Behavior                                                                                                |
|---------------------------------|-------------------------|---------------------------------------------------------------------------------------------------------|
| `.nd-nav-toggle`                | inside `<nav>` / `.nd-nav` | On click: toggles `nd-nav-open` on the closest `nav` / `.nd-nav` ancestor. Syncs `aria-expanded` on the toggle. |
| `.nd-nav-side`                  | on the `<nav>`           | When opened, the runtime appends a `.nd-nav-overlay` to `<body>`; clicking the overlay closes the nav. |
| `data-nd-toggle="sidebar"`      | any clickable element    | Legacy shortcut: toggles `nd-nav-open` on the first `.sidebar` plus an overlay on `.overlay` / `.nd-nav-overlay`. Independent of `initNav()`. Syncs `aria-expanded` on the trigger. |

A window-level `resize` listener auto-closes every open nav when
`window.innerWidth > 1280` so the user does not see a mobile drawer
stuck open after a resize to desktop.

### Events fired

Navigation does not dispatch custom events. Listen for `click` on
specific links if a host application needs to react.

### JS API

Navigation is wired automatically by `NDesign.init()`. There is no
public method to open or close a nav programmatically — toggle the
`nd-nav-open` class directly on the `<nav>` and update `aria-expanded`
on the toggle button.

### Accessibility

- `.nd-nav-toggle` SHOULD carry `aria-label` (the hamburger glyph has no
  accessible name) and starts with `aria-expanded="false"`. The runtime
  syncs the value on every toggle.
- The auto-created `.nd-nav-overlay` is decorative — clicking it closes
  the nav, but it is not focusable.
- Use `class="nd-active"` on the current-page link so screen-reader
  users hear the active state. Pair with `aria-current="page"` for
  redundancy.
- Sidebar menu link clicks on viewports below `1280 px` close the
  sidebar automatically (the delegated click handler in `ndesign.js`).

### Pitfalls

- `.nd-nav-toggle` MUST be inside a `<nav>` or `.nd-nav` ancestor —
  toggles outside that scope are silently ignored at init.
- Do NOT mix `.nd-nav-side` with `data-nd-toggle="sidebar"` on the same
  element. They are independent code paths and double-handling will
  open and immediately close the menu.
- A `<nav>` styled as a sidebar uses `.sidebar` (not `.nd-sidebar`) for
  historical reasons. Both class names appear in legacy markup; the
  framework currently keys off `.sidebar`.
- The auto-close-on-resize threshold is fixed at `1280 px` to match
  `$nd-bp-lg`. There is no configuration option.

### See also

- [Tabs](#tabs) — for in-page panel switching.
- [Dropdowns](#dropdowns) — for action menus inside the nav.
- [Theme](#theme) — pair `data-nd-theme-toggle` with the trailing slot.
- Source: `js/nav.js`, `scss/_nav.scss`

## Select

ndesign auto-enhances every non-multi `<select>` on the page into a
themed `.nd-select` wrapper at init time. The native `<select>` is hidden
but **kept in the layout** (zero-sized, opacity 0) so browser form
validation, the form-submission value, and `<label for>` association all
continue to work. The visible UI is a custom listbox driven by the
runtime, fully keyboard-accessible.

### When to use

- Single-choice form fields where consistent theming across browsers
  matters.
- Selects whose options are populated dynamically from a server response
  via [Data binding](#data-binding) (`data-nd-options`).

### When NOT to use

- For multi-select inputs — `<select multiple>` is **skipped** at init
  and rendered as the native control. Ndesign does not provide a
  multi-select widget.
- For action menus — use [Dropdowns](#dropdowns).
- For very long option lists requiring server-side search — author a
  custom search input plus [Data binding](#data-binding) result list.

### Minimal example

```html
<label for="country">Country</label>
<select id="country" name="country" required>
  <option value="">Choose a country</option>
  <optgroup label="Europe">
    <option value="de">Germany</option>
    <option value="fr">France</option>
  </optgroup>
  <optgroup label="Americas">
    <option value="us" selected>United States</option>
    <option value="ca">Canada</option>
  </optgroup>
</select>
```

### Markup and classes

Authors write a plain `<select>`. The runtime inserts the wrapper
markup as a sibling immediately after the native element. The following
classes describe the runtime-generated DOM for theming reference.

| Class                       | Effect                                                                |
|-----------------------------|-----------------------------------------------------------------------|
| `.nd-select`                | Custom wrapper. `position: relative`.                                 |
| `.nd-select.nd-open`        | Runtime-applied while the dropdown is expanded.                       |
| `.nd-select.nd-disabled`    | Mirrors `<select disabled>`.                                          |
| `.nd-select-trigger`        | The visible `<button type="button">` that toggles the listbox.        |
| `.nd-select-value`          | The `<span>` showing the current option's label.                      |
| `.nd-select-arrow`          | Decorative chevron.                                                   |
| `.nd-select-dropdown`       | The `<ul role="listbox">`.                                            |
| `.nd-select-option`         | A `<li role="option">`.                                               |
| `.nd-select-option.nd-selected`    | Currently selected option.                                     |
| `.nd-select-option.nd-highlighted` | Keyboard / hover focus marker.                                  |
| `.nd-select-option.nd-disabled`    | Mirrors `<option disabled>`.                                    |
| `.nd-select-group`          | A `<li role="presentation">` rendered from each `<optgroup>` label.   |

`<optgroup>` labels are rendered as inert section headings; the options
inside are flat in the listbox.

### Dynamic bindings

The select wrapper itself does not consume `data-nd-*` attributes — but
two binding directives work in concert with this component:

| Attribute              | Location          | Behavior                                                                                                                     |
|------------------------|-------------------|------------------------------------------------------------------------------------------------------------------------------|
| `data-nd-options`      | the `<select>`    | Populates `<option>` elements from a JSON array fetched by [Data binding](#data-binding). Mechanics live in [Data binding](#data-binding). |
| `data-nd-bind`         | the `<select>`    | Re-fetches the option list when triggered. After mutation, callers SHOULD invoke `NDesign.refreshSelect(selectEl)` (see JS API). |

When the native option list changes (programmatic `appendChild`,
binding-driven re-population, etc.) the visible custom dropdown does
not auto-rebuild. Call `refreshSelect(selectEl)` to rewrap.

### Events fired

The custom select forwards selection changes to the native `<select>`
and dispatches a standard bubbling `change` event on it. Application
code (and `data-nd-model`) MAY listen for `change` on the native
element exactly as it would for an unenhanced select.

### JS API

```javascript
import { initSelects, refreshSelect, destroySelects } from 'ndesign';
// or via NDesign global once init() has run
```

| Method                          | Behavior                                                                                                                                                  |
|---------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `initSelects()`                 | Wraps every eligible `<select>` (skips `multiple` and any select already inside `.nd-select`). Called automatically by `NDesign.init()`.                  |
| `refreshSelect(selectEl)`       | Tear down and rebuild the custom dropdown for one `<select>`. No-op if the element is not tracked. Used after `<option>` mutations.                       |
| `destroySelects()`              | Restore every native `<select>` and remove every wrapper. Called by `NDesign.init()` on re-init.                                                          |

### Accessibility

- The trigger has `aria-haspopup="listbox"` and `aria-expanded` synced
  with the open state.
- The list has `role="listbox"`; each option carries `role="option"` and
  `aria-selected` reflects the current value.
- A `<label for>` associated with the native `<select>` is mirrored as
  `aria-label` on the trigger so the visible custom UI is announced
  correctly.
- The native element is **not** removed — `required`, `pattern`, and
  custom validity messages still fire; submitting the form sends the
  native value.

Keyboard map (focus on the trigger):

| Key                 | Effect                                                                       |
|---------------------|------------------------------------------------------------------------------|
| `ArrowDown`         | Open if closed and highlight first / next option. Skips disabled options.    |
| `ArrowUp`           | Open if closed and highlight last / previous option. Skips disabled options. |
| `Enter` / `Space`   | Open if closed; otherwise commit the highlighted option.                     |
| `Escape`            | Close the dropdown without changing the value.                               |
| Printable character | Type-ahead: jump to the first option whose label starts with the buffered string. Buffer resets after 500 ms of inactivity. |

The dropdown closes on outside click. A form `reset` event re-syncs the
trigger label and the highlighted option after a deferred tick.

### Pitfalls

- The runtime checks for `<select multiple>` and **skips it**. If you
  need a multi-select, the native control is what your users see.
- Mutating `<option>` children after init does **not** update the
  custom UI. Call `NDesign.refreshSelect(selectEl)` after any
  programmatic mutation.
- To opt out of enhancement, either set `multiple` or wrap the
  `<select>` inside an existing `.nd-select` ancestor before
  `initSelects()` runs (the runtime detects pre-wrapped selects and
  leaves them alone).
- Custom `setCustomValidity()` messages are cleared automatically on
  every `change` event so the validation reset matches the visible
  UI's behavior.

### See also

- [Data binding](#data-binding) — `data-nd-options` and `data-nd-model`.
- [Dropdowns](#dropdowns) — for non-form action menus.
- Source: `js/select.js`, `scss/_forms.scss`

## Theme

ndesign ships two themes — `light` and `dark` — and supports any number
of custom themes registered via `<meta>` tags. The runtime swaps the
active stylesheet by replacing a single `<link class="theme">` element
in the document head, waiting for the new sheet to load before removing
the old one to avoid a flash of unstyled content.

### When to use

- Adding a theme switcher (manual light / dark toggle, or N-way cycle).
- Loading a tenant- or user-specific theme stylesheet at runtime without
  reloading the page.

### When NOT to use

- For one-off color overrides — extend the theme with custom properties
  (`--nd-accent` etc.) on the parent stylesheet instead of swapping
  whole stylesheets.

### Setup

Declare each available theme twice:

1. A `<meta name="nd-theme">` tag registers the theme name and its
   stylesheet URL.
2. A `<link class="theme" data-theme="...">` carries the *currently
   active* theme. There MUST be exactly one such link in the document.

```html
<head>
  <!-- Registry: one meta per theme. -->
  <meta name="nd-theme" content="light" data-href="/dist/themes/light.min.css">
  <meta name="nd-theme" content="dark"  data-href="/dist/themes/dark.min.css">

  <!-- Active stylesheet — must carry class="theme" and data-theme. -->
  <link rel="stylesheet"
        href="/dist/themes/light.min.css"
        class="theme"
        data-theme="light">
</head>
```

### Markup and classes

| Selector                              | Effect                                                                                                                |
|---------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| `meta[name="nd-theme"][content]`      | Theme registry. `content` is the theme name; `data-href` is the stylesheet URL the runtime swaps in.                   |
| `link.theme`                          | The active theme stylesheet. Replaced atomically on switch. `data-theme` MUST match the registered name.              |

### Dynamic bindings

The single delegated click handler processes:

| Attribute                  | Location              | Behavior                                                  |
|----------------------------|-----------------------|-----------------------------------------------------------|
| `data-nd-theme="NAME"`     | any clickable element | Click calls `setTheme(NAME)`. Calls `e.preventDefault()`. |
| `data-nd-theme-toggle`     | any clickable element | Click calls `toggleTheme()`. Calls `e.preventDefault()`.  |

```html
<button class="nd-btn-ghost" data-nd-theme-toggle>Theme</button>

<button data-nd-theme="light">Light</button>
<button data-nd-theme="dark">Dark</button>
```

### JS API

```javascript
NDesign.setTheme('dark');           // → void
NDesign.toggleTheme();              // → void; cycles to the next registered theme
NDesign.getThemes();                // → [{name, label, active}, ...]
```

| Method               | Behavior                                                                                                                                                            |
|----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `setTheme(name)`     | Looks up `meta[name="nd-theme"][content="<name>"]`, inserts a fresh `<link class="theme">`, and removes the old one after `load`. No-op if the theme is unknown or already active. Warns when the theme name is not registered. |
| `toggleTheme()`      | Cycles through registered themes in document order, wrapping at the end.                                                                                            |
| `getThemes()`        | Returns one object per registered meta: `{ name, label, active }`. `label` is the name with the first character upper-cased (compatibility shim — apps SHOULD generate their own labels for i18n). |

### Accessibility

- Theme triggers SHOULD be real `<button>` elements (they call
  `e.preventDefault()` on click, but anchors without `href` are still
  not keyboard-accessible).
- The runtime does not announce the theme change to screen readers. If
  the visible label of the trigger changes (e.g. "Switch to dark"
  becoming "Switch to light"), the change is read on next focus.
- `prefers-color-scheme` is **not** consulted automatically. Application
  code SHOULD read the media query and call `setTheme()` on first load
  if it wants OS-driven defaults.

### Pitfalls

- **Do NOT use `title="..."` on the theme `<link>`.** Per the HTML
  spec, `<link rel="stylesheet" title>` becomes an "alternate
  stylesheet" that the browser will not apply unless explicitly
  selected via the View menu. Use `data-theme="..."` instead. This is
  the single most common theme bug.
- The active link MUST carry `class="theme"`. Without it, `setTheme()`
  no-ops because there is no element to replace.
- The `<meta name="nd-theme">` registry MUST be present at init time.
  Adding a meta after `NDesign.init()` does not retroactively register
  the theme — call `NDesign.setTheme()` instead, which scans the meta
  list on every call.
- The runtime does not persist theme choice. Persisting across reloads
  (localStorage, a cookie, or a server-rendered `class` on `<html>`)
  is the application's responsibility.
- A theme stylesheet that fails to load leaves the page in a broken
  state — the new `<link>` exists but never fires `load`, so the old
  stylesheet stays. Verify URLs in `data-href` against your CDN.

### See also

- [Navigation](#navigation) — typical home for the theme toggle.
- Source: `js/ndesign.js` (`setTheme`, `toggleTheme`, `getThemes`),
  `scss/themes/light.scss`, `scss/themes/dark.scss`.

## Sortable

`data-nd-sortable` turns a container's direct children into a
drag-and-drop reorderable list with full keyboard support, optional
server-sync POST on every reorder, automatic revert on failure, and
opt-in cross-container drag for kanban-style boards. The runtime uses
the native HTML5 drag-and-drop API and a `MutationObserver` to wire
children added after init.

### When to use

- Reordering rows in a list whose order is meaningful (todo lists,
  playlist queues, prioritized backlogs).
- Kanban boards with N status columns — each column is one sortable
  container, all sharing a `data-nd-sortable-group`.
- Client-only reorders where the order is read on the next form submit
  (no URL on the attribute).

### When NOT to use

- For sorting by a column header (alphabetic / numeric) — use a sortable
  table component or a `data-nd-bind` re-fetch with sort params.
- For nested trees with drop-into-item semantics — sortable only
  reorders peers; it does not nest.

### Minimal example — single list with server sync

```html
<ul data-nd-sortable="POST ${api}/api/todos/reorder">
  <li data-id="1" tabindex="0">First</li>
  <li data-id="2" tabindex="0">Second</li>
  <li data-id="3" tabindex="0">Third</li>
</ul>
```

After every reorder the runtime POSTs `{"order": ["1","2","3"]}` to the
URL. On a non-2xx response, the DOM reverts to the pre-drag order, the
container shakes, and a toast surfaces the error.

### Markup and classes

The author MAY apply zero ndesign classes — `data-nd-sortable` alone is
enough. Children are made `draggable="true"` automatically. The
following classes are runtime-applied or available for theming.

| Class                           | Effect                                                                  |
|---------------------------------|-------------------------------------------------------------------------|
| `.nd-sortable` (optional)       | Authoring class for grab cursor, focus ring, dragging / grabbed states. |
| `.nd-dragging` (runtime)        | The item currently being mouse-dragged.                                 |
| `.nd-kb-grabbed` (runtime)      | The item picked up by keyboard.                                         |
| `.nd-sortable-error` (runtime)  | Applied for 2 s after a server-sync failure (shake + danger outline).   |
| `[aria-grabbed="true"]` (runtime) | Equivalent style hook to `.nd-kb-grabbed`.                            |

### Dynamic bindings

| Attribute                          | Location           | Behavior                                                                                                                                                              |
|------------------------------------|--------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `data-nd-sortable`                 | container element  | Empty value: client-only reorder. `"METHOD URL"`: POST `{order: [...]}` to the URL after every reorder. URL is `${var}`-resolved at fetch time.                       |
| `data-nd-sortable-group="NAME"`    | container element  | Two or more containers with the same non-empty group accept drops from each other (cross-container drag).                                                              |
| `data-nd-sortable-refresh="CSV"`   | container element  | Comma-separated CSS selectors. After a successful reorder, dispatches `nd:refresh` on every match — pair with `data-nd-bind` to re-pull sibling columns declaratively. |
| `data-id`                          | each direct child  | Identifier emitted in the `order` array. Falls back to the child's zero-based positional index as a string when omitted.                                              |

`data-nd-sortable-live` is auto-added to a hidden `aria-live` polite
region the runtime injects into `<body>` for screen-reader
announcements. Authors do not need to create it.

### Wiring

On init each `[data-nd-sortable]` container:

- Sets `role="listbox"` (skipped for `<ul>` / `<ol>`, which carry
  implicit list semantics) and a default `aria-label="Reorderable list"`
  if no label is present.
- Walks every direct child and applies `draggable="true"`,
  `tabindex="0"` (when absent), and `aria-grabbed="false"`. Non-list
  containers also get `role="option"` on each child.
- Registers a `MutationObserver` for child additions so dynamically
  rendered rows are wired automatically. Children removed by the
  application are forgotten naturally.

### Mouse drag behavior

While dragging the dragged item is reordered live so the user always
sees the drop slot. On drop:

1. `nd:sortable:reorder` is dispatched on the destination container with
   `detail = { order, item, source, crossContainer }`.
2. If the destination's `data-nd-sortable` carries a URL, the runtime
   POSTs `{ "order": [...] }` with the destination's new order. The
   source container is **not** re-POSTed on cross-container drops — the
   server is expected to infer the state change from the destination
   URL (e.g. a `?status=` query parameter).

### Keyboard behavior (WAI-ARIA Listbox reordering)

Tab to a child to focus it, then:

| Key            | When focused (no grab)                        | When grabbed                                                |
|----------------|-----------------------------------------------|-------------------------------------------------------------|
| `Space`        | Grab the item.                                | Drop at current position; submit reorder.                   |
| `ArrowUp`      | Move focus to the previous draggable.         | Move the grabbed item up one position.                      |
| `ArrowDown`    | Move focus to the next draggable.             | Move the grabbed item down one position.                    |
| `Home`         | —                                             | Move the grabbed item to the first position.                |
| `End`          | —                                             | Move the grabbed item to the last position.                 |
| `Escape`       | —                                             | Cancel the grab; restore pre-grab order.                    |

Keyboard drag is intentionally **constrained to the grabbed
container** — there is no obvious arrow-key affordance for jumping
between columns. Cross-container moves are mouse-only by design.

### Revert-on-failure

When a server POST returns non-2xx (or the request fails outright):

1. The source container's children are restored to the pre-drag
   snapshot. For cross-container drops, the moved item is returned to
   the source first, then the snapshot is applied — both columns end
   up in their pre-drag state.
2. The destination receives `nd-sortable-error` for 2 s (shake animation
   + danger outline).
3. `NDesign.toast(message, 'error')` fires. The message is read from
   `responseData.errors._form` or `responseData.message` when the
   response is JSON; otherwise a generic
   *"Reorder failed — order has been reverted."* is shown.
4. `nd:sortable:revert` is dispatched on the destination with
   `detail = { item, source }`.
5. The same message is announced via the shared `aria-live` region.

The reorder POST honors `NDesign.configure({ headers: ... })` —
bearer tokens and `X-CSRF-Token` set globally reach the endpoint
unchanged. See [Data binding](#data-binding) for the full configuration
surface.

### Cross-container drag (`data-nd-sortable-group`)

Two or more containers declaring the same non-empty
`data-nd-sortable-group` accept drops from each other. Containers
without a group attribute keep the prior in-container-only behavior.
After a successful cross-container POST, `data-nd-sortable-refresh` on
*either* container dispatches `nd:refresh` on every selected element so
sibling columns can re-pull their contents declaratively.

#### Kanban example

```html
<section class="kanban">
  <ul data-nd-sortable="POST ${api}/api/tasks/move?status=todo"
      data-nd-sortable-group="tasks"
      data-nd-sortable-refresh="#doing,#done"
      id="todo"></ul>

  <ul data-nd-sortable="POST ${api}/api/tasks/move?status=doing"
      data-nd-sortable-group="tasks"
      data-nd-sortable-refresh="#todo,#done"
      id="doing"></ul>

  <ul data-nd-sortable="POST ${api}/api/tasks/move?status=done"
      data-nd-sortable-group="tasks"
      data-nd-sortable-refresh="#todo,#doing"
      id="done"></ul>
</section>
```

Dragging a card from `#todo` into `#doing` POSTs
`/api/tasks/move?status=doing` with the new `#doing` order, then
dispatches `nd:refresh` on `#todo` and `#done`. Pair `nd:refresh` with
a `data-nd-bind` element whose URL reloads that column to close the
loop.

### Events fired

| Event                | Target                                       | Detail                                          | When                                                                                       |
|----------------------|----------------------------------------------|-------------------------------------------------|--------------------------------------------------------------------------------------------|
| `nd:sortable:reorder`| destination container                        | `{ order, item, source, crossContainer }`       | After a mouse drop OR a keyboard Space-to-drop. Bubbles.                                   |
| `nd:sortable:revert` | destination container                        | `{ item, source }`                              | After a server POST failure has restored the snapshot. Bubbles.                            |
| `nd:refresh`         | every match of `data-nd-sortable-refresh`    | none                                            | After a successful reorder. Bubbles. Consumed by `data-nd-bind` to re-fetch.               |

### JS API

Sortable is wired by `NDesign.init()`. There is no public method to
trigger a reorder programmatically — manipulate `container.children`
directly and the `MutationObserver` will keep them wired.

`destroySortable()` is exported for re-init: cancels any active
keyboard grab, removes listeners, disconnects the observer, and clears
the `draggable` / `tabindex` attributes the runtime added.

### Accessibility

- Each child becomes keyboard-focusable (`tabindex="0"`).
- The shared `aria-live` polite region announces grab, every position
  change while grabbed, drop, cancel, and server-side errors.
- `aria-grabbed` is toggled on the active item during both mouse and
  keyboard drag.
- The container's `aria-label` defaults to `"Reorderable list"` —
  override it (or use `aria-labelledby`) for any non-trivial UI so
  screen readers identify the list.

### Pitfalls

- The container MUST be a stable parent. Replacing the entire container
  with `data-nd-bind` mode `replace` discards the runtime's listeners
  and the `MutationObserver`. Use mode `inner` or wrap the binding
  inside the sortable container.
- `data-id` on each child is strongly recommended. Without it, the
  emitted `order` array is just `["0","1","2",...]`, which is useless
  to a server endpoint.
- Cross-container drag requires **both** containers to opt in. A drag
  from a grouped container into a non-grouped one is silently rejected
  during `dragover`.
- Keyboard drag does not cross containers even when groups match —
  this is intentional. Implement an explicit "Move to column X" menu
  if cross-column keyboard moves are required.
- The reorder POST sends only `{ "order": [...] }` — there is no
  per-item position field, no `from` / `to` indices, and no delta
  encoding. The server is responsible for diffing against its current
  ordering.

### See also

- [Data binding](#data-binding) — `nd:refresh` and the unified error
  envelope.
- [Toasts](#toasts) — surface the revert message.
- Source: `js/sortable.js`, `scss/_sortable.scss`

## Upload

`data-nd-upload` intercepts a `<form>` submit and routes it through
`XMLHttpRequest` so the upload progress event is observable. The browser
serializes the form via `FormData` (so `<input type="file">` works
unchanged) and the runtime updates a `<progress>` element inside the
form as bytes are transmitted. Success and error rendering reuse the
same chain as `data-nd-action`, so feedback messages, field error
display, and success-action chaining behave consistently.

### When to use

- Any form that contains a file input. `data-nd-action` uses `fetch`
  and cannot expose upload progress; `data-nd-upload` exists for that
  reason.
- Multipart submissions that the user expects to take longer than a few
  hundred milliseconds.

### When NOT to use

- For JSON-only forms with no file input — use `data-nd-action`. See
  [Data binding](#data-binding).
- For background sync of local files — there is no resume support.

### Minimal example

```html
<form data-nd-upload="POST ${api}/api/uploads"
      data-nd-feedback="upload-msg"
      data-nd-success="toast:Uploaded">
  <label>
    File
    <input type="file" name="file" required>
  </label>

  <progress class="nd-upload-progress" hidden></progress>

  <button type="submit" class="nd-btn-primary">Upload</button>
</form>

<div id="upload-msg"></div>
```

### Markup and classes

| Class                       | Effect                                                                |
|-----------------------------|-----------------------------------------------------------------------|
| `<input type="file">`       | Native element. Themed (`::file-selector-button` matches `nd-btn`).   |
| `progress.nd-upload-progress` | Optional progress bar inside the form. Starts `hidden`; revealed during upload, hidden again 1 s after completion. |
| `.nd-loading` (runtime)     | Applied to the submit button while a request is in flight.            |
| `.nd-alert.nd-alert-success` | Applied to the feedback element on success.                          |
| `.nd-alert.nd-alert-error`  | Applied to the feedback element on failure.                           |

### Dynamic bindings

| Attribute                       | Location              | Behavior                                                                                                                                                                |
|---------------------------------|-----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `data-nd-upload="METHOD URL"`   | `<form>` only         | Hijacks submit. Method defaults to `POST`. URL is `${var}`-resolved at submit time (see [Data binding](#data-binding) for store interpolation).                         |
| `data-nd-feedback="ID"`         | `<form>`              | Element id receiving the success / error message text.                                                                                                                  |
| `data-nd-confirm="MESSAGE"`     | `<form>`              | Shows a `window.confirm` prompt before submitting. Cancellation aborts the upload silently.                                                                              |
| `data-nd-success="CHAIN"`       | `<form>`              | Comma-separated success actions executed after a 2xx response. Same vocabulary as `data-nd-action` (`refresh:#sel`, `redirect:/path`, `toast:msg`, `close-modal`, ...).  |
| `progress.nd-upload-progress`   | inside the `<form>`   | Optional. When present, `value` is updated from `xhr.upload.progress` (capped at `max=100`).                                                                            |

`data-nd-set` is **NOT** processed on upload forms. If a server response
needs to drive a store mutation, listen for the success chain or call
`NDesign.store.set(...)` from a custom handler.

### Headers and CSRF

The XHR sets exactly two headers manually:

- `X-Requested-With: NDesign`
- `X-CSRF-Token: <meta name="csrf-token">` (only when the meta tag is
  present)

The browser sets `Content-Type: multipart/form-data; boundary=...`
automatically from the `FormData`. **Do not override it** — without the
boundary parameter the server cannot parse the body.

Upload runs on the legacy XHR path and does not consume
`NDesign.configure({ headers: ... })` automatically. Custom headers
SHOULD be applied via a server-side proxy or by adding them through
`onRequest` when migrating off this path.

### Error handling

The upload handler dispatches the response payload through the same
helpers used by form actions:

- **2xx** — `handleSuccess(form, responseData)` runs the
  `data-nd-success` chain. The feedback element shows
  `responseData.message` or "Upload complete".
- **non-2xx with JSON `errors`** — `displayErrors(form, errors,
  feedbackId)` paints `.nd-form-error` next to fields and the global
  `errors._form` / `errors.error` message into the feedback element.
- **non-2xx without JSON** — the feedback element shows the response
  text or `xhr.statusText`.

The upload module pre-dates the unified error envelope rollout. It
recognises field errors but does **not** invoke `config.onError` —
treat it as a legacy code path until parity work lands. See
[Data binding → Error envelope](#error-envelope) for the canonical
shape.

A network failure dispatches `xhr.onerror` and sets the feedback to
*"Network error. Please try again."* An aborted request (typically
because `destroyUploads()` ran mid-flight) sets the feedback to
*"Upload cancelled."*

### Events fired

Upload does not dispatch ndesign-specific custom events. The native
`submit` event is intercepted with `e.preventDefault()`. To observe
progress programmatically, listen for `xhr.upload.progress` from a
custom interceptor — there is no public hook on the form itself.

### JS API

Upload is wired by `NDesign.init()` for every `form[data-nd-upload]`
present at init time.

| Method               | Behavior                                                                                                                                            |
|----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| `initUploads()`      | Idempotent. Skips forms already wired. Called automatically by `NDesign.init()`.                                                                    |
| `destroyUploads()`   | Removes every submit handler **and aborts any in-flight `XMLHttpRequest`**. Called by `NDesign.init()` on re-init. Aborted XHRs surface a "cancelled" feedback. |

### Accessibility

- `<input type="file">` is the native control — accessible label
  comes from a wrapping `<label>` or `<label for>` exactly as for any
  form input.
- The `<progress>` element provides built-in screen-reader semantics
  (current value vs. max). No additional ARIA is needed.
- The submit button is disabled while uploading and carries the
  `nd-loading` class for visual feedback. Re-enable it manually only if
  custom code intercepts the upload — the standard handler restores it
  on `load` / `error` / `abort`.

### Pitfalls

- `data-nd-upload` is valid **only on `<form>`**. Applying it to a
  `<button>` or other element is a silent no-op.
- The `<progress>` element MUST start with the `hidden` attribute. The
  runtime removes the attribute on submit and re-adds it 1 s after
  completion. A `<progress>` without `hidden` is visible immediately at
  page load with `value="0"` — looks broken.
- File inputs MUST have a `name` attribute, otherwise `FormData`
  silently omits them. There is no warning.
- Setting `Content-Type` manually (e.g. via a `<meta>`-driven header)
  prevents the browser from injecting the multipart boundary; the
  server then fails to parse the body. The runtime never sets
  `Content-Type` on the XHR for this reason.
- `data-nd-set` is intentionally NOT processed on upload forms. Migrate
  to `data-nd-action` (with no file input) when you need direct store
  mutation, or chain `toast:` / `refresh:` and let the server response
  drive subsequent fetches.
- A re-init via `NDesign.init()` aborts any active upload — the user
  sees an "Upload cancelled" feedback. Avoid wholesale re-init while
  uploads are in flight.

### See also

- [Data binding](#data-binding) — `data-nd-success`, `data-nd-feedback`,
  `data-nd-confirm`, and the error envelope.
- [Toasts](#toasts) — surface upload completion via
  `data-nd-success="toast:Uploaded"`.
- Source: `js/upload.js`, `scss/_uploads.scss`

## Reference

This section is the lookup appendix. Every attribute, meta tag,
runtime CSS class, JS API method, and event the runtime understands
appears in one of the tables below, with a link to the section that
explains it.

### Attribute reference

Alphabetical list of every `data-nd-*` attribute the runtime
processes.

| Attribute                  | One-line description                                                                  | Section |
|----------------------------|---------------------------------------------------------------------------------------|---------|
| `data-nd-action`           | Form/button action: `"METHOD URL"`, submits JSON and handles the response.            | [data-nd-action](#data-nd-action--forms-and-button-actions) |
| `data-nd-attr`             | On a `data-nd-bind` element with `data-nd-field`, writes the value to a DOM attribute. | [Attribute write](#attribute-write--data-nd-attrname) |
| `data-nd-bind`             | Fetch a JSON URL and render into the element (field or template).                     | [data-nd-bind](#data-nd-bind--fetch-and-render) |
| `data-nd-bind-mode`        | On a bind trigger: override the target's `data-nd-mode` (e.g. `append`).              | [Triggers](#triggers--data-nd-bind-trigger-and-data-nd-bind-mode) |
| `data-nd-bind-trigger`     | CSS selector: clicking this element refetches the matching bound element.             | [Triggers](#triggers--data-nd-bind-trigger-and-data-nd-bind-mode) |
| `data-nd-body`             | JSON template body for a button `data-nd-action` (buttons only).                      | [Button body template](#button-body-template--data-nd-body) |
| `data-nd-confirm`          | Text → `window.confirm()`; `"#dialog-id"` → async `<dialog>` confirm.                 | [Confirmation](#confirmation--data-nd-confirm) |
| `data-nd-confirm-accept`   | On a button inside a confirm `<dialog>`: resolves `confirmDialog()` as `true`.        | [Modals](#modals) |
| `data-nd-defer`            | Skip the initial auto-fetch on a `data-nd-bind` element.                              | [Deferred fetch](#deferred-fetch--data-nd-defer) |
| `data-nd-dismiss`          | On a button inside `<dialog>`: closes the dialog.                                     | [Modals](#modals) |
| `data-nd-empty`            | `<template data-nd-empty>`: shown when a bound array is empty.                        | [Loading, empty, and error templates](#loading-empty-and-error-templates) |
| `data-nd-error`            | `<template data-nd-error>`: rendered when a bound fetch fails.                        | [Loading, empty, and error templates](#loading-empty-and-error-templates) |
| `data-nd-feedback`         | ID of a feedback element that receives server messages for this action/upload.        | [Feedback element](#feedback-element--data-nd-feedbackid-and-the-auto-slot) |
| `data-nd-field`            | Dot-path extracting a scalar from response data (for bind/sse/ws).                    | [Scalar field binding](#scalar-field-binding--data-nd-fieldpath) |
| `data-nd-if`               | Inside a template: remove the element when the named field is falsy.                  | [Templates and {{field}} interpolation](#templates-and-field-interpolation) |
| `data-nd-loading`          | `<template data-nd-loading>`: shown while a bound fetch is in flight.                 | [Loading, empty, and error templates](#loading-empty-and-error-templates) |
| `data-nd-max`              | Maximum number of rendered children for append/prepend rendering.                     | [Render mode](#render-mode-and-data-nd-max) |
| `data-nd-modal`            | CSS selector: opens the target `<dialog>` when clicked.                               | [Modals](#modals) |
| `data-nd-mode`             | Render mode: `replace` (default), `append`, `prepend`.                                | [Render mode](#render-mode-and-data-nd-max) |
| `data-nd-model`            | Two-way bind a form input to a store var.                                              | [data-nd-model](#data-nd-model--two-way-form-binding) |
| `data-nd-on`               | Escape hatch: `"event:handlerName"`; calls `window[handlerName](e, el)`.              | [Escape hatch](#escape-hatch--data-nd-on) |
| `data-nd-options`          | On a `<select data-nd-bind>`: populate `<option>`s from a JSON array (`"value:label"`). | [Select population](#select-population--data-nd-optionsvaluelabel) |
| `data-nd-params`           | Extra query string appended to the bind URL.                                          | [data-nd-bind](#data-nd-bind--fetch-and-render) |
| `data-nd-refresh`          | Polling interval (ms) for a bound element.                                            | [Polling](#polling--data-nd-refreshms) |
| `data-nd-select`           | Dot-path selecting a sub-field of the response before rendering (envelope unwrap).    | [Envelope unwrap](#envelope-unwrap--data-nd-selectpath) |
| `data-nd-set`              | Write one or more values into the store (response, literal, ref, or arithmetic).      | [data-nd-set](#data-nd-set--write-to-the-store) |
| `data-nd-sortable`         | Mark a container as sortable; optional `"METHOD URL"` to POST new order.              | [Sortable](#sortable) |
| `data-nd-sortable-group`   | Opt containers with the same value into cross-container drag-and-drop.                | [Sortable](#sortable) |
| `data-nd-sortable-refresh` | CSV of selectors to `nd:refresh` after a successful reorder (pairs with group).       | [Sortable](#sortable) |
| `data-nd-sse`              | Connect to a server-sent events stream and render messages.                           | [data-nd-sse](#data-nd-sse--server-sent-events) |
| `data-nd-sse-event`        | Filter for a named SSE event type (default is the generic `message`).                 | [data-nd-sse](#data-nd-sse--server-sent-events) |
| `data-nd-success`          | Comma-separated chain of post-success actions.                                        | [Success chain](#success-chain--data-nd-successactionaction) |
| `data-nd-tab` *(role=tab)* | Use `role="tab"` and `aria-controls="panel-id"` — tab container is `.nd-tabs`.        | [Tabs](#tabs) |
| `data-nd-template`         | ID of a `<template>` element used to render a bind/sse/ws response.                   | [Template binding](#template-binding--data-nd-templateid) |
| `data-nd-theme`            | On a click target: set the theme by name (matches `<meta name="nd-theme">`).          | [Theme](#theme) |
| `data-nd-theme-toggle`     | Cycle to the next registered theme on click.                                          | [Theme](#theme) |
| `data-nd-timeout`          | Per-element fetch timeout in ms; overrides `config.timeout` (default 15000).          | [Per-element timeout](#per-element-timeout--data-nd-timeoutms) |
| `data-nd-toast`            | Message to show in a toast when the element is clicked.                               | [Toasts](#toasts) |
| `data-nd-toast-type`       | Type for a `data-nd-toast` trigger: `success`, `error`, `warning`, `info`.            | [Toasts](#toasts) |
| `data-nd-toast-duration`   | Duration (ms) for a `data-nd-toast` trigger; 0 = persistent.                          | [Toasts](#toasts) |
| `data-nd-toggle`           | `"sidebar"`: toggles `.sidebar` and an overlay (auto-wired delegated click).          | [Navigation](#navigation) |
| `data-nd-tooltip`          | Text shown in a tooltip on hover/focus.                                               | [Tooltips](#tooltips) |
| `data-nd-tooltip-placement`| `top` (default), `bottom`, `left`, `right`.                                           | [Tooltips](#tooltips) |
| `data-nd-upload`           | Form multipart upload endpoint: `"METHOD URL"`. XHR with progress.                    | [Upload](#upload) |
| `data-nd-ws`               | Connect to a WebSocket URL and render messages.                                       | [data-nd-ws](#data-nd-ws--websockets) |
| `data-nd-ws-filter`        | `"field:value"` — only render messages whose field matches.                           | [data-nd-ws](#data-nd-ws--websockets) |

### Meta tag reference

Meta tag namespaces the runtime reads at init.

| Meta name            | Purpose                                                                  | Section |
|----------------------|--------------------------------------------------------------------------|---------|
| `endpoint:NAME`      | Registers a URL base under `NAME`, resolvable via `${NAME}`.             | [Store, meta tags, and ${var} interpolation](#store-meta-tags-and-var-interpolation) |
| `var:NAME`           | Registers an initial value under `NAME`, resolvable via `${NAME}`.       | [Store, meta tags, and ${var} interpolation](#store-meta-tags-and-var-interpolation) |
| `csrf-token`         | Read by `buildHeaders()` and upload, sent as `X-CSRF-Token`.             | [Configuration](#configuration) |
| `nd-theme`           | Registers a named theme; `data-href` points at its stylesheet.           | [Theme](#theme) |

### Runtime CSS classes

Classes the runtime ADDS at runtime. They are NOT classes consumers
write by hand; consumers MAY style them in CSS.

| Class                      | Added by                                                          | Section |
|----------------------------|-------------------------------------------------------------------|---------|
| `nd-loading`               | Bind in flight; action/upload submit in flight.                    | [data-nd-bind](#data-nd-bind--fetch-and-render), [data-nd-action](#data-nd-action--forms-and-button-actions) |
| `nd-error`                 | Bind fetch failed; action failed; field with a validation error.   | [Loading, empty, and error templates](#loading-empty-and-error-templates), [Error envelope](#error-envelope) |
| `nd-ws-connected`          | Element's WebSocket is currently open.                            | [data-nd-ws](#data-nd-ws--websockets) |
| `nd-ws-disconnected`       | Element's WebSocket is closed or connecting.                      | [data-nd-ws](#data-nd-ws--websockets) |
| `nd-dragging`              | Mouse-dragged sortable item.                                      | [Sortable](#sortable) |
| `nd-kb-grabbed`            | Keyboard-grabbed sortable item.                                    | [Sortable](#sortable) |
| `nd-sortable-error`        | Briefly applied to a container after a revert.                     | [Sortable](#sortable) |
| `nd-form-feedback-auto`    | Auto-created feedback slot for forms/buttons without `data-nd-feedback`. | [Feedback element](#feedback-element--data-nd-feedbackid-and-the-auto-slot) |

### Public JS API

`window.NDesign.*` methods. The runtime is exposed as an IIFE
attached to `window`; these are the supported entry points.

| Name                                          | Description                                                       | Section |
|-----------------------------------------------|-------------------------------------------------------------------|---------|
| `NDesign.configure(partial)`                  | Merge runtime configuration.                                       | [Configuration](#configuration) |
| `NDesign.init()`                              | Re-init the runtime (tears down first).                           | [Lifecycle and initialization](#lifecycle-and-initialization) |
| `NDesign.store.get(key)`                      | Read a top-level var.                                             | [Store API](#store-api) |
| `NDesign.store.set(key, value)`               | Write a top-level var (does NOT fire `nd:var-change`).            | [Store API](#store-api) |
| `NDesign.store.has(key)` / `delete` / `clear` | Standard map ops on top-level vars.                               | [Store API](#store-api) |
| `NDesign.storeGet(path)`                      | Read a var by dot-path (fires through `getVar`).                  | [Store API](#store-api) |
| `NDesign.storeSet(path, value)`               | Write a var by dot-path; FIRES `nd:var-change`.                   | [Store API](#store-api) |
| `NDesign.endpoint(name)`                      | Return the URL base for a named endpoint, or `''`.                 | [Store API](#store-api) |
| `NDesign.resolveVars(template)`               | Resolve `${...}` tokens in a template string.                      | [${var} grammar](#var-grammar) |
| `NDesign.render(container, id, data, mode?)`  | Render a `<template>` programmatically.                            | [Templates and {{field}} interpolation](#templates-and-field-interpolation) |
| `NDesign.renderOne(tpl, data)`                | Clone + interpolate a `<template>` for one item.                   | [Templates and {{field}} interpolation](#templates-and-field-interpolation) |
| `NDesign.interpolate(text, data)`             | Interpolate a `{{field}}` string.                                  | [Templates and {{field}} interpolation](#templates-and-field-interpolation) |
| `NDesign.escapeHTML(s)`                       | HTML-escape a string.                                              | [Templates and {{field}} interpolation](#templates-and-field-interpolation) |
| `NDesign.getByPath(obj, path)`                | Dot-path read on an arbitrary object.                              | [Configuration](#configuration) |
| `NDesign.setByPath(obj, path, value)`         | Dot-path write on an arbitrary object.                             | [Configuration](#configuration) |
| `NDesign.getCSRFToken()`                      | Read the CSRF meta tag content.                                    | [Configuration](#configuration) |
| `NDesign.openModal(selector)`                 | `.showModal()` a `<dialog>` by selector.                           | [Modals](#modals) |
| `NDesign.closeModal(selector)`                | `.close()` a `<dialog>` by selector.                               | [Modals](#modals) |
| `NDesign.confirmDialog(selector)`             | Open a `<dialog>` as confirm; returns `Promise<boolean>`.          | [Modals](#modals) |
| `NDesign.toast(msg, type?, duration?)`        | Show a toast.                                                      | [Toasts](#toasts) |
| `NDesign.setTheme(name)`                      | Switch to a named theme.                                           | [Theme](#theme) |
| `NDesign.toggleTheme()`                       | Cycle to the next registered theme.                                | [Theme](#theme) |
| `NDesign.getThemes()`                         | List registered themes and which is active.                        | [Theme](#theme) |

### Events fired by the runtime

Every `nd:*` event the runtime dispatches. Listen via
`addEventListener` on the target element (or `document` for
`nd:var-change`).

| Event                  | Target                | Detail                                          | Section |
|------------------------|-----------------------|-------------------------------------------------|---------|
| `nd:refresh`           | bound element          | none — consumer refetches                       | [data-nd-bind](#data-nd-bind--fetch-and-render) |
| `nd:var-change`        | `document`            | `{path, topKey, value}`                         | [Store API](#store-api) |
| `nd:model`             | model input            | `{name, value}`                                 | [data-nd-model](#data-nd-model--two-way-form-binding) |
| `nd:set`               | set-trigger element    | `{el}`                                          | [data-nd-set](#data-nd-set--write-to-the-store) |
| `nd:modal:open`        | `<dialog>`            | none — `openModal()` or `confirmDialog()`       | [Modals](#modals) |
| `nd:modal:close`       | `<dialog>`            | none — `close` event                            | [Modals](#modals) |
| `nd:modal:confirm`     | `<dialog>`            | none — `confirmDialog()` resolved `true`        | [Modals](#modals) |
| `nd:modal:cancel`      | `<dialog>`            | none — `confirmDialog()` resolved `false`       | [Modals](#modals) |
| `nd:sortable:reorder`  | destination container | `{order, item, source, crossContainer}`         | [Sortable](#sortable) |
| `nd:sortable:revert`   | destination container | `{item, source}`                                | [Sortable](#sortable) |
| user-defined `emit:X`  | action / set element   | `responseData` (`undefined` for set)            | [Success chain](#success-chain--data-nd-successactionaction) |

Any custom event name used in `data-nd-success="emit:foo"` is also
dispatched on the action / set element as a bubbling `CustomEvent`
with `detail = responseData`.
