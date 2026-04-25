## Asides

Bare `<aside>` is styled by default as a simple bordered callout with a left accent strip — drop it into the document for tangentially related content. The `.fold` variant overrides this with an edge-pinned geometric callout that bleeds to the viewport edge for sidebar-style notes.

### When to use

- Plain `<aside>` for an inline callout: a tip, a note, a sidebar quote.
- `.fold` for an edge-pinned marginalia treatment in long-form content.

### When NOT to use

- Status messages (success/error/warning/info) — use [Alerts](#alerts).
- General bordered grouping — use [Panels](#panels).

### Minimal example — bare aside

```html
<aside>
  <strong>Note.</strong> The runtime initializes on <code>DOMContentLoaded</code>;
  call <code>NDesign.init()</code> after dynamic markup changes.
</aside>
```

### Minimal example — fold

```html
<aside class="fold fold-info">
  <h4 class="fold-title">Heads up</h4>
  Page binds initialize once at load. Refresh a region with
  <code>data-nd-bind-trigger</code>.
</aside>
```

### Markup and classes

| Class | Effect |
|---|---|
| (bare `<aside>`) | Surface background, border, 4px left accent strip, rounded corners |
| `.fold` | Edge-pinned variant: pins to the right edge with a negative right margin, rounds inner corners, drops outer corners square. Carries a heavier shadow. |
| `.fold-left` | Pins to the left edge instead of the right (mirrors borders and corner radii) |
| `.fold-title` | Base-size, semibold heading inside a fold (margin reset) |
| `.fold-info` | Blue accent strip (left or right depending on `.fold-left`) |
| `.fold-success` | Green accent strip |
| `.fold-warning` | Amber accent strip |
| `.fold-danger` | Red accent strip |

The default `.fold` (no semantic variant) renders without an accent — pair it with one of `.fold-info` / `.fold-success` / `.fold-warning` / `.fold-danger` to convey meaning.

### Pitfalls

- `.fold` uses negative margin to bleed to the viewport edge. It MUST be a direct child of a container whose padding is the viewport gutter (e.g. `<main>` with `--nd-container-padding`). Inside a centered card it will visibly clip.
- A bare `<aside>` and a `.fold` are visually distinct — adding `.fold` to an `<aside>` overrides the base style entirely. Do NOT expect the left-accent strip to compose with the fold geometry.
- `.fold-left` flips both the margin and the accent strip side. Setting `.fold-info.fold-left` correctly puts the accent on the right (the visible inner edge).

### See also

- [Alerts](#alerts), [Panels](#panels), [Wells](#wells)
- Source: `scss/_asides.scss`
