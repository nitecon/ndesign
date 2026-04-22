# ndesign — Frontend Specification

This is the authoritative, self-contained specification for the ndesign frontend
library. It is written for coding agents that must build real web applications
using only the two bundled files `dist/ndesign.min.css` and `dist/ndesign.min.js`
(plus optional theme stylesheets). No other reference is required.

Every runnable example in this document targets the public test server at
`https://test.nitecon.org`. Examples can be pasted verbatim into an HTML file
and loaded in a browser.

---

## 0. Quick-reference coverage table

### 0.1. `data-nd-*` attributes (alphabetical)

| Attribute                  | One-line description                                                                | Section |
|----------------------------|--------------------------------------------------------------------------------------|---------|
| `data-nd-action`           | Form/button action: `"METHOD URL"`, submits JSON and handles the response.           | 7       |
| `data-nd-attr`             | On a `data-nd-bind` element with `data-nd-field`, writes the value to a DOM attribute. | 6.4     |
| `data-nd-bind`             | Fetch a JSON URL and render into the element (field or template).                    | 6       |
| `data-nd-bind-mode`        | On a bind trigger: override the target's `data-nd-mode` (e.g. `append`).              | 6.8     |
| `data-nd-bind-trigger`     | CSS selector: clicking this element refetches the matching bound element.            | 6.8     |
| `data-nd-body`             | JSON template body for a button `data-nd-action` (buttons only).                      | 7.5     |
| `data-nd-confirm`          | Text → `window.confirm()`; `"#dialog-id"` → async `<dialog>` confirm.                 | 7.6     |
| `data-nd-confirm-accept`   | On a button inside a confirm `<dialog>`: resolves `confirmDialog()` as `true`.         | 13      |
| `data-nd-defer`            | Skip the initial auto-fetch on a `data-nd-bind` element.                              | 6.10    |
| `data-nd-dismiss`          | On a button inside `<dialog>`: closes the dialog.                                     | 13      |
| `data-nd-empty`            | `<template data-nd-empty>`: shown when a bound array is empty.                        | 6.6     |
| `data-nd-error`            | `<template data-nd-error>`: rendered when a bound fetch fails.                        | 6.6     |
| `data-nd-feedback`         | ID of a feedback element that receives server messages for this action/upload.       | 7.4     |
| `data-nd-field`            | Dot-path extracting a scalar from response data (for bind/sse/ws).                    | 6.3     |
| `data-nd-if`               | Inside a template: remove the element when the named field is falsy.                  | 17.2    |
| `data-nd-loading`          | `<template data-nd-loading>`: shown while a bound fetch is in flight.                  | 6.6     |
| `data-nd-max`              | Maximum number of rendered children for append/prepend rendering.                    | 6.7     |
| `data-nd-modal`            | CSS selector: opens the target `<dialog>` when clicked.                               | 13      |
| `data-nd-mode`             | Render mode: `replace` (default), `append`, `prepend`.                                | 6.7     |
| `data-nd-model`            | Two-way bind a form input to a store var.                                             | 5.6     |
| `data-nd-on`               | Escape hatch: `"event:handlerName"`; calls `window[handlerName](e, el)`.               | 7.11    |
| `data-nd-params`           | Extra query string appended to the bind URL.                                          | 6.5     |
| `data-nd-refresh`          | Polling interval (ms) for a bound element.                                            | 6.9     |
| `data-nd-select`           | Dot-path selecting a sub-field of the response before rendering (envelope unwrap).     | 6.6     |
| `data-nd-set`              | Write one or more values into the store (response, literal, ref, or arithmetic).      | 5.5     |
| `data-nd-sortable`         | Mark a container as sortable; optional `"METHOD URL"` to POST new order.               | 12      |
| `data-nd-sse`              | Connect to a server-sent events stream and render messages.                            | 9       |
| `data-nd-sse-event`        | Filter for a named SSE event type (default is the generic `message`).                  | 9       |
| `data-nd-success`          | Comma-separated chain of post-success actions.                                        | 7.7     |
| `data-nd-tab` *(role=tab)* | Use `role="tab"` and `aria-controls="panel-id"` — tab container is `.nd-tabs`.         | 15.3    |
| `data-nd-template`         | ID of a `<template>` element used to render a bind/sse/ws response.                    | 6.2, 17 |
| `data-nd-timeout`          | Per-element fetch timeout in ms; overrides `config.timeout` (default 15000).           | 7       |
| `data-nd-theme`            | On a click target: set the theme by name (matches `<meta name="nd-theme">`).           | 16      |
| `data-nd-theme-toggle`     | Cycle to the next registered theme on click.                                          | 16      |
| `data-nd-toast`            | Message to show in a toast when the element is clicked.                               | 14      |
| `data-nd-toast-type`       | Type for a `data-nd-toast` trigger: `success`, `error`, `warning`, `info`.             | 14      |
| `data-nd-toast-duration`   | Duration (ms) for a `data-nd-toast` trigger; 0 = persistent.                           | 14      |
| `data-nd-toggle`           | `"sidebar"`: toggles `.sidebar` and an overlay (auto-wired delegated click).           | 15.1    |
| `data-nd-tooltip`          | Text shown in a tooltip on hover/focus.                                               | 15.5    |
| `data-nd-tooltip-placement`| `top` (default), `bottom`, `left`, `right`.                                           | 15.5    |
| `data-nd-upload`           | Form multipart upload endpoint: `"METHOD URL"`. XHR with progress.                    | 11      |
| `data-nd-ws`               | Connect to a WebSocket URL and render messages.                                       | 10      |
| `data-nd-ws-filter`        | `"field:value"` — only render messages whose field matches.                            | 10      |

### 0.2. `<meta name="...">` conventions

| Meta name            | Purpose                                                                               | Section |
|----------------------|---------------------------------------------------------------------------------------|---------|
| `endpoint:NAME`      | Registers a URL base under `NAME`, resolvable via `${NAME}`.                           | 5.1     |
| `var:NAME`           | Registers an initial value under `NAME`, resolvable via `${NAME}`.                     | 5.1     |
| `csrf-token`         | Read by `buildHeaders()` and upload, sent as `X-CSRF-Token`.                           | 4, 11   |
| `nd-theme`           | Registers a named theme; `data-href` points at its stylesheet.                         | 16      |

### 0.3. CSS classes the runtime writes

| Class                      | Added by                                                         | Section |
|----------------------------|------------------------------------------------------------------|---------|
| `nd-loading`               | Bind in flight; action/upload submit in flight.                   | 6, 7    |
| `nd-error`                 | Bind fetch failed; action failed; field with a validation error. | 6, 7    |
| `nd-ws-connected`          | Element's WebSocket is currently open.                           | 10      |
| `nd-ws-disconnected`       | Element's WebSocket is closed or connecting.                      | 10      |
| `nd-dragging`              | Mouse-dragged sortable item.                                      | 12      |
| `nd-kb-grabbed`            | Keyboard-grabbed sortable item.                                    | 12      |
| `nd-sortable-error`        | Briefly applied to a container after a revert.                     | 12      |
| `nd-form-feedback-auto`    | Auto-created feedback slot for forms/buttons without `data-nd-feedback`. | 7.4  |

### 0.4. Public JS API (`window.NDesign.*`)

| Name                                    | Description                                                      | Section |
|-----------------------------------------|------------------------------------------------------------------|---------|
| `NDesign.configure(partial)`            | Merge runtime configuration.                                      | 4       |
| `NDesign.init()`                        | Re-init the runtime (tears down first).                           | 3       |
| `NDesign.store.get(key)`                | Read a top-level var.                                             | 5.4     |
| `NDesign.store.set(key, value)`         | Write a top-level var (does NOT fire `nd:var-change`).            | 5.4     |
| `NDesign.store.has(key)` / `delete` / `clear` | Standard map ops.                                           | 5.4     |
| `NDesign.storeGet(path)`                | Read a var by dot-path (fires through `getVar`).                  | 5.4     |
| `NDesign.storeSet(path, value)`         | Write a var by dot-path; FIRES `nd:var-change`.                   | 5.4     |
| `NDesign.endpoint(name)`                | Return the URL base for a named endpoint, or `''`.                 | 5.4     |
| `NDesign.resolveVars(template)`         | Resolve `${...}` tokens in a template string.                      | 5.3     |
| `NDesign.render(container, id, data, mode?)` | Render a `<template>` programmatically.                       | 17      |
| `NDesign.renderOne(tpl, data)`          | Clone + interpolate a `<template>` for one item.                  | 17      |
| `NDesign.interpolate(text, data)`       | Interpolate a `{{field}}` string.                                 | 17      |
| `NDesign.escapeHTML(s)`                 | HTML-escape a string.                                             | 17      |
| `NDesign.getByPath(obj, path)` / `setByPath` | Dot-path accessors on arbitrary objects.                      | 4       |
| `NDesign.getCSRFToken()`                | Read the CSRF meta tag content.                                   | 4       |
| `NDesign.openModal(selector)`           | `.showModal()` a `<dialog>` by selector.                          | 13      |
| `NDesign.closeModal(selector)`          | `.close()` a `<dialog>` by selector.                              | 13      |
| `NDesign.confirmDialog(selector)`       | Open a `<dialog>` as confirm; returns `Promise<boolean>`.          | 13      |
| `NDesign.toast(msg, type?, duration?)`  | Show a toast.                                                     | 14      |
| `NDesign.setTheme(name)`                | Switch to a named theme.                                           | 16      |
| `NDesign.toggleTheme()`                 | Cycle to the next registered theme.                                | 16      |
| `NDesign.getThemes()`                   | List registered themes and which is active.                        | 16      |

### 0.5. Events dispatched by ndesign

| Event                   | Target                | When                                                 | Section |
|-------------------------|-----------------------|------------------------------------------------------|---------|
| `nd:refresh`            | bound element         | External trigger (e.g. `refresh:#id`, bind trigger). | 6.8     |
| `nd:var-change`         | `document`            | After `setVar()` is called (NOT `store.set`).         | 5.4     |
| `nd:model`              | model input           | After user input updates the store.                   | 5.6     |
| `nd:set`                | set-trigger element    | After a standalone `data-nd-set` click runs.          | 5.5     |
| `nd:modal:open`         | `<dialog>`            | After `openModal()` or `confirmDialog()`.             | 13      |
| `nd:modal:close`        | `<dialog>`            | On `close` (Escape, backdrop, `.close()`).             | 13      |
| `nd:modal:confirm`      | `<dialog>`            | `confirmDialog()` resolved `true` (accept click).      | 13      |
| `nd:modal:cancel`       | `<dialog>`            | `confirmDialog()` resolved `false` (dismiss/escape).   | 13      |
| `nd:sortable:reorder`   | sortable container    | After any successful reorder (drop or keyboard drop). | 12      |
| `nd:sortable:revert`    | sortable container    | After a server-side reorder POST fails and reverts.   | 12      |

Any custom event name used in `data-nd-success="emit:foo"` is also dispatched on
the action/set element as a bubbling `CustomEvent` with `detail = responseData`.

---

## 1. What ndesign is (and is not)

ndesign is a small runtime that turns plain HTML attributes into data-bound,
server-talking UI. It is NOT a framework in the React/Vue/Svelte sense.

Core principles:

- **Vanilla HTML + vanilla CSS + one bundled JS file.** Consumers do NOT run a
  build step. They include two files and write standard HTML.
- **Backend-authoritative.** The server renders the initial HTML, sets
  `<meta>` tags that declare URLs and initial values, and answers fetch calls
  with JSON. There is no client router and no client session.
- **URLs live on the element.** Every `data-nd-bind`, `data-nd-action`,
  `data-nd-ws`, etc. carries its own URL. There is **no `baseURL` config.** Use
  absolute URLs for cross-origin APIs, or relative paths for same-origin. DRY
  is achieved with `<meta name="endpoint:api">` and `${api}/...`.
