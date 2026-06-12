## Toasts

> **Rules**
> - Use for transient acknowledgements that auto-dismiss: "Saved", "Copied", recoverable background errors.
> - Do NOT use for confirmations or destructive choices — use a confirm [Modal](#modals).
> - Do NOT use for form-field validation — those belong inline next to the field.
> - Toast text is plain text only — HTML markup is escaped and rendered as literal entities.
> - `duration: 0` keeps the toast persistent until the user dismisses it manually.

Toasts are transient, non-blocking notifications that slide in from the
top-right of the viewport. The runtime auto-creates a single
`.nd-toast-container` in `<body>` on first use; individual toasts append to
it and dismiss themselves after a configurable duration.

### When to use

- Acknowledging a successful action ("Saved", "Copied to clipboard").
- Surfacing a recoverable error from a background operation.
- Showing a transient warning that does not require interaction.

### When NOT to use

- For confirmations or destructive choices — use a confirm
  [Modal](#modals) so the user must acknowledge.
- For form-field validation messages — those belong inline next to the
  field; see [Data binding](#data-binding) for `displayErrors` mechanics.
- For information the user must read in full — toasts auto-dismiss.

### Minimal example

```html
<button class="nd-btn-primary"
        data-nd-toast="Saved"
        data-nd-toast-type="success">Save</button>
```

```javascript
NDesign.toast('Saved!', 'success');
NDesign.toast('Network error', 'error', 8000);
NDesign.toast('Heads up', 'info', 0);  // 0 = persistent until manually closed
```

### Markup and classes

Toasts are created by the runtime — applications SHOULD NOT author toast
markup directly. The classes below document what gets rendered for
theming reference only.

| Class                  | Effect                                                       |
|------------------------|--------------------------------------------------------------|
| `.nd-toast-container`  | Fixed top-right overlay area. Auto-created in `<body>`.       |
| `.nd-toast`            | Single toast row. Slides in, auto-dismisses.                 |
| `.nd-toast-success`    | Green left border accent.                                    |
| `.nd-toast-error`      | Red left border accent.                                      |
| `.nd-toast-warning`    | Amber left border accent.                                    |
| `.nd-toast-info`       | Blue left border accent.                                     |
| `.nd-toast-message`    | The message `<span>` inside a toast.                         |
| `.nd-toast-close`      | The `&times;` close button.                                  |
| `.nd-toast-exit`       | Applied during the 200 ms exit animation.                    |

### Dynamic bindings

The single delegated click handler fires `NDesign.toast()` for any
element carrying `data-nd-toast`. Toasts may also be triggered as part of
a [Data binding](#data-binding) action's `data-nd-success` chain via
`toast:<message>`.

| Attribute                  | Location              | Behavior                                                          |
|----------------------------|-----------------------|-------------------------------------------------------------------|
| `data-nd-toast`            | any clickable element | Click fires `toast(MESSAGE, type, duration)`. Calls `e.preventDefault()`. |
| `data-nd-toast-type`       | sibling on the trigger | One of `success` / `error` / `warning` / `info`. Optional — neutral when omitted. |
| `data-nd-toast-duration`   | sibling on the trigger | Milliseconds as integer. Defaults to `5000`. `0` = persistent.    |

### JS API

```javascript
NDesign.toast(message, type, duration);  // → HTMLElement (the toast)
```

| Parameter   | Type    | Default | Notes                                                       |
|-------------|---------|---------|-------------------------------------------------------------|
| `message`   | string  | —       | Required. HTML-escaped via `textContent`.                   |
| `type`      | string  | `''`    | One of `success` / `error` / `warning` / `info` / omitted.  |
| `duration`  | number  | `5000`  | Milliseconds. `0` keeps the toast until the user dismisses. |

Returns the created toast element so callers can attach observers or
mutate it after creation.

### Accessibility

- Error toasts (`type === 'error'`) are rendered with `role="alert"` and
  `aria-live="assertive"`, interrupting screen readers immediately.
- All other toasts use `role="status"` with `aria-live="polite"` so they
  announce when the current speech finishes.
- Every toast also carries `aria-atomic="true"` so the full message is
  re-announced on update.
- The close button is a real `<button>` and is keyboard-focusable; tab
  order is determined by document order in the container.

### Pitfalls

- Toast text is set via `textContent` after `escapeHTML()` — HTML in the
  message is escaped twice and rendered as literal entities. Pass plain
  text only; do not embed `<strong>`, `<a>`, etc.
- The container is fixed and sits at `z-index: $nd-z-toast`. If a custom
  overlay sits above it, the toast will be hidden — fix the overlay's
  z-index, do not move the toast.
- Calling `NDesign.toast(...)` before `DOMContentLoaded` works only if
  the script is loaded with `defer` or at the end of `<body>`; the
  container is appended to `document.body` lazily.
- `destroyToasts()` removes the container and every active toast — any
  pending dismiss timer becomes a no-op.

### See also

- [Modals](#modals) — for blocking acknowledgement.
- [Data binding](#data-binding) — `toast:MESSAGE` in `data-nd-success`.
- Source: `js/toast.js`, `scss/_toasts.scss`
