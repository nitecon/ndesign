## Modals

> **Rules**
> - Use the native `<dialog>` element — custom `<div class="modal">` markup is NOT supported and will not open.
> - Use for single-record edits, destructive-action confirms, and multi-step forms that feed back into the parent view.
> - Do NOT use for transient feedback — use [Toasts](#toasts).
> - On a form inside a modal, add `data-nd-success="close-modal,refresh:#target"` to close on save and refresh the parent view.
> - Server-driven chained confirmation (`next_confirm` on response) is NOT implemented — compose multi-step confirms client-side with nested `data-nd-confirm`.

ndesign uses the browser's native `<dialog>` element for every modal. There
is no custom modal container, no portal, and no focus-trap implementation
beyond what the platform provides. The runtime only adds declarative open /
close triggers, backdrop-click handling, and a Promise-based confirm helper.

### When to use

- Editing a single record without leaving the current page.
- Confirming a destructive action with a yes / no choice.
- Surfacing a multi-step form whose result feeds back into the parent view.

### When NOT to use

- For transient feedback that does not require acknowledgement — use
  [Toasts](#toasts) instead.
- For navigation between sections — modals are not a substitute for routing.

### Minimal example

```html
<button class="nd-btn-primary" data-nd-modal="#edit-user">Edit</button>

<dialog id="edit-user">
  <header>
    <h3>Edit user</h3>
    <button class="nd-modal-close" aria-label="Close">&times;</button>
  </header>
  <form data-nd-action="PATCH ${api}/api/users/${userId}"
        data-nd-feedback="edit-feedback"
        data-nd-success="close-modal,refresh:#user-table">
    <div class="nd-form-group">
      <label for="name">Name</label>
      <input name="name" id="name" required>
      <div class="nd-form-error"></div>
    </div>
    <div id="edit-feedback"></div>
    <menu>
      <button type="button" data-nd-dismiss>Cancel</button>
      <button type="submit" class="nd-btn-primary">Save</button>
    </menu>
  </form>
</dialog>
```

### Markup and classes

| Class                | Effect                                                        |
|----------------------|---------------------------------------------------------------|
| `dialog`             | Native element — styled out of the box. No class required.    |
| `.nd-modal-sm`       | Narrow width variant (24 rem max).                            |
| `.nd-modal-lg`       | Wide variant (56 rem max).                                    |
| `.nd-modal-full`     | Near-full-viewport variant.                                   |
| `.nd-modal-close`    | Header close button — closes the enclosing `<dialog>`.        |

`<dialog>` accepts a `<header>`, a body `<div>`, and a `<footer>` as direct
children. The runtime does not require any class on those wrappers — the
SCSS targets them by element selector inside `dialog`.

### Dynamic bindings

| Attribute                   | Location                  | Behavior                                                                                                |
|-----------------------------|---------------------------|---------------------------------------------------------------------------------------------------------|
| `data-nd-modal="SELECTOR"`  | any clickable element     | On click: calls `document.querySelector(SELECTOR).showModal()`. Delegated, so triggers rendered later by [Data binding](#data-binding) work. |
| `data-nd-dismiss`           | inside a `<dialog>`       | On click: closes the enclosing `<dialog>`.                                                              |
| `.nd-modal-close`           | inside a `<dialog>`       | Equivalent to `data-nd-dismiss`.                                                                        |
| `data-nd-confirm-accept`    | inside a `<dialog>` opened by `confirmDialog()` | Resolves the confirm promise with `true` and closes the dialog.                                        |

A click on the `::backdrop` (detected when the click coordinates fall
outside the dialog's bounding rect) also closes the dialog.

When a [Data binding](#data-binding) form action inside a modal succeeds,
add `data-nd-success="close-modal"` to the form to close the enclosing
dialog as part of the success chain. It composes with other success steps,
e.g. `data-nd-success="close-modal,refresh:#user-table"`.

### Events fired

| Event              | Target   | Detail | When                                                                         |
|--------------------|----------|--------|------------------------------------------------------------------------------|
| `nd:modal:open`    | `dialog` | none   | After `openModal()` or `confirmDialog()` calls `showModal()`.                |
| `nd:modal:close`   | `dialog` | none   | After the dialog's `close` event (Escape, backdrop, programmatic close).     |
| `nd:modal:confirm` | `dialog` | none   | When `confirmDialog()` resolves `true`.                                      |
| `nd:modal:cancel`  | `dialog` | none   | When `confirmDialog()` resolves `false` (any dismiss path).                  |

`nd:modal:confirm` and `nd:modal:cancel` are observational — they do NOT
affect promise resolution.

### JS API

```javascript
NDesign.openModal('#my-dialog');                  // → void
NDesign.closeModal('#my-dialog');                 // → void
NDesign.confirmDialog('#confirm') /* → */ .then(ok => { /* ok: boolean */ });
```

`openModal` and `closeModal` warn and no-op if the selector does not match
a `<dialog>`. `confirmDialog()` returns a `Promise<boolean>` resolved
exactly once based on the first matching event:

| Trigger                                                     | Resolves to |
|-------------------------------------------------------------|-------------|
| Click on `[data-nd-confirm-accept]` inside the dialog       | `true`      |
| Click on `[data-nd-dismiss]` or `.nd-modal-close`           | `false`     |
| Click on the dialog backdrop                                | `false`     |
| Escape key                                                  | `false`     |
| Programmatic `dialog.close()` / `NDesign.closeModal()`      | `false`     |

Listeners for a `confirmDialog()` call are scoped to a local
`AbortController` and removed on resolution, so calling it repeatedly on
the same dialog is safe.

### Accessibility

- `<dialog>` provides a native focus trap, Escape-to-close, and inert
  background semantics — the runtime does not re-implement them.
- Use `<header>` + `<h2>`/`<h3>` inside the dialog to label the modal for
  screen readers, or set `aria-labelledby` explicitly.
- `.nd-modal-close` MUST carry an `aria-label` (e.g. `aria-label="Close"`)
  because its visible text is a `&times;` glyph.
- Confirm dialogs SHOULD include both an accept button
  (`data-nd-confirm-accept`) and a cancel button (`data-nd-dismiss`) so
  keyboard users can dismiss without reaching for Escape.

### Pitfalls

- Calling `openModal()` on an element that is not a `<dialog>` emits a
  console warning and does nothing. Custom `<div class="modal">` markup is
  not supported — use the native element.
- Server-driven chained confirmation (a `next_confirm` field on the
  response opening another confirm dialog) is NOT implemented.
- Closing a `<dialog>` programmatically inside a `confirmDialog()` session
  resolves the promise as `false`. To resolve as `true`, the user MUST
  click an element with `data-nd-confirm-accept`.

### See also

- [Data binding](#data-binding) — `data-nd-success="close-modal"` and the
  full success chain.
- [Toasts](#toasts) — for non-blocking feedback.
- Source: `js/modal.js`, `scss/_modals.scss`