- **No reactivity for display elements.** Mutating a store var does NOT
  re-render `data-nd-bind` elements. Only `data-nd-model` (two-way form
  binding) reacts to store changes via `nd:var-change`. Everything else is
  lazy: URLs are resolved at fetch/submit time.
- **CDN-friendly.** Ship the minified bundle on any CDN. Pages configure the
  runtime via inline `<script>` or (preferred) via `<meta>` tags.

Non-goals (things ndesign deliberately does NOT do):

- SPA routing.
- Virtual DOM or general reactivity beyond `data-nd-model`.
- Client-side state management frameworks (no Redux, no signals).
- Build-step JavaScript in consumer code (no JSX, no TypeScript required).
- Offline-first sync or IndexedDB adapters.
- Client-side auth or session management — CSRF is handled via a meta tag,
  everything else is cookies or headers the backend sets.

A successful ndesign app is one where every dynamic element has its URL,
render template, and success chain visible directly in the HTML, and the
entire JS bundle is never forked.

### 1.1. Layout philosophy — full-width by default

ndesign is designed for **full-width application layouts**. The `<body>`
occupies the entire viewport width out of the box, and components (cards,
tables, grids, sidebars) are expected to fill the available space. This is
the correct default for dashboards, admin panels, control panels, data-heavy
apps, and virtually all application UIs.

The framework provides an **opt-in** narrow container (`.nd-container`,
max-width 900 px) and a prose wrapper (`.nd-prose`) for long-form reading
content. These exist exclusively for pages whose primary content is text:
blog posts, articles, documentation, marketing copy, and similar editorial
layouts.

**Do NOT wrap application markup in `.nd-container` by default.** This is the
single most common misuse of the framework — agents and developers familiar
with other CSS frameworks reflexively add a centered narrow column to every
page, which wastes horizontal space, breaks sidebar + content patterns, and
defeats the grid system. If the page is not a blog or article, do not use
`.nd-container`.

| Layout type           | Correct approach                                                    |
|-----------------------|---------------------------------------------------------------------|
| Dashboard / admin     | Place content directly in `<body>` or `<main>` — no container.      |
| Sidebar + content     | Use `app-layout` / `app-content` classes (see demo/control-panel).  |
| Data tables, forms    | Full-width inside their parent; constrain with the grid if needed.  |
| Blog post / article   | Wrap in `<main class="nd-container">` with `.nd-prose` for text.    |
| Centered landing page | `.nd-container` is acceptable for a narrow hero + CTA layout.       |

Rule of thumb: if the page has a sidebar, a data table, a card grid, or any
kind of multi-column application layout, it should be full-width. Reserve
`.nd-container` for pages where the user is primarily **reading**.

### 1.1a. Three canonical starting layouts — ASK THE USER FIRST

ndesign ships **three canonical starting layouts**. Every new page begins
from one of them. Picking the wrong skeleton later means rewriting the
entire shell, so **agents MUST ask the user which of the three to start
from before writing a single line of HTML.** Do not guess from the task
description, do not default silently, do not invent a fourth. Ask.

| ID              | Best for                                                           | Key markers                                              |
|-----------------|--------------------------------------------------------------------|----------------------------------------------------------|
| `control-panel` | Dashboards, admin UIs, data-heavy internal tools with a sidebar.   | `.app-layout` + `.sidebar` + `.app-body` + top `<header>`|
| `app-shell`     | Multi-page SaaS apps with a fixed sidebar and per-page content.    | `.sidebar.sidebar-fixed` + `.app-main`                   |
| `blog`          | Editorial content — posts, articles, docs, marketing copy.         | Top `<nav>` + `.nd-container` + `.nd-panel` + `.nd-prose`|

The required prompt to the user, before writing any markup:

> Which of the three starting layouts should this page use —
> **control-panel** (sidebar + scrollable content for a dashboard),
> **app-shell** (fixed sidebar for a multi-page SaaS app), or
> **blog** (centered prose panel for an article)?

Once the user picks, copy the matching skeleton from Section 20.1 verbatim
and build inside it.
Do NOT mix layouts (e.g. do not add `.nd-container` to `control-panel`, do
not add `.sidebar` to `blog`). If the user's need truly does not fit one of
the three, flag it and discuss — do not silently invent a hybrid.

Live reference demos for each layout:

| Layout          | Demo file                    |
|-----------------|------------------------------|
| `control-panel` | `demo/control-panel.html`    |
| `app-shell`     | `demo/app-shell.html`        |
| `blog`          | `demo/blog-post.html`        |

### 1.2. No custom CSS or JavaScript

ndesign is an **HTML-only** framework from the consumer's perspective. The
two bundled files (`ndesign.min.css` + `ndesign.min.js`) provide all styling,
interactivity, data binding, and server communication a page needs. Consumer
pages should contain **zero** `<style>` blocks, zero inline `style="…"`
attributes, and zero `<script>` blocks beyond the one `<script>` tag that
loads the runtime.

This is a deliberate design constraint, not an oversight:

- **If a visual treatment requires custom CSS**, the framework is missing a
  component or utility class. The correct response is to file an issue or
  extend the framework — not to patch around it with one-off styles.
- **If an interaction requires custom JavaScript**, the framework is missing
  a `data-nd-*` attribute, a success-chain action, or a store operation. The
  correct response is to extend the runtime — not to add ad-hoc `<script>`
  handlers.

Before writing any custom CSS or JS, verify with the framework maintainer
(or this spec) that no existing attribute, class, or configuration already
solves the problem. Agents generating ndesign pages MUST NOT introduce
custom styles or scripts without explicit user approval.

**Acceptable exceptions** — third-party libraries that provide capabilities
outside the framework's scope:

| Exception                | Examples                                           |
|--------------------------|----------------------------------------------------|
| Charting / visualization | Chart.js, D3, ECharts, Plotly                      |
| Animation / motion       | GSAP, Lottie, anime.js                             |
| Rich text editing        | TipTap, ProseMirror, CodeMirror                    |
| Maps                     | Leaflet, Mapbox GL                                 |

Even when using these libraries, the surrounding layout, typography, cards,
forms, and controls should still come from ndesign — only the specialized
rendering surface itself should be third-party.

---

## 2. Installation

The runtime ships as two files: `ndesign.min.css` and `ndesign.min.js`, with
two optional theme stylesheets. They are distributed via a public GCS bucket
at `https://storage.googleapis.com/ndesign-cdn/`. Agents building an ndesign
application SHOULD load the bundle directly from the CDN — no build step, no
package manager, no vendoring required.

### 2.1. CDN URLs

Two prefix conventions exist in the bucket:

| Prefix                  | Mutability              | Cache        | Use when                                |
|-------------------------|-------------------------|--------------|-----------------------------------------|
| `ndesign/latest/`       | mutable, evolves        | 5 min        | active development, demos, prototypes   |
| `ndesign/v<semver>/`    | immutable once uploaded | 1 year       | production, reproducible agent handoffs |

The files under each prefix are:

```
ndesign/<prefix>/ndesign.min.js       # runtime bundle (IIFE, exposes window.NDesign)
ndesign/<prefix>/ndesign.min.css      # base stylesheet
ndesign/<prefix>/themes/light.min.css # optional light theme
ndesign/<prefix>/themes/dark.min.css  # optional dark theme
ndesign/<prefix>/SPEC.md              # this document
```

**Pinned SPEC URL for agent handoffs**: point any coding agent at
`https://storage.googleapis.com/ndesign-cdn/ndesign/v<semver>/SPEC.md` —
that URL is immutable. An agent reading the pinned spec is guaranteed to
build against the same runtime forever.

### 2.2. Minimal page

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My App</title>

    <!-- Core stylesheet (pinned version — swap v0.1.0 for your target) -->
    <link rel="stylesheet"
          href="https://storage.googleapis.com/ndesign-cdn/ndesign/v0.1.0/ndesign.min.css">

    <!-- Optional theme. class="theme" is REQUIRED so the theme switcher
         can find and swap the link element. -->
    <link rel="stylesheet"
          href="https://storage.googleapis.com/ndesign-cdn/ndesign/v0.1.0/themes/light.min.css"
          class="theme" data-theme="light">
    <meta name="nd-theme" content="light"
          data-href="https://storage.googleapis.com/ndesign-cdn/ndesign/v0.1.0/themes/light.min.css">
    <meta name="nd-theme" content="dark"
          data-href="https://storage.googleapis.com/ndesign-cdn/ndesign/v0.1.0/themes/dark.min.css">

    <!-- Store configuration via meta tags. Agents SHOULD prefer this over
         NDesign.configure() because it keeps URLs declarative. -->
    <meta name="endpoint:api" content="https://test.nitecon.org">
    <meta name="var:userId" content="2">

    <!-- CSRF token. Read by buildHeaders() for every fetch and XHR upload. -->
    <meta name="csrf-token" content="REPLACE_WITH_SERVER_TOKEN">
  </head>
  <body>
    <!-- App markup here -->

    <!-- Runtime bundle. Loads synchronously and auto-initializes on
         DOMContentLoaded (or immediately if the DOM is already parsed). -->
    <script src="https://storage.googleapis.com/ndesign-cdn/ndesign/v0.1.0/ndesign.min.js"></script>
  </body>
