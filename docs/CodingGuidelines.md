# ndesign — Coding Guidelines

## SCSS

### Naming

- All classes prefixed with `nd-` to avoid collisions with consumer styles.
- BEM-lite: `.nd-card`, `.nd-card-header`, `.nd-card-body` (flat hierarchy, no `__` or `--`).
- Modifier classes use descriptive suffixes: `.nd-btn-primary`, `.nd-btn-sm`, `.nd-card-flush`.
- Native HTML elements (`<button>`, `<table>`, `<nav>`, `<input>`, `<textarea>`, `<select>`, `<dialog>`, `<progress>`) are styled by default. Do not introduce a bare alias class (e.g. `nd-btn`, `nd-table`) that simply mirrors the element selector — style the element directly instead.
- **Prefer HTML5 semantic elements over `<div>`.** Use `<article>` for self-contained content (cards, posts, stat blocks), `<section>` for thematic grouping within a page, `<aside>` for tangential content (callouts, supplementary panels), `<figure>`/`<figcaption>` for captioned media, `<details>`/`<summary>` for disclosure widgets, `<time>` for timestamps, `<address>` for contact information. The framework styles all of these elements by default — reaching for a `<div>` with a class when a semantic element fits is almost always wrong.
- State classes: `.nd-active`, `.nd-disabled`, `.nd-loading`, `.nd-error`.

### Structure

- One component per partial file (`_cards.scss`, `_buttons.scss`).
- No color values in core partials — always use `var(--nd-*)` custom properties.
- SCSS variables (`$nd-*`) for structural tokens (spacing, font sizes, radii, breakpoints).
- CSS custom properties (`--nd-*`) for theme-dependent values (colors, shadows).
- No nesting deeper than 3 levels.
- No `!important` unless overriding third-party styles (document why).
- No vendor prefixes in source — use autoprefixer in build if needed.

### Responsive

- Desktop-first: base styles are desktop, use `@include nd-below(md)` to override for smaller.
- Breakpoint mixins only — never raw `@media` queries in component files.

## JavaScript

### Style

- ES2020+ modules. No TypeScript (keep it simple and dependency-free).
- `const` by default, `let` when reassignment needed, never `var`.
- No classes — plain functions and closures. Export named functions.
- JSDoc comments on all exported functions.
- No external dependencies. Zero. None.

### DOM

- Use `data-nd-*` attributes for all framework behavior — never class names.
- Query with `querySelectorAll('[data-nd-bind]')` pattern.
- Clone `<template>` elements with `template.content.cloneNode(true)`.
- Prefer `textContent` over `innerHTML` for security (XSS prevention).
- Use `innerHTML` only for trusted server-rendered HTML fragments, clearly documented.

### Error Handling

- Network errors: log to console, add `.nd-error` class to bound element.
- Never throw unhandled exceptions — catch at boundary and degrade gracefully.
- Form errors: map server response to input fields, never alert().

### Security

- All template interpolation must escape HTML by default.
- CSRF tokens auto-included from `<meta name="csrf-token">`.
- No `eval()`, no `Function()` constructor, no `innerHTML` with user data.
- WebSocket messages parsed with try/catch — malformed JSON must not crash.

## Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `build:`, `test:`.
- One logical change per commit.
- PR descriptions reference the relevant section of Architecture.md.

## File Organization

- SCSS partials prefixed with `_` (standard Sass convention).
- JS modules in `js/` — one file per concern (bind, ws, sse, action, template).
- No barrel files / re-export files.
- Demo pages in `demo/` — not shipped in dist.

## Demo Pages

- `demo/index.html` — component showcase: typography, buttons, cards, panels, wells, forms, tables, alerts, badges, grid. Used to visually verify every component in isolation.
- `demo/control-panel.html` — realistic control panel layout with sidebar navigation, header, stats cards, data tables, and forms. Used to test real-world composition of components.
- Both pages load CSS/JS via relative paths from `../dist/` so they work when opened directly as `file://` in a browser — no server required.
- Both pages include a theme toggle button that swaps between light and dark themes.
- When adding new components or modifying existing ones, update both demo pages to cover the change.
