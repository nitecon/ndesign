# ndesign — Architecture Specification

**Version:** 0.1.0-draft
**Date:** 2026-04-08

---

## 1. Vision

ndesign is a lightweight, framework-free frontend design system and binding runtime built for server-rendered HTML applications. It enables backend engineers (Go, Rust, Python, etc.) to build rich, interactive UIs by declaring data bindings in HTML attributes — no build step, no SPA, no virtual DOM.

The backend is always authoritative. The frontend is a thin presentation and binding layer delivered via CDN.

---

## 2. Delivery Model

### 2.1 CDN Assets

```
cdn.example.com/ndesign/<version>/
├── ndesign.min.js          # binding runtime (~15-25KB gzipped target)
├── ndesign.min.css          # core structural styles
├── themes/
│   ├── light.min.css        # default light theme
│   ├── dark.min.css         # dark theme
│   └── <custom>.min.css     # any additional themes
```

### 2.2 Consumer Integration

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="stylesheet" href="/cdn/ndesign/1.0.0/ndesign.min.css">
  <link rel="stylesheet" href="/cdn/ndesign/1.0.0/themes/light.min.css" class="theme" title="light">
  <meta name="nd-theme" content="light" data-href="/cdn/ndesign/1.0.0/themes/light.min.css">
  <meta name="nd-theme" content="dark"  data-href="/cdn/ndesign/1.0.0/themes/dark.min.css">
</head>
<body>
  <!-- server-rendered HTML with nd-* attributes -->
  <script src="/cdn/ndesign/1.0.0/ndesign.min.js"></script>
