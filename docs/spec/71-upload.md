## Upload

> **Rules**
> - Use for any form containing `<input type="file">` — `data-nd-action` uses `fetch` and cannot expose upload progress.
> - `data-nd-upload` is valid ONLY on `<form>` — applying it to a `<button>` is a silent no-op.
> - File inputs MUST have a `name` attribute — `FormData` silently omits unnamed inputs.
> - The `<progress class="nd-upload-progress">` MUST start with `hidden` — the runtime removes it on submit.
> - Do NOT set `Content-Type` manually — the browser injects the multipart boundary; overriding it breaks server-side parsing.

`data-nd-upload` intercepts a `<form>` submit and routes it through
`XMLHttpRequest` so the upload progress event is observable. The browser
serializes the form via `FormData` (so `<input type="file">` works
unchanged) and the runtime updates a `<progress>` element inside the
form as bytes are transmitted. Success and error rendering reuse the
same chain as `data-nd-action`, so feedback messages, field error
display, and success-action chaining behave consistently.

### When to use

- Any form that contains a file input. `data-nd-action` uses `fetch`
  and cannot expose upload progress; `data-nd-upload` exists for that
  reason.
- Multipart submissions that the user expects to take longer than a few
  hundred milliseconds.

### When NOT to use

- For JSON-only forms with no file input — use `data-nd-action`. See
  [Data binding](#data-binding).
- For background sync of local files — there is no resume support.

### Minimal example

```html
<form data-nd-upload="POST ${api}/api/uploads"
      data-nd-feedback="upload-msg"
      data-nd-success="toast:Uploaded">
  <label>
    File
    <input type="file" name="file" required>
  </label>

  <progress class="nd-upload-progress" hidden></progress>

  <button type="submit" class="nd-btn-primary">Upload</button>
</form>

<div id="upload-msg"></div>
```

### Markup and classes

| Class                       | Effect                                                                |
|-----------------------------|-----------------------------------------------------------------------|
| `<input type="file">`       | Native element. Themed (`::file-selector-button` matches `nd-btn`).   |
| `progress.nd-upload-progress` | Optional progress bar inside the form. Starts `hidden`; revealed during upload, hidden again 1 s after completion. |
| `.nd-loading` (runtime)     | Applied to the submit button while a request is in flight.            |
| `.nd-alert.nd-alert-success` | Applied to the feedback element on success.                          |
| `.nd-alert.nd-alert-error`  | Applied to the feedback element on failure.                           |

### Dynamic bindings

| Attribute                       | Location              | Behavior                                                                                                                                                                |
|---------------------------------|-----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `data-nd-upload="METHOD URL"`   | `<form>` only         | Hijacks submit. Method defaults to `POST`. URL is `${var}`-resolved at submit time (see [Data binding](#data-binding) for store interpolation).                         |
| `data-nd-feedback="ID"`         | `<form>`              | Element id receiving the success / error message text.                                                                                                                  |
| `data-nd-confirm="MESSAGE"`     | `<form>`              | Plain text shows `window.confirm`; `"#dialog-id"` opens a native `<dialog>` confirm. Cancellation aborts the upload silently.                                            |
| `data-nd-success="CHAIN"`       | `<form>`              | Comma-separated success actions executed after a 2xx response. Same vocabulary as `data-nd-action` (`refresh:#sel`, `redirect:/path`, `toast:msg`, `close-modal`, ...).  |
| `data-nd-set="OPS"`             | `<form>`              | Store writes executed after a 2xx response. Same grammar as `data-nd-action`.                                                                                            |
| `data-nd-timeout="MS"`          | `<form>`              | Per-upload XHR timeout; overrides `NDesign.configure({timeout})`.                                                                                                        |
| `progress.nd-upload-progress`   | inside the `<form>`   | Optional. When present, `value` is updated from `xhr.upload.progress` (capped at `max=100`).                                                                            |

`data-nd-set` receives the parsed JSON response (or `null`) after a
successful upload, before the `data-nd-success` chain runs.

### Headers and CSRF

The XHR applies the same configured headers as bind/action requests, then
removes `Content-Type` before sending:

- `X-Requested-With: NDesign`
- any headers from `NDesign.configure({ headers: ... })`
- `X-CSRF-Token: <meta name="csrf-token">` (only when the meta tag is
  present)

The browser sets `Content-Type: multipart/form-data; boundary=...`
automatically from the `FormData`. **Do not override it** — without the
boundary parameter the server cannot parse the body.

`NDesign.configure({ onRequest })` receives an options object with
`{ method, headers, body: FormData, transport: 'xhr' }` before headers
are applied, so applications MAY mutate `headers` for upload requests.

### Error handling

The upload handler dispatches the response payload through the same
helpers used by form actions:

- **2xx** — `data-nd-set` runs first, then
  `handleSuccess(form, responseData)` runs the `data-nd-success`
  chain. The feedback element shows `responseData.message` or
  "Upload complete".
- **non-2xx with JSON `errors`** — `displayErrors(form, errors,
  feedbackId)` paints `.nd-form-error` next to fields and the global
  `errors._form` / `errors.error` message into the feedback element.
- **non-2xx without JSON** — the feedback element shows the response
  text or `xhr.statusText`.

Upload failures are normalised into the unified error envelope shape and
passed to `config.onError(url, envelope, err)` after visible feedback is
updated. See [Data binding → Error envelope](#error-envelope) for the
canonical shape.

A network failure dispatches `xhr.onerror` and sets the feedback to
*"Network error. Please try again."* A timeout sets the feedback to
*"Request timed out"*. An aborted request (typically because
`destroyUploads()` ran mid-flight) sets the feedback to
*"Upload cancelled."*

### Events fired

Upload does not dispatch ndesign-specific custom events. The native
`submit` event is intercepted with `e.preventDefault()`. To observe
progress programmatically, listen for `xhr.upload.progress` from a
custom interceptor — there is no public hook on the form itself.

### JS API

Upload is wired by `NDesign.init()` for every `form[data-nd-upload]`
present at init time.

| Method               | Behavior                                                                                                                                            |
|----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| `initUploads(config)` | Idempotent. Skips forms already wired. Called automatically by `NDesign.init()`. Uses the shared runtime config for headers, hooks, and timeout.    |
| `destroyUploads()`   | Removes every submit handler **and aborts any in-flight `XMLHttpRequest`**. Called by `NDesign.init()` on re-init. Aborted XHRs surface a "cancelled" feedback. |

### Accessibility

- `<input type="file">` is the native control — accessible label
  comes from a wrapping `<label>` or `<label for>` exactly as for any
  form input.
- The `<progress>` element provides built-in screen-reader semantics
  (current value vs. max). No additional ARIA is needed.
- The submit button is disabled while uploading and carries the
  `nd-loading` class for visual feedback. Re-enable it manually only if
  custom code intercepts the upload — the standard handler restores it
  on `load` / `error` / `abort`.

### Pitfalls

- `data-nd-upload` is valid **only on `<form>`**. Applying it to a
  `<button>` or other element is a silent no-op.
- The `<progress>` element MUST start with the `hidden` attribute. The
  runtime removes the attribute on submit and re-adds it 1 s after
  completion. A `<progress>` without `hidden` is visible immediately at
  page load with `value="0"` — looks broken.
- File inputs MUST have a `name` attribute, otherwise `FormData`
  silently omits them. There is no warning.
- Setting `Content-Type` manually (e.g. via a `<meta>`-driven header)
  prevents the browser from injecting the multipart boundary; the
  server then fails to parse the body. The runtime never sets
  `Content-Type` on the XHR for this reason.
- Upload still uses XHR rather than `fetch` because browsers do not
  expose upload progress events through `fetch`.
- A re-init via `NDesign.init()` aborts any active upload — the user
  sees an "Upload cancelled" feedback. Avoid wholesale re-init while
  uploads are in flight.

### See also

- [Data binding](#data-binding) — `data-nd-success`, `data-nd-feedback`,
  `data-nd-confirm`, and the error envelope.
- [Toasts](#toasts) — surface upload completion via
  `data-nd-success="toast:Uploaded"`.
- Source: `js/upload.js`, `scss/_uploads.scss`
