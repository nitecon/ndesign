## Tooltips

Tooltips are short descriptive popups that anchor to an element on hover
or focus. ndesign uses a single shared `<div class="nd-tooltip">`
appended to `<body>` and re-positioned for each anchor; there is no
per-element tooltip DOM and no external positioning library.

### When to use

- Clarifying an icon-only button or compact control.
- Surfacing supplementary information that is not essential to read.
- Annotating tabular data with extra context per cell.

### When NOT to use

- For interactive content (links, buttons, form fields) — tooltips are
  pointer-events: none and cannot receive focus. Use a [Dropdown](#dropdowns)
  or [Modal](#modals) for content that must be clicked.
- For critical information — tooltips disappear on scroll, resize, and
  Escape; users on touch devices may not see them at all.
- For long-form text — content is plain text only and capped at ~18 rem
  wide.

### Minimal example

```html
<button data-nd-tooltip="Save the document">Save</button>

<a href="/docs"
   data-nd-tooltip="Opens in a new tab"
   data-nd-tooltip-placement="bottom">Docs</a>
```

### Markup and classes

The runtime creates and reuses a single tooltip element. Applications
SHOULD NOT author tooltip markup directly. Classes below document the
runtime-generated DOM for theming reference.

| Class                    | Effect                                                       |
|--------------------------|--------------------------------------------------------------|
| `.nd-tooltip`            | The shared tooltip element appended to `<body>`.             |
| `.nd-tooltip-visible`    | Added via `requestAnimationFrame` to trigger the fade-in.    |
| `.nd-tooltip-top`        | Arrow points down — tooltip above the anchor (default).      |
| `.nd-tooltip-bottom`     | Arrow points up — tooltip below the anchor.                  |
| `.nd-tooltip-left`       | Arrow points right — tooltip left of the anchor.             |
| `.nd-tooltip-right`      | Arrow points left — tooltip right of the anchor.             |

### Dynamic bindings

| Attribute                       | Location              | Behavior                                                                     |
|---------------------------------|-----------------------|------------------------------------------------------------------------------|
| `data-nd-tooltip="TEXT"`        | any element           | Anchor for the shared tooltip. `TEXT` is shown on hover/focus after a 200 ms delay. Empty values are ignored. |
| `data-nd-tooltip-placement`     | same element          | One of `top` (default), `bottom`, `left`, `right`. Unknown values fall back to `top`. |

Listeners are delegated on `document`, so anchors rendered by
[Data binding](#data-binding) after init pick up tooltip behavior with no
additional wiring.

### Accessibility

- The shared element has `id="nd-tooltip-active"` and `role="tooltip"`.
  When a tooltip is shown, the runtime sets `aria-describedby` on the
  anchor to reference that id; on hide, the attribute is removed.
- Pressing **Escape** while a tooltip is visible hides it.
- Scroll and resize hide the tooltip — it would otherwise mis-position.
- Tooltip text is set via `textContent`; HTML markup in the value is
  rendered as literal characters (XSS-safe).

### Pitfalls

- Do NOT put a `data-nd-tooltip` on a `<div>` or `<span>` that is not
  focusable. Keyboard users will never see it. Apply tooltips to
  natively focusable elements (`<button>`, `<a href>`, form fields) or
  add `tabindex="0"` to the anchor.
- The tooltip is `pointer-events: none` — hovering the tooltip itself
  does NOT keep it open, so do not embed links or buttons in tooltip
  text. Use a [Dropdown](#dropdowns) instead.
- Only one tooltip is visible at a time. Showing a second tooltip
  immediately hides the first — there is no stacking.
- Setting `data-nd-tooltip=""` (empty string) is a silent no-op — the
  anchor will not show a tooltip even on hover.

### See also

- [Dropdowns](#dropdowns) — for tooltip content that needs interaction.
- Source: `js/tooltip.js`, `scss/_tooltips.scss`
