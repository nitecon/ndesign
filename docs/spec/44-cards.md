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