</body>
</html>
```

No build step required. No npm. No bundler. Just `<link>` + `<script>` + `<meta>` tags.

---

## 3. CSS Architecture

### 3.1 Design Principles

- **Desktop-first, mobile-responsive.** Breakpoints scale down, not up.
- **No utility-class sprawl.** Semantic class names (`.nd-card`, `.nd-btn`) over atomic utilities.
- **Components are CSS-only.** Cards, panels, wells, buttons — no JS behavior attached.
- **Theme files are pure color definitions.** Core never contains a color value.

### 3.2 File Structure (SCSS Source)

```
scss/
├── core.scss               # master import — compiles to ndesign.css
├── _reset.scss             # normalize + box-sizing + sensible defaults
├── _tokens.scss            # spacing scale, font sizes, radii, breakpoints, z-index
├── _typography.scss        # headings (h1-h6), body, monospace, links, prose
├── _layout.scss            # grid system, flex helpers, containers, sections
├── _cards.scss             # .nd-card, .nd-card-header, .nd-card-body, .nd-card-footer
├── _panels.scss            # .nd-panel — bordered content sections
├── _wells.scss             # .nd-well — inset/recessed background regions
├── _buttons.scss           # .nd-btn, .nd-btn-primary/secondary/danger, sizes, .nd-switch
├── _forms.scss             # inputs, selects, textareas, checkboxes, radios, labels
├── _tables.scss            # .nd-table, striped, hover, responsive wrapper
├── _alerts.scss            # .nd-alert, .nd-alert-success/warning/error/info
├── _badges.scss            # .nd-badge, .nd-badge-primary/danger/success
├── _asides.scss            # .fold — edge-pinned callouts with semantic variants
├── _nav.scss               # <nav>, .sidebar, .nd-nav-menu, mobile collapse
├── _dropdowns.scss         # .nd-dropdown, .nd-dropdown-menu, alignment/direction
├── _modals.scss            # <dialog> — native modal with backdrop, size variants
├── _toasts.scss            # .nd-toast, .nd-toast-container, slide-in animation
├── _app-layout.scss        # .app-layout, .app-page, .overlay, .hamburger
├── _avatars.scss           # .avatar, .avatar-sm/lg/xl
├── _utilities.scss         # spacing helpers, text alignment, visibility, display
├── _responsive.scss        # breakpoint mixins, responsive overrides
├── _transitions.scss       # shared transition/animation tokens
│
├── themes/
│   ├── light.scss          # compiles to themes/light.css
│   └── dark.scss           # compiles to themes/dark.css
```

### 3.3 Theming Strategy

**Mechanism: CSS custom properties defined in theme files, swapped via file replacement.**

`core.scss` references variables — never raw color values:

```scss
// In _cards.scss (part of core)
.nd-card {
  background: var(--nd-bg-surface);
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius-md);
  box-shadow: var(--nd-shadow-sm);
}
```

Theme files define those properties on `:root`:

```scss
// themes/light.scss
:root {
  --nd-bg-body:       #f8f9fa;
  --nd-bg-surface:    #ffffff;
  --nd-bg-well:       #e9ecef;
  --nd-text-primary:  #212529;
  --nd-text-secondary:#6c757d;
  --nd-text-muted:    #adb5bd;
  --nd-border:        #dee2e6;
  --nd-accent:        #0d6efd;
  --nd-accent-hover:  #0b5ed7;
  --nd-danger:        #dc3545;
  --nd-success:       #198754;
  --nd-warning:       #ffc107;
  --nd-info:          #0dcaf0;
  --nd-shadow-sm:     0 1px 2px rgba(0,0,0,0.05);
  --nd-shadow-md:     0 4px 6px rgba(0,0,0,0.07);
  --nd-shadow-lg:     0 10px 15px rgba(0,0,0,0.1);
  // ... full token set
}
```

```scss
// themes/dark.scss
:root {
  --nd-bg-body:       #1a1a2e;
  --nd-bg-surface:    #16213e;
  --nd-bg-well:       #0f3460;
  --nd-text-primary:  #e4e6eb;
  --nd-text-secondary:#b0b3b8;
  --nd-text-muted:    #6c757d;
  --nd-border:        #2d3748;
  --nd-accent:        #4dabf7;
  --nd-accent-hover:  #74c0fc;
  // ... same token names, dark values
}
```

**Theme switching mechanism:**

A single `<link class="theme">` tag carries the active stylesheet. Available themes
are registered via `<meta name="nd-theme">` tags that map a name to a CSS href:

```html
<link rel="stylesheet" href="themes/light.css" class="theme" title="light">
<meta name="nd-theme" content="light" data-href="themes/light.css">
<meta name="nd-theme" content="dark"  data-href="themes/dark.css">
```

**Switching in JS:**

```js
NDesign.setTheme('dark');   // sets link.theme href to the matching meta's data-href
NDesign.toggleTheme();      // cycles to the next registered theme
NDesign.getThemes();        // returns [{ name, label, active }, ...]
```

**Declarative switching in HTML:**

```html
<!-- Set a specific theme -->
<button data-nd-theme="dark">Dark Mode</button>

<!-- Cycle through all registered themes -->
<button data-nd-theme-toggle>Toggle Theme</button>
```

**Why this approach:**
- Complete separation — each theme is a standalone file
- Unlimited themes — add `solarized.css`, `high-contrast.css`, etc.
- Zero duplication of structural rules across theme files
- Theme files are tiny (just custom property declarations)
- Works without JS (server can render the correct `<link>` tag)
- Declarative HTML attributes for zero-JS theme toggling

### 3.4 Spacing & Typography Scale

```scss
// _tokens.scss
$nd-space-unit: 0.25rem;  // 4px base

$nd-space-xs:   $nd-space-unit * 1;   // 4px
$nd-space-sm:   $nd-space-unit * 2;   // 8px
$nd-space-md:   $nd-space-unit * 4;   // 16px
$nd-space-lg:   $nd-space-unit * 6;   // 24px
$nd-space-xl:   $nd-space-unit * 8;   // 32px
$nd-space-2xl:  $nd-space-unit * 12;  // 48px

