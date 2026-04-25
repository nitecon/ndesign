## Reference

This section is the lookup appendix. Every attribute, meta tag,
runtime CSS class, JS API method, and event the runtime understands
appears in one of the tables below, with a link to the section that
explains it.

### Attribute reference

Alphabetical list of every `data-nd-*` attribute the runtime
processes.

| Attribute                  | One-line description                                                                  | Section |
|----------------------------|---------------------------------------------------------------------------------------|---------|
| `data-nd-action`           | Form/button action: `"METHOD URL"`, submits JSON and handles the response.            | [data-nd-action](#data-nd-action--forms-and-button-actions) |
| `data-nd-attr`             | On a `data-nd-bind` element with `data-nd-field`, writes the value to a DOM attribute. | [Attribute write](#attribute-write--data-nd-attrname) |
| `data-nd-bind`             | Fetch a JSON URL and render into the element (field or template).                     | [data-nd-bind](#data-nd-bind--fetch-and-render) |
| `data-nd-bind-mode`        | On a bind trigger: override the target's `data-nd-mode` (e.g. `append`).              | [Triggers](#triggers--data-nd-bind-trigger-and-data-nd-bind-mode) |
| `data-nd-bind-trigger`     | CSS selector: clicking this element refetches the matching bound element.             | [Triggers](#triggers--data-nd-bind-trigger-and-data-nd-bind-mode) |
| `data-nd-body`             | JSON template body for a button `data-nd-action` (buttons only).                      | [Button body template](#button-body-template--data-nd-body) |
| `data-nd-confirm`          | Text → `window.confirm()`; `"#dialog-id"` → async `<dialog>` confirm.                 | [Confirmation](#confirmation--data-nd-confirm) |
| `data-nd-confirm-accept`   | On a button inside a confirm `<dialog>`: resolves `confirmDialog()` as `true`.        | [Modals](#modals) |
| `data-nd-defer`            | Skip the initial auto-fetch on a `data-nd-bind` element.                              | [Deferred fetch](#deferred-fetch--data-nd-defer) |
| `data-nd-dismiss`          | On a button inside `<dialog>`: closes the dialog.                                     | [Modals](#modals) |
| `data-nd-empty`            | `<template data-nd-empty>`: shown when a bound array is empty.                        | [Loading, empty, and error templates](#loading-empty-and-error-templates) |
| `data-nd-error`            | `<template data-nd-error>`: rendered when a bound fetch fails.                        | [Loading, empty, and error templates](#loading-empty-and-error-templates) |
| `data-nd-feedback`         | ID of a feedback element that receives server messages for this action/upload.        | [Feedback element](#feedback-element--data-nd-feedbackid-and-the-auto-slot) |
| `data-nd-field`            | Dot-path extracting a scalar from response data (for bind/sse/ws).                    | [Scalar field binding](#scalar-field-binding--data-nd-fieldpath) |
| `data-nd-if`               | Inside a template: remove the element when the named field is falsy.                  | [Templates and {{field}} interpolation](#templates-and-field-interpolation) |
| `data-nd-loading`          | `<template data-nd-loading>`: shown while a bound fetch is in flight.                 | [Loading, empty, and error templates](#loading-empty-and-error-templates) |
| `data-nd-max`              | Maximum number of rendered children for append/prepend rendering.                     | [Render mode](#render-mode-and-data-nd-max) |
| `data-nd-modal`            | CSS selector: opens the target `<dialog>` when clicked.                               | [Modals](#modals) |
| `data-nd-mode`             | Render mode: `replace` (default), `append`, `prepend`.                                | [Render mode](#render-mode-and-data-nd-max) |
| `data-nd-model`            | Two-way bind a form input to a store var.                                              | [data-nd-model](#data-nd-model--two-way-form-binding) |
| `data-nd-on`               | Escape hatch: `"event:handlerName"`; calls `window[handlerName](e, el)`.              | [Escape hatch](#escape-hatch--data-nd-on) |
| `data-nd-options`          | On a `<select data-nd-bind>`: populate `<option>`s from a JSON array (`"value:label"`). | [Select population](#select-population--data-nd-optionsvaluelabel) |
| `data-nd-params`           | Extra query string appended to the bind URL.                                          | [data-nd-bind](#data-nd-bind--fetch-and-render) |
| `data-nd-refresh`          | Polling interval (ms) for a bound element.                                            | [Polling](#polling--data-nd-refreshms) |
| `data-nd-select`           | Dot-path selecting a sub-field of the response before rendering (envelope unwrap).    | [Envelope unwrap](#envelope-unwrap--data-nd-selectpath) |
| `data-nd-set`              | Write one or more values into the store (response, literal, ref, or arithmetic).      | [data-nd-set](#data-nd-set--write-to-the-store) |
| `data-nd-sortable`         | Mark a container as sortable; optional `"METHOD URL"` to POST new order.              | [Sortable](#sortable) |
| `data-nd-sortable-group`   | Opt containers with the same value into cross-container drag-and-drop.                | [Sortable](#sortable) |
| `data-nd-sortable-refresh` | CSV of selectors to `nd:refresh` after a successful reorder (pairs with group).       | [Sortable](#sortable) |
| `data-nd-sse`              | Connect to a server-sent events stream and render messages.                           | [data-nd-sse](#data-nd-sse--server-sent-events) |
| `data-nd-sse-event`        | Filter for a named SSE event type (default is the generic `message`).                 | [data-nd-sse](#data-nd-sse--server-sent-events) |
| `data-nd-success`          | Comma-separated chain of post-success actions.                                        | [Success chain](#success-chain--data-nd-successactionaction) |
| `data-nd-tab` *(role=tab)* | Use `role="tab"` and `aria-controls="panel-id"` — tab container is `.nd-tabs`.        | [Tabs](#tabs) |
| `data-nd-template`         | ID of a `<template>` element used to render a bind/sse/ws response.                   | [Template binding](#template-binding--data-nd-templateid) |
| `data-nd-theme`            | On a click target: set the theme by name (matches `<meta name="nd-theme">`).          | [Theme](#theme) |
| `data-nd-theme-toggle`     | Cycle to the next registered theme on click.                                          | [Theme](#theme) |
| `data-nd-timeout`          | Per-element fetch timeout in ms; overrides `config.timeout` (default 15000).          | [Per-element timeout](#per-element-timeout--data-nd-timeoutms) |
| `data-nd-toast`            | Message to show in a toast when the element is clicked.                               | [Toasts](#toasts) |
| `data-nd-toast-type`       | Type for a `data-nd-toast` trigger: `success`, `error`, `warning`, `info`.            | [Toasts](#toasts) |
| `data-nd-toast-duration`   | Duration (ms) for a `data-nd-toast` trigger; 0 = persistent.                          | [Toasts](#toasts) |
| `data-nd-toggle`           | `"sidebar"`: toggles `.sidebar` and an overlay (auto-wired delegated click).          | [Navigation](#navigation) |
| `data-nd-tooltip`          | Text shown in a tooltip on hover/focus.                                               | [Tooltips](#tooltips) |
| `data-nd-tooltip-placement`| `top` (default), `bottom`, `left`, `right`.                                           | [Tooltips](#tooltips) |
| `data-nd-upload`           | Form multipart upload endpoint: `"METHOD URL"`. XHR with progress.                    | [Upload](#upload) |
| `data-nd-ws`               | Connect to a WebSocket URL and render messages.                                       | [data-nd-ws](#data-nd-ws--websockets) |
| `data-nd-ws-filter`        | `"field:value"` — only render messages whose field matches.                           | [data-nd-ws](#data-nd-ws--websockets) |

### Meta tag reference

Meta tag namespaces the runtime reads at init.

| Meta name            | Purpose                                                                  | Section |
|----------------------|--------------------------------------------------------------------------|---------|
| `endpoint:NAME`      | Registers a URL base under `NAME`, resolvable via `${NAME}`.             | [Store, meta tags, and ${var} interpolation](#store-meta-tags-and-var-interpolation) |
| `var:NAME`           | Registers an initial value under `NAME`, resolvable via `${NAME}`.       | [Store, meta tags, and ${var} interpolation](#store-meta-tags-and-var-interpolation) |
| `csrf-token`         | Read by `buildHeaders()` and upload, sent as `X-CSRF-Token`.             | [Configuration](#configuration) |
| `nd-theme`           | Registers a named theme; `data-href` points at its stylesheet.           | [Theme](#theme) |

### Runtime CSS classes

Classes the runtime ADDS at runtime. They are NOT classes consumers
write by hand; consumers MAY style them in CSS.

| Class                      | Added by                                                          | Section |
|----------------------------|-------------------------------------------------------------------|---------|
| `nd-loading`               | Bind in flight; action/upload submit in flight.                    | [data-nd-bind](#data-nd-bind--fetch-and-render), [data-nd-action](#data-nd-action--forms-and-button-actions) |
| `nd-error`                 | Bind fetch failed; action failed; field with a validation error.   | [Loading, empty, and error templates](#loading-empty-and-error-templates), [Error envelope](#error-envelope) |
| `nd-ws-connected`          | Element's WebSocket is currently open.                            | [data-nd-ws](#data-nd-ws--websockets) |
| `nd-ws-disconnected`       | Element's WebSocket is closed or connecting.                      | [data-nd-ws](#data-nd-ws--websockets) |
| `nd-dragging`              | Mouse-dragged sortable item.                                      | [Sortable](#sortable) |
| `nd-kb-grabbed`            | Keyboard-grabbed sortable item.                                    | [Sortable](#sortable) |
| `nd-sortable-error`        | Briefly applied to a container after a revert.                     | [Sortable](#sortable) |
| `nd-form-feedback-auto`    | Auto-created feedback slot for forms/buttons without `data-nd-feedback`. | [Feedback element](#feedback-element--data-nd-feedbackid-and-the-auto-slot) |

### Public JS API

`window.NDesign.*` methods. The runtime is exposed as an IIFE
attached to `window`; these are the supported entry points.

| Name                                          | Description                                                       | Section |
|-----------------------------------------------|-------------------------------------------------------------------|---------|
| `NDesign.configure(partial)`                  | Merge runtime configuration.                                       | [Configuration](#configuration) |
| `NDesign.init()`                              | Re-init the runtime (tears down first).                           | [Lifecycle and initialization](#lifecycle-and-initialization) |
| `NDesign.store.get(key)`                      | Read a top-level var.                                             | [Store API](#store-api) |
| `NDesign.store.set(key, value)`               | Write a top-level var (does NOT fire `nd:var-change`).            | [Store API](#store-api) |
| `NDesign.store.has(key)` / `delete` / `clear` | Standard map ops on top-level vars.                               | [Store API](#store-api) |
| `NDesign.storeGet(path)`                      | Read a var by dot-path (fires through `getVar`).                  | [Store API](#store-api) |
| `NDesign.storeSet(path, value)`               | Write a var by dot-path; FIRES `nd:var-change`.                   | [Store API](#store-api) |
| `NDesign.endpoint(name)`                      | Return the URL base for a named endpoint, or `''`.                 | [Store API](#store-api) |
| `NDesign.resolveVars(template)`               | Resolve `${...}` tokens in a template string.                      | [${var} grammar](#var-grammar) |
| `NDesign.render(container, id, data, mode?)`  | Render a `<template>` programmatically.                            | [Templates and {{field}} interpolation](#templates-and-field-interpolation) |
| `NDesign.renderOne(tpl, data)`                | Clone + interpolate a `<template>` for one item.                   | [Templates and {{field}} interpolation](#templates-and-field-interpolation) |
| `NDesign.interpolate(text, data)`             | Interpolate a `{{field}}` string.                                  | [Templates and {{field}} interpolation](#templates-and-field-interpolation) |
| `NDesign.escapeHTML(s)`                       | HTML-escape a string.                                              | [Templates and {{field}} interpolation](#templates-and-field-interpolation) |
| `NDesign.getByPath(obj, path)`                | Dot-path read on an arbitrary object.                              | [Configuration](#configuration) |
| `NDesign.setByPath(obj, path, value)`         | Dot-path write on an arbitrary object.                             | [Configuration](#configuration) |
| `NDesign.getCSRFToken()`                      | Read the CSRF meta tag content.                                    | [Configuration](#configuration) |
| `NDesign.openModal(selector)`                 | `.showModal()` a `<dialog>` by selector.                           | [Modals](#modals) |
| `NDesign.closeModal(selector)`                | `.close()` a `<dialog>` by selector.                               | [Modals](#modals) |
| `NDesign.confirmDialog(selector)`             | Open a `<dialog>` as confirm; returns `Promise<boolean>`.          | [Modals](#modals) |
| `NDesign.toast(msg, type?, duration?)`        | Show a toast.                                                      | [Toasts](#toasts) |
| `NDesign.setTheme(name)`                      | Switch to a named theme.                                           | [Theme](#theme) |
| `NDesign.toggleTheme()`                       | Cycle to the next registered theme.                                | [Theme](#theme) |
| `NDesign.getThemes()`                         | List registered themes and which is active.                        | [Theme](#theme) |

### Events fired by the runtime

Every `nd:*` event the runtime dispatches. Listen via
`addEventListener` on the target element (or `document` for
`nd:var-change`).

| Event                  | Target                | Detail                                          | Section |
|------------------------|-----------------------|-------------------------------------------------|---------|
| `nd:refresh`           | bound element          | none — consumer refetches                       | [data-nd-bind](#data-nd-bind--fetch-and-render) |
| `nd:var-change`        | `document`            | `{path, topKey, value}`                         | [Store API](#store-api) |
| `nd:model`             | model input            | `{name, value}`                                 | [data-nd-model](#data-nd-model--two-way-form-binding) |
| `nd:set`               | set-trigger element    | `{el}`                                          | [data-nd-set](#data-nd-set--write-to-the-store) |
| `nd:modal:open`        | `<dialog>`            | none — `openModal()` or `confirmDialog()`       | [Modals](#modals) |
| `nd:modal:close`       | `<dialog>`            | none — `close` event                            | [Modals](#modals) |
| `nd:modal:confirm`     | `<dialog>`            | none — `confirmDialog()` resolved `true`        | [Modals](#modals) |
| `nd:modal:cancel`      | `<dialog>`            | none — `confirmDialog()` resolved `false`       | [Modals](#modals) |
| `nd:sortable:reorder`  | destination container | `{order, item, source, crossContainer}`         | [Sortable](#sortable) |
| `nd:sortable:revert`   | destination container | `{item, source}`                                | [Sortable](#sortable) |
| user-defined `emit:X`  | action / set element   | `responseData` (`undefined` for set)            | [Success chain](#success-chain--data-nd-successactionaction) |

Any custom event name used in `data-nd-success="emit:foo"` is also
dispatched on the action / set element as a bubbling `CustomEvent`
with `detail = responseData`.