</html>
```

For active development, substitute `latest` for `v0.1.0` in every URL above.
For a production deployment, always pin to a specific `v<semver>` so your
app does not silently upgrade when the CDN's `latest/` pointer moves.

### 2.3. Self-hosting

If CDN delivery is not acceptable (air-gapped environments, CSP constraints,
or policy), download the four files and host them under any same-origin or
cross-origin path of your choice. The same `<link>` and `<script>` tags
apply — just swap the URLs. No other configuration changes are required.

### 2.4. Notes

- The CSS MUST be in `<head>` to avoid FOUC.
- The JS SHOULD be at the end of `<body>`. It is an IIFE that exposes
  `window.NDesign`.
- `NDesign.configure(...)` MAY be called before or after init — see section 4.
- The CDN sets `Cache-Control: public, max-age=31536000, immutable` on
  versioned assets and `public, max-age=300, must-revalidate` on the
  `latest/` prefix, so browsers will not re-fetch pinned bundles across
  reloads.

---

## 3. Lifecycle model

The runtime auto-initializes on `DOMContentLoaded`. If the script tag is placed
at the end of `<body>` and the DOM is already parsed, init runs synchronously.

`NDesign.init()` MAY be called manually. When called a second time, it
tears down every subsystem first, then re-scans the DOM. Order on init:

1. `destroyStore()` + every other `destroy*()` (only when re-initing).
2. `initStoreFromMeta()` — reads `<meta name="endpoint:*">` and
   `<meta name="var:*">` into the store. MUST run before any directive that
   resolves a `${var}` URL.
3. `initBindings(config)` — wires `data-nd-bind`.
4. `initActions(config)` — wires `data-nd-action` on forms and buttons, and
   `data-nd-on`.
5. `initWebSockets(config)`, `initSSE(config)`.
6. `initSelects()`, `initNav()`, `initDropdowns()`, `initModals()`,
   `initToasts()`, `initTabs()`, `initTooltips()`, `initUploads()`,
   `initSortable()`.
7. `initSetTriggers(config)` — wires click handlers for standalone
   `data-nd-set` elements.
8. `initModel(config)` — wires two-way `data-nd-model` inputs.
9. A single delegated `click` listener is attached to `document` for theme
   toggling, toast triggers, sidebar toggling, sortable sidebar nav active
   state, `data-nd-toast`, and `data-nd-bind-trigger`.

Agents calling `NDesign.init()` manually after injecting new markup SHOULD be
aware that the teardown step removes listeners on EVERY tracked element in the
document, not just new ones. In practice this means full re-init is safe but
heavy; prefer it only after wholesale DOM replacement.

---

## 4. Configuration API

### 4.1. `NDesign.configure(userConfig)`

Merge-updates the runtime config. Call before OR after init. Signature:

```javascript
NDesign.configure({
  headers: { 'X-Client': 'my-app' },            // merged into default headers
  onRequest:  (url, options) => {},              // called before every fetch
  onResponse: (url, response) => {},             // called after every fetch
  onError:    (url, envelope, err) => {},        // called on fetch/ws/sse failure
  onRender:   (element, data) => {},             // called after a bind/sse/ws render
  timeout: 15000,                                // default fetch timeout (ms)
  wsProtocols: ['ndesign.v1'],                   // WebSocket sub-protocols
  wsTokenProvider: () => localStorage.token,     // appends ?token=... to WS URL
});
```

| Key               | Type                                           | Default                                   | Notes |
|-------------------|------------------------------------------------|-------------------------------------------|-------|
| `headers`         | `Record<string,string>`                         | `{ 'X-Requested-With': 'NDesign' }`      | Merged, not replaced. |
| `onRequest`       | `(url, options) => void` \| `null`             | `null`                                    | Mutating `options` affects the request. |
| `onResponse`      | `(url, response) => void` \| `null`            | `null`                                    | Response has not been read yet. |
| `onError`         | `(url, envelope, err) => void` \| `null`       | *default toast handler* (see below)       | Fires for bind, action, SSE, and WS errors. |
| `onRender`        | `(el, data) => void` \| `null`                 | `null`                                    | Fires after bind / sse / ws renders. |
| `timeout`         | `number` (ms)                                   | `15000`                                   | Default fetch timeout; per-element `data-nd-timeout` overrides. |
| `wsProtocols`     | `string[]`                                      | `[]`                                      | Passed to `new WebSocket(url, protocols)` if non-empty. |
| `wsTokenProvider` | `() => string` \| `null`                        | `null`                                    | If set, WS URLs get `?token=<value>` appended. |

**Breaking change — `onError` signature.** `onError` now takes THREE arguments
`(url, envelope, err)`, not `(url, err)`. The `envelope` argument is the unified
error envelope (see section 8), always shaped `{ errors: { error: "...", ... } }`.
The `err` argument is the original thrown `Error` for fetch/ws/sse failures and
may be `null` when the envelope was synthesized from a non-2xx response.

**Default `onError` handler.** Previously `null` (silent). The runtime now
ships a default that calls `NDesign.toast(message, 'error')` using
`envelope.errors.error`, `envelope.errors._form`, or the literal string
`"Something went wrong"` as the message. Apps opt out with
`NDesign.configure({ onError: null })` or replace it with a custom handler.

**Distinguishing timeout vs. network failure.** The `err` argument lets callers
tell the two apart: `err.name === 'AbortError'` is a timeout (from
`fetchWithTimeout()`), `err instanceof TypeError` is a network/CORS/DNS failure
(thrown directly by `fetch()`). Both produce a synthesized envelope with the
canonical `errors.error` key.

All keys MAY be changed after init. `headers` changes take effect on the next
fetch; other callbacks take effect immediately. `wsProtocols` and
`wsTokenProvider` only apply at the next WebSocket `connect()` call — to
re-apply them to existing connections, call `NDesign.init()`.

### 4.2. Default headers applied by `buildHeaders()`

Every fetch made by bind/action routes through `buildHeaders(config.headers)`,
which produces:

```javascript
{
  'Content-Type': 'application/json',
  'X-Requested-With': 'NDesign',
  // ...any user-configured headers
  'X-CSRF-Token': '<value from <meta name="csrf-token">, if present>',
}
```

`data-nd-bind` (GET) deletes `Content-Type` from the header set before sending.
`data-nd-upload` does NOT use `buildHeaders`; it sets only `X-Requested-With`
and `X-CSRF-Token` manually on the XHR (multipart body requires the browser to
set its own `Content-Type` with the boundary).

---

## 5. Store, meta, and `${var}` interpolation

### 5.1. Meta conventions

At init, `initStoreFromMeta()` scans all `<meta name>` tags and populates two
maps:

- `<meta name="endpoint:NAME" content="URL">` → `endpoints` map.
- `<meta name="var:NAME" content="VALUE">` → `vars` map.

All content is stored as a string. Numeric coercion happens at consumption
time (e.g. when writing into a `type="number"` input, or inside `data-nd-set`
arithmetic).

```html
<meta name="endpoint:api"  content="https://test.nitecon.org">
<meta name="endpoint:ws"   content="wss://test.nitecon.org">
<meta name="var:userId"    content="2">
<meta name="var:pageSize"  content="25">
```

### 5.2. `${var}` grammar

The token grammar is a single regex:

```
\$\{([a-zA-Z_][\w.\-]*)\}
```

Only the braced form is recognised. Dot paths are permitted on the variable
side (`${user.first_name}`). Endpoint names MUST be flat — endpoint lookup
ignores dots. Resolution order for each token is:

1. `getVar(name)` — vars take precedence.
2. `endpoints.get(name)` — exact key match only.
3. Unknown token: substitutes the empty string and emits
   `console.warn('[ndesign] unresolved var: ${<name>}')` once per name per
   `resolveVars()` call.

If a var resolves to a non-primitive (e.g. the user object itself), the
substitution is `String(obj)`, which yields `[object Object]`. Use dot paths
for scalar fields: `${user.id}`, never `${user}`.

A `null` value substitutes the empty string. An `undefined` (missing) value
falls through to endpoint lookup.

### 5.3. Where `${var}` substitution applies

`resolveVars()` is invoked on the following attribute values:

- `data-nd-bind` — the URL.
- `data-nd-action` — the URL portion (after the method).
- `data-nd-upload` — the URL portion.
- `data-nd-sse` — the URL.
- `data-nd-ws` — the URL.
- `data-nd-sortable` — the URL portion of the optional `"METHOD URL"`.
- `data-nd-body` — the full JSON template, before `JSON.parse`.
- `data-nd-set` — only inside `${ref}` tokens in the RHS (see 5.5).

`${var}` substitution is NOT performed in:

- Element text nodes or other attributes.
- `data-nd-confirm` values (the message is used verbatim).
- `data-nd-params` values (they are appended as-is).
- Template bodies — templates use `{{field}}` (section 17).

### 5.4. Store API

The public store is exposed as `NDesign.store` plus several top-level
aliases. IMPORTANT: `NDesign.store.set` is a thin façade over the raw `vars`
Map — it does NOT fire `nd:var-change`. `NDesign.storeSet` (alias of the
module-level `setVar`) DOES fire `nd:var-change`. Agents that need
`data-nd-model` inputs to re-sync MUST use `NDesign.storeSet`.

| Call                               | Path support | Fires `nd:var-change`? |
|------------------------------------|--------------|------------------------|
| `NDesign.store.get('k')`           | top-level    | n/a                    |
| `NDesign.store.set('k', v)`        | top-level    | **no**                 |
| `NDesign.store.has/delete/clear`   | top-level    | no                     |
| `NDesign.storeGet('a.b.c')`        | dot-path     | n/a                    |
| `NDesign.storeSet('a.b.c', v)`     | dot-path     | **yes**                |
| `NDesign.endpoint('api')`          | flat         | n/a                    |
| `NDesign.resolveVars(str)`         | n/a          | n/a                    |

`nd:var-change` is a `CustomEvent` dispatched on `document` with
`detail = { path, topKey, value }`.

### 5.5. `data-nd-set` grammar

`data-nd-set` performs one or more store writes. Its value is a comma-separated
list of "ops", where commas inside single-quoted string literals are NOT split
points. Each op has one of two forms:

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

Semantics:

- **Response form** (`NAME` alone) writes the full `responseData` under `NAME`.
  If `responseData` is `undefined` at the moment the directive runs, the op is
  a no-op and emits a warning.
- **Explicit form** parses the RHS as an AST:
  - `literal` writes the literal value.
  - `ref` reads the var and writes its current value to `NAME`.
  - `ref OP NUMBER` coerces the referenced var to `Number`; if `NaN` the op
    throws and logs. Division by zero throws.
  - `$response` writes the full response value (same effect as the response
    form but inside the explicit form, useful when you want to combine it with
    other ops in a single attribute).
- Dot-path LHS writes use `setByPath` on the top-level object, creating
  intermediate objects as needed.

When the directive runs depends on where `data-nd-set` appears:

| Element context                                          | When it runs                                   | `responseData` |
|----------------------------------------------------------|------------------------------------------------|----------------|
| On a `data-nd-bind` element                              | After a successful fetch.                      | parsed JSON    |
| On a `form[data-nd-action]` element                      | After a successful submit (HTTP 2xx).          | parsed JSON (or `null`) |
| On a non-form `[data-nd-action]` (button/link)           | After a successful submit.                     | parsed JSON (or `null`) |
| On a `form[data-nd-upload]` element                      | NOT invoked (upload does not process set).     | —              |
| Standalone (no bind/action/upload/sortable)              | On click. Response form warns.                  | `undefined`    |

Examples:

```html
<!-- Pager: +/- buttons mutate ${page}. The bound list refreshes via nd:refresh
     emitted by data-nd-success. -->
<button data-nd-set="page=${page}+1"
        data-nd-success="refresh:#user-list">Next</button>
<button data-nd-set="page=${page}-1"
        data-nd-success="refresh:#user-list">Prev</button>

<!-- After creating a user, store the whole response under 'currentUser' and
     store its id specifically under 'lastUserId'. -->
<form data-nd-action="POST https://test.nitecon.org/api/users"
      data-nd-set="currentUser,lastUserId=${currentUser.id}">
  ...
</form>

<!-- Write a literal string. -->
<button data-nd-set="view='list'"
        data-nd-success="refresh:#view-container">List</button>
```

### 5.6. `data-nd-model` — two-way form binding

`data-nd-model="NAME"` on a form input creates a two-way binding between the
input and a store var:

1. On init, `initModel()` reads `getVar(name)` and writes it into the input.
   If no value exists AND the input has a non-empty `defaultValue`, the input's
   current value is written into the store so subsequent reads see it.
2. When the user types/clicks/selects, the input's value is coerced and
   written back via `setVar(name, coerced)`, then an `nd:model` CustomEvent
   is dispatched on the input with `detail = { name, value }`.
3. When ANY other code writes the same TOP-LEVEL key (via `setVar` /
   `NDesign.storeSet` / a `data-nd-set` directive), the input re-syncs.
   A re-entrance guard prevents the sync from triggering its own input event.

Coercions written back to the store:

| Input                       | Stored type                                  |
|-----------------------------|----------------------------------------------|
| `type="checkbox"`           | `boolean` (`el.checked`)                     |
| `type="number"`/`"range"`   | `Number`, or `null` when empty               |
| `<select multiple>`         | `Array<string>` of selected option values    |
| Everything else             | `string` (`el.value`)                        |

Event wiring: `input` for most controls; `change` for checkboxes and selects.

### 5.7. `data-nd-defer`

A boolean attribute on a `data-nd-bind` element. When present, `initBindings`
adds an `nd:refresh` listener but skips the initial fetch. The element fetches
on the first externally dispatched `nd:refresh`:

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

### 5.8. `data-nd-success` on standalone set elements

On standalone `data-nd-set` elements (click triggers), `data-nd-success` is
evaluated after the store writes but ONLY the following action prefixes are
supported:

- `refresh:SELECTOR` — dispatch `nd:refresh` on every matching element.
- `emit:EVENT` — dispatch a bubbling `CustomEvent('EVENT')` on the element.

`reset`, `reload`, `redirect:URL`, and `close-modal` are NOT supported on set
triggers (there is no such thing as `close-modal` anywhere — see Section 21).

### 5.9. No reactivity for display elements

This is the single most important thing to remember about ndesign:

> Mutating a store var does NOT refresh `data-nd-bind` elements.

To update a bound element after a store write, you MUST explicitly trigger a
refresh. Use either:

- `data-nd-success="refresh:#id"` on the element that wrote the store.
- Or, from JS, `document.querySelector('#id').dispatchEvent(new CustomEvent('nd:refresh'))`.

The only reactivity in ndesign is `data-nd-model` re-syncing its input when
the same top-level key is written. `nd:var-change` is an internal event used
only by the model subsystem — application code SHOULD NOT listen for it as
a general reactivity primitive.

---

## 6. Data binding (`data-nd-bind`)

### 6.1. Purpose

Fetch JSON from a URL and render it into the element. Supports scalar field
extraction, template rendering of arrays or objects, polling, params,
append/prepend modes, empty/loading placeholders, deferred fetching, and
store writes via chained `data-nd-set`.

### 6.2. Attribute: `data-nd-bind="URL"`

The URL MAY contain `${var}` tokens. The fetch method is always `GET`. The
request uses `buildHeaders(config.headers)` minus `Content-Type`.

Two elements with identical resolved URLs in the same tick share a single
fetch (in-flight dedup via `pendingRequests`).

### 6.3. Scalar field binding — `data-nd-field="PATH"`

When `data-nd-template` is absent and `data-nd-field` is present, the bound
element's `textContent` is set to `String(getByPath(data, PATH))`, or `''` if
null/undefined.

```html
<strong data-nd-bind="https://test.nitecon.org/api/stats"
        data-nd-field="version"></strong>