$nd-font-xs:    0.75rem;    // 12px
$nd-font-sm:    0.875rem;   // 14px
$nd-font-base:  1rem;       // 16px
$nd-font-lg:    1.125rem;   // 18px
$nd-font-xl:    1.25rem;    // 20px
$nd-font-2xl:   1.5rem;     // 24px
$nd-font-3xl:   1.875rem;   // 30px
$nd-font-4xl:   2.25rem;    // 36px

$nd-font-family-sans:  'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$nd-font-family-mono:  'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### 3.5 Layout Philosophy

**Full-width by default.** The body uses 100% of the viewport with comfortable padding. No centered narrow column. Application UIs (dashboards, tables, control panels) benefit from every pixel.

- `min-width: 1280px` on the body — desktop content never gets cramped
- Below 1280px the min-width drops and responsive stacking begins
- `.nd-container` is opt-in for the rare case of centered prose content (blog posts, docs)

### 3.6 Breakpoints (Desktop-First)

```scss
// _tokens.scss
$nd-bp-xl:  1600px;   // ultrawide / 4K
$nd-bp-lg:  1280px;   // standard desktop — mobile transition point
$nd-bp-md:   992px;   // small desktop / landscape tablet
$nd-bp-sm:   768px;   // tablet portrait
$nd-bp-xs:   480px;   // phone

// Usage: @include nd-below(md) { ... }
@mixin nd-below($bp) {
  @media (max-width: map-get($breakpoints, $bp) - 1px) {
    @content;
  }
}
```

### 3.7 Native-First Styling

ndesign styles native HTML elements directly — no base classes needed for common elements:

| Element | Styled natively | Class only needed for |
|---------|----------------|----------------------|
| `<button>` | Base button appearance | Modifiers: `.nd-btn-primary`, `.nd-btn-sm`, `.nd-switch` |
| `<input>`, `<textarea>`, `<select>` | Full form input styling | Error/size modifiers |
| `<input type="checkbox/radio">` | Custom appearance, large hit targets | (none) |
| `<table>` | Full table styling with headers | `.nd-table-striped`, `.nd-table-hover` etc. |
| `<nav>` | Top bar layout (sticky, flex, shadow) | `.sidebar` for vertical side navigation |
| `<dialog>` | Modal styling with backdrop | `.nd-modal-sm`, `.nd-modal-lg`, `.nd-modal-full` |
| `<label>` in `.nd-form-group` | Tab label appearance | (none) |
| `<label>` in `.nd-form-check` | Check label appearance | (none) |
| `<aside>` | **Not styled natively** | Requires `.fold` class (see Fold component) |

### 3.8 Component Class Reference

