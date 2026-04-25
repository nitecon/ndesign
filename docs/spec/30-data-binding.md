## Data binding

This section explains the entire runtime mechanics of ndesign in one
place. Every other component in the spec is built on the primitives
documented here.

### How it works

The runtime model is small enough to hold in your head:

1. The server renders an HTML page that carries `data-nd-*` attributes
   on the elements it wants to be dynamic.
2. On `DOMContentLoaded` (or immediately, if the script is at the end
   of `<body>`), the runtime scans the DOM and wires fetch / submit /
   stream behaviours per attribute.
3. URLs live on the elements themselves. Each `data-nd-bind`,
   `data-nd-action`, `data-nd-sse`, `data-nd-ws`, etc. carries its own
   URL. The `${var}` token system resolves URLs against `<meta>` tags
   at fetch time — there is no `baseURL` config.
4. There is no virtual DOM. Templates are real `<template>` elements
   cloned and interpolated into the live DOM.
5. There is no client router. Navigation is plain `<a href>` and
   `window.location`.
6. **There is no reactivity for display elements.** Writing to the
   store does NOT refresh `data-nd-bind` elements. The only reactive
   primitive is `data-nd-model`, which re-syncs a form input when the
   same top-level store key is written. Everything else is explicit:
   to refresh a bound element after a store write, dispatch
   `nd:refresh` on it (typically via `data-nd-success="refresh:#id"`).

The remainder of this section covers each subsystem in turn.

### Lifecycle and initialization

The runtime auto-initialises on `DOMContentLoaded`. If the script is
placed at the end of `<body>` and the DOM is already parsed, init runs
synchronously.

`NDesign.init()` MAY be called manually. When called a second time, it
tears down every subsystem first, then re-scans the DOM. The order on
init is:

1. `destroyStore()` plus every `destroy*()` (only when re-initing).
2. `initStoreFromMeta()` — reads `<meta name="endpoint:*">` and
   `<meta name="var:*">` into the store. MUST run before any directive
   that resolves a `${var}` URL.
3. `initBindings(config)` — wires `data-nd-bind`.
4. `initActions(config)` — wires `data-nd-action` on forms and
   buttons, plus `data-nd-on`.
5. `initWebSockets(config)`, `initSSE(config)`.
6. `initSelects()`, `initNav()`, `initDropdowns()`, `initModals()`,
   `initToasts()`, `initTabs()`, `initTooltips()`, `initUploads()`,
   `initSortable()`.
7. `initSetTriggers(config)` — wires click handlers for standalone
   `data-nd-set` elements.
8. `initModel(config)` — wires two-way `data-nd-model` inputs.
9. A single delegated `click` listener is attached to `document` for
   theme toggling, toast triggers, sidebar toggling, sortable sidebar
   nav active state, `data-nd-toast`, and `data-nd-bind-trigger`.

A full `NDesign.init()` is safe but heavy — teardown removes listeners
on every tracked element, not just new ones. Prefer it only after
wholesale DOM replacement.

For dynamic markup that adds children to a known-live container — for
example a `data-nd-sortable` list whose rows arrive via a template
refresh — the sortable subsystem attaches a `MutationObserver` per
container at init and auto-wires new children without a full re-init.

### Configuration

`NDesign.configure(userConfig)` merges runtime configuration. It MAY
be called before OR after init.

```javascript
NDesign.configure({
  headers: { 'X-Client': 'my-app' },              // merged into default headers
  onRequest:  (url, options) => {},                // before every fetch
  onResponse: (url, response) => {},               // after every fetch
  onError:    (url, envelope, err) => {},          // on fetch/ws/sse failure
  onRender:   (element, data) => {},               // after a bind/sse/ws render
  timeout: 15000,                                  // default fetch timeout (ms)
  wsProtocols: ['ndesign.v1'],                     // WebSocket sub-protocols
  wsTokenProvider: () => localStorage.token,       // appends ?token=... to WS URL
});
```

| Key               | Type                                      | Default                            | Notes |
|-------------------|-------------------------------------------|------------------------------------|-------|
| `headers`         | `Record<string,string>`                   | `{ 'X-Requested-With': 'NDesign' }` | Merged, not replaced. |
| `onRequest`       | `(url, options) => void` \| `null`        | `null`                             | Mutating `options` affects the request. |
| `onResponse`      | `(url, response) => void` \| `null`       | `null`                             | Response has not been read yet. |
| `onError`         | `(url, envelope, err) => void` \| `null`  | *default toast handler*            | Fires for bind, action, SSE, and WS errors. |
| `onRender`        | `(el, data) => void` \| `null`            | `null`                             | Fires after bind / sse / ws renders. |
| `timeout`         | `number` (ms)                             | `15000`                            | Default fetch timeout; per-element `data-nd-timeout` overrides. |
| `wsProtocols`     | `string[]`                                | `[]`                               | Passed to `new WebSocket(url, protocols)` if non-empty. |
| `wsTokenProvider` | `() => string` \| `null`                  | `null`                             | If set, WS URLs get `?token=<value>` appended. |