```

### 6.4. Attribute write — `data-nd-attr="NAME"`

When combined with `data-nd-field`, the resolved value is written to the named
DOM attribute instead of `textContent`. A `null`/`undefined` value REMOVES the
attribute.

```html
<img data-nd-bind="${api}/api/users/${userId}"
     data-nd-field="avatar_url"
     data-nd-attr="src"
     alt="">
```

### 6.5. Template binding — `data-nd-template="ID"`

Renders via a `<template id="ID">`. When the response is an array, one clone
is produced per item; for an object, one clone total. Interpolation uses
`{{field}}` (section 17).

```html
<tbody id="user-table"
       data-nd-bind="https://test.nitecon.org/api/users"
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

### 6.6. Envelope unwrap — `data-nd-select="PATH"`

When the backend returns `{ data: [...], meta: {...} }`, set `data-nd-select`
to pull the array out before rendering. Empty state (`data-nd-empty` template)
also honours this:

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

Loading template behaviour: when present, a clone is inserted into the
container while the fetch is in flight, wrapped in an element with
`data-nd-loading-active`. It is removed before the render. An `nd-error`
class is added to the container if the fetch throws.

Empty template behaviour: fires only when the rendered data (after
`data-nd-select`) is an array of length 0. All non-template children are
removed first, then the empty clone is appended.

Error template — `<template data-nd-error>`: when a bind fetch fails, the
runtime synthesizes a unified error envelope (section 8) and then:

1. If a `<template data-nd-error>` is present inside the container, its
   contents are cloned in, replacing all non-template children. `.nd-error`
   is still added to the container.
2. Otherwise, `config.onError(url, envelope, err)` is invoked (the default
   handler toasts the global message).

The error template has the same structural rules as `data-nd-loading` and
`data-nd-empty`: it is a direct descendant `<template>` of the bound element
and MUST NOT be referenced by `id` — the runtime finds it by attribute.
Agents MAY also style `.nd-error` in CSS as a purely visual fallback.

### 6.7. Render mode and `data-nd-max`

`data-nd-mode` controls how template renders are inserted:

| Mode       | Behaviour                                                      |
|------------|----------------------------------------------------------------|
| `replace`  | (default) Removes all non-`<template>` children, then appends. |
| `append`   | Appends after existing children.                                |
| `prepend`  | Inserts before the first non-template child.                    |

`data-nd-max="N"`: after each render, if there are more than N rendered
(non-template) children, drop the oldest until the count is N. "Oldest" is:

- the first child when mode is `append` or `replace`;
- the LAST child when mode is `prepend` (since new items arrive at the top).

### 6.8. Triggers — `data-nd-bind-trigger` and `data-nd-bind-mode`

The delegated click handler processes `[data-nd-bind-trigger="SELECTOR"]`.
When clicked:

1. `preventDefault()`.
2. If the trigger has its own `data-nd-params`, that value is copied onto the
   target element. Otherwise, if the trigger is an `<a>` with an `href`, the
   query string of the href is copied onto `data-nd-params` of the target and
   `aria-current="page"` is managed across sibling triggers (pagination
   active state — the walker finds the nearest ancestor holding at least two
   triggers).
3. If the trigger has `data-nd-bind-mode`, it is copied to the target's
   `data-nd-mode` (used for "Load more" patterns).
4. `target.dispatchEvent(new CustomEvent('nd:refresh'))`.

### 6.9. Polling — `data-nd-refresh="MS"`

When `data-nd-refresh` is a positive integer, a `setInterval` is set up and
refetches the element every MS milliseconds. A `MutationObserver` tears down
the interval if the element is removed from the DOM.

### 6.10. Deferred fetch — `data-nd-defer`

See 5.7. Skips the initial fetch only.

### 6.11. Edge cases

- Two bound elements with identical URLs share an in-flight request.
- The polling observer is global and re-created on init.
- Re-init clears the in-flight request cache.
- `data-nd-set` is applied after a successful render (the full response is
  passed, not the selected sub-field).

---

## 7. Forms and button actions (`data-nd-action`)

### 7.1. Purpose

Submit data to a REST endpoint and map the response (success or validation
errors) back into the UI.

### 7.2. Attribute grammar

```
data-nd-action = METHOD ' ' URL
```

Examples: `"POST /api/users"`, `"DELETE ${api}/api/users/${userId}"`,
`"PATCH https://test.nitecon.org/api/users/42"`. If there is no space, the
method defaults to `POST`. The URL is `${var}`-resolved at submit time.

### 7.3. Form vs button behaviour

| Behaviour                                       | `<form data-nd-action>`                 | `[data-nd-action]:not(form)` |
|-------------------------------------------------|------------------------------------------|------------------------------|
| Event intercepted                                | `submit`                                 | `click`                      |
| Body sent                                        | JSON-serialized form inputs              | None, or `data-nd-body`      |
| Field validation error display                  | Yes (`.nd-error`, `.nd-form-error`)      | No                           |
| `data-nd-feedback` rendering                     | Yes                                      | Yes                          |
| Disables while in flight                         | Submit button                             | The clicked element           |
| `data-nd-success`                                | Yes                                      | Yes                          |
| `data-nd-set` after success                      | Yes                                      | Yes                          |
| `data-nd-confirm` prompt                         | Yes                                      | Yes                          |

### 7.4. Feedback element — `data-nd-feedback="ID"` and the auto-slot

Every failed action MUST produce a visible global error message adjacent to
the triggering element. The runtime guarantees this via two mechanisms:

**1. Declared feedback — `data-nd-feedback="ID"`.** If the attribute is
present, the element with that ID is used as the feedback slot:

- `""` / hidden while the request is in flight (cleared up front);
- `nd-alert nd-alert-success` with `responseData.message || 'Success'` on 2xx;
- `nd-alert nd-alert-error` with the global message from the unified envelope
  on failure (see section 8).

**2. Auto-feedback slot — `.nd-form-feedback-auto`.** When no
`data-nd-feedback` is declared, on the FIRST error the runtime auto-creates
a feedback element and inserts it adjacent to the triggering control:

- **Forms**: the slot is inserted immediately BEFORE the submit button (or,
  if the submit button is nested inside wrappers like `<menu>` or
  `<div class="nd-card-footer">`, before its nearest ancestor that is a
  direct child of the `<form>`).
- **Buttons**: the slot is inserted as the next sibling AFTER the button.
- **Class**: `nd-alert nd-form-feedback-auto` (plus `nd-alert-error` /
  `nd-alert-success` per message type). `aria-live="assertive"`,
  `aria-atomic="true"`. Initially hidden.
- **Reuse**: the element is cached on `form._ndAutoFeedbackEl` /
  `btn._ndAutoFeedbackEl` and reused across subsequent submits — never
  duplicated. `clearFormErrors(form)` (called at the start of each submit)
  clears and hides it.
- **Success**: the auto-slot is populated with the success message ONLY if
  it already exists from a prior error; it auto-hides after ~3 seconds. The
  runtime never auto-creates a slot purely to display a success message.

**Global message priority (`_synthesizeGlobalMessage`).** The message
written into the feedback slot is chosen in this order:

1. `envelope.errors.error` (canonical) or `envelope.errors._form` (legacy
   alias) — written verbatim.
2. If exactly ONE field error is present:
   `"Please correct the highlighted field: <LABEL>"`. `<LABEL>` is resolved
   by walking from the input (`[name="<field>"]`) to its matching
   `<label for="<input-id>">` and using that label's trimmed `textContent`.
   If no `<label for>` is found, `<LABEL>` falls back to the field's `name`
   attribute.
3. If TWO OR MORE field errors are present:
   `"Please correct the N highlighted fields below."`
4. Fallback: `"Submit failed. Please try again."`

Forms ALSO map field-level errors inline to `.nd-form-error` siblings (see
7.9). Button actions only show the global message — there are no fields to
highlight.

**UX rationale.** Users click a button and expect a visible response at the
click point. Field-level errors above the fold are often missed. Toasts in a
screen corner can be missed. The auto-slot guarantees a message is rendered
next to the clicked control no matter how the form is structured. The
default `onError` toast fires IN ADDITION as a belt-and-suspenders secondary
signal, not as a replacement for the inline feedback.

**Expected label markup** for the single-field synthesized message:

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

### 7.5. Button body template — `data-nd-body`

Only valid on non-form `[data-nd-action]` elements. The attribute is a JSON
template string that is `${var}`-interpolated first, then `JSON.parse`d. On a
JSON parse failure, the message `"data-nd-body: invalid JSON after
interpolation"` is written to the feedback element (if any), the action is
aborted, and the element is re-enabled. No fetch is performed.

```html
<button data-nd-action="POST ${api}/api/orders"
        data-nd-body='{"sku":"${sku}","qty":${qty}}'
        data-nd-feedback="order-msg">Place order</button>
```

Forms MUST NOT use `data-nd-body`: their body is always the JSON-serialized
form. If both are present on a form, `data-nd-body` is ignored.

### 7.6. Confirmation — `data-nd-confirm`

`data-nd-confirm` has two forms, dispatched by the leading character:

1. **Plain text** — `data-nd-confirm="Delete user James Miller?"` → the
   runtime calls `window.confirm(TEXT)` synchronously. A falsy result aborts
   the action. This is the native browser dialog.
2. **Dialog selector** — `data-nd-confirm="#confirm-delete"` → the runtime
   calls `confirmDialog('#confirm-delete')` (section 13) and awaits the
   promise. The action proceeds only if the user clicks a button with
   `[data-nd-confirm-accept]`; any dismiss path (`.nd-modal-close`,
   `[data-nd-dismiss]`, backdrop, Escape, native close) aborts.

Both forms work identically for `<form data-nd-action>` and
`[data-nd-action]:not(form)`. The underlying helper is
`resolveConfirm(el) → Promise<boolean>`, exported from `action.js` for apps
that want to reuse the same branching logic from custom handlers.

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
    <button type="button" class="nd-btn-danger" data-nd-confirm-accept>Delete</button>
  </menu>
