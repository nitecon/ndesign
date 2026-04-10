# ndesign

A lightweight, declarative UI framework for server-rendered HTML applications. No build step, no npm, no React. Add `data-nd-*` attributes to your HTML and ndesign handles REST binding, WebSocket/SSE streaming, form actions, drag-and-drop, file upload, and more — all from a single minified JS + CSS bundle.

---

## Native-first styling

ndesign follows a **native-first** philosophy: write semantic HTML and it looks great immediately — no classes required to opt in. This extends to the full HTML5 semantic vocabulary.

**Sectioning**

| Element | Styled by default |
|---------|-------------------|
| `<nav>` | Top navigation bar layout (sticky, flex, shadow) |
| `<header>` | App header layout |
| `<main>` | Content area layout |
| `<footer>` | App footer layout |
| `<article>` | Self-contained content — use for cards, posts, stat blocks |
| `<section>` | Thematic grouping with margin/padding defaults |

**Content**

| Element | Styled by default |
|---------|-------------------|
| `<figure>` | Browser default margin reset |
| `<figcaption>` | Small muted text below media |
| `<details>` / `<summary>` | Bordered disclosure widget; marker rotates on open |
| `<mark>` | Highlighted text using the warning tint |
| `<meter>` | Cross-browser gauge with optimum/suboptimum/pessimum state colors |
| `<progress>` | Themed progress bar |
| `<address>` | Contact info block (resets browser italic, adds margin) |
| `<time>` | Semantic timestamp (no visual style — meaning preserved for assistive tech) |

**Text-level**

| Element | Styled by default |
|---------|-------------------|
| `<code>` | Inline mono font with background |
| `<kbd>` | Keyboard key appearance |
| `<samp>` | Mono font with code-style padding and background |
| `<pre>` | Scrollable code block |
| `<abbr>` | Dotted underline with help cursor |
| `<cite>` | Italic with muted color |

**Forms & interactive**

| Element | Styled by default |
|---------|-------------------|
| `<table>` | Full table styling with headers, borders, and spacing |
| `<button>` | Base button appearance |
| `<input>`, `<textarea>`, `<select>` | Consistent form control appearance |
| `<dialog>` | Modal with backdrop and size variants |

Add a class only when you need to modify behaviour or appearance beyond the default:

- **Modifiers**: `.nd-table-striped`, `.nd-table-hover`, `.nd-table-responsive`
- **Variants**: `.nd-btn-primary`, `.nd-btn-secondary`, `.nd-btn-danger`, `.nd-btn-ghost`
- **Sizes**: `.nd-btn-sm`, `.nd-btn-lg`
- **Nav helpers**: `.nd-nav-brand`, `.nd-nav-menu`, `.nd-nav-end`, `.nd-nav-toggle`

This keeps markup clean and idiomatic. `<article>` means a self-contained piece of content; `<details>` means a disclosure widget — use the element that matches your content's meaning and ndesign handles the rest.

---

## v0.4 — Release Highlights

### nd-flex-1 / nd-grow / nd-shrink utilities

New flexbox shorthand classes for building flex layouts without custom CSS:

| Class | CSS |
|-------|-----|
| `nd-flex-1` | `flex: 1 1 0%` |
| `nd-grow` | `flex-grow: 1` |
| `nd-shrink` | `flex-shrink: 1` |
| `nd-grow-0` | `flex-grow: 0` |
| `nd-shrink-0` | `flex-shrink: 0` |

### Sortable — full keyboard accessibility (WAI-ARIA listbox)

The `data-nd-sortable` module now implements the WAI-ARIA listbox reordering pattern. Keyboard users can Tab into the list, Space to grab an item, Arrow keys to move it, and Space again to drop (or Escape to cancel and restore). Position changes are announced via an `aria-live` polite region so screen readers report each move in real time.

### Sortable — MutationObserver auto-init

A `MutationObserver` is attached to each sortable container at init time. Children added dynamically — for example by a template refresh after a server sync — are automatically wired as draggable and keyboard-accessible without any additional `initSortable()` call.

### Sortable — revert on failure with server error surfacing

When a server-sync POST returns a non-2xx response, the DOM is automatically restored to its pre-drag order, a shake animation plays on the container, and `NDesign.toast()` is called with the error message from the JSON response body (`errors._form` or `message`). A `nd:sortable:revert` CustomEvent is dispatched on the container for programmatic handling.

### Upload — CSRF token + clean teardown

The upload module now sends the CSRF token on every XHR request via the shared `buildHeaders()` utility (consistent with actions and sortable). `destroyUploads()` also aborts any in-flight XHR to prevent ghost uploads after component teardown.

### Test coverage

84 tests passing across the full stack: 57 JS unit tests, 20 Go integration tests, 7 browser end-to-end tests. Bundle size: 42.0 KB (minified JS).

---
