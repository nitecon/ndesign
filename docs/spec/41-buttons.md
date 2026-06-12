## Buttons

> **Rules**
> - Use `<button>` for in-page actions; use `<a href>` only for real navigable URLs (right-click → open in new tab).
> - There is no `.nd-btn` base class — `<button>` is the base; add a variant class for color (`nd-btn-primary`, etc.).
> - Inside a `<form>`, a bare `<button>` defaults to `type="submit"` — always set `type="button"` for non-submit actions.
> - Do NOT set `--nd-btn-text` globally; only set it per-button when the spinner color is inadequate on a ghost/transparent variant.
> - `.nd-btn-group` children MUST be direct `<button>` siblings — any wrapper `<div>` breaks the border collapse.

Native `<button>` elements are styled by default. Add a variant class for color, a size class for scale, and one or more `data-nd-*` attributes to wire behavior. There is no `.nd-btn` base class — `<button>` itself is the base.

### When to use

- Anywhere the user triggers an action: form submit, modal open, confirm, toast, theme switch, programmatic fetch.
- Wrap the element in `<a>` only when the target is a real URL the user could right-click → open in new tab. Use `<button>` for in-page actions.

### Minimal example

```html
<button class="nd-btn-primary">Save</button>
<button class="nd-btn-secondary">Cancel</button>
<button class="nd-btn-danger nd-btn-sm">Delete</button>
<button class="nd-btn-ghost">Dismiss</button>
```

### Variant classes

| Class | Effect |
|---|---|
| `.nd-btn-primary` | Accent-colored fill (default action) |
| `.nd-btn-secondary` | Surface fill with border (neutral action) |
| `.nd-btn-danger` | Destructive accent fill |
| `.nd-btn-ghost` | Transparent until hover (toolbar action) |

### Size and shape classes

| Class | Effect |
|---|---|
| `.nd-btn-sm` | Compact padding, `font-size: sm` |
| `.nd-btn-lg` | Roomy padding, `font-size: lg` |
| `.nd-btn-block` | `display: flex; width: 100%` |
| `.nd-btn-icon` | Square padding for an icon-only button |
| `.nd-btn-group` | Flex wrapper that joins adjacent buttons into a single segmented control |

### State classes

| Class | Effect |
|---|---|
| `.nd-loading` | Hides label, renders an inline spinner; disables pointer events. Added by the runtime during `data-nd-action` and `data-nd-bind` requests, but MAY be set manually for custom flows. |
| `.nd-disabled` | Same effect as the native `disabled` attribute. Prefer the attribute when possible. |

`<button disabled>` is fully styled. Buttons inherit `:focus-visible` outlines and `:active` press translation from the base style.

### Switch helper — `.nd-switch`

A `.nd-switch` is a `<button aria-pressed="true|false">` styled as a toggle. The runtime does NOT manage `aria-pressed`; the page's own click handler MUST flip it. Pair with `.nd-switch-sm` for a compact variant.

```html
<button class="nd-switch" aria-pressed="false" onclick="this.setAttribute('aria-pressed', this.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')">
  Notifications
</button>
```

### Dynamic bindings

Buttons participate in every declarative-runtime mechanism. Place these attributes directly on the `<button>`:

| Attribute | Purpose |
|---|---|
| `data-nd-action="METHOD URL"` | Issue a fetch on click. See [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions). |
| `data-nd-body='{...}'` | JSON template body for the action (buttons only). |
| `data-nd-modal="#dialog"` | Open a `<dialog>`. See [Modals and dialogs](#modals). |
| `data-nd-toast="msg"` | Show a toast. See [Toasts](#toasts). |
| `data-nd-theme="name"` / `data-nd-theme-toggle` | Switch theme. See [Theme switching](#theme). |
| `data-nd-confirm` | Confirm prompt before running the action. See [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions). |
| `data-nd-bind-trigger="selector"` | Refetch a bound element on click. See [Data binding → data-nd-bind](#data-nd-bind--fetch-and-render). |

### Pitfalls

- Inside a `<form>`, a bare `<button>` defaults to `type="submit"` and triggers form submission. Always set `type="button"` for buttons that are NOT the submit action.
- The `.nd-loading` spinner color is derived from `--nd-btn-text`. On `.nd-btn-ghost` and other transparent variants the spinner stroke MAY be hard to see — set `--nd-btn-text` explicitly via inline style if needed.
- `.nd-btn-group` requires the children to be direct `<button>` siblings. Wrapping any child in a `<div>` breaks the segmented border collapse.

### See also

- [Forms](#forms), [Modals and dialogs](#modals), [Toasts](#toasts)
- Source: `scss/_buttons.scss`
