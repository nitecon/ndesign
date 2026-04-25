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