`onError` takes THREE arguments — `(url, envelope, err)`. The
`envelope` is the unified error envelope (see
[Error envelope](#error-envelope)), always shaped
`{ errors: { error: "..." } }`. The `err` argument is the original
thrown `Error` for fetch/ws/sse failures and MAY be `null` when the
envelope was synthesised from a non-2xx response.

The default `onError` calls `NDesign.toast(message, 'error')` using
`envelope.errors.error`, `envelope.errors._form`, or the literal
`"Something went wrong"`. Apps opt out with
`NDesign.configure({ onError: null })` or replace it with a custom
handler.

To distinguish timeout from network failure inside a custom
`onError`: `err.name === 'AbortError'` is a timeout (from
`fetchWithTimeout()`); `err instanceof TypeError` is a
network/CORS/DNS failure (thrown directly by `fetch()`).

#### Default headers applied by `buildHeaders()`

Every fetch made by bind/action routes through
`buildHeaders(config.headers)`, which produces:

```javascript
{
  'Content-Type': 'application/json',
  'X-Requested-With': 'NDesign',
  // ...any user-configured headers
  'X-CSRF-Token': '<meta name="csrf-token" content>, if present',
}
```

`data-nd-bind` (GET) deletes `Content-Type` from the header set before
sending. `data-nd-upload` does NOT use `buildHeaders`; it sets only
`X-Requested-With` and `X-CSRF-Token` manually on the XHR (multipart
body requires the browser to set its own `Content-Type` with the
boundary).

### Store, meta tags, and ${var} interpolation

#### Meta conventions

At init, `initStoreFromMeta()` scans every `<meta name>` tag and
populates two maps:

- `<meta name="endpoint:NAME" content="URL">` → `endpoints` map.
- `<meta name="var:NAME" content="VALUE">` → `vars` map.

All content is stored as a string. Numeric coercion happens at
consumption time (e.g. when writing into a `type="number"` input or
inside `data-nd-set` arithmetic).

```html
<meta name="endpoint:api"  content="https://test.nitecon.org">
<meta name="endpoint:ws"   content="wss://test.nitecon.org">
<meta name="var:userId"    content="2">
<meta name="var:pageSize"  content="25">
```

#### `${var}` grammar

The token grammar is a single regex:

```
\$\{([a-zA-Z_][\w.\-]*)\}
```

Only the braced form is recognised. **There is no `$var`.** Dot paths
are permitted on the variable side (`${user.first_name}`). Endpoint
names MUST be flat — endpoint lookup ignores dots. Resolution order
for each token is:

1. `getVar(name)` — vars take precedence.
2. `endpoints.get(name)` — exact key match only.
3. Unknown token: substitutes the empty string and emits
   `console.warn('[ndesign] unresolved var: ${<name>}')` once per name
   per `resolveVars()` call.

If a var resolves to a non-primitive (e.g. the user object itself),
the substitution is `String(obj)`, which yields `[object Object]`.
Use dot paths for scalar fields: `${user.id}`, never `${user}`.

A `null` value substitutes the empty string. An `undefined` (missing)
value falls through to endpoint lookup.

#### Where `${var}` substitution applies

`resolveVars()` is invoked on the following attribute values:

- `data-nd-bind` — the URL.
- `data-nd-action` — the URL portion (after the method).
- `data-nd-upload` — the URL portion.
- `data-nd-sse` — the URL.
- `data-nd-ws` — the URL.
- `data-nd-sortable` — the URL portion of the optional `"METHOD URL"`.
- `data-nd-body` — the full JSON template, before `JSON.parse`.
- `data-nd-set` — only inside `${ref}` tokens in the RHS (see
  [data-nd-set](#data-nd-set--write-to-the-store)).

`${var}` substitution is NOT performed in:

- Element text nodes or other attributes.
- `data-nd-confirm` values (the message is used verbatim).
- `data-nd-params` values (they are appended as-is).
- Template bodies — templates use `{{field}}` (see
  [Templates and {{field}} interpolation](#templates-and-field-interpolation)).

#### Store API

The public store is exposed as `NDesign.store` plus several top-level
aliases. `NDesign.store.set` is a thin façade over the raw `vars`
Map — it does NOT fire `nd:var-change`. `NDesign.storeSet` (alias of
the module-level `setVar`) DOES fire `nd:var-change`. Agents that need
`data-nd-model` inputs to re-sync MUST use `NDesign.storeSet`.

| Call                                              | Path support | Fires `nd:var-change`? |
|---------------------------------------------------|--------------|------------------------|
| `NDesign.store.get('k')`                          | top-level    | n/a                    |
| `NDesign.store.set('k', v)`                       | top-level    | **no**                 |
| `NDesign.store.has/delete/clear`                  | top-level    | no                     |
| `NDesign.storeGet('a.b.c')`                       | dot-path     | n/a                    |
| `NDesign.storeSet('a.b.c', v)`                    | dot-path     | **yes**                |
| `NDesign.endpoint('api')`                         | flat         | n/a                    |
| `NDesign.resolveVars(str)`                        | n/a          | n/a                    |

`nd:var-change` is a `CustomEvent` dispatched on `document` with
`detail = { path, topKey, value }`. Application code SHOULD NOT listen
for it as a general reactivity primitive — it is scoped conceptually
to the `data-nd-model` subsystem.

### Templates and {{field}} interpolation

Templates are `<template>` elements referenced by `id`. Rendering
clones the template's content and walks all text nodes and attributes,
replacing `{{path}}` tokens.

#### Token grammar

```
\{\{(\s*[\w.]+\s*)\}\}
```

- The path is `\w.` only — no pipes, no filters, no defaults. **There
  is NO `{{field|default}}` syntax.**
- `getByPath(data, path)` resolves the value.
- Missing values yield the empty string in text nodes and
  `escapeHTML(undefined) === ''` in attribute values.
- Text-node substitutions use `textContent` — the browser handles
  escaping.
- Attribute substitutions use `escapeHTML()` before assignment.

Only the row object is visible inside a template render. `${var}`
store interpolation does NOT apply inside templates.

#### Conditional `data-nd-if`

An element inside a template carrying `data-nd-if="FIELD"` is REMOVED
when the named field is falsy.

```html
<template id="user-row">
  <tr>
    <td>{{name}}</td>
    <td data-nd-if="active">
      <span class="nd-badge nd-badge-success">Active</span>
    </td>
  </tr>
</template>
```

#### Programmatic API

| Function                                              | Purpose                                    |
|-------------------------------------------------------|--------------------------------------------|
| `NDesign.render(container, templateId, data, mode?)`  | Render an array or object into a container. |
| `NDesign.renderOne(tpl, data)`                        | Clone and interpolate a template for one item. |
| `NDesign.interpolate(text, data)`                     | Interpolate a standalone string.           |

`mode` defaults to `'replace'`. See
[Render mode](#render-mode-and-data-nd-max).

### data-nd-bind — fetch and render

`data-nd-bind` fetches JSON from a URL and renders it into the
element. It is the workhorse of the framework: scalar fields, template
rendering of arrays or objects, polling, params, append/prepend modes,
empty/loading placeholders, deferred fetching, store writes via
chained `data-nd-set`, select population, and a templateless callback
mode are all supported.

#### Attribute — `data-nd-bind="URL"`

The URL MAY contain `${var}` tokens. The fetch method is always `GET`.
The request uses `buildHeaders(config.headers)` minus `Content-Type`.

Two elements with identical resolved URLs in the same tick share a
single fetch (in-flight dedup via `pendingRequests`). Re-init clears
the in-flight cache.

#### Scalar field binding — `data-nd-field="PATH"`

When `data-nd-template` is absent and `data-nd-field` is present, the
bound element's `textContent` is set to
`String(getByPath(data, PATH))`, or `''` if null/undefined.

```html
<strong data-nd-bind="${api}/api/stats"
        data-nd-field="version"></strong>
```

#### Attribute write — `data-nd-attr="NAME"`

When combined with `data-nd-field`, the resolved value is written to
the named DOM attribute instead of `textContent`. A `null` /
`undefined` value REMOVES the attribute.

```html
<img data-nd-bind="${api}/api/users/${userId}"
     data-nd-field="avatar_url"
     data-nd-attr="src"
     alt="">
```

#### Template binding — `data-nd-template="ID"`

Renders via a `<template id="ID">`. When the response is an array, one
clone is produced per item; for an object, one clone total.
Interpolation uses `{{field}}`.

```html
<tbody id="user-table"
       data-nd-bind="${api}/api/users"
       data-nd-template="user-row">
  <template id="user-row">
    <tr>
      <td>{{id}}</td>
      <td>{{name}}</td>
      <td>{{email}}</td>
    </tr>
  </template>
</tbody>
```

#### Envelope unwrap — `data-nd-select="PATH"`

When the backend returns `{ data: [...], meta: {...} }`, set
`data-nd-select` to pull the array out before rendering. The empty-state
template (`data-nd-empty`) also honours this path.

```html
<tbody data-nd-bind="${api}/api/users/paginated"
       data-nd-select="data"
       data-nd-params="page=1&per_page=5"
       data-nd-template="u-row">
  <template id="u-row"><tr><td>{{name}}</td></tr></template>
  <template data-nd-loading>
    <tr><td><span class="nd-skeleton"></span></td></tr>
  </template>
  <template data-nd-empty>
    <tr><td>No users found.</td></tr>
  </template>
</tbody>
```

#### Render mode and `data-nd-max`

`data-nd-mode` controls how template renders are inserted:

| Mode       | Behaviour                                                    |
|------------|--------------------------------------------------------------|
| `replace`  | (default) Removes all non-`<template>` children, then appends. |
| `append`   | Appends after existing children.                              |
| `prepend`  | Inserts before the first non-template child.                  |

`data-nd-max="N"`: after each render, if there are more than N
rendered (non-template) children, drop the oldest until the count is
N. "Oldest" is:

- the first child when mode is `append` or `replace`;
- the LAST child when mode is `prepend` (since new items arrive at the top).

#### Loading, empty, and error templates

Three direct-descendant `<template>` markers cover the bound
element's lifecycle:

- `<template data-nd-loading>` — a clone is inserted into the
  container while the fetch is in flight, wrapped in an element with
  `data-nd-loading-active`. It is removed before the render. The
  container also carries `nd-loading` while the fetch is active.
- `<template data-nd-empty>` — fires only when the rendered data
  (after `data-nd-select`) is an array of length 0. All non-template
  children are removed first, then the empty clone is appended.
- `<template data-nd-error>` — when a bind fetch fails, the
  unified error envelope (see [Error envelope](#error-envelope)) is
  synthesised and the template's contents are cloned into the
  container, replacing all non-template children. `.nd-error` is also
  added to the container. If no error template is present,
  `config.onError(url, envelope, err)` is invoked instead (the
  default handler toasts the global message).

These templates are matched by attribute, not `id` — they MUST be
direct descendants of the bound element and MUST NOT be referenced by
`id`.

#### Polling — `data-nd-refresh="MS"`

When `data-nd-refresh` is a positive integer, a `setInterval` is set
up and the element refetches every MS milliseconds. A
`MutationObserver` tears down the interval if the element is removed
from the DOM.

```html
<h2 data-nd-bind="${api}/api/stats/live"
    data-nd-field="cpu_usage"
    data-nd-refresh="2000">—</h2>
```

#### Deferred fetch — `data-nd-defer`

A boolean attribute on a `data-nd-bind` element. When present,
`initBindings` adds an `nd:refresh` listener but skips the initial
fetch. The element fetches on the first externally dispatched
`nd:refresh`:

```html
<div id="user-details"
     data-nd-bind="${api}/api/users/${selectedId}"
     data-nd-template="user-tpl"
     data-nd-defer>
  <template id="user-tpl"><h2>{{name}}</h2></template>
</div>

<button data-nd-set="selectedId=1"
        data-nd-success="refresh:#user-details">Show user 1</button>
```

#### Triggers — `data-nd-bind-trigger` and `data-nd-bind-mode`

The delegated click handler processes `[data-nd-bind-trigger="SELECTOR"]`.
On click:

1. `preventDefault()`.
2. If the trigger has its own `data-nd-params`, that value is copied
   onto the target element. Otherwise, if the trigger is an `<a>` with
   an `href`, the query string of the href is copied onto
   `data-nd-params` of the target and `aria-current="page"` is managed
   across sibling triggers (pagination active state — the walker finds
   the nearest ancestor holding at least two triggers).
3. If the trigger has `data-nd-bind-mode`, it is copied to the
   target's `data-nd-mode` (used for "Load more" patterns).
4. `target.dispatchEvent(new CustomEvent('nd:refresh'))`.

```html
<tbody id="feed-list"
       data-nd-bind="${api}/api/feed"
       data-nd-params="offset=0&limit=10"
       data-nd-template="feed-item"
       data-nd-mode="append"
       data-nd-max="100">
  <template id="feed-item">
    <tr><td>{{id}}</td><td>{{title}}</td></tr>
  </template>
</tbody>

<button class="nd-btn-secondary"
        data-nd-bind-trigger="#feed-list"
        data-nd-params="offset=10&limit=10"
        data-nd-bind-mode="append">Load more</button>
```

#### Select population — `data-nd-options="VALUE:LABEL"`

A `<select>` carrying both `data-nd-bind` and `data-nd-options` turns
the fetched JSON array into `<option>` children. The attribute value
is a compact dot-path shorthand into each array item.

```html
<select data-nd-bind="${api}/api/training/runs"
        data-nd-options="id:name">
  <option value="">Choose a run…</option>
</select>
```

| Attribute form                  | Items are    | Behaviour                                      |
|---------------------------------|--------------|------------------------------------------------|
| `data-nd-options`               | primitives   | item is used as BOTH `value` and label text.   |
| `data-nd-options="name"`        | objects      | `value` and label both read from `item.name`.  |
| `data-nd-options="id:name"`     | objects      | `value` from `item.id`, label from `item.name`. |
| `data-nd-options=":name"` / `"id:"` | objects  | blank side mirrors the other.                  |

Rules:

- **Static `<option>` children are preserved across fetches.** A
  leading `<option value="">Choose…</option>` placeholder survives
  refetches.
- Runtime-generated options carry an internal `data-nd-generated`
  marker and are the only ones removed when the element refetches.
- **Envelope unwrap** via `data-nd-select` applies — the array is
  extracted from the envelope before option generation.
- If the `<select>` was upgraded by the custom-dropdown module
  (`js/select.js`), its visual wrapper is rebuilt automatically after
  options are populated, so the themed UI stays in sync with the
  native element.
- `config.onRender(el, data)` still fires after the options are in
  place.
- `data-nd-options` takes precedence over the templateless callback
  branch below.

#### Templateless binding (raw JSON callback)

When a `data-nd-bind` element has **no** `data-nd-template`, **no**
`data-nd-field`, and **no** `data-nd-options`, the fetched payload is
passed to `config.onRender(el, data)` as a pure fetch-and-callback
hook.

Text-content rules for this branch:

| Payload type   | Effect on `textContent`                |
|----------------|----------------------------------------|
| `string`       | Written to `textContent` as-is.        |
| Anything else  | `textContent` is NOT touched.          |

This lets `<span data-nd-bind="/api/version"></span>` still display
the version string intuitively, while object/array payloads stay out
of the DOM and flow only to `onRender`.

The recommended pattern pairs this with `data-nd-defer` so the
callback is registered before the fetch fires:

```html
<div id="run-list"
     data-nd-bind="${api}/api/training/runs"
     data-nd-defer hidden></div>
<script>
  NDesign.configure({
    onRender(el, data) {
      if (el.id === 'run-list') populateCustomUI(data);
    }
  });
  document.getElementById('run-list')
    .dispatchEvent(new CustomEvent('nd:refresh'));
</script>
```

For the common "fill a `<select>` from an API" case, prefer
`data-nd-options` over a custom `onRender` callback.

> Behaviour change in v0.3.0: prior releases wrote
> `JSON.stringify(data)` into `textContent` for non-string payloads
> on this branch, which could dump JSON blobs into hidden containers.
> The textless behaviour documented above is now the default.
> Templated binding, scalar binding, and attribute binding are
> unchanged.

#### Edge cases

- Two bound elements with identical URLs share an in-flight request.
- The polling observer is global and re-created on init.
- Re-init clears the in-flight request cache.
- `data-nd-set` on a bound element is applied after a successful
  render; the FULL response is passed, not the `data-nd-select`
  sub-field.

### data-nd-action — forms and button actions

`data-nd-action` submits data to a REST endpoint and maps the
response (success or validation errors) back into the UI. It works on
both `<form>` and non-form elements (buttons and links).

#### Attribute grammar

```
data-nd-action = METHOD ' ' URL
```

Examples: `"POST /api/users"`, `"DELETE ${api}/api/users/${userId}"`,
`"PATCH https://test.nitecon.org/api/users/42"`. If there is no space,
the method defaults to `POST`. The URL is `${var}`-resolved at submit
time.

#### Form vs button behaviour

| Behaviour                              | `<form data-nd-action>`               | `[data-nd-action]:not(form)` |
|----------------------------------------|----------------------------------------|------------------------------|
| Event intercepted                      | `submit`                               | `click`                      |
| Body sent                              | JSON-serialised form inputs            | None, or `data-nd-body`      |
| Field validation error display         | Yes (`.nd-error`, `.nd-form-error`)    | No                           |
| `data-nd-feedback` rendering           | Yes                                    | Yes                          |
| Disables while in flight               | Submit button                           | The clicked element           |
| `data-nd-success`                      | Yes                                    | Yes                          |
| `data-nd-set` after success            | Yes                                    | Yes                          |
| `data-nd-confirm` prompt               | Yes                                    | Yes                          |

#### Button body template — `data-nd-body`

Only valid on non-form `[data-nd-action]` elements. The attribute is a
JSON template string that is `${var}`-interpolated first, then
`JSON.parse`d. On a JSON parse failure, the message
`"data-nd-body: invalid JSON after interpolation"` is written to the
feedback element (if any), the action is aborted, and the element is
re-enabled. No fetch is performed.

```html
<button data-nd-action="POST ${api}/api/orders"
        data-nd-body='{"sku":"${sku}","qty":${qty}}'
        data-nd-feedback="order-msg">Place order</button>
```

**Forms MUST NOT use `data-nd-body`.** Their body is always the
JSON-serialised form. If both are present on a form, `data-nd-body`
is ignored.

#### Feedback element — `data-nd-feedback="ID"` and the auto-slot

Every failed action produces a visible global error message adjacent
to the triggering element. The runtime guarantees this via two
mechanisms.

**1. Declared feedback — `data-nd-feedback="ID"`.** If the attribute
is present, the element with that ID is used as the feedback slot:

- empty / hidden while the request is in flight (cleared up front);
- `nd-alert nd-alert-success` with `responseData.message || 'Success'`
  on 2xx;
- `nd-alert nd-alert-error` with the global message from the unified
  envelope on failure.

**2. Auto-feedback slot — `.nd-form-feedback-auto`.** When no
`data-nd-feedback` is declared, on the FIRST error the runtime
auto-creates a feedback element and inserts it adjacent to the
triggering control:

- **Forms**: the slot is inserted immediately BEFORE the submit
  button (or, if the submit button is nested inside wrappers like
  `<menu>` or `<div class="nd-card-footer">`, before its nearest
  ancestor that is a direct child of the `<form>`).
- **Buttons**: the slot is inserted as the next sibling AFTER the
  button.
- **Class**: `nd-alert nd-form-feedback-auto` plus `nd-alert-error` /
  `nd-alert-success` per message type.
  `aria-live="assertive"`, `aria-atomic="true"`. Initially hidden.
- **Reuse**: the element is cached on `form._ndAutoFeedbackEl` /
  `btn._ndAutoFeedbackEl` and reused across subsequent submits — never
  duplicated. `clearFormErrors(form)` (called at the start of each
  submit) clears and hides it.
- **Success**: the auto-slot is populated with the success message
  ONLY if it already exists from a prior error; it auto-hides after
  ~3 seconds. The runtime never auto-creates a slot purely to display
  a success message.

**Global message priority.** The message written into the feedback
slot is chosen in this order:

1. `envelope.errors.error` (canonical) or `envelope.errors._form`
   (legacy alias) — written verbatim.
2. If exactly ONE field error is present:
   `"Please correct the highlighted field: <LABEL>"`. `<LABEL>` is
   resolved by walking from the input (`[name="<field>"]`) to its
   matching `<label for="<input-id>">` and using that label's trimmed
   `textContent`. If no `<label for>` is found, `<LABEL>` falls back
   to the field's `name` attribute.
3. If TWO OR MORE field errors are present:
   `"Please correct the N highlighted fields below."`
4. Fallback: `"Submit failed. Please try again."`

Forms ALSO map field-level errors inline to `.nd-form-error` siblings.
Button actions only show the global message — there are no fields to
highlight.

**Expected label markup** for the single-field synthesised message:

```html
<div class="nd-form-group">
  <label for="user-email">Email address</label>
  <input type="email" id="user-email" name="email">
  <div class="nd-form-error"></div>
</div>
```

With this markup and a server response of
`{"errors":{"email":"already taken"}}`, the auto-feedback slot shows
`"Please correct the highlighted field: Email address"` and the
`.nd-form-error` sibling of the input shows `"already taken"`.

#### Confirmation — `data-nd-confirm`

`data-nd-confirm` has two forms, dispatched by the leading character:

1. **Plain text** — `data-nd-confirm="Delete user James Miller?"` →
   the runtime calls `window.confirm(TEXT)` synchronously. A falsy
   result aborts the action. This is the native browser dialog.
2. **Dialog selector** — `data-nd-confirm="#confirm-delete"` → the
   runtime calls `confirmDialog('#confirm-delete')` and awaits the
   promise. The action proceeds only if the user clicks a button with
   `[data-nd-confirm-accept]`; any dismiss path
   (`.nd-modal-close`, `[data-nd-dismiss]`, backdrop, Escape, native
   close) aborts.

Both forms work identically for `<form data-nd-action>` and
`[data-nd-action]:not(form)`.

```html
<!-- Native browser confirm -->
<button class="nd-btn-danger"
        data-nd-action="DELETE ${api}/api/users/3"
        data-nd-confirm="Delete user James Miller?">Delete</button>

<!-- Custom <dialog> confirm -->
<button class="nd-btn-danger"
        data-nd-action="DELETE ${api}/api/users/3"
        data-nd-confirm="#confirm-delete">Delete</button>

<dialog id="confirm-delete" class="nd-modal">
  <p>Delete this user? This cannot be undone.</p>
  <menu>
    <button type="button" data-nd-dismiss>Cancel</button>
    <button type="button" class="nd-btn-danger"
            data-nd-confirm-accept>Delete</button>
  </menu>
</dialog>
```

#### Success chain — `data-nd-success="action[,action]*"`

After a 2xx, the value is split on commas and each action is
processed in order.

| Action              | Valid on    | Behaviour                                                                       |
|---------------------|-------------|---------------------------------------------------------------------------------|
| `reset`             | forms only  | `form.reset()`.                                                                 |
| `reload`            | any         | `window.location.reload()`. Stops the chain.                                    |
| `redirect:URL`      | any         | `window.location.href = URL`. Stops the chain.                                  |
| `refresh:SELECTOR`  | any         | Dispatches `nd:refresh` on every matching element.                             |
| `emit:EVENT`        | any         | Dispatches a bubbling `CustomEvent(EVENT, {detail: responseData})` on the element. |
| `close-modal`       | any         | Closes the nearest ancestor `<dialog>` of the triggering element (no-op if none). |

Actions not in this list are silently ignored (no warning).
`close-modal` composes with the rest of the chain — for example
`"close-modal,refresh:#user-table"` closes the enclosing dialog then
refreshes a table outside it.

#### Form serialisation rules

Inputs are iterated via `form.elements`. For each named, enabled,
non-file, non-submit, non-button element:

| Input                        | Serialised as                                       |
|------------------------------|-----------------------------------------------------|
| `type="checkbox"`            | `boolean` (`el.checked`)                            |
| `type="radio"`               | the value of the selected radio; unchecked skipped  |
| `<select multiple>`          | `Array<string>` of selected `value`s                |
| `type="number"` / `"range"`  | `Number`, or `null` if empty                        |
| everything else              | `string`                                            |

Dot-notation names produce nested objects:
`name="address.city"` → `{ address: { city: ... } }`.

File inputs are skipped. Use `data-nd-upload` (see [Upload](#upload))
instead.

#### Per-element timeout — `data-nd-timeout="MS"`

Every form and button action is submitted via `fetchWithTimeout()`
with an `AbortController`. The timeout resolves to, in order:

1. The `data-nd-timeout` attribute on the element, parsed as an
   integer.
2. `config.timeout` (default `15000`).

When the timer fires, the fetch rejects with an `AbortError` and the
synthesised envelope carries `errors.error: "Request timed out"`.

```html
<!-- Force the timeout path for demo/testing purposes -->
<button data-nd-action="GET ${api}/api/stats"
        data-nd-timeout="50"
        class="nd-btn-primary">Force timeout</button>
```

A 50 ms timeout against any real endpoint reliably hits the
`AbortError` branch, which is the easiest way to exercise the timeout
envelope without taking the network down.

#### Escape hatch — `data-nd-on`

`data-nd-on="EVENT:HANDLER"` binds an event listener that looks up
`window[HANDLER]` and calls `HANDLER(event, element)`. If the handler
is not on `window`, a warning is logged. Use this only when a
declarative directive cannot express what you need.

### data-nd-set — write to the store

`data-nd-set` performs one or more store writes. Its value is a
comma-separated list of "ops", where commas inside single-quoted
string literals are NOT split points.

#### Grammar

```
ops        ::= op ( ',' op )*
op         ::= NAME                        (response form)
             | NAME '=' rhs                (explicit form)
NAME       ::= identifier ( '.' identifier )*
rhs        ::= literal | ref | ref OP NUMBER | '$response'
literal    ::= 'null' | 'true' | 'false' | NUMBER | STRING
ref        ::= '${' NAME '}'
OP         ::= '+' | '-' | '*' | '/'
NUMBER     ::= '-'? digits ( '.' digits )?
STRING     ::= "'" ( any-char | "\\'" | "\\\\" )* "'"
```

#### Semantics

- **Response form** (`NAME` alone) writes the full `responseData`
  under `NAME`. If `responseData` is `undefined` at the moment the
  directive runs, the op is a no-op and emits a warning.
- **Explicit form** parses the RHS as an AST:
  - `literal` writes the literal value.
  - `ref` reads the var and writes its current value to `NAME`.
  - `ref OP NUMBER` coerces the referenced var to `Number`; if `NaN`
    the op throws and logs. Division by zero throws.
  - `$response` writes the full response value (same effect as the
    response form, but useful when combined with other ops in a
    single attribute).
- Dot-path LHS writes use `setByPath` on the top-level object,
  creating intermediate objects as needed.

#### When it runs

| Element context                                          | When it runs                              | `responseData` |
|----------------------------------------------------------|-------------------------------------------|----------------|
| On a `data-nd-bind` element                              | After a successful fetch.                 | parsed JSON    |
| On a `form[data-nd-action]` element                      | After a successful submit (HTTP 2xx).     | parsed JSON (or `null`) |
| On a non-form `[data-nd-action]` (button/link)           | After a successful submit.                | parsed JSON (or `null`) |
| On a `form[data-nd-upload]` element                      | NOT invoked (upload does not process set). | —              |
| Standalone (no bind/action/upload/sortable)              | On click. Response form warns.             | `undefined`    |

#### Examples

```html
<!-- Pager: +/- buttons mutate ${page}. The bound list refreshes via
     nd:refresh emitted by data-nd-success. -->
<button data-nd-set="page=${page}+1"
        data-nd-success="refresh:#user-list">Next</button>
<button data-nd-set="page=${page}-1"
        data-nd-success="refresh:#user-list">Prev</button>

<!-- After creating a user, store the whole response under 'currentUser'
     and store its id specifically under 'lastUserId'. -->
<form data-nd-action="POST ${api}/api/users"
      data-nd-set="currentUser,lastUserId=${currentUser.id}">
  ...
</form>

<!-- Write a literal string. -->
<button data-nd-set="view='list'"
        data-nd-success="refresh:#view-container">List</button>
```

#### `data-nd-success` on standalone set elements

On standalone `data-nd-set` elements (click triggers),
`data-nd-success` is evaluated after the store writes but ONLY the
following action prefixes are supported:

- `refresh:SELECTOR` — dispatch `nd:refresh` on every matching
  element.
- `emit:EVENT` — dispatch a bubbling `CustomEvent('EVENT')` on the
  element.

`reset`, `reload`, `redirect:URL`, and `close-modal` are NOT supported
on set triggers.

### data-nd-model — two-way form binding

`data-nd-model="NAME"` on a form input creates a two-way binding
between the input and a store var. This is the only reactive
primitive in ndesign — store writes propagate back to the input, and
input changes propagate to the store.

Lifecycle:

1. On init, `initModel()` reads `getVar(name)` and writes it into the
   input. If no value exists AND the input has a non-empty
   `defaultValue`, the input's current value is written into the
   store so subsequent reads see it.
2. When the user types/clicks/selects, the input's value is coerced
   and written back via `setVar(name, coerced)`, then an `nd:model`
   `CustomEvent` is dispatched on the input with
   `detail = { name, value }`.
3. When ANY other code writes the same TOP-LEVEL key (via `setVar` /
   `NDesign.storeSet` / a `data-nd-set` directive), the input
   re-syncs. A re-entrance guard prevents the sync from triggering
   its own input event.

Coercions written back to the store:

| Input                        | Stored type                                  |
|------------------------------|----------------------------------------------|
| `type="checkbox"`            | `boolean` (`el.checked`)                     |
| `type="number"` / `"range"`  | `Number`, or `null` when empty               |
| `<select multiple>`          | `Array<string>` of selected option values    |
| Everything else              | `string` (`el.value`)                        |

Event wiring: `input` for most controls; `change` for checkboxes and
selects.

`data-nd-model` is the ONLY directive that reacts to store changes.
`data-nd-bind` elements do NOT refresh when the store changes — see
[Pitfalls](#pitfalls).

### data-nd-sse — server-sent events

`data-nd-sse="URL"` subscribes to an `EventSource` and renders each
incoming message into the element, either as a scalar field or via a
template.

#### Attribute

The URL is `${var}`-resolved. Elements sharing the same resolved URL
share a single `EventSource`. A new `EventSource` is created per
unique URL.

#### Event filtering — `data-nd-sse-event="TYPE"`

If set, the element only renders messages dispatched under that named
SSE event type (`event: TYPE` in the stream). If absent, the element
renders only the unnamed default `message` event.

The init code inspects every bound element, collects the union of
named types, and registers one listener per type plus (optionally) a
`message` listener.

#### Rendering

- `data-nd-template="ID"` + `data-nd-mode="append|prepend|replace"`
  renders each message via `render()`. **Default mode is `append`**
  (not `replace`). `data-nd-max` is honoured.
- `data-nd-field="PATH"` writes a scalar to `textContent`.
- Neither → `textContent = JSON.stringify(data)` or the raw string.

#### Reconnection and errors

`EventSource` handles reconnect natively. Each dispatch updates
`el.dataset.ndSseLastId` with the last observed event id. `error`
events are logged and routed through `config.onError(url, err)`.
There is no public `getLastEventId()` helper — read
`dataset.ndSseLastId` directly.

#### Example

```html
<tbody data-nd-sse="${api}/api/events"
       data-nd-sse-event="trade"
       data-nd-template="trade-row"
       data-nd-mode="prepend"
       data-nd-max="50">
  <template id="trade-row">
    <tr><td>{{ts}}</td><td>{{symbol}}</td><td>{{price}}</td></tr>
  </template>
</tbody>
```

### data-nd-ws — WebSockets

`data-nd-ws="URL"` opens a WebSocket and renders incoming JSON
messages into the element.

#### Attribute

The URL is `${var}`-resolved. `wss://` URLs are recommended for
authenticated traffic. Elements sharing a resolved URL share one
`WebSocket`.

Before connection, `config.wsProtocols` is passed as the protocol
list (if non-empty). If `config.wsTokenProvider` is a function, its
return value is appended as `token=<encoded>` to the URL's query
string.

#### Connection state classes

Every bound element is stamped with `nd-ws-disconnected` at init.
On `open`, `nd-ws-disconnected` is removed and `nd-ws-connected` is
added; on `close`, the reverse. Style these in CSS to show a status
indicator.

#### Reconnect with backoff

On `close` (non-intentional), a reconnect timer fires after
`retryDelay` ms. `retryDelay` starts at 1000, doubles on each attempt
(plus up to 500 ms of jitter), and caps at 30000. On `open`,
`retryDelay` is reset to 1000. `destroyWebSockets()` sets
`intentionalClose = true` to prevent reconnect.

#### Message filtering — `data-nd-ws-filter="FIELD:VALUE"`

Per-element filter. The filter field is a dot-path read via
`getByPath`. If `String(actualValue) !== filterValue`, the message is
skipped for that element. Messages that are not JSON are dropped with
a console warning.

#### Rendering

Same rules as SSE. Default mode is `append`.

#### Example

```html
<div id="ws-status"
     class="nd-badge"
     data-nd-ws="wss://test.nitecon.org/ws/feed"
     data-nd-field="type">connecting…</div>

<tbody data-nd-ws="wss://test.nitecon.org/ws/feed"
       data-nd-ws-filter="type:trade"
       data-nd-template="trade-row"
       data-nd-mode="prepend"
       data-nd-max="20">
  <template id="trade-row">
    <tr><td>{{symbol}}</td><td>{{price}}</td></tr>
  </template>
</tbody>
```

### Error envelope

Every action and bind error — regardless of source — is normalised
into a single envelope shape:

```json
{ "errors": { "error": "Human-readable global message", "field": "per-field message" } }
```

- `errors.error` is the canonical global-message key.
- `errors._form` is accepted as a legacy alias for `errors.error`;
  both are routed to the feedback slot. New backends SHOULD use
  `errors.error`.
- Any other key in `errors` is treated as a field-level error,
  matched against an input by `name=` (forms only).

#### Envelope sources

| Source                                              | Envelope                                                          |
|-----------------------------------------------------|-------------------------------------------------------------------|
| non-2xx response with a server `errors` object       | used verbatim as the envelope                                      |
| non-2xx response without an `errors` object          | `{errors:{error: responseData.message \|\| "Error: <statusText>"}}` |
| thrown fetch with `err.name === 'AbortError'`        | `{errors:{error:"Request timed out"}}`                             |
| thrown fetch with `err instanceof TypeError`         | `{errors:{error:"Couldn't reach server"}}`                         |
| any other thrown error                                | `{errors:{error: err.message \|\| "Unexpected error"}}`            |

The timeout vs. network distinction is load-bearing: both are
presented as a generic message to the user, but custom `onError`
handlers can tell them apart by re-reading `err.name` /
`err instanceof TypeError` from the third argument.

#### Routing

Form and button action errors flow through
`handleActionError(el, envelope, config, feedbackId, url, err)`:

1. Add `.nd-error` to the triggering element.
2. Forms: call `displayErrors()` to map field keys to
   `.nd-form-error` siblings and add `.nd-error` to matching inputs.
3. Write the synthesised global message (see
   [data-nd-action](#data-nd-action--forms-and-button-actions)) to the
   declared feedback element if any, OR to the auto-feedback slot if
   none.
4. Call `config.onError(url, envelope, err)` as a secondary signal.
   The default handler toasts the global message.

Bind errors flow through the same envelope shape but render either a
`<template data-nd-error>` (if present) or fall through to
`config.onError(url, envelope, err)`.

#### Upload errors

Uploads are a separate code path (XHR, not fetch) and do not yet use
the unified envelope:

- 2xx → feedback shows success message; `handleSuccess` chain runs.
- non-2xx with JSON `errors` → `displayErrors` maps fields.
- non-2xx otherwise → feedback shows server message or generic
  "Upload failed" text.
- XHR network error → feedback shows "Network error. Please try
  again."
- Aborted XHR (teardown) → feedback shows "Upload cancelled."

#### Recommended backend envelope shapes

Global-only error:

```json
{ "errors": { "error": "Payment declined" } }
```

Per-field errors only:

```json
{ "errors": { "email": "already taken", "role": "invalid" } }
```

Combined global + field errors:

```json
{ "errors": { "error": "Please correct the form.", "email": "already taken" } }
```

Legacy alias (still accepted):

```json
{ "errors": { "_form": "Payment declined" } }
```

Backends MUST set `Content-Type: application/json` on error
responses — the runtime only parses JSON when the header matches.

### Pitfalls

The data-binding model is small but sharp-edged. The following
mistakes are common enough that they each have a section below.

- **Store writes do NOT auto-refresh `data-nd-bind` elements.** Only
  `data-nd-model` inputs react to store changes, and only for the
  same TOP-LEVEL key. Pair every store mutation that should refresh
  a view with an explicit `data-nd-success="refresh:#id"` or a
  manual `dispatchEvent(new CustomEvent('nd:refresh'))`.
- **`${var}` does NOT interpolate inside element text nodes.** Store
  vars use `${var}` per attribute; templates use `{{field}}` per
  row. Writing `<p>Hello ${name}</p>` does nothing — the literal
  string remains in the DOM.
- **`data-nd-body` on a `<form>` is ignored.** Forms always
  serialise their inputs. If you need a JSON body that does not
  match the form's inputs, use a non-form action (`<button>` with
  `data-nd-action`) and `data-nd-body`.
- **There is no `$var` syntax — only `${var}`.** Bare `$name` is
  treated as literal text.
- **`data-nd-params` is NOT `${var}`-resolved.** Its value is
  appended to the URL as-is. For dynamic params, prefer a dedicated
  trigger element with `data-nd-bind-trigger` and
  `data-nd-params` constructed from the trigger's own attributes,
  or refresh the bound element after mutating `${page}` and keep
  the params static.
- **Do NOT listen to `nd:var-change` for general reactivity.** It
  fires every store write and is scoped conceptually to
  `data-nd-model`. Use `nd:refresh` for view refreshes and `nd:set`
  / custom `emit:` events for cross-component signalling.
- **`data-nd-set` is NOT processed on upload forms.** Upload success
  only processes `data-nd-success` and the feedback message.
- **`NDesign.init()` tears down everything.** It is safe but heavy.
  Prefer `MutationObserver`-driven re-wiring (sortable does this
  automatically) over a full re-init for incremental DOM additions.
- **`baseURL` does not exist.** Every element carries its own URL.
  DRY via `<meta name="endpoint:NAME">` and `${NAME}/...`.
- **Relative `/api/...` URLs only work for same-origin APIs.** Use
  the full URL or `${api}/...` for cross-origin.
- **A server-driven chained-confirm flow is NOT implemented.** A
  `next_confirm` field on the response will not open a second
  confirm. Compose multi-step confirms client-side with
  `data-nd-confirm="#dialog-id"` and
  `data-nd-success="close-modal,..."`.
- **Toast messages are HTML-escaped via `textContent`.** Embedded
  HTML in the message string will not render.

### Events fired by the runtime

The data-binding subsystem dispatches the following events.
Component-specific events (modal, sortable, etc.) live in their own
fragments and are also collected in [Reference](#reference).

| Event              | Target                | When                                                      | Detail                          |
|--------------------|-----------------------|-----------------------------------------------------------|---------------------------------|
| `nd:refresh`       | bound element          | External trigger (e.g. `refresh:#id`, bind trigger).       | none — consumer refetches       |
| `nd:var-change`    | `document`            | After `setVar()` / `NDesign.storeSet` (NOT `store.set`).   | `{path, topKey, value}`         |
| `nd:model`         | model input            | After user input updates the store.                       | `{name, value}`                 |
| `nd:set`           | set-trigger element    | After a standalone `data-nd-set` click runs.              | `{el}`                          |
| user-defined `emit:X` | action / set element | When a `data-nd-success="emit:X"` step runs.              | `responseData` (`undefined` for set) |

`nd:refresh` listeners SHOULD be the only thing application code
uses to re-trigger a `data-nd-bind` fetch. `nd:var-change` is an
internal-ish event for the model subsystem; do not build general
reactivity on top of it.