| Component | Base Class | Modifiers |
|-----------|-----------|-----------|
| Card | `.nd-card` | `.nd-card-header`, `.nd-card-body`, `.nd-card-footer`, `.nd-card-flush` |
| Panel | `.nd-panel` | `.nd-panel-bordered`, `.nd-panel-compact` |
| Well | `.nd-well` | `.nd-well-sm`, `.nd-well-lg` |
| Fold | `.fold` | `.fold-left`, `.fold-title`, `.fold-info`, `.fold-warning`, `.fold-danger`, `.fold-success` |
| Button | `<button>` (native) | `.nd-btn-primary`, `.nd-btn-secondary`, `.nd-btn-danger`, `.nd-btn-ghost`, `.nd-btn-sm`, `.nd-btn-lg` |
| Form Group | `.nd-form-group` | `.nd-form-group-attached`, `.nd-form-help`, `.nd-form-error` |
| Alert | `.nd-alert` | `.nd-alert-success`, `.nd-alert-warning`, `.nd-alert-error`, `.nd-alert-info` |
| Table | `<table>` (native) | `.nd-table-striped`, `.nd-table-hover`, `.nd-table-responsive` |
| Badge | `.nd-badge` | `.nd-badge-primary`, `.nd-badge-danger`, `.nd-badge-success` |
| Switch | `<button class="nd-switch">` | `.nd-switch-sm`, `aria-pressed="true\|false"`, `disabled` |
| Avatar | `.avatar` | `.avatar-sm`, `.avatar-lg`, `.avatar-xl` |
| Nav (top) | `<nav>` (native) | `.nd-nav-brand`, `.nd-nav-menu`, `.nd-nav-end`, `.nd-nav-toggle`, `.nd-nav-section` |
| Sidebar | `.sidebar` | `.sidebar-fixed`, `.sidebar-section`, `.sidebar-menu`, `.nd-nav-open` |
| Dropdown | `.nd-dropdown` | `.nd-dropdown-menu`, `.nd-dropdown-right`, `.nd-dropdown-up`, `.nd-dropdown-divider`, `.nd-open` |
| Modal | `<dialog>` (native) | `.nd-modal-close`, `.nd-modal-body`, `.nd-modal-sm`, `.nd-modal-lg`, `.nd-modal-full` |
| Toast | `.nd-toast` | `.nd-toast-container`, `.nd-toast-message`, `.nd-toast-close`, `.nd-toast-success`, `.nd-toast-error`, `.nd-toast-warning`, `.nd-toast-info` |
| App Layout | `.app-layout` | `.app-page`, `.app-content`, `.app-main`, `.app-header`, `.app-footer`, `.app-layout-below-nav` |
| Overlay | `.overlay` | `.active` |
| Hamburger | `.hamburger` | (mobile-only toggle button) |
| Container | `.nd-container` | Opt-in for narrow/centered content |
| Grid | `.nd-row` | `.nd-col-{1-12}`, `.nd-col-md-{1-12}` etc. |

---

## 4. JavaScript Binding Runtime

### 4.1 Design Principles

- **Zero dependencies.** Vanilla JS, ES2020+ target.
- **Declarative.** All behavior expressed via `data-nd-*` HTML attributes.
- **Backend authoritative.** No client-side state store. The server is the source of truth.
- **Direct DOM manipulation.** No virtual DOM, no diffing, no reconciliation.
- **Progressive enhancement.** Pages work without JS; bindings add interactivity.
- **Transport agnostic.** Supports REST, WebSocket, and SSE from the same attribute API.

### 4.2 Attribute API

#### Data Binding — `data-nd-bind`

Fetches data from a REST endpoint and renders it into the element.

```html
<!-- Simple text binding -->
<span data-nd-bind="/api/user/name"></span>

<!-- Bind with template -->
<div data-nd-bind="/api/users" data-nd-template="user-row">
  <template id="user-row">
    <div class="nd-card">
      <div class="nd-card-body">
        <h3>{{name}}</h3>
        <p>{{email}}</p>
      </div>
    </div>
  </template>
</div>

<!-- Bind to specific JSON field -->
<span data-nd-bind="/api/stats" data-nd-field="active_users"></span>
```

#### WebSocket — `data-nd-ws`

Subscribes to a WebSocket channel for real-time push updates.

```html
<!-- Live feed -->
<div data-nd-ws="ws://host/feed/trades" data-nd-template="trade-row">
  <template id="trade-row">
    <tr>
      <td>{{symbol}}</td>
      <td>{{price}}</td>
      <td>{{volume}}</td>
    </tr>
  </template>
</div>

<!-- Single value update -->
<span data-nd-ws="ws://host/feed/price" data-nd-field="last"></span>

<!-- Filtered — only render messages where type == "alert" -->
<div data-nd-ws="ws://host/feed/events"
     data-nd-ws-filter="type:alert"
     data-nd-template="alert-row">
  <template id="alert-row">
    <div class="nd-alert nd-alert-warning">{{message}}</div>
  </template>
</div>
```

#### Server-Sent Events — `data-nd-sse`

Subscribes to an SSE endpoint for server push (unidirectional).

