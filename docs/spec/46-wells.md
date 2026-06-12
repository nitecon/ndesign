## Wells

> **Rules**
> - Use wells for secondary, read-only insets: quotes, code samples, key facts, empty-state placeholders — always INSIDE a panel or card body.
> - Do NOT use for primary content the user acts on — use [Cards](#cards) or [Panels](#panels) instead.
> - Do NOT use for status messages — use [Alerts](#alerts).
> - `Panel › Card › Well` is the canonical three-level stack and is correct UX. See [Composition](#composition--stacking).
> - Never nest a well inside another well — double inset shadows conflict visually; merge the content.

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
- `Panel › Card › Well` is the canonical three-level nesting stack and is **encouraged** — each layer adds distinct meaning. A fourth nested surface (e.g. a well inside a card inside a panel inside another panel) is too far; flatten. See [Composition & stacking](#composition--stacking) for the canonical rule and examples.
- Do NOT nest a well inside another well — the double inset shadow creates a visually broken surface. Merge the content instead.

### See also

- [Composition & stacking](#composition--stacking) — canonical nesting rules.
- [Cards](#cards), [Panels](#panels), [Alerts](#alerts)
- Source: `scss/_wells.scss`
