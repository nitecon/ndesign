## Forms

Forms are plain `<form>` markup. ndesign styles native inputs, selects, and textareas, and provides `.nd-form-group` / `.nd-form-label` wrappers for tabbed labels and validation slots. Submit handling, JSON serialization, and server-error mapping live on `data-nd-action` (see [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions)) — the markup stays declarative.

### When to use

- Any user data entry: create, edit, search, filter, login.
- Combine with `data-nd-action` to submit as JSON; the runtime maps validation errors back onto each `.nd-form-group` and writes a global feedback message.

### Minimal example

```html
<form data-nd-action="POST ${api}/api/users"
      data-nd-success="toast:User created">
  <div class="nd-form-group">
    <label for="name">Name <span class="nd-required">*</span></label>
    <input name="name" id="name" required>
    <div class="nd-form-error"></div>
  </div>

  <div class="nd-form-group">
    <label for="email">Email</label>
    <input type="email" name="email" id="email">
    <small class="nd-form-help">We never share your email.</small>
    <div class="nd-form-error"></div>
  </div>

  <button type="submit" class="nd-btn-primary">Create user</button>
</form>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-form-group` | Wraps one label + input + help/error slot. Adds bottom margin and is the relative anchor for error positioning. |
| `.nd-form-group-attached` | Inline label + input joined as one segmented control (label is the left cap). |
| `.nd-form-label` | Tabbed label appearance for elements outside `.nd-form-group`. The default `<label>` inside `.nd-form-group` already gets this style. |
| `.nd-required` | Red `*` indicator inside a label. |
| `.nd-form-help` | Small muted help text below the input. |
| `.nd-form-error` | Validation error slot. Empty by default; the runtime fills it on a failed submit. Hidden via `:empty`. |
| `.nd-form-check-group` | Bordered box wrapping checkbox/radio rows. |
| `.nd-form-check` | One row inside a check group. |
| `.nd-form-check-input` | Native `<input type="checkbox">` / `<input type="radio">` with custom appearance. |
| `.nd-form-input-sm` / `.nd-form-input-lg` | Compact / roomy input sizing. |
| `.nd-form-inline` | Lay out form groups in a horizontal row. |

### Native elements styled by default

`<input>` (text, email, password, number, search, url, tel, date variants), `<textarea>`, `<select>`, and `<input type="file">` all render with consistent borders, focus rings, and placeholder colors. No class is required.

### State classes

| Class on `.nd-form-group` | Effect |
|---|---|
| `.nd-error` | Red border + red focus ring on the contained input. |
| `.nd-success` | Green border + green focus ring on the contained input. |

`.nd-error` is added by the runtime on submit failure (per-field) and on the form itself. `.nd-success` is purely for consumer use.

### Dynamic bindings

Pair every form with `data-nd-action="METHOD URL"`. The runtime intercepts the `submit` event, serializes named inputs into a JSON object (dot-notation names create nested objects), submits via `fetch`, and:

- On success: removes `nd-error` classes, runs the `data-nd-success` chain, optionally writes response data into the store via `data-nd-set`.
- On error: parses the unified error envelope, sets `.nd-error` on each field whose name appears in `errors`, writes the matching `errors[name]` message into that field's `.nd-form-error`, and writes the global error message into the form's feedback element.

If the form does NOT declare `data-nd-feedback`, the runtime auto-creates an `.nd-alert nd-form-feedback-auto` slot adjacent to the submit button on first error, so the global message is always visible. See [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions) for the full envelope shape and lifecycle.

For multipart file uploads, use `data-nd-upload="METHOD URL"` instead of `data-nd-action` and add a `<progress class="nd-upload-progress" hidden>` element. See [Upload](#upload).

### Pitfalls

- Each field input MUST have a `name` attribute. Inputs without `name` are skipped by the serializer and will silently NOT submit.
- The `.nd-form-error` slot MUST be a sibling of the input inside the same `.nd-form-group`. Errors target fields by traversing up to `.nd-form-group` and writing into the nearest `.nd-form-error`.
- File inputs are skipped by `data-nd-action`'s JSON serializer. Use `data-nd-upload` for any form that includes a file input.
- `<input type="checkbox">` serializes as a boolean (`true`/`false`), not as the `value` attribute. Multi-select serializes as an array of values.
- `<input type="number">` serializes as a `Number` (or `null` if empty), NOT as a string.

### See also

- [Buttons](#buttons), [Upload](#upload), [Modals and dialogs](#modals)
- Source: `scss/_forms.scss`, `js/action.js`
