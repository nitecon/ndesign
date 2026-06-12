## Forms

> **Rules**
> - Write plain `<form>` markup; ndesign styles and wires it — no wrapper class required.
> - Every form that submits to an API needs `data-nd-action="METHOD URL"`. Without it the form does a full-page submit.
> - Every input MUST have a `name` attribute — unnamed inputs are silently skipped by the serializer.
> - Use `data-nd-success`, `data-nd-error`, and `data-nd-finally` to declaratively chain post-submit actions. See [Action lifecycle hooks](#action-lifecycle-hooks) below.
> - Use `data-nd-upload` (not `data-nd-action`) for any form containing a `<input type="file">`.

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

- On success: removes `nd-error` classes, optionally writes response data into the store via `data-nd-set` (BEFORE the lifecycle chain runs, so verbs like `emit` and `refresh` observe updated data), then runs the `data-nd-success` chain.
- On error: parses the unified error envelope, sets `.nd-error` on each field whose name appears in `errors`, writes the matching `errors[name]` message into that field's `.nd-form-error`, and writes the global error message into the form's feedback element.

If the form does NOT declare `data-nd-feedback`, the runtime auto-creates an `.nd-alert nd-form-feedback-auto` slot adjacent to the submit button on first error, so the global message is always visible. See [Data binding → data-nd-action](#data-nd-action--forms-and-button-actions) for the full envelope shape and lifecycle.

For multipart file uploads, use `data-nd-upload="METHOD URL"` instead of `data-nd-action` and add a `<progress class="nd-upload-progress" hidden>` element. See [Upload](#upload).

### Action lifecycle hooks

Three attributes on a `<form data-nd-action>` (or any `[data-nd-action]` element) declare comma-separated chains of verbs that run at different lifecycle phases:

| Attribute | When it runs | Typical use |
|---|---|---|
| `data-nd-success` | After a **2xx** response | `close-modal`, `toast:Saved!`, `refresh:#list` |
| `data-nd-error` | After a **non-2xx** or network failure | `toast:Failed`, `emit:submit-error` |
| `data-nd-finally` | After EITHER phase, once the phase chain completes | `reset`, `refresh:#status` |

#### Verb grammar (shared across all three attributes)

| Verb | Effect | Stops chain? |
|---|---|---|
| `reset` | `form.reset()` (forms only) | No |
| `reload` | `window.location.reload()` | Yes |
| `redirect:URL` | `window.location.href = URL` | Yes |
| `refresh:SELECTOR` | Dispatches `nd:refresh` on every matching element | No |
| `emit:EVENT` | Dispatches a bubbling `CustomEvent(EVENT, {detail: responseData})` | No |
| `toast:MESSAGE` | Shows a success toast with MESSAGE (composes with the toast subsystem) — **built-in** | No |
| `close-modal` | Closes the nearest ancestor `<dialog>` | No |
| Custom verbs | Registered via `NDesign.registerHook()` | Depends on handler |

**Navigation verbs in `data-nd-finally`:** if the `success` or `error` chain already navigated (via `redirect` or `reload`), the `finally` chain suppresses any further navigation verb so the page is not navigated twice.

**Ordering: `data-nd-set` runs BEFORE the phase chain.** If your form or button has both `data-nd-set` and `data-nd-success` (or `data-nd-error`), the store writes execute first, then the lifecycle chain runs. This allows verbs like `refresh:#target` and `emit:eventName` to observe the updated store values in real time.

#### Example — success, error, and finally in one form

```html
<form data-nd-action="POST ${api}/api/records"
      data-nd-success="close-modal,toast:Saved!"
      data-nd-error="toast:Save failed — please retry"
      data-nd-finally="refresh:#record-list">
  <!-- fields -->
  <button type="submit" class="nd-btn-primary">Save</button>
</form>
```

#### Extending with `NDesign.registerHook(verb, handler)`

Register a custom verb for use in any `data-nd-success`, `data-nd-error`, or `data-nd-finally` attribute.

```javascript
// Register a custom verb — then use it in any lifecycle chain:
NDesign.registerHook('confetti', (arg, ctx) => launchConfetti(ctx.data));
// data-nd-success='close-modal,confetti'
```

`registerHook` can also **override a built-in** (e.g. re-point `toast` at a different notifier) — the registry has no special-casing, so a re-registered verb simply replaces the previous handler.

**Handler signature:** `handler(arg, ctx)` where:

| Parameter | Type | Description |
|---|---|---|
| `arg` | `string` | The portion after the colon in `verb:arg`. Empty string when no arg. |
| `ctx.element` | `HTMLElement` | The form or button that triggered the action. |
| `ctx.response` | `Response \| null` | The raw `fetch` Response (null on network failure). |
| `ctx.data` | `any` | Parsed JSON response body, or `null`. |
| `ctx.error` | `{errors: Object} \| null` | The unified error envelope (null on success), with shape `{errors: {error?: string, fieldName?: string, ...}}`. |
| `ctx.phase` | `'success' \| 'error' \| 'finally'` | Which phase is running. |

A handler MAY return a `Promise` — the runtime awaits it before advancing the chain. Unknown verbs are silently ignored (no console warning). Built-in verbs (`reset`, `reload`, `redirect`, `refresh`, `emit`, `toast`, `close-modal`) can be overridden by calling `registerHook` with the same verb name.

### Pitfalls

- Each field input MUST have a `name` attribute. Inputs without `name` are skipped by the serializer and will silently NOT submit.
- The `.nd-form-error` slot MUST be a sibling of the input inside the same `.nd-form-group`. Errors target fields by traversing up to `.nd-form-group` and writing into the nearest `.nd-form-error`.
- File inputs are skipped by `data-nd-action`'s JSON serializer. Use `data-nd-upload` for any form that includes a file input.
- `<input type="checkbox">` serializes as a boolean (`true`/`false`), not as the `value` attribute. Multi-select serializes as an array of values.
- `<input type="number">` serializes as a `Number` (or `null` if empty), NOT as a string.

### See also

- [Buttons](#buttons), [Upload](#upload), [Modals and dialogs](#modals)
- Source: `scss/_forms.scss`, `js/action.js`
