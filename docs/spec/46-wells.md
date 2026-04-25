## Wells

A well is an inset, recessed region — visually the inverse of a card. The inner shadow simulates content carved into the surface. Use wells to set apart secondary information without giving it the visual weight of a card or panel.

### When to use

- Quoted content, code samples, supplementary info inside a card or panel.
- Empty-state placeholders ("No results — try a different filter").
- Disabled or read-only sub-sections.

### When NOT to use

- Primary content that the user acts on — use [Cards](#cards) or [Panels](#panels).
- Status messages — use [Alerts](#alerts).

### Minimal example

```html
<div class="nd-well">
  <h4 class="nd-well-title">Tip</h4>
  <p>Press <kbd>?</kbd> anywhere to see keyboard shortcuts.</p>
</div>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-well` | Inset background, border, inner shadow at the top edge, bottom margin |
| `.nd-well-sm` | Reduced padding |
| `.nd-well-lg` | Increased padding |
| `.nd-well-title` | Base-size, semibold heading (margin reset) |
| `.nd-well-inline` | Removes the bottom margin (use when nested inside another spacing container) |

### Pitfalls

- Wells deliberately have no specular highlight — they absorb light rather than catch it. Do NOT add a glass effect on top.
- Stacking a well inside a card body inside a panel produces three visually conflicting surfaces. Pick one container per region.

### See also

- [Cards](#cards), [Panels](#panels), [Alerts](#alerts)
- Source: `scss/_wells.scss`
