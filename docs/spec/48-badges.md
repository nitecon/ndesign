## Badges

Inline pill labels for status, counts, and metadata. Badges are display-only — no behavior, no JS contract.

### When to use

- Status indicators next to a name or title (`Active`, `Beta`, `Deprecated`).
- Counts on a button or nav item (`Inbox 3`).
- Tags and categories.

### Minimal example

```html
<span class="nd-badge nd-badge-success">Active</span>
<span class="nd-badge nd-badge-warning">Beta</span>
<span class="nd-badge nd-badge-danger">Deprecated</span>
<button class="nd-btn-secondary">
  Inbox <span class="nd-badge nd-badge-primary">3</span>
</button>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-badge` | Base pill: inline-flex, sm padding, xs font-size, pill border-radius |
| `.nd-badge-primary` | Accent fill |
| `.nd-badge-secondary` | Well-tinted fill, secondary text color |
| `.nd-badge-success` | Green fill |
| `.nd-badge-warning` | Amber fill |
| `.nd-badge-danger` | Red fill |
| `.nd-badge-info` | Blue fill |
| `.nd-badge-sm` | Smaller padding, 0.625rem font-size |
| `.nd-badge-lg` | Larger padding, sm font-size |
| `.nd-badge-dot` | Empty circular dot (notification indicator, no text) |

### Pitfalls

- A bare `.nd-badge` (no semantic variant) uses the muted well background — barely visible on a card surface. Always pair `.nd-badge` with a semantic variant unless that subtle treatment is intentional.
- `.nd-badge-dot` ignores its content (`width: 0.5rem; padding: 0`). Keep it empty.
- Badges inside a button inherit `vertical-align: middle`. If they appear misaligned, check that the parent has not overridden `line-height`.

### See also

- [Buttons](#buttons), [Alerts](#alerts)
- Source: `scss/_badges.scss`