</dialog>
```

### 7.7. Success chain — `data-nd-success="action[,action]*"`

After a 2xx, the value is split on commas and each action is processed in
order. Supported actions:

| Action                | Valid on                | Behaviour                                                                              |
|-----------------------|-------------------------|----------------------------------------------------------------------------------------|
| `reset`               | forms only              | `form.reset()`.                                                                        |
| `reload`              | any                     | `window.location.reload()`. Stops the chain.                                            |
| `redirect:URL`        | any                     | `window.location.href = URL`. Stops the chain.                                          |
| `refresh:SELECTOR`    | any                     | Dispatches `nd:refresh` on every matching element.                                     |
| `emit:EVENT`          | any                     | Dispatches a bubbling `CustomEvent(EVENT, {detail: responseData})` on the element.     |
| `close-modal`         | any                     | Closes the nearest ancestor `<dialog>` of the triggering element (no-op if none).      |

Actions not in this list are silently ignored (NO warning). `close-modal`
composes with the rest of the chain — e.g. `"close-modal,refresh:#user-table"`
closes the enclosing dialog then refreshes a table outside it.

### 7.8. Form serialization rules

Inputs are iterated via `form.elements`. For each named, enabled, non-file,
non-submit, non-button element:

| Input                        | Serialized as                                       |
|------------------------------|-----------------------------------------------------|
| `type="checkbox"`            | `boolean` (`el.checked`)                            |
| `type="radio"`               | the value of the selected radio; unchecked skipped  |
| `<select multiple>`          | `Array<string>` of selected `value`s                |
| `type="number"`/`"range"`    | `Number`, or `null` if empty                        |
| everything else              | `string`                                            |

Dot-notation names produce nested objects:
`name="address.city"` → `{ address: { city: ... } }`.

File inputs are skipped. Use `data-nd-upload` instead (section 11).

### 7.9. Error response handling

On a non-2xx response:

1. If `responseData.errors` is a truthy object, it is routed directly as
   the unified envelope (section 8). `displayErrors(form, errors, feedbackId)`
   maps field-level keys inline to inputs and `.nd-form-error` siblings.
2. Global keys — `errors.error` (canonical) and `errors._form` (legacy
   alias) — are BOTH recognised and written to the declared feedback
   element (if any). The auto-feedback slot (7.4) always shows the
   synthesized global message regardless of which key was used.
3. If there is no `errors` object, the runtime synthesizes
   `{errors:{error: responseData.message || "Error: " + statusText}}` and
   routes it through the same handler.
4. On a thrown fetch (timeout, network, CORS), `synthesizeEnvelope(err)`
   produces `{errors:{error:"Request timed out"}}` (AbortError) or
   `{errors:{error:"Couldn't reach server"}}` (TypeError) or
   `{errors:{error: err.message}}` (other), then routes through the same
   handler.

Every path ends in `handleActionError(el, envelope, config, feedbackId, url, err)`
which (a) writes the global message to the declared feedback element or
auto-slot, (b) for forms, maps field errors inline, and (c) calls
`config.onError(url, envelope, err)` as a secondary signal (default: toast).

### 7.10. Per-element timeout — `data-nd-timeout="MS"`

Every form and button action is submitted via `fetchWithTimeout()` with an
`AbortController`. The timeout resolves to, in order:

1. The `data-nd-timeout` attribute on the element, parsed as an integer.
2. `config.timeout` (default `15000`).

When the timer fires, the fetch rejects with an `AbortError` and the
synthesized envelope carries `errors.error: "Request timed out"`.

```html
<!-- Force the timeout path for demo/testing purposes -->
<button data-nd-action="GET ${api}/api/stats"
        data-nd-timeout="50"
        class="nd-btn-primary">Force timeout</button>
```

A 50 ms timeout against any real endpoint reliably hits the AbortError
branch, which is the easiest way to exercise the timeout envelope without
taking the network down.

### 7.11. Escape hatch — `data-nd-on`

`data-nd-on="EVENT:HANDLER"` binds an event listener that looks up
`window[HANDLER]` and calls `HANDLER(event, element)`. If the handler is not
on `window`, a warning is logged. Use this only when a declarative directive
cannot express what you need.

---

## 8. Error handling

### 8.1. The unified error envelope

Every action and bind error — regardless of source — is normalised into
a single envelope shape:

```json
{ "errors": { "error": "Human-readable global message", "field": "per-field message" } }
```

- `errors.error` is the canonical global-message key.
- `errors._form` is accepted as a legacy alias for `errors.error`; both are
  routed to the feedback slot and both satisfy `_synthesizeGlobalMessage`'s
  priority-1 case. New backends SHOULD use `errors.error`.
- Any other key in `errors` is treated as a field-level error, matched
  against an input by `name=` (forms only).

### 8.2. Envelope sources

| Source                                              | Envelope                                                              |
|-----------------------------------------------------|-----------------------------------------------------------------------|
| non-2xx response with a server `errors` object       | used verbatim as the envelope                                          |
| non-2xx response without an `errors` object          | `{errors:{error: responseData.message \|\| "Error: <statusText>"}}`    |
| thrown fetch with `err.name === 'AbortError'`        | `{errors:{error:"Request timed out"}}`                                 |
| thrown fetch with `err instanceof TypeError`          | `{errors:{error:"Couldn't reach server"}}`                             |
| any other thrown error                                | `{errors:{error: err.message \|\| "Unexpected error"}}`                |

The timeout vs. network distinction is load-bearing: both are presented as
generic "something went wrong" to the user, but custom `onError` handlers
can tell them apart by re-reading `err.name` / `err instanceof TypeError`
from the third argument.

### 8.3. Routing

Form and button action errors flow through
`handleActionError(el, envelope, config, feedbackId, url, err)`:

1. Add `.nd-error` to the triggering element.
2. Forms: call `displayErrors()` to map field keys to `.nd-form-error`
   siblings and add `.nd-error` to matching inputs.
3. Write the synthesized global message (see 7.4) to the declared feedback
   element if any, OR to the auto-feedback slot if none.
4. Call `config.onError(url, envelope, err)` as a secondary signal. The
   default handler toasts the global message.

Bind errors (section 6.6) flow through the same envelope shape but render
either a `<template data-nd-error>` (if present) or fall through to
`config.onError(url, envelope, err)`.

### 8.4. Upload errors

Uploads are a separate code path (XHR, not fetch) and do not yet use the
unified envelope.

- 2xx → feedback shows success message; `handleSuccess` chain runs.
- non-2xx with JSON `errors` → `displayErrors` maps fields.
- non-2xx otherwise → feedback shows server message or generic "Upload
  failed" text.
- XHR network error → feedback shows "Network error. Please try again."
- Aborted XHR (teardown) → feedback shows "Upload cancelled."

### 8.5. Recommended backend envelope shapes

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

Backends MUST set `Content-Type: application/json` on error responses — the
runtime only parses JSON when the header matches.

---

## 9. Server-sent events (`data-nd-sse`)

### 9.1. Purpose

Subscribe to an `EventSource` and render each incoming message into the
element, either as a scalar field or via a template.

### 9.2. Attribute — `data-nd-sse="URL"`

The URL is `${var}`-resolved. Elements sharing the same resolved URL share a
single `EventSource`. A new `EventSource` is created per unique URL.

### 9.3. Event filtering — `data-nd-sse-event="TYPE"`

If set, the element only renders messages dispatched under that named SSE
event type (`event: TYPE` in the stream). If absent, the element renders only
the unnamed default `message` event.

The init code inspects every bound element, collects the union of named
types, and registers one listener per type plus (optionally) a `message`
listener.

### 9.4. Rendering

- `data-nd-template="ID"` + `data-nd-mode="append|prepend|replace"` renders
  each message via `render()`. Default mode is `append` (not `replace`).
  `data-nd-max` is honoured.
- `data-nd-field="PATH"` writes a scalar to `textContent`.
- Neither → `textContent = JSON.stringify(data)` or the raw string.

### 9.5. Reconnection and errors

`EventSource` handles reconnect natively. Each dispatch updates
`el.dataset.ndSseLastId` with the last observed event id. `error` events are
logged and routed through `config.onError(url, err)`.

### 9.6. `NDesign.getLastEventId(url)` (not currently exported)

An internal helper `getLastEventId(url)` exists in `sse.js` but is NOT
re-exported on the `NDesign` global. Agents SHOULD read the element's
`dataset.ndSseLastId` instead.

### 9.7. Example

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

---

## 10. WebSockets (`data-nd-ws`)

### 10.1. Purpose

Open a WebSocket and render incoming JSON messages into the element.

### 10.2. Attribute — `data-nd-ws="URL"`

URL is `${var}`-resolved. `wss://` URLs are recommended for authenticated
traffic. Elements sharing a resolved URL share one `WebSocket`.

Before connection, `config.wsProtocols` is passed as the protocol list (if
non-empty). If `config.wsTokenProvider` is a function, its return value is
appended as `token=<encoded>` to the URL's query string.

### 10.3. Connection state classes

Every bound element is stamped with `nd-ws-disconnected` at init; on `open`,
`nd-ws-disconnected` is removed and `nd-ws-connected` is added; on `close`,
the reverse. Style these in CSS to show a status indicator.

### 10.4. Reconnect with backoff

On `close` (non-intentional), a reconnect timer fires after `retryDelay` ms.
`retryDelay` starts at 1000, doubles on each attempt (plus up to 500 ms of
jitter), and caps at 30000. On `open`, `retryDelay` is reset to 1000.
`destroyWebSockets()` sets `intentionalClose = true` to prevent reconnect.

### 10.5. Message filtering — `data-nd-ws-filter="FIELD:VALUE"`

Per-element filter. The filter field is a dot-path read via `getByPath`. If
`String(actualValue) !== filterValue`, the message is skipped for that
element.

Messages that are not JSON are dropped with a console warning.

### 10.6. Rendering

Same rules as SSE (section 9.4). Default mode is `append`.

### 10.7. Example

```html
<div id="ws-status"
     class="nd-badge"
     data-nd-ws="wss://test.nitecon.org/ws/feed"
     data-nd-field="type">connecting...</div>

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

---

## 11. File upload (`data-nd-upload`)

### 11.1. Purpose

Submit a multipart form via `XMLHttpRequest` with live progress, using the
browser's native `FormData` serializer (so file inputs work). Shares
success/error rendering with action.js.

### 11.2. Attribute — `data-nd-upload="METHOD URL"`

Only valid on `<form>`. Method defaults to `POST`. URL is `${var}`-resolved.

```html
<form data-nd-upload="POST ${api}/api/uploads"
      data-nd-feedback="upload-msg">
  <input type="file" name="file" required>
  <progress class="nd-upload-progress" hidden></progress>
  <button type="submit" class="nd-btn-primary">Upload</button>
</form>
<div id="upload-msg"></div>
```

### 11.3. Progress bar

If the form contains `progress.nd-upload-progress`, its `value` is updated
from the `xhr.upload.progress` event (when `lengthComputable` is true). The
progress bar is shown during the upload and hidden 1 s after completion.

### 11.4. Headers and CSRF

The XHR manually sets:
- `X-Requested-With: NDesign`
- `X-CSRF-Token: <meta csrf-token>` (if the meta tag is present)

The browser sets `Content-Type: multipart/form-data; boundary=...`
automatically from the `FormData`. Do not override it.

### 11.5. Error handling

See 8.4. Field-level errors are mapped via `displayErrors` when the response
is JSON with an `errors` object.

### 11.6. Chained actions

`data-nd-success`, `data-nd-feedback`, and `data-nd-confirm` work the same as
on form actions. Note: `data-nd-set` is NOT processed on upload forms.

### 11.7. Teardown behaviour

`destroyUploads()` aborts any in-flight XHR for every tracked form.

---

## 12. Sortable (`data-nd-sortable`)

### 12.1. Purpose

Enable HTML5 drag-and-drop reordering on a container's direct children, with
full keyboard support and optional server POST on drop.

### 12.2. Attribute — `data-nd-sortable` or `data-nd-sortable="METHOD URL"`

When the value is empty, reordering is client-only. When a `"METHOD URL"` is
provided, after every successful reorder the runtime POSTs
`{ order: [...] }` to the endpoint and reverts the DOM on a non-2xx response.

The `order` array contains each draggable child's `data-id` if present, else
its zero-based string index.

### 12.3. Wiring

On init, the container is scanned and each direct child element is given
`draggable="true"`, `tabindex="0"` (if absent), and `aria-grabbed="false"`.
UL/OL containers keep implicit listbox semantics; other containers get
`role="listbox"`. An `aria-label` is added if missing.

A `MutationObserver` auto-wires dynamically added children.

### 12.4. Mouse drag behaviour

While dragging, the item is reordered live so the user sees the drop slot.
On drop:

1. `nd:sortable:reorder` is dispatched with `detail = { order, item }`.
2. If the attribute carries a URL, `submitReorder()` POSTs the order.

### 12.5. Keyboard behaviour

Focus a child (Tab), then:

| Key        | Action                                                |
|------------|-------------------------------------------------------|
| `Space`    | Grab the item / drop the grabbed item at current pos. |
| `ArrowUp`  | When grabbed: move up. Otherwise: focus previous.      |
| `ArrowDown`| When grabbed: move down. Otherwise: focus next.        |
| `Home`     | When grabbed: move to first position.                  |
| `End`      | When grabbed: move to last position.                   |
| `Escape`   | Cancel a grab; revert to snapshot order.              |

An `aria-live` polite region is injected into `<body>` and announces grab/drop/cancel.

### 12.6. Revert-on-failure

On server POST failure, the container's children are restored to the
pre-drag snapshot, the container gets `nd-sortable-error` for 2 s, a toast
fires, and `nd:sortable:revert` is dispatched. The toast message comes from
`responseData.errors._form` or `responseData.message` when the response is
JSON; otherwise a generic "Reorder failed — order has been reverted."

### 12.7. Example

```html
<ul data-nd-sortable="POST ${api}/api/todos/reorder">
  <li data-id="1">First</li>
  <li data-id="2">Second</li>
  <li data-id="3">Third</li>