```html
<div data-nd-sse="/api/events/deployments" data-nd-template="deploy-row">
  <template id="deploy-row">
    <div class="nd-alert nd-alert-info">
      Deploy {{version}} to {{environment}}: {{status}}
    </div>
  </template>
</div>
```

#### Actions — `data-nd-action`

Binds an element (typically a button or form) to an API action.

```html
<!-- Button action -->
<button class="nd-btn nd-btn-danger"
        data-nd-action="DELETE /api/users/42"
        data-nd-confirm="Are you sure?">
  Delete User
</button>

<!-- Form submission -->
<form data-nd-action="POST /api/users" data-nd-feedback="user-feedback">
  <div class="nd-form-group">
    <label class="nd-form-label">Name</label>
    <input class="nd-form-input" name="name" required>
  </div>
  <div class="nd-form-group">
    <label class="nd-form-label">Email</label>
    <input class="nd-form-input" name="email" type="email" required>
  </div>
  <div id="user-feedback"></div>
  <button class="nd-btn nd-btn-primary" type="submit">Create</button>
</form>
```

#### Refresh — `data-nd-refresh`

Polling interval for periodic data refresh (for backends that don't support push).

```html
<!-- Poll every 5 seconds -->
<div data-nd-bind="/api/status" data-nd-refresh="5000">
  <span data-nd-field="cpu_usage"></span>%
</div>
```

#### Events — `data-nd-on`

Bind custom JS behavior to DOM events (escape hatch for edge cases).

```html
<button data-nd-on="click:handleExport">Export CSV</button>
```

#### Theme Switching — `data-nd-theme` / `data-nd-theme-toggle`

Declarative theme controls without writing JS.

```html
<!-- Set a specific theme by name -->
<button data-nd-theme="dark">Dark Mode</button>
<button data-nd-theme="light">Light Mode</button>

<!-- Cycle through all registered themes -->
<button data-nd-theme-toggle>Toggle Theme</button>
```

#### Sidebar Toggle — `data-nd-toggle="sidebar"`

Opens/closes the `.sidebar` element and its associated `.overlay` on mobile.

```html
<button class="hamburger" data-nd-toggle="sidebar" aria-expanded="false">
  &#9776;
</button>
```

### 4.3 Template System

Templates use `<template>` elements with `{{field}}` placeholders.

**Rules:**
- Templates are standard HTML `<template>` elements — invisible until cloned.
- `{{field_name}}` maps to JSON keys from the bound data source.
- Nested access via dot notation: `{{user.address.city}}`.
- Arrays: the template is cloned once per item.
- Single objects: the template is cloned once.
- Scalar values: use `data-nd-field` instead of a template.

**Conditional rendering:**

```html
<template id="user-row">
  <div class="nd-card">
    <div class="nd-card-body">
      <h3>{{name}}</h3>
      <span data-nd-if="admin" class="nd-badge nd-badge-danger">Admin</span>
    </div>
  </div>
</template>
```

**State templates:**

```html
<div data-nd-bind="/api/users" data-nd-template="user-row">
  <!-- Loading placeholder — shown while the fetch is in flight -->
  <template data-nd-loading>
    <div class="nd-well">Loading users...</div>
  </template>

  <!-- Empty state — shown when the response is an empty array -->
  <template data-nd-empty>
    <div class="nd-well">No users found.</div>
  </template>

  <!-- Data template — rendered per item -->
  <template id="user-row">
    <div class="nd-card"><div class="nd-card-body">{{name}}</div></div>
  </template>
</div>
```

**Render modes:**

| Attribute | Behavior |
|-----------|----------|
| `data-nd-mode="replace"` | Clear container, render fresh (default for `data-nd-bind`) |
| `data-nd-mode="append"` | Append new items (default for `data-nd-ws` and `data-nd-sse`) |
| `data-nd-mode="prepend"` | Prepend new items |
| `data-nd-max="100"` | Max items in container (oldest removed when exceeded) |

### 4.4 Form Handling

All forms with `data-nd-action` are intercepted and serialized to JSON.

**Serialization rules:**
- All `name`d inputs are collected into a flat JSON object.
- Nested fields via dot notation: `name="address.city"` → `{"address":{"city":"..."}}`
- Checkboxes → `true`/`false`
- Multi-selects → arrays
- File inputs → excluded (use separate upload endpoint)

**Client-side validation:**
- Standard HTML5 validation attributes (`required`, `type="email"`, `pattern`, `min`, `max`)
- `data-nd-validate="rule"` for custom rules (future extension point)
- Validation errors shown in `.nd-form-error` elements adjacent to the input

**Server-side error response:**

The backend returns errors in a standard format:

```json
{
  "errors": {
    "email": "Email already exists",
    "name": "Name must be at least 2 characters"
  }
}
```

ndesign maps each key to the matching `name` input and displays the error in the nearest `.nd-form-error` element. A non-field-specific error key `"_form"` displays in the `data-nd-feedback` target.

**Success handling:**

```html
<form data-nd-action="POST /api/users"
      data-nd-success="redirect:/users"
      data-nd-feedback="feedback-area">
```

| `data-nd-success` value | Behavior |
|------------------------|----------|
| `redirect:/path` | Navigate to path |
| `reset` | Clear the form |
| `reload` | Reload the page |
| `refresh:#selector` | Re-fetch `data-nd-bind` on the matched element(s) |
| `close` | Close parent modal/panel (future) |
| `emit:event-name` | Dispatch custom DOM event |

### 4.5 Connection Management

**WebSocket:**
- Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Shared connections — multiple elements binding to the same WS host share one socket
- Message routing by channel/path
- Connection status exposed via CSS class on bound elements: `.nd-ws-connected`, `.nd-ws-disconnected`

**SSE:**
- Native `EventSource` with auto-reconnect (browser-handled)
- `data-nd-sse-event="eventname"` to filter by SSE event type

**REST:**
- Fetch API with configurable headers via `NDesign.configure({ headers: {...} })`
- Automatic CSRF token inclusion if `<meta name="csrf-token">` exists
- Request deduplication — multiple elements bound to the same endpoint share one request

### 4.6 Lifecycle Hooks (Global)

```js
NDesign.configure({
  baseURL: '',                          // prefix for all relative URLs
  headers: { 'X-Requested-With': 'NDesign' },
  onRequest: (url, options) => {},      // before every fetch
  onResponse: (url, response) => {},    // after every fetch
  onError: (url, error) => {},          // fetch/ws/sse errors
  onRender: (element, data) => {},      // after template render
  wsProtocols: [],                      // WebSocket sub-protocols
});
```

---

## 5. Project Structure

```
ndesign/
├── docs/
│   ├── Architecture.md          # this file
│   ├── CodingGuidelines.md      # coding standards
│   └── bindings.md              # binding attribute reference
├── scss/
│   ├── core.scss                # master import — compiles to ndesign.css
│   ├── _reset.scss              # normalize + box-sizing
│   ├── _tokens.scss             # spacing, fonts, radii, breakpoints, z-index
│   ├── _typography.scss         # headings, body, monospace, links
│   ├── _layout.scss             # grid, flex helpers, containers
│   ├── _cards.scss              # .nd-card
│   ├── _panels.scss             # .nd-panel
│   ├── _wells.scss              # .nd-well
│   ├── _buttons.scss            # buttons, .nd-btn-*, .nd-switch
│   ├── _forms.scss              # inputs, selects, textareas, checkboxes
│   ├── _tables.scss             # tables, striped, hover, responsive
│   ├── _alerts.scss             # .nd-alert
│   ├── _badges.scss             # .nd-badge
│   ├── _asides.scss             # .fold (edge-pinned callouts)
│   ├── _nav.scss                # <nav>, .sidebar, .nd-nav-*
│   ├── _dropdowns.scss          # .nd-dropdown
│   ├── _modals.scss             # <dialog> modal styling
│   ├── _toasts.scss             # .nd-toast, .nd-toast-container
│   ├── _app-layout.scss         # .app-layout, .app-page, .overlay, .hamburger
│   ├── _avatars.scss            # .avatar
│   ├── _utilities.scss          # spacing, display, text helpers
│   ├── _responsive.scss         # breakpoint overrides
│   ├── _transitions.scss        # keyframes, animation tokens
│   └── themes/
│       ├── light.scss
│       └── dark.scss
├── js/
│   ├── ndesign.js               # entry point, theme API, auto-init
│   ├── bind.js                  # data-nd-bind handler
│   ├── ws.js                    # data-nd-ws handler
│   ├── sse.js                   # data-nd-sse handler
│   ├── action.js                # data-nd-action handler (forms + buttons)
│   ├── template.js              # template cloning + interpolation
│   ├── nav.js                   # top nav collapse toggle
│   ├── dropdown.js              # dropdown open/close
│   ├── modal.js                 # dialog open/close, openModal(), closeModal()
│   ├── toast.js                 # toast(), auto-dismiss
│   ├── select.js                # custom select styling
│   └── utils.js                 # shared helpers
├── testserver/                  # Go test server for local development
│   ├── go.mod
│   ├── go.sum
│   └── main.go
├── dist/                        # compiled output
│   ├── ndesign.min.js
│   ├── ndesign.min.css
│   └── themes/
│       ├── light.min.css
│       └── dark.min.css
├── demo/                        # local demo/test pages
│   ├── index.html
│   ├── app-shell.html
│   ├── bindings.html
│   ├── complex-app.html
│   └── control-panel.html
├── package.json                 # build tooling only (sass, esbuild)
└── README.md
```

---

## 6. Build Pipeline

### 6.1 SCSS Compilation

```bash
# Development (with source maps)
sass scss/core.scss dist/ndesign.css --source-map
sass scss/themes/light.scss dist/themes/light.css --source-map
sass scss/themes/dark.scss dist/themes/dark.css --source-map

# Production
sass scss/core.scss dist/ndesign.min.css --style=compressed --no-source-map
sass scss/themes/light.scss dist/themes/light.min.css --style=compressed --no-source-map
sass scss/themes/dark.scss dist/themes/dark.min.css --style=compressed --no-source-map
```

### 6.2 JS Bundling

```bash
# esbuild — fast, zero-config
esbuild js/ndesign.js --bundle --minify --outfile=dist/ndesign.min.js --format=iife --global-name=NDesign
```

### 6.3 Development Server

```bash
# Watch mode
sass --watch scss:dist
# Serve demo
npx serve demo
```

---

## 7. Anti-Patterns (What We Do NOT Build)

| Anti-Pattern | Reason |
|-------------|--------|
| Client-side routing | Backend owns URLs |
| Virtual DOM / diffing | Unnecessary overhead for server-driven UI |
| Component lifecycle hooks | Keep it flat — no mount/unmount/update cycles |
| Client-side state store | Backend is authoritative |
| Required build step for consumers | Just include CDN files |
| npm dependency for consumers | No node_modules in consuming apps |
| JSX / custom template syntax | Standard HTML templates only |

---

## 8. Future Extensions (Out of Scope for v0.1)

- Tabs component
- Skeleton loaders
- Tooltips
- Pagination component
- Progress bars
- Breadcrumbs
- Drag-and-drop
- File upload with progress
- Lazy loading / infinite scroll
- i18n attribute helpers
- Animation library beyond transitions
- CLI scaffolding tool

---

## 9. Browser Support

- Chrome/Edge 88+ (ES2020, CSS custom properties)
- Firefox 78+
- Safari 14+
- No IE11. No polyfills.
