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