</ul>
```

---

## 13. Modals and dialogs

### 13.1. Native `<dialog>` only

ndesign uses the browser's `<dialog>` element. There is no custom modal
container and no focus trap implementation beyond what the platform provides.

### 13.2. Attributes

| Attribute                      | Location                  | Behaviour                                                              |
|--------------------------------|---------------------------|------------------------------------------------------------------------|
| `data-nd-modal="SELECTOR"`     | any element               | On click: `document.querySelector(SELECTOR).showModal()`.              |
| `data-nd-dismiss`              | inside a `<dialog>`       | On click: closes the enclosing `<dialog>`.                             |
| `.nd-modal-close`              | inside a `<dialog>`       | Same as `data-nd-dismiss`.                                              |

A click on the dialog's `::backdrop` (detected via click coordinates outside
the dialog's bounding rect) also closes the dialog.

### 13.3. JS API

- `NDesign.openModal('#my-dialog')` — opens a dialog.
- `NDesign.closeModal('#my-dialog')` — closes a dialog.
- `NDesign.confirmDialog('#my-dialog') → Promise<boolean>` — opens a dialog
  as a confirm prompt and resolves with the user's choice.

`openModal` and `closeModal` log a warning and no-op if the selector does
not match a dialog. `confirmDialog` resolves `false` in that case.

**`confirmDialog(selector)` resolution rules.** The returned promise
resolves exactly once, based on the first matching event:

| Trigger                                                      | Resolves to |
|--------------------------------------------------------------|-------------|
| Click on `[data-nd-confirm-accept]` inside the dialog         | `true`      |
| Click on `[data-nd-dismiss]` or `.nd-modal-close`              | `false`     |
| Click on the dialog backdrop                                   | `false`     |
| Escape key                                                     | `false`     |
| Programmatic `dialog.close()` / `NDesign.closeModal()`         | `false`     |

Listeners are scoped to a local `AbortController` and removed automatically
on resolution, so calling `confirmDialog()` repeatedly on the same dialog
is safe.

### 13.4. Events

- `nd:modal:open` — dispatched on the dialog after `openModal()` or
  `confirmDialog()`.
- `nd:modal:close` — dispatched on the dialog after its `close` event (covers
  Escape, backdrop click, explicit `.close()` and `NDesign.closeModal`).
- `nd:modal:confirm` — dispatched on the dialog when `confirmDialog()`
  resolves `true` (accept button clicked).
- `nd:modal:cancel` — dispatched on the dialog when `confirmDialog()`
  resolves `false` (any dismiss path).

`nd:modal:confirm` and `nd:modal:cancel` are purely observational — they do
NOT affect the promise resolution.

### 13.5. Example

```html
<button class="nd-btn-primary" data-nd-modal="#edit-user">Edit</button>

<dialog id="edit-user" class="nd-modal">
  <form data-nd-action="PATCH ${api}/api/users/${userId}"
        data-nd-feedback="edit-feedback"
        data-nd-success="refresh:#user-table">
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

To close the enclosing dialog after a successful submit, use
`data-nd-success="close-modal"` (section 7.7) — it composes with the rest of
the success chain, e.g. `"close-modal,refresh:#user-table"`.

Server-driven chained confirmation (a `next_confirm` field on the response
opening another confirm dialog) is NOT implemented.

---

## 14. Toasts

### 14.1. JS API

```javascript
NDesign.toast(message, type, duration);
```

- `message` — text; HTML-escaped automatically.
- `type` — `'success' | 'error' | 'warning' | 'info'` or omitted for neutral.
- `duration` — milliseconds; default 5000; `0` = persistent until dismissed.

Returns the created toast DOM element.

Error toasts use `role="alert"` + `aria-live="assertive"`. Other toasts use
`role="status"` + `aria-live="polite"`.

### 14.2. Declarative trigger — `data-nd-toast`

The delegated click handler fires `NDesign.toast()` for any clicked element
with `data-nd-toast`. Attributes:

| Attribute                  | Value                                            |
|----------------------------|--------------------------------------------------|
| `data-nd-toast`            | Message text.                                    |
| `data-nd-toast-type`       | `success` / `error` / `warning` / `info`.         |
| `data-nd-toast-duration`   | Milliseconds as integer. Default 5000.            |

```html
<button class="nd-btn-primary"
        data-nd-toast="Saved"
        data-nd-toast-type="success">Save</button>
```

The container (`.nd-toast-container`) is auto-created in `<body>` on first use.

---

## 15. Navigation, dropdowns, tabs, tooltips

### 15.1. Responsive nav (`.nd-nav`, `.nd-nav-toggle`)

The module scans `.nd-nav-toggle` buttons. Each toggle's nearest ancestor
`nav` or `.nd-nav` is toggled open/closed via the `nd-nav-open` class. Side
navs (`.nd-nav-side`) additionally create/destroy a `.nd-nav-overlay`
element that closes the nav when clicked. `aria-expanded` is kept in sync.

Auto-close above `1280 px` window width.

The delegated click handler also supports `data-nd-toggle="sidebar"` as an
independent mechanism that toggles `.sidebar` and an overlay (this is a
separate code path from `initNav()` and targets legacy markup).

### 15.2. Dropdowns (`.nd-dropdown`)

Wrap a `<button>` followed by a `<ul>` or `<ol>` inside `.nd-dropdown`. The
module:

- Wires the button to toggle `nd-open` on the wrapper.
- Applies `role="menu"` to the list and `role="menuitem"` to items.
- Handles ArrowUp/Down, Enter, and Escape on the trigger.
- Closes on outside click.

```html
<div class="nd-dropdown">
  <button type="button">Actions</button>
  <ul class="nd-dropdown-menu">
    <li><a href="/edit">Edit</a></li>
    <li><a href="/delete">Delete</a></li>
  </ul>
</div>
```

### 15.3. Tabs (`.nd-tabs`, `.nd-tabs-vertical`)

Uses WAI-ARIA roles. Tabs MUST carry `role="tab"` and
`aria-controls="PANEL_ID"`; panels MUST carry `role="tabpanel"` and an `id`.
Activation is MANUAL — arrow keys move focus only; Enter, Space, or click
activate the focused tab.

```html
<div class="nd-tabs">
  <div role="tablist">
    <button role="tab" aria-controls="p1" aria-selected="true">Profile</button>
    <button role="tab" aria-controls="p2">Security</button>
  </div>
  <section role="tabpanel" id="p1">Profile content</section>
  <section role="tabpanel" id="p2" hidden>Security content</section>
</div>
```

### 15.4. Custom selects

Every non-multi `<select>` is enhanced by `initSelects()` into a themed
`.nd-select` wrapper. The native select is hidden (kept in layout for form
validation) and its value is synced to/from the custom list. Full keyboard
support including type-ahead. To opt out, apply the enhancement after
`initSelects` has run by adding `multiple` or wrapping the select in
`.nd-select` before init.

### 15.5. Tooltips (`data-nd-tooltip`)

```html
<button data-nd-tooltip="Save the document">Save</button>
<a data-nd-tooltip="External link"
   data-nd-tooltip-placement="bottom">Docs</a>
```

- Shared tooltip element inserted in `<body>`.
- `data-nd-tooltip-placement` may be `top` (default), `bottom`, `left`, `right`.
- Shows after a 200 ms hover/focus delay.
- Escape hides the tooltip. Scroll/resize also hides it.
- The tooltip text is set via `textContent` — HTML is NOT rendered.

---

## 16. Theme switching

### 16.1. Setup

Declare each theme twice — once as a `<meta name="nd-theme">` registration
and once as the actual `<link class="theme">`:

```html
<meta name="nd-theme" content="light" data-href="/dist/themes/light.min.css">
<meta name="nd-theme" content="dark"  data-href="/dist/themes/dark.min.css">

<link rel="stylesheet"
      href="/dist/themes/light.min.css"
      class="theme" data-theme="light">
```

The `class="theme"` is mandatory. Do NOT use `title="..."` on the theme link
— per HTML spec, `<link rel="stylesheet" title>` becomes an "alternate
stylesheet" that the browser will not apply.

### 16.2. Switching

- `NDesign.setTheme('dark')` swaps to the named theme by replacing the
  `link.theme` element (a fresh `<link>` is inserted and the old one removed
  after `load`, avoiding FOUC).
- `NDesign.toggleTheme()` cycles to the next registered theme.
- `NDesign.getThemes()` returns `[{name, label, active}, ...]`.

### 16.3. Declarative triggers

The delegated click handler processes:

| Attribute                  | Effect                               |
|----------------------------|--------------------------------------|
| `data-nd-theme="dark"`     | Calls `setTheme('dark')`.             |
| `data-nd-theme-toggle`     | Calls `toggleTheme()`.                |

```html
<button class="nd-btn-ghost" data-nd-theme-toggle>Theme</button>
```

---

## 17. Template syntax (`{{field}}`)

Templates are `<template>` elements referenced by `id`. Rendering clones the
content and walks all text nodes and attributes, replacing `{{path}}` tokens.

### 17.1. Token grammar

```
\{\{(\s*[\w.]+\s*)\}\}
```

- The path is `\w.` only — no pipes, no filters, no defaults. There is NO
  `{{field|default}}` syntax.
- `getByPath(data, path)` resolves the value.
- Missing values yield the empty string in text nodes and
  `escapeHTML(undefined)` = `''` in attribute values.
- Text node substitutions use `textContent` — the browser handles escaping.
- Attribute substitutions use `escapeHTML()` before assignment.

Only the row object is visible inside a template render. `${var}` store
interpolation does NOT apply inside templates.

### 17.2. Conditional `data-nd-if`

An element inside a template with `data-nd-if="FIELD"` is REMOVED when the
named field is falsy.

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

### 17.3. Programmatic API

| Function                                          | Purpose                                          |
|---------------------------------------------------|--------------------------------------------------|
| `NDesign.render(container, templateId, data, mode?)` | Render (array or object) into a container.   |
| `NDesign.renderOne(tpl, data)`                    | Clone and interpolate a template for one item.    |
| `NDesign.interpolate(text, data)`                 | Interpolate a standalone string.                  |

`mode` defaults to `'replace'`. See section 6.7.

---

## 18. Events fired by ndesign

A consolidated list (also in section 0.5):

