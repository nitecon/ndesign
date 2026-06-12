## Panels

> **Rules**
> - Panels are the PRIMARY container for raw/primary data in the main grid — reach for a panel first.
> - Do NOT use for content that needs a distinct header/footer band — use [Cards](#cards) instead.
> - Do NOT use for recessed/inset backgrounds — use [Wells](#wells) inside a panel.
> - Cards and wells nest INSIDE panels; asides live OUTSIDE. See [Composition](#composition--stacking).
> - `.nd-panel-header` and `.nd-panel-footer` MUST be direct children of `.nd-panel` — wrapping them breaks edge-to-edge bleed.

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

- [Composition & stacking](#composition--stacking) — canonical nesting rules for Panel/Card/Well.
- [Cards](#cards), [Wells](#wells), [Asides](#asides)
- Source: `scss/_panels.scss`
