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