| Event                    | Target                | Detail                                |
|--------------------------|-----------------------|---------------------------------------|
| `nd:refresh`             | bound element          | none — consumer refetches              |
| `nd:var-change`          | `document`            | `{path, topKey, value}`               |
| `nd:model`               | model input           | `{name, value}`                       |
| `nd:set`                 | set-trigger element    | `{el}`                                |
| `nd:modal:open`          | `<dialog>`            | none                                  |
| `nd:modal:close`         | `<dialog>`            | none                                  |
| `nd:modal:confirm`       | `<dialog>`            | none — `confirmDialog()` accepted       |
| `nd:modal:cancel`        | `<dialog>`            | none — `confirmDialog()` dismissed      |
| `nd:sortable:reorder`    | sortable container    | `{order, item}`                       |
| `nd:sortable:revert`     | sortable container    | `{item}`                              |
| user-defined `emit:X`    | action/set element     | `responseData` (for set: `undefined`) |

---

## 19. CSS class reference (compact)

The core stylesheet ships a conventional utility + component system. Modifier
names follow predictable suffixes; agents do not need to memorize every class.

### 19.1. Layout and spacing

| Family          | Example                              | Notes                                   |
|-----------------|--------------------------------------|-----------------------------------------|
| Container       | `.nd-container`                      | Narrow (900 px) centered column — **prose/blog only**, not for app layouts. See 1.1. |
| Grid            | `.nd-row`, `.nd-col-6`, `.nd-col-12` | 12-col grid.                             |
| Flex            | `.nd-flex`, `.nd-flex-between`, `.nd-flex-center` | Flex layout helpers.           |
| Gap             | `.nd-gap-sm`, `.nd-gap-md`, `.nd-gap-lg`          | Flex/grid gap.                  |
| Margin          | `.nd-m{t,b,l,r,x,y}-{xs,sm,md,lg,xl,2xl,3xl,0}` | `.nd-mt-md`, `.nd-mx-lg`, etc.    |
| Padding         | `.nd-p{t,b,l,r,x,y,}-{xs,sm,md,lg,xl,2xl,3xl,0}` | Same scale as margin.            |

Spacing scale (rems): `xs=0.25`, `sm=0.5`, `md=1`, `lg=1.5`, `xl=2`,
`2xl=3`, `3xl=4`.

### 19.2. Typography

- `.nd-text-xs`, `-sm`, `-base`, `-lg`, `-xl`, `-2xl`, `-3xl`, `-4xl`, `-5xl`
- `.nd-text-muted`, `.nd-text-primary`, `.nd-text-success`, `.nd-text-danger`
- Font weights: `.nd-font-normal` / `-medium` / `-semibold` / `-bold`

### 19.3. Forms

- `.nd-form-group` — wraps label + input + error.
- `.nd-form-error` — per-field error message slot (written by `displayErrors`).
- `.nd-form-feedback-auto` — auto-created global feedback slot for forms and
  buttons that did not declare `data-nd-feedback` (see section 7.4). Combined
  with `.nd-alert` + `.nd-alert-{error,success}`.
- `.nd-form-help` — help text slot.
- `.nd-error` on an input — red border / error state.
- `.nd-btn-primary`, `.nd-btn-secondary`, `.nd-btn-ghost`, `.nd-btn-danger`,
  `.nd-btn-sm`, `.nd-btn-lg`.

### 19.4. Containers and feedback

- Cards: `.nd-card`, `.nd-card-header`, `.nd-card-body`, `.nd-card-footer`.
- Alerts: `.nd-alert`, `.nd-alert-success`, `.nd-alert-error`,
  `.nd-alert-warning`, `.nd-alert-info`.
- Badges: `.nd-badge`, `.nd-badge-sm`, `.nd-badge-success`, `.nd-badge-warning`.
- Tables: `.nd-table`, `.nd-table-hover`, `.nd-table-compact`,
  `.nd-table-responsive`.
- Modals: `.nd-modal`, `.nd-modal-sm`, `.nd-modal-lg`, `.nd-modal-close`.
- Navigation: `.nd-nav`, `.nd-nav-side`, `.nd-nav-toggle`, `.nd-nav-open`,
  `.nd-nav-menu`, `.nd-active`.
- Dropdown: `.nd-dropdown`, `.nd-dropdown-menu`, `.nd-open`.
- Tabs: `.nd-tabs`, `.nd-tabs-vertical`.
- Switches: `.nd-switch` (delegated click auto-toggles `aria-pressed`).
- Skeletons: `.nd-skeleton`.
- Toasts: `.nd-toast-container`, `.nd-toast`, `.nd-toast-success` etc.
- Upload progress: `progress.nd-upload-progress`.
- Sortable: `.nd-dragging`, `.nd-kb-grabbed`, `.nd-sortable-error`.

### 19.5. Theme variables

Every color, background, shadow, and accent is a CSS custom property named
`--nd-*`. Examples from the light theme:

- `--nd-bg-body`, `--nd-bg-surface`, `--nd-bg-surface-raised`,
  `--nd-bg-surface-hover`, `--nd-bg-well`, `--nd-bg-code`, `--nd-bg-table-stripe`.
- `--nd-text-primary`, `--nd-text-secondary`, `--nd-text-muted`.
- `--nd-border`, `--nd-border-hover`.
- `--nd-accent`, `--nd-accent-hover`.
- `--nd-glass-blur`, `--nd-glass-saturate`.

Apps that need to override colors SHOULD redefine `--nd-*` variables in a
custom stylesheet loaded AFTER the theme link.

---

## 20. Recipes

All recipes target `https://test.nitecon.org`. They assume the standard page
skeleton from section 2 (with `<meta name="endpoint:api" content="https://test.nitecon.org">`).

### 20.1. Starting layouts — pick one

ndesign pages begin from one of three canonical skeletons. **Ask the user
which to use** (see section 1.1a); do not guess. Once chosen, copy the
matching skeleton verbatim and build inside it.

All three skeletons share the same `<head>` — the only thing that varies
is the `<body>` contents.

**Shared `<head>` (use for all three layouts):**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page title</title>
    <link rel="stylesheet" href="/dist/ndesign.min.css">
    <link rel="stylesheet" href="/dist/themes/light.css" class="theme" data-theme="light">
    <meta name="nd-theme" content="light" data-href="/dist/themes/light.css">
    <meta name="nd-theme" content="dark"  data-href="/dist/themes/dark.css">
    <meta name="endpoint:api" content="https://test.nitecon.org">
  </head>
  <!-- body goes here — pick ONE of the three below -->
  <script src="/dist/ndesign.min.js"></script>
</html>
```

#### 20.1.a. `control-panel` — dashboard with sidebar and top header

Use for admin UIs, dashboards, operations consoles — any data-heavy
application with persistent left navigation and a scrollable content area.
Reference: `demo/control-panel.html`.

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
          <button class="hamburger" data-nd-toggle="sidebar" aria-label="Toggle navigation">&#9776;</button>
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

#### 20.1.b. `app-shell` — fixed sidebar + main content column

Use for multi-page SaaS apps where the sidebar is always visible and the
page's primary content sits in a single main column. Simpler than
`control-panel` (no top header bar). Reference: `demo/app-shell.html`.

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

  <!-- Main content area — .app-main reserves the 16rem sidebar gutter -->
  <div class="app-main">
    <!-- Optional top bar -->
    <nav class="nd-relative nd-mb-lg">
      <button class="nd-nav-toggle" aria-label="Toggle sidebar" data-nd-toggle="sidebar">&#9776;</button>
      <span class="nd-nav-brand">Page Title</span>
      <div class="nd-nav-end">
        <button class="nd-btn-ghost nd-btn-sm" data-nd-theme-toggle>Theme</button>
      </div>
    </nav>

    <!-- Page content. Do NOT wrap in .nd-container. -->
  </div>

</body>
```

#### 20.1.c. `blog` — centered prose panel for editorial content

Use for blog posts, articles, documentation, marketing copy, and similar
long-form reading. The only layout that uses `.nd-container` +
`.nd-prose`. Reference: `demo/blog-post.html`.

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

  <!-- Centered 900px column; the article sits on a floating .nd-panel -->
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

### 20.2. User card bound to `/api/users/2`

```html
<div class="nd-card"
     id="user-card"
     data-nd-bind="${api}/api/users/2"
     data-nd-template="user-tpl">
  <template id="user-tpl">
    <div class="nd-card-header"><h3>{{name}}</h3></div>
    <div class="nd-card-body">
      <p>{{email}}</p>
      <p data-nd-if="active"><span class="nd-badge nd-badge-success">Active</span></p>
    </div>
  </template>
  <template data-nd-loading>
    <div class="nd-card-body"><div class="nd-skeleton"></div></div>
  </template>
</div>
```

### 20.3. User list table

```html
<table class="nd-table nd-table-hover">
  <thead>
    <tr><th>ID</th><th>Name</th><th>Email</th></tr>
  </thead>
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
    <template data-nd-empty>
      <tr><td colspan="3">No users.</td></tr>
    </template>
  </tbody>
</table>
```

### 20.4. Create user form with validation

```html
<form data-nd-action="POST ${api}/api/users"
      data-nd-success="refresh:#user-table,reset"
      data-nd-feedback="user-feedback"
      class="nd-card">
  <div class="nd-card-body">
    <div class="nd-form-group">
      <label for="u-name">Name</label>
      <input id="u-name" name="name" required>
      <div class="nd-form-error"></div>
    </div>
    <div class="nd-form-group">
      <label for="u-email">Email</label>
      <input id="u-email" name="email" type="email" required>
      <div class="nd-form-error"></div>
    </div>
    <div class="nd-form-group">
      <label for="u-role">Role</label>
      <select id="u-role" name="role">
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <div class="nd-form-error"></div>
    </div>
    <div id="user-feedback"></div>
  </div>
  <div class="nd-card-footer">
    <button type="submit" class="nd-btn-primary">Create</button>
  </div>
</form>
```

Server error shape expected (section 8.5):

```json
{ "errors": { "error": "Please correct the form below.",
              "email": "That email is already taken" } }
```

### 20.5. Dashboard with polling stats and WS trade feed

```html
<section class="nd-row">
  <div class="nd-col-4 nd-card">
    <div class="nd-card-body">
      <h2 data-nd-bind="${api}/api/stats/live"
          data-nd-field="cpu_usage"
          data-nd-refresh="2000">—</h2>
      <p>CPU %</p>
    </div>
  </div>
  <div class="nd-col-4 nd-card">
    <div class="nd-card-body">
      <h2 data-nd-bind="${api}/api/stats/live"
          data-nd-field="memory_used"
          data-nd-refresh="2000">—</h2>
      <p>Memory</p>
    </div>
  </div>
  <div class="nd-col-4 nd-card">
    <div class="nd-card-body">
      <h2 data-nd-bind="${api}/api/stats/live"
          data-nd-field="active_sessions"
          data-nd-refresh="2000">—</h2>
      <p>Sessions</p>
    </div>
  </div>
</section>

<table class="nd-table nd-table-compact">
  <thead><tr><th>Symbol</th><th>Price</th></tr></thead>
  <tbody data-nd-ws="wss://test.nitecon.org/ws/feed"
         data-nd-ws-filter="type:trade"
         data-nd-template="trade-row"
         data-nd-mode="prepend"
         data-nd-max="20">
    <template id="trade-row">
      <tr><td>{{symbol}}</td><td>{{price}}</td></tr>
    </template>
  </tbody>
</table>
```

### 20.6. Workflow: inputs + pager + submit via data-nd-body

```html
<meta name="var:page" content="1">
<meta name="var:perPage" content="10">

<div class="nd-flex nd-gap-sm">
  <button data-nd-set="page=${page}-1" data-nd-success="refresh:#list">Prev</button>
  <span>Page <span data-nd-bind="${api}/api/users/paginated"
                    data-nd-field="meta.page"
                    data-nd-params="page=1">1</span></span>
  <button data-nd-set="page=${page}+1" data-nd-success="refresh:#list">Next</button>
</div>

<tbody id="list"
       data-nd-bind="${api}/api/users/paginated"
       data-nd-select="data"
       data-nd-template="row"
       data-nd-params="page=${page}&per_page=${perPage}"
       data-nd-defer>
  <template id="row"><tr><td>{{name}}</td></tr></template>
</tbody>

<button class="nd-btn-primary"
        data-nd-action="POST ${api}/api/orders"
        data-nd-body='{"page":${page},"per_page":${perPage}}'
        data-nd-feedback="order-msg">Submit</button>
<div id="order-msg"></div>
```

