## Progress

> **Rules**
> - Use for file uploads (`data-nd-upload`) and long-running operations with a known percentage.
> - Do NOT use for a loading indicator inside a button — use `.nd-loading` on the button.
> - Do NOT use for a loading indicator on a list — use [Skeletons](#skeletons).
> - The `<progress class="nd-upload-progress">` MUST start with the `hidden` attribute — the runtime removes it on submit; do NOT set `display: block` manually.
> - `<progress value="">` or no `value` = indeterminate. Use `value="0"` for an explicit empty bar.

Native `<progress>` is fully styled — determinate (with a `value`) and indeterminate (no `value`). No wrapper class is required. The `.nd-upload-progress` class hooks into the file-upload XHR runtime, which toggles the element's visibility and updates `value` as bytes transfer.

### When to use

- File uploads (always pair with `data-nd-upload`).
- Long-running operations driven by SSE/WS where the server sends percentage updates.
- Determinate background tasks (export, import, batch).

### When NOT to use

- A loading indicator without a known percentage and inside a button — use the button's `.nd-loading` state.
- A loading indicator on a list — use [Skeletons](#skeletons).

### Minimal example — determinate

```html
<progress value="42" max="100">42%</progress>
```

### Minimal example — indeterminate

```html
<progress>Loading…</progress>
```

The indeterminate state animates an accent stripe across the track.

### Markup and classes

| Class | Effect |
|---|---|
| `.nd-progress-sm` | 0.25rem tall |
| `.nd-progress-lg` | 0.75rem tall |
| `.nd-progress-xl` | 1.25rem tall |
| `.nd-progress-success` | Green fill |
| `.nd-progress-warning` | Amber fill |
| `.nd-progress-danger` | Red fill |
| `.nd-upload-progress` | Marker class for the upload runtime; `[hidden]` selector hides it until upload starts |

The default fill height is 0.5rem. Both WebKit (`::-webkit-progress-bar` / `::-webkit-progress-value`) and Firefox (`::-moz-progress-bar`) pseudos are styled.

### Dynamic bindings — file upload

A `<form data-nd-upload="POST /api/upload">` with a `<progress class="nd-upload-progress" hidden>` element and a `<input type="file">` produces a complete upload UI. The runtime selects the progress element via `form.querySelector('progress.nd-upload-progress')` on submit, removes the `hidden` attribute, and updates `value` from the XHR `upload.onprogress` event.

```html
<form data-nd-upload="POST ${api}/api/files"
      data-nd-feedback="upload-feedback">
  <input type="file" name="file" required>
  <progress class="nd-upload-progress" value="0" max="100" hidden></progress>
  <div id="upload-feedback"></div>
  <button type="submit" class="nd-btn-primary">Upload</button>
</form>
```

See [Upload](#upload) for the full attribute set, server payload, and CSRF behavior.

### Pitfalls

- A `<progress>` with `value=""` or no `value` attribute is indeterminate, NOT zero. Use `value="0"` for an explicit empty bar.
- The semantic color modifiers only style the WebKit/Firefox pseudo-elements. They do NOT change the indeterminate-state animation color (which is hard-coded to the accent gradient).
- `.nd-upload-progress[hidden]` is a `display: none` rule. The runtime relies on removing the `hidden` attribute (NOT toggling a class) — do NOT manually set `display: block` and expect the runtime to clean up.

### See also

- [Upload](#upload), [Forms](#forms), [Skeletons](#skeletons)
- Source: `scss/_progress.scss`, `scss/_uploads.scss`, `js/upload.js`
