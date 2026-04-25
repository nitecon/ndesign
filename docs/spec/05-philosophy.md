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