Note: the recipe above demonstrates a CAVEAT. `data-nd-params` is not
`${var}`-resolved — its value is appended literally. For params that depend
on store state, prefer a dedicated trigger element with `data-nd-bind-trigger`
and `data-nd-params` constructed in JS, or use `data-nd-success="refresh:#list"`
after mutating `${page}` and keep params simple.

### 20.7. Modal with form + validation

```html
<button class="nd-btn-primary" data-nd-modal="#new-user">New user</button>

<dialog id="new-user" class="nd-modal">
  <form data-nd-action="POST ${api}/api/users"
        data-nd-success="close-modal,refresh:#user-table,reset">
    <div class="nd-form-group">
      <label for="m-name">Name</label>
      <input id="m-name" name="name" required>
      <div class="nd-form-error"></div>
    </div>
    <div class="nd-form-group">
      <label for="m-email">Email</label>
      <input id="m-email" name="email" type="email" required>
      <div class="nd-form-error"></div>
    </div>
    <menu>
      <button type="button" data-nd-dismiss>Cancel</button>
      <button type="submit" class="nd-btn-primary">Create</button>
    </menu>
  </form>
</dialog>
```

Note: `data-nd-feedback` is intentionally omitted — the runtime auto-creates
a `.nd-form-feedback-auto` slot immediately before the `<menu>` (which is the
direct child of the `<form>` containing the submit button) on the first
error. Declare `data-nd-feedback="some-id"` only if you need the global
message at a specific location other than just above the submit row.
`data-nd-success="close-modal,..."` closes the enclosing `<dialog>` and
refreshes the outer table after a successful submit.

### 20.8. Confirm delete

```html
<button class="nd-btn-danger"
        data-nd-action="DELETE ${api}/api/users/3"
        data-nd-confirm="Delete user James Miller?"
        data-nd-success="refresh:#user-table"
        data-nd-feedback="delete-msg">
  Delete
</button>
<div id="delete-msg"></div>
```

For a custom-styled confirm, point `data-nd-confirm` at a `<dialog>` by id
(see 7.6) — the runtime awaits `confirmDialog()` before submitting.

### 20.9. Dark-mode toggle

```html
<meta name="nd-theme" content="light" data-href="/dist/themes/light.min.css">
<meta name="nd-theme" content="dark"  data-href="/dist/themes/dark.min.css">
<link rel="stylesheet" href="/dist/themes/light.min.css"
      class="theme" data-theme="light">

<nav class="nd-nav">
  <button class="nd-btn-ghost" data-nd-theme-toggle>Theme</button>
</nav>
```

### 20.10. File upload with progress

```html
<form data-nd-upload="POST ${api}/api/uploads"
      data-nd-feedback="upload-msg"
      class="nd-card">
  <div class="nd-card-body">
    <label>
      File
      <input type="file" name="file" required>
    </label>
    <progress class="nd-upload-progress" hidden></progress>
    <div id="upload-msg"></div>
  </div>
  <div class="nd-card-footer">
    <button type="submit" class="nd-btn-primary">Upload</button>
  </div>
</form>
```

### 20.11. Infinite scroll with append mode

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
  <template data-nd-loading>
    <tr><td colspan="2">Loading…</td></tr>
  </template>
</tbody>

<button class="nd-btn-secondary"
        data-nd-bind-trigger="#feed-list"
        data-nd-params="offset=10&limit=10"
        data-nd-bind-mode="append">Load more</button>
```

### 20.12. Deferred bind that waits for a store var

```html
<meta name="var:selectedId" content="">

<div class="nd-flex nd-gap-sm">
  <button data-nd-set="selectedId=1"
          data-nd-success="refresh:#user-details">User 1</button>
  <button data-nd-set="selectedId=2"
          data-nd-success="refresh:#user-details">User 2</button>
  <button data-nd-set="selectedId=3"
          data-nd-success="refresh:#user-details">User 3</button>
</div>

<div id="user-details"
     data-nd-bind="${api}/api/users/${selectedId}"
     data-nd-template="u-details"
     data-nd-defer>
  <template id="u-details">
    <h2>{{name}}</h2>
    <p>{{email}}</p>
  </template>
</div>
```

### 20.13. Form with realistic error handling

This recipe exercises every part of the unified error envelope, the
auto-feedback slot, the `<dialog>`-based confirm, per-element timeout, and
`close-modal` composed in the success chain. `POST /api/users` on the test
server returns `{"errors":{"email":"Invalid email address","role":"Invalid role"}}`
for bad input, which triggers the "please correct the N highlighted fields
below." auto-feedback message.

```html
<table class="nd-table nd-table-hover">
  <thead><tr><th>Name</th><th>Email</th></tr></thead>
  <tbody id="user-table"
         data-nd-bind="${api}/api/users"
         data-nd-template="user-row">
    <template id="user-row">
      <tr><td>{{name}}</td><td>{{email}}</td></tr>
    </template>
  </tbody>
</table>

<button class="nd-btn-primary" data-nd-modal="#new-user-modal">New user</button>

<dialog id="new-user-modal" class="nd-modal">
  <form data-nd-action="POST ${api}/api/users"
        data-nd-timeout="8000"
        data-nd-confirm="#confirm-submit"
        data-nd-success="close-modal,refresh:#user-table,reset">
    <h2>New user</h2>

    <div class="nd-form-group">
      <label for="nu-name">Full name</label>
      <input id="nu-name" name="name" required>
      <div class="nd-form-error"></div>
    </div>
    <div class="nd-form-group">
      <label for="nu-email">Email address</label>
      <input id="nu-email" name="email" type="email" required>
      <div class="nd-form-error"></div>
    </div>
    <div class="nd-form-group">
      <label for="nu-role">Role</label>
      <select id="nu-role" name="role">
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <div class="nd-form-error"></div>
    </div>

    <menu>
      <button type="button" data-nd-dismiss>Cancel</button>
      <button type="submit" class="nd-btn-primary">Create</button>
    </menu>
  </form>
</dialog>

<dialog id="confirm-submit" class="nd-modal nd-modal-sm">
  <p>Create this user?</p>
  <menu>
    <button type="button" data-nd-dismiss>No</button>
    <button type="button" class="nd-btn-primary" data-nd-confirm-accept>Yes</button>
  </menu>
</dialog>
```

Behaviour walkthrough:

1. User clicks "New user" → the outer dialog opens.
2. User fills the form and clicks Create → the runtime awaits
   `confirmDialog('#confirm-submit')`. Only if the user clicks the
   `[data-nd-confirm-accept]` button does the fetch start.
3. The fetch is bounded by `data-nd-timeout="8000"` (8 s). If the server
   is unreachable the envelope becomes
   `{errors:{error:"Couldn't reach server"}}`; on timeout,
   `{errors:{error:"Request timed out"}}`.
4. On a 422 with `{"errors":{"email":"...","role":"..."}}`:
   - `.nd-error` is added to both inputs.
   - Their `.nd-form-error` siblings show the per-field messages.
   - The auto-feedback slot (injected above `<menu>`) shows
     `"Please correct the 2 highlighted fields below."`
   - The default `onError` toast fires
     `NDesign.toast("Please correct the 2 highlighted fields below.", "error")`.
5. On a 2xx, the success chain runs: `close-modal` closes the outer dialog,
   `refresh:#user-table` refetches the table, `reset` clears the form for
   next use.

No `data-nd-feedback` attribute is declared — the auto-slot handles the
global message placement.

---

## 21. What NOT to do — common mistakes

- **DO NOT** reinvent `baseURL`. Use `<meta name="endpoint:NAME">` and
  `${NAME}` in attribute values.
- **DO NOT** expect a store write to auto-refresh a `data-nd-bind` element.
  Only `data-nd-model` inputs react to store changes (same top-level key).
  Fetch-backed bindings do NOT. Pair every store mutation that should
  refresh a view with an explicit `data-nd-success="refresh:#id"` or a
  manual `dispatchEvent(new CustomEvent('nd:refresh'))`. See section 5.9.
- **DO NOT** put `${var}` tokens in element text nodes expecting
  interpolation. Templates use `{{field}}` (per-row); store vars use `${var}`
  (per-attribute).
- **DO NOT** use `data-nd-body` on `<form>` elements. Forms always serialize
  their inputs; `data-nd-body` is ignored.
- **DO NOT** use relative `/api/...` URLs when the API is cross-origin. Use
  the full URL, or `${api}/...` with a `<meta name="endpoint:api">` base.
- **DO NOT** call `NDesign.init()` while there are dynamic subscriptions you
  want to keep — init tears down every subsystem first. It is safe but heavy.
- **DO NOT** listen to `nd:var-change` for general reactivity. It fires
  every store write and is scoped conceptually to `data-nd-model`.
- **DO NOT** write `$var`. Only `${var}` is recognised.
- **DO NOT** rely on a server-driven chained confirmation flow (e.g. a
  `next_confirm` field on the response opening another confirm dialog). It
  is not implemented. Compose multi-step confirms client-side with
  `data-nd-confirm="#dialog-id"` and `data-nd-success="close-modal,..."`.
- **DO NOT** expect `data-nd-set` to run on successful uploads. It does not
  — upload success only processes `data-nd-success` and the feedback message.
- **DO NOT** embed HTML in toast messages expecting it to render. Toast text
  is HTML-escaped via `textContent`.
- **DO NOT** wrap application layouts in `.nd-container`. The framework is
  full-width by default. `.nd-container` is a narrow (900 px) centered
  column intended only for prose-heavy pages such as blog posts and articles.
  Using it on dashboards, control panels, or any multi-column app layout
  wastes screen space and breaks the grid. See section 1.1.
- **DO NOT** add custom `<style>` blocks, inline `style="…"` attributes, or
  `<script>` blocks to ndesign pages. The framework is designed to be
  HTML-only — every visual treatment and interaction is handled by the
  bundled CSS and JS. If something appears to require custom code, it means
  a framework capability is missing and should be added to the framework,
  not patched around. The only exceptions are third-party libraries for
  charting, animation, rich-text editing, or maps. See section 1.2.

---

## 22. Testing recommendations

- Interactive debugging: open the browser console and use
  `NDesign.store.get('userId')`, `NDesign.resolveVars('${api}/api/users/${userId}')`,
  `NDesign.endpoint('api')`.
- Manual error exercise: submit a form whose backend returns
  `{"errors":{"error":"...", "email":"..."}}` with HTTP 422; verify that
  `.nd-error` appears on the `email` input, the nearest `.nd-form-error`
  shows the field message, and the auto-feedback slot (or declared
  `#your-feedback-id`) shows the global `errors.error` text.
- Network failure simulation: use devtools → Network → Offline, submit a
  form, and verify the auto-feedback slot shows `"Couldn't reach server"`.
- Timeout simulation: add `data-nd-timeout="50"` to any action, click it,
  and verify the auto-feedback slot shows `"Request timed out"` (the
  synthesized `AbortError` envelope from section 8.2).
- Browser automation: the repo ships demo pages under `demo/`; use any
  headless browser harness to drive `demo/bindings.html` against the public
  test server.
- `data-nd-set` arithmetic: check the console for `[ndesign] data-nd-set:
  arithmetic on non-numeric var` warnings; they indicate an uninitialised or
  malformed var.

---

## 23. Versioning

This specification reflects the state of the `main` branch at the time of
writing. The authoritative sources are `js/*.js` in the repository and the
compiled `dist/ndesign.min.js` + `dist/ndesign.min.css` bundles. When these
diverge from this document, the source wins; please file an issue or PR
against `docs/SPEC.md`.
