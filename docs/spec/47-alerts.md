## Alerts

An alert is a static, in-page status message — success, error, warning, or info. Alerts are also the canonical class used by the auto-feedback slot inserted by `data-nd-action` and `data-nd-upload`, so any `.nd-alert` you place adjacent to a form participates in the same visual language as runtime-emitted messages.

### When to use

- Persistent in-page status: validation summary, banner notice, post-submit confirmation.
- The feedback target for a form (`data-nd-feedback="my-alert-id"`).

### When NOT to use

- Transient notifications — use [Toasts](#toasts).
- Inline field-level errors — use `.nd-form-error` inside an `.nd-form-group` (see [Forms](#forms)).

### Minimal example

```html
<div class="nd-alert nd-alert-success" role="status">
  <strong>Saved.</strong> Your changes are live.
</div>

<div class="nd-alert nd-alert-error" role="alert">
  <div class="nd-alert-content">
    <div class="nd-alert-title">Could not save</div>
    The server rejected the request.
  </div>
</div>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-alert` | Base alert: padding, border, rounded corners, bottom margin, flex layout |
| `.nd-alert-success` | Green tint |
| `.nd-alert-warning` | Amber tint |
| `.nd-alert-error` | Red tint |
| `.nd-alert-info` | Blue tint |
| `.nd-alert-title` | Bold heading inside an alert |
| `.nd-alert-content` | Flex-1 wrapper for the message body (use alongside an icon) |
| `.nd-alert-icon` | 1.25rem icon slot, top-aligned with the first text line |
| `.nd-alert-dismissible` | Reserves right padding for a close button |
| `.nd-alert-close` | Absolute-positioned `×` button (place inside an `.nd-alert-dismissible`) |

Use `role="alert"` for error alerts (assertive announcement) and `role="status"` for non-error alerts (polite announcement). The runtime-created auto-feedback slot does NOT set a role — pages that need announcement on auto-created feedback SHOULD declare `data-nd-feedback` on a static `.nd-alert` with the appropriate role.

### Dynamic bindings

`data-nd-action` and `data-nd-upload` look up `data-nd-feedback="<id>"` and write the server's global message into that element with one of `nd-alert-success`, `nd-alert-error`, `nd-alert-warning`, or `nd-alert-info` applied. If the form omits `data-nd-feedback`, the runtime auto-creates an `.nd-alert nd-form-feedback-auto` element next to the submit button on first error so the message is always visible. See [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions).

```html
<form data-nd-action="POST ${api}/api/users"
      data-nd-feedback="user-feedback">
  <!-- form fields -->
  <div id="user-feedback" class="nd-alert" role="status" hidden></div>
  <button type="submit" class="nd-btn-primary">Create</button>
</form>
```

### Pitfalls

- `.nd-alert-close` requires `.nd-alert-dismissible` on the parent so the close button does NOT overlap the message text.
- The runtime resets `className` to `nd-alert nd-alert-<type>` when writing into a feedback target, then restores `nd-form-feedback-auto` if the slot was auto-created. Custom classes you add to a declared feedback element will be wiped on every write — use inline style or a wrapping element if you need extra styling.
- An empty `.nd-alert` is still rendered (the base class has padding and a border). Toggle visibility with the `hidden` attribute or `display: none` until populated.

### See also

- [Toasts](#toasts), [Forms](#forms), [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions)
- Source: `scss/_alerts.scss`, `js/action.js`
