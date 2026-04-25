## Skeletons

Animated shimmer placeholders that occupy the same shape as the content they will be replaced with. The idiomatic use is inside a `<template data-nd-loading>` — the runtime renders the template into the bound element while the fetch is in flight, then replaces it with the real content.

### When to use

- The loading state for any `data-nd-bind` element where a spinner would be vague but a layout-preserving placeholder reassures the user.
- Cards, list rows, avatar + text blocks, image tiles.

### When NOT to use

- Sub-100ms operations — render the real content directly.
- Non-data-driven UI (the user clicked a button, expect a near-instant reaction) — use the button's `.nd-loading` spinner state instead.

### Minimal example

```html
<div data-nd-bind="${api}/api/profile">
  <template data-nd-loading>
    <div style="display: flex; gap: 1rem; align-items: center;">
      <span class="nd-skeleton nd-skeleton-avatar"></span>
      <div class="nd-skeleton-group" style="flex: 1;">
        <span class="nd-skeleton nd-skeleton-title"></span>
        <span class="nd-skeleton nd-skeleton-text"></span>
        <span class="nd-skeleton nd-skeleton-text"></span>
      </div>
    </div>
  </template>
  <template>
    <h2>{{name}}</h2>
    <p>{{bio}}</p>
  </template>
</div>
```

### Shape classes

| Class | Effect |
|---|---|
| `.nd-skeleton` | Base shimmer (animated linear gradient, sm border-radius). Required on every shape. |
| `.nd-skeleton-text` | 0.875rem tall line; the last sibling shrinks to 80% width |
| `.nd-skeleton-title` | 1.5rem tall, 60% width |
| `.nd-skeleton-circle` | Circular border-radius (combine with explicit width/height) |
| `.nd-skeleton-avatar` | 2rem circle |
| `.nd-skeleton-avatar-lg` | 4rem circle |
| `.nd-skeleton-button` | 2.25rem × 6rem button shape |
| `.nd-skeleton-image` | 16:9 aspect-ratio block (uses `padding-bottom: 56.25%`) |
| `.nd-skeleton-card` | 8rem tall card shape |
| `.nd-skeleton-group` | Flex column with sm gap (use to stack multiple text/title shapes) |

### Pitfalls

- `.nd-skeleton` MUST be on every shape — it carries the shimmer animation. The shape classes alone provide only dimensions.
- Skeleton elements MUST be `display: block` (or `inline-flex` inside a flex container) for width to apply. A bare `<span class="nd-skeleton">` inside flowing text will collapse.
- The shimmer uses `prefers-reduced-motion` to fall back to a static fill. Do NOT add a manual animation on top.
- `<template data-nd-loading>` is rendered by the bind runtime — it is NOT inserted into the DOM as static markup. Putting visible skeletons outside a `data-nd-loading` template and toggling them by hand is also valid, but you forfeit the runtime's automatic show/hide.

### See also

- [Tables](#tables), [Cards](#cards), [Data binding → data-nd-bind](#data-nd-bind--fetch-and-render)
- Source: `scss/_skeletons.scss`
