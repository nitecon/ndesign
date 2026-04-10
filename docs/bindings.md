# Data Bindings

ndesign binds HTML elements to backend data using declarative `data-nd-*` attributes. No JavaScript required -- just HTML. Your backend serves JSON; ndesign renders it into the DOM, keeps it updated via WebSocket or SSE, and submits forms back as JSON.

Three principles:

1. **The backend is authoritative.** The frontend never stores state. It reflects what the server says.
2. **SSE and WebSocket are preferred** for real-time data. Polling exists as a fallback for backends that cannot support push.
3. **Write native HTML.** The `data-nd-*` attributes are the only thing you add. Templates use standard `<template>` elements.

---

## Setup

Include ndesign on any page served by your backend. No build step, no npm.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="stylesheet" href="/static/ndesign.css">
  <link rel="stylesheet" href="/static/themes/light.css" class="theme" title="light">
  <meta name="nd-theme" content="light" data-href="/static/themes/light.css">
  <meta name="nd-theme" content="dark" data-href="/static/themes/dark.css">
</head>
<body>
  <!-- your HTML with data-nd-* attributes -->

  <script src="/static/ndesign.min.js"></script>
</body>
</html>
```

ndesign auto-initializes on `DOMContentLoaded`. The script scans for every `data-nd-*` attribute and sets up bindings, connections, and event handlers.

---

## REST Binding -- `data-nd-bind`

Fetch JSON from a REST endpoint and render it into an element.

### Binding a single value

Display one field from an API response:

```html
<span data-nd-bind="/api/stats" data-nd-field="version"></span>
```

ndesign fetches `/api/stats`, parses the JSON, extracts the `version` field, and sets the element's text content.

The Go handler:

```go
type Stats struct {
    TotalUsers     int     `json:"total_users"`
    ActiveSessions int     `json:"active_sessions"`
    CPUUsage       float64 `json:"cpu_usage"`
    Uptime         string  `json:"uptime"`
    Version        string  `json:"version"`
}

func handleStats(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(Stats{
        TotalUsers:     12847,
        ActiveSessions: 567,
        CPUUsage:       42.3,
        Uptime:         "14d 6h 23m",
        Version:        "2.4.1",
    })
}
```

Multiple elements can bind to the same URL. ndesign deduplicates requests -- elements bound to the same endpoint within the same tick share a single `fetch` call.

```html
<p>Version: <strong data-nd-bind="/api/stats" data-nd-field="version"></strong></p>
<p>Uptime: <strong data-nd-bind="/api/stats" data-nd-field="uptime"></strong></p>
<p>CPU: <strong data-nd-bind="/api/stats" data-nd-field="cpu_usage"></strong>%</p>
```

### Targeting an attribute -- `data-nd-attr`

By default `data-nd-field` writes to the element's `textContent`. When combined with `data-nd-attr`, the extracted value is written to an HTML attribute instead. This makes it trivial to drive native elements like `<progress>`, `<img>`, or `<a>` directly from backend state.

```html
<progress data-nd-bind="/api/job/status"
          data-nd-field="percent"
          data-nd-attr="value"
          max="100"></progress>
```

Common use cases:

| Attribute | Example |
|-----------|---------|
| `value` | `<progress>`, `<meter>`, `<input>` bound to a backend value |
| `src` | `<img data-nd-bind="/api/user/me" data-nd-field="avatar_url" data-nd-attr="src">` |
| `href` | `<a data-nd-bind="/api/download" data-nd-field="url" data-nd-attr="href">Download</a>` |
| `disabled` | Enable or disable a control based on server state |

If the resolved field value is `null` or `undefined`, ndesign removes the attribute entirely rather than setting it to the string `"null"`.

### Query parameters -- `data-nd-params`

`data-nd-params` appends a query string to the bind URL before fetching. It can be set as an initial attribute, or updated dynamically at runtime (for example by a pagination link -- see below).

```html
<tbody data-nd-bind="/api/users/paginated"
       data-nd-params="page=1&per_page=25"
       data-nd-template="user-row"></tbody>
```

The above fetches `/api/users/paginated?page=1&per_page=25`. When the attribute changes and an `nd:refresh` event is dispatched on the element, the next fetch uses the new query string.

### Unwrapping envelope responses -- `data-nd-select`

Many REST backends wrap list responses in an envelope such as `{data: [...], meta: {...}}` so they can carry pagination metadata alongside the payload. `data-nd-select` tells ndesign to pluck a sub-field from the response (dot notation supported) before handing it to the template engine:

```html
<tbody data-nd-bind="/api/users/paginated"
       data-nd-select="data"
       data-nd-params="page=1&per_page=10"
       data-nd-template="user-row"></tbody>
```

With the Go handler responding:

```json
{
  "data": [
    {"id":1,"name":"Will","email":"will@example.com","role":"admin","active":true}
  ],
  "meta": {"page":1,"per_page":10,"total":42,"total_pages":5,"has_next":true,"has_prev":false}
}
```

ndesign extracts `data` and renders it via the template exactly as if the handler had returned a bare array. Empty-state detection (`<template data-nd-empty>`) also honours the selected sub-field.

### Pagination -- `data-nd-bind-trigger`

Pagination is wired up declaratively. Put `data-nd-bind-trigger="#target"` on a link (or any element), and ndesign will:

1. Copy the query string from the link's `href` into the target's `data-nd-params`
2. Maintain `aria-current="page"` across sibling links in the same nav
3. Dispatch `nd:refresh` on the target so it refetches with the new params

```html
<!-- Bound table with initial params -->
<tbody id="user-table"
       data-nd-bind="/api/users/paginated"
       data-nd-select="data"
       data-nd-params="page=1&per_page=5"
       data-nd-template="user-row">
  <template id="user-row">
    <tr>
      <td>{{name}}</td>
      <td>{{email}}</td>
      <td>{{role}}</td>
    </tr>
  </template>
</tbody>

<!-- Pagination that refetches the table -->
<nav class="nd-pagination" aria-label="Pagination">
  <ul>
    <li><a href="?page=1&per_page=5" data-nd-bind-trigger="#user-table" aria-current="page">1</a></li>
    <li><a href="?page=2&per_page=5" data-nd-bind-trigger="#user-table">2</a></li>
    <li><a href="?page=3&per_page=5" data-nd-bind-trigger="#user-table">3</a></li>
  </ul>
</nav>
```

The trigger pattern works with any bound element -- lists, grids, cards, or scalar-bound elements. You do not need any JavaScript: the framework handles preventDefault, param propagation, and the refresh dispatch in a single delegated click handler.

### Load More (append mode)

The same trigger mechanism drives "Load More" buttons. Instead of pulling params from an `href`, the button supplies its own `data-nd-params`, and optionally overrides the render mode via `data-nd-bind-mode="append"`:

```html
<tbody id="feed"
       data-nd-bind="/api/feed"
       data-nd-params="offset=0&limit=20"
       data-nd-template="feed-row"
       data-nd-mode="append"></tbody>

<button data-nd-bind-trigger="#feed"
        data-nd-params="offset=20&limit=20"
        data-nd-bind-mode="append">Load More</button>
```

When clicked, the button sets `data-nd-params="offset=20&limit=20"` on `#feed`, ensures `data-nd-mode="append"`, and fires `nd:refresh`. The new rows are appended to the existing feed rather than replacing it. Increment the offset server-side (or in a click handler) on each subsequent click for true infinite scroll.

> **Server-driven "end of list"**: the framework does not know when the server has run out of rows — only the server knows. To hide the Load More button when no more pages remain, drive it from the `meta` envelope that your endpoint returns (e.g., `{"data": [...], "meta": {"has_next": false}}`) and hook `NDesign.configure({ onRender })`:
>
> ```js
> NDesign.configure({
>   onRender(el, json) {
>     if (el.id === 'feed' && json?.meta?.has_next === false) {
>       document.querySelector('[data-nd-bind-trigger="#feed"]')?.setAttribute('hidden', '');
>     }
>   }
> });
> ```
>
> Alternately, return an empty array and let the button sit disabled — but the `onRender` approach keeps all state decisions on the server.

### Loading skeletons -- `<template data-nd-loading>`

A child `<template data-nd-loading>` inside a bound container is shown while a fetch is in flight, then automatically replaced with real data. This pairs well with the built-in `nd-skeleton` utilities:

```html
<tbody data-nd-bind="/api/users" data-nd-template="user-row">
  <template data-nd-loading>
    <tr>
      <td colspan="3"><div class="nd-skeleton nd-skeleton-text"></div></td>
    </tr>
    <tr>
      <td colspan="3"><div class="nd-skeleton nd-skeleton-text"></div></td>
    </tr>
  </template>
  <template id="user-row">
    <tr><td>{{name}}</td><td>{{email}}</td><td>{{role}}</td></tr>
  </template>
</tbody>
```

While `/api/users` is fetching, ndesign clones the loading template into the container. Once the response arrives (or an error occurs), the placeholder is removed and the real template (or `.nd-error` class) takes over.

### Binding a list with templates

Render an array of objects using a `<template>` element:

```html
<table>
  <thead>
    <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
  </thead>
  <tbody data-nd-bind="/api/users" data-nd-template="user-row">
    <template id="user-row">
      <tr>
        <td>{{name}}</td>
        <td>{{email}}</td>
        <td><span class="nd-badge nd-badge-primary">{{role}}</span></td>
        <td data-nd-if="active"><span class="nd-badge nd-badge-success">Active</span></td>
      </tr>
    </template>
  </tbody>
</table>
```

The Go handler returns an array:

```go
type User struct {
    ID     int    `json:"id"`
    Name   string `json:"name"`
    Email  string `json:"email"`
    Role   string `json:"role"`
    Active bool   `json:"active"`
}

func handleListUsers(w http.ResponseWriter, r *http.Request) {
    users := []User{
        {ID: 1, Name: "Will Hattingh", Email: "will@example.com", Role: "admin", Active: true},
        {ID: 2, Name: "Sarah Kim", Email: "sarah@example.com", Role: "editor", Active: true},
        {ID: 3, Name: "James Miller", Email: "james@example.com", Role: "viewer", Active: false},
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(users)
}
```

ndesign clones the template once per array item, interpolates the `{{field}}` placeholders, and appends the results to the container. A single object (non-array) clones the template once.

### Template syntax

| Syntax | Behavior |
|--------|----------|
| `{{field}}` | Simple field interpolation |
| `{{user.address.city}}` | Dot-notation for nested objects |
| `data-nd-if="active"` | Conditional rendering -- element is removed if the field is falsy |

Values in text nodes are safe by default (set via `textContent`, so HTML entities render literally). Values in attributes are HTML-escaped to prevent XSS.

### Loading and error states

While fetching, ndesign adds `.nd-loading` to the bound element. On failure, it adds `.nd-error`. You can style these for loading skeletons or error indicators:

```css
[data-nd-bind].nd-loading { opacity: 0.5; }
[data-nd-bind].nd-error   { border: 1px solid var(--nd-danger); }
```

---

## WebSocket -- `data-nd-ws`

### Why WebSocket over polling

The server pushes data the instant it changes. No wasted requests, no polling intervals, no stale data. A single persistent connection replaces hundreds of periodic fetches.

### Connecting to a feed

```html
<table>
  <thead>
    <tr><th>Time</th><th>Symbol</th><th>Price</th><th>Volume</th></tr>
  </thead>
  <tbody data-nd-ws="ws://localhost:28080/ws/feed"
         data-nd-template="trade-row"
         data-nd-mode="prepend"
         data-nd-max="20">
    <template id="trade-row">
      <tr>
        <td>{{time}}</td>
        <td><strong>{{symbol}}</strong></td>
        <td>{{price}}</td>
        <td>{{volume}}</td>
      </tr>
    </template>
  </tbody>
</table>
```

The Go WebSocket handler (using `gorilla/websocket`):

```go
import "github.com/gorilla/websocket"

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
}

func handleWSFeed(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("upgrade error: %v", err)
        return
    }
    defer conn.Close()

    // Drain reads so the connection detects client disconnect.
    go func() {
        for {
            if _, _, err := conn.ReadMessage(); err != nil {
                break
            }
        }
    }()

    ticker := time.NewTicker(2 * time.Second)
    defer ticker.Stop()

    symbols := []string{"BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD"}

    for range ticker.C {
        sym := symbols[rand.Intn(len(symbols))]
        msg := map[string]interface{}{
            "time":   time.Now().Format("15:04:05"),
            "symbol": sym,
            "price":  67234.50 + (rand.Float64()-0.5)*1344.69,
            "volume": 0.1 + rand.Float64()*20.0,
        }
        if err := conn.WriteJSON(msg); err != nil {
            return // client disconnected
        }
    }
}
```

Every JSON message the server sends is parsed, run through the template, and inserted into the container.

### Render modes

| Attribute | Behavior |
|-----------|----------|
| `data-nd-mode="replace"` | Clear the container and render fresh (default for REST bindings) |
| `data-nd-mode="append"` | Add new items to the end (default for WebSocket and SSE) |
| `data-nd-mode="prepend"` | Add new items to the beginning (newest first) |
| `data-nd-max="50"` | Cap items in the container; oldest items are removed when the limit is exceeded |

When using `prepend` with `data-nd-max`, the oldest items (at the bottom) are removed. When using `append` with `data-nd-max`, the oldest items (at the top) are removed.

### Shared connections

Multiple elements can bind to the same WebSocket URL. They share a single socket connection. Each incoming message is delivered to every bound element:

```html
<!-- Both of these share one WebSocket connection -->
<span data-nd-ws="ws://localhost:28080/ws/feed" data-nd-field="type">--</span>

<tbody data-nd-ws="ws://localhost:28080/ws/feed"
       data-nd-template="trade-row"
       data-nd-mode="prepend"
       data-nd-max="20">
  ...
</tbody>
```

### Connection status

ndesign adds CSS classes to bound elements reflecting the connection state:

| Class | Meaning |
|-------|---------|
| `.nd-ws-connected` | Socket is open and receiving |
| `.nd-ws-disconnected` | Socket is closed or connecting |

Use these to show connection indicators:

```css
.nd-ws-connected    { /* green dot */ }
.nd-ws-disconnected { /* red dot, or show a reconnecting banner */ }
```

If the connection drops, ndesign reconnects automatically with exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s. When the connection re-establishes, the backoff resets.

### Backend push pattern

Your Go backend pushes data by writing JSON to the connection:

```go
// Push a single message
conn.WriteJSON(map[string]interface{}{
    "type":    "alert",
    "level":   "warning",
    "message": "Memory usage above 80%",
    "service": "gateway",
})
```

For broadcasting to all connected clients, maintain a set of connections and iterate:

```go
var (
    mu    sync.Mutex
    conns = make(map[*websocket.Conn]struct{})
)

func broadcast(v interface{}) {
    data, _ := json.Marshal(v)
    mu.Lock()
    defer mu.Unlock()
    for c := range conns {
        if err := c.WriteMessage(websocket.TextMessage, data); err != nil {
            c.Close()
            delete(conns, c)
        }
    }
}
```

### Authentication

WebSocket connections cannot carry `Authorization` headers from the browser, so ndesign supports two patterns for auth. Pick based on how your infrastructure routes WebSocket traffic.

**Sub-protocol auth (preferred).** The browser sends the configured strings in the `Sec-WebSocket-Protocol` handshake header. This is the cleanest option when your server (or at least your WebSocket gateway) can inspect the handshake:

```js
NDesign.configure({
  wsProtocols: ['ndesign.v1', 'jwt.' + localStorage.getItem('auth_token')]
});
```

On the Go side, the upgrader echoes one of the offered protocols back:

```go
var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
    Subprotocols: []string{"ndesign.v1"},
}

func handleWSFeed(w http.ResponseWriter, r *http.Request) {
    // Sub-protocol token: "jwt.<value>"
    for _, p := range websocket.Subprotocols(r) {
        if strings.HasPrefix(p, "jwt.") {
            if !validateJWT(strings.TrimPrefix(p, "jwt.")) {
                http.Error(w, "unauthorized", http.StatusUnauthorized)
                return
            }
            break
        }
    }
    conn, err := upgrader.Upgrade(w, r, nil)
    // ...
}
```

**Query-parameter auth.** Some load balancers (notably older AWS ALB configurations and certain nginx setups) strip sub-protocols before forwarding. In that case, use `wsTokenProvider` -- a function that returns a token string, which ndesign appends to every WebSocket URL as `?token=<value>`:

```js
NDesign.configure({
  wsTokenProvider: () => localStorage.getItem('auth_token')
});
```

The provider is called fresh on every connect (and every reconnect), so rotating tokens just work. The Go handler reads the token from the query string:

```go
func handleWSFeed(w http.ResponseWriter, r *http.Request) {
    token := r.URL.Query().Get("token")
    if !validateJWT(token) {
        http.Error(w, "unauthorized", http.StatusUnauthorized)
        return
    }
    conn, err := upgrader.Upgrade(w, r, nil)
    // ...
}
```

If both `wsProtocols` and `wsTokenProvider` are configured, both are used: the protocols go in the handshake header and the token is appended to the URL. Handlers that support both patterns can prefer the sub-protocol and fall back to the query param.

---

## Server-Sent Events -- `data-nd-sse`

### When to use SSE vs WebSocket

| | SSE | WebSocket |
|-|-----|-----------|
| Direction | Server to client only | Bidirectional |
| Protocol | HTTP (works over HTTP/2) | Upgrade from HTTP |
| Reconnect | Built into the browser | Handled by ndesign |
| Complexity | Simpler server implementation | More setup |

Rule of thumb: if the client only listens, use SSE. If the client needs to send data back over the same connection, use WebSocket.

### Subscribing to events

```html
<div data-nd-sse="/events/stream"
     data-nd-sse-event="deployment"
     data-nd-template="deploy-event"
     data-nd-mode="prepend"
     data-nd-max="10">
  <template id="deploy-event">
    <div class="nd-alert nd-alert-info">
      Deploy <strong>{{version}}</strong> to <strong>{{environment}}</strong>: {{status}}
    </div>
  </template>
</div>
```

### Event filtering

`data-nd-sse-event="deployment"` tells ndesign to only process events with `event: deployment` in the SSE stream. Without this attribute, ndesign listens for the default `message` event.

This lets a single SSE endpoint emit multiple event types, and each HTML element subscribes to only the type it cares about:

```html
<!-- Only deployment events -->
<div data-nd-sse="/events/stream" data-nd-sse-event="deployment" data-nd-template="deploy-event">
  ...
</div>

<!-- Only metric events -->
<h3 data-nd-sse="/events/stream" data-nd-sse-event="metric" data-nd-field="cpu">--</h3>
```

### Go SSE handler

```go
func handleSSEStream(w http.ResponseWriter, r *http.Request) {
    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "Streaming not supported", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    flusher.Flush()

    ctx := r.Context()
    ticker := time.NewTicker(3 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            data := map[string]interface{}{
                "version":     "2.4.2",
                "environment": "production",
                "status":      "complete",
                "timestamp":   time.Now().UTC().Format(time.RFC3339),
            }
            jsonData, _ := json.Marshal(data)
            fmt.Fprintf(w, "event: deployment\ndata: %s\n\n", jsonData)
            flusher.Flush()
        }
    }
}
```

The SSE protocol format is:

```
event: deployment
data: {"version":"2.4.2","environment":"production","status":"complete"}

```

Each message ends with a blank line (`\n\n`). The `event:` line is the named event type that `data-nd-sse-event` filters on. The `data:` line contains the JSON payload.

The browser's `EventSource` handles reconnection natively. If the connection drops, it reconnects automatically without any intervention from ndesign.

### Resumable streams -- `Last-Event-ID`

The SSE protocol includes a resumption mechanism: if the server emits an `id:` line with each event, the browser remembers the last id it saw. On reconnect, it automatically sends a `Last-Event-ID: <value>` header, and the server can replay any events the client missed.

ndesign does not need to do anything special for this to work -- native `EventSource` handles the round-trip -- but it does expose the most recently observed id for debugging and manual resume scenarios:

```js
const lastId = NDesign.getLastEventId('/events/stream');
console.log('last SSE id seen:', lastId);
```

The latest id is also written to the bound element's dataset as `data-nd-sse-last-id` on every event, so you can inspect it from DevTools without any code.

The Go handler simply prepends an `id:` line to each event:

```go
id := 0
for {
    select {
    case <-r.Context().Done():
        return
    case <-ticker.C:
        id++
        data, _ := json.Marshal(map[string]interface{}{
            "version": "2.4.2", "environment": "production", "status": "complete",
        })
        // id: <n> lets native EventSource resume via Last-Event-ID on reconnect.
        fmt.Fprintf(w, "id: %d\nevent: deployment\ndata: %s\n\n", id, data)
        flusher.Flush()
    }
}
```

On reconnect the handler can read `r.Header.Get("Last-Event-ID")` and replay anything newer than that id.

---

## Form Actions -- `data-nd-action`

### Submitting a form

```html
<form data-nd-action="POST /api/users"
      data-nd-success="reset"
      data-nd-feedback="user-feedback">
  <div class="nd-form-group">
    <label for="name">Name</label>
    <input type="text" id="name" name="name" placeholder="Full name" required>
    <span class="nd-form-error"></span>
  </div>
  <div class="nd-form-group">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" placeholder="user@example.com" required>
    <span class="nd-form-error"></span>
  </div>
  <div class="nd-form-group">
    <label for="role">Role</label>
    <select id="role" name="role">
      <option value="">Select role...</option>
      <option value="admin">Administrator</option>
      <option value="editor">Editor</option>
      <option value="viewer">Viewer</option>
    </select>
    <span class="nd-form-error"></span>
  </div>
  <div id="user-feedback"></div>
  <button type="submit" class="nd-btn-primary">Create User</button>
</form>
```

The `data-nd-action` attribute format is `METHOD /path`. If no method is specified, it defaults to `POST`.

ndesign intercepts the form's `submit` event, serializes all named inputs to JSON, and sends the request via `fetch`. The submit button is disabled and gets `.nd-loading` during the request.

### How form serialization works

All named inputs are collected into a JSON object:

| Input type | Serialization |
|------------|---------------|
| Text, email, password, textarea | String value |
| `name="address.city"` | Nested object: `{"address":{"city":"..."}}` |
| Checkbox | `true` / `false` |
| Radio | Selected value (string) |
| Multi-select | Array of selected values |
| Number, range | Number (not string). Empty value becomes `null` |
| File, submit, button | Skipped |

Dot-notation names create nested JSON structures automatically:

```html
<input name="address.street" value="123 Main St">
<input name="address.city" value="Portland">
```

Serializes to:

```json
{"address": {"street": "123 Main St", "city": "Portland"}}
```

### Server validation errors

When the server returns a non-2xx response with an `errors` object, ndesign maps each key to the matching `name` attribute on form inputs:

```json
{
  "errors": {
    "name": "Name must be at least 2 characters",
    "email": "Invalid email address",
    "role": "Role must be one of: admin, editor, viewer"
  }
}
```

Each matched input gets the `.nd-error` class, and the error message is displayed in the nearest `.nd-form-error` element within the same `.nd-form-group`.

For errors that do not map to a specific field, use the `_form` key. This displays in the element identified by `data-nd-feedback`:

```json
{
  "errors": {
    "_form": "Invalid username or password"
  }
}
```

The feedback element receives the `.nd-alert .nd-alert-error` classes and becomes visible.

The Go validation handler:

```go
type ValidationErrors struct {
    Errors map[string]string `json:"errors"`
}

func handleCreateUser(w http.ResponseWriter, r *http.Request) {
    var body struct {
        Name  string `json:"name"`
        Email string `json:"email"`
        Role  string `json:"role"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(http.StatusBadRequest)
        json.NewEncoder(w).Encode(ValidationErrors{
            Errors: map[string]string{"_form": "Invalid JSON body"},
        })
        return
    }

    errs := make(map[string]string)
    if len(strings.TrimSpace(body.Name)) < 2 {
        errs["name"] = "Name must be at least 2 characters"
    }
    if !strings.Contains(body.Email, "@") {
        errs["email"] = "Invalid email address"
    }
    if body.Role != "admin" && body.Role != "editor" && body.Role != "viewer" {
        errs["role"] = "Role must be one of: admin, editor, viewer"
    }
    if len(errs) > 0 {
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(http.StatusBadRequest)
        json.NewEncoder(w).Encode(ValidationErrors{Errors: errs})
        return
    }

    // Create the user...
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]string{
        "message": "User created successfully",
    })
}
```

On success (2xx), the feedback element receives `.nd-alert .nd-alert-success` and shows the server's `message` field (or "Success" if none is provided).

### Success behaviors -- `data-nd-success`

| Value | Behavior |
|-------|----------|
| `reset` | Clear the form (calls `form.reset()`) |
| `redirect:/path` | Navigate to the given path (lets `Set-Cookie` headers take hold) |
| `reload` | Reload the current page |
| `refresh:#selector` | Re-fetch data on bound elements matching the selector |
| `emit:event-name` | Dispatch a custom DOM event (bubbles, with `detail` set to the response data) |

```html
<!-- Login: server sets cookie, then redirect to dashboard -->
<form data-nd-action="POST /api/login" data-nd-success="redirect:/dashboard" data-nd-feedback="login-feedback">

<!-- Create user: refresh the user table after success -->
<form data-nd-action="POST /api/users" data-nd-success="refresh:#user-table" data-nd-feedback="feedback">

<!-- Reset the form after successful creation -->
<form data-nd-action="POST /api/users" data-nd-success="reset">

<!-- Emit a custom event for other bindings to react to -->
<form data-nd-action="POST /api/users" data-nd-success="emit:user-created">
```

**Login pattern:** The server returns 200 with a `Set-Cookie` header. The browser stores the cookie before `redirect:` fires, so the next page load is already authenticated. This is the recommended pattern for cookie-based auth.

```go
// Go handler
func loginHandler(w http.ResponseWriter, r *http.Request) {
    // ... validate credentials ...
    http.SetCookie(w, &http.Cookie{
        Name:     "session",
        Value:    sessionToken,
        Path:     "/",
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteLaxMode,
    })
    json.NewEncoder(w).Encode(map[string]string{"message": "Login successful"})
}
```

### Button actions (non-form)

Any element with `data-nd-action` that is not a `<form>` is treated as a button action. It fires on `click` instead of `submit`, and sends no request body:

```html
<button data-nd-action="DELETE /api/users/42"
        data-nd-confirm="Delete user James Miller?"
        class="nd-btn-danger">
  Delete User
</button>
```

### Confirmation dialogs -- `data-nd-confirm`

Add `data-nd-confirm="message"` to any element with `data-nd-action`. ndesign calls the native `window.confirm()` before firing the request. If the user cancels, nothing happens.

Works on both forms and buttons:

```html
<form data-nd-action="POST /api/dangerous" data-nd-confirm="This cannot be undone. Continue?">
<button data-nd-action="DELETE /api/users/42" data-nd-confirm="Are you sure?">
```

### Custom event binding -- `data-nd-on`

For edge cases where you need custom JavaScript behavior, use `data-nd-on`:

```html
<button data-nd-on="click:handleExport">Export CSV</button>

<script>
function handleExport(event, element) {
    // Your custom logic
    window.location.href = '/api/export.csv';
}
</script>
```

The format is `event:functionName`. The function must exist on `window` and receives the DOM event and the element as arguments.

---

## Polling (Fallback) -- `data-nd-refresh`

**SSE or WebSocket should always be preferred.** Polling is provided as a fallback for backends that cannot support push -- simple Python/PHP servers, or backends behind a reverse proxy that strips SSE connections.

Add `data-nd-refresh` to any `data-nd-bind` element with an interval in milliseconds:

```html
<h2 data-nd-bind="/api/stats/live"
    data-nd-field="cpu_usage"
    data-nd-refresh="2000"></h2>
```

This fetches `/api/stats/live` every 2 seconds and updates the element's text content with the `cpu_usage` field.

Request deduplication applies here too. Multiple elements bound to the same URL with different `data-nd-field` values share a single fetch per interval tick.

---

## Configuration

Call `NDesign.configure()` before the script initializes (or at any time to update settings):

```html
<script src="/static/ndesign.min.js"></script>
<script>
NDesign.configure({
    baseURL: '/api',
    headers: {
        'X-API-Key': 'abc123',
        'Authorization': 'Bearer eyJ...',
    },
    onRequest: function(url, opts) {
        console.log('Requesting:', url);
    },
    onResponse: function(url, response) {
        if (response.status === 401) {
            window.location.href = '/login';
        }
    },
    onError: function(url, err) {
        console.error('Failed:', url, err);
    },
    onRender: function(el, data) {
        // Called after every template render
    },
    wsProtocols: [],
});
</script>
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseURL` | `string` | `""` | Prefix for all relative URLs in `data-nd-bind`, `data-nd-sse`, and `data-nd-action` |
| `headers` | `object` | `{'X-Requested-With': 'NDesign'}` | Extra headers sent with every `fetch` request (merged, not replaced) |
| `onRequest` | `function` | `null` | Called before every fetch with `(url, fetchOptions)` |
| `onResponse` | `function` | `null` | Called after every fetch with `(url, response)` |
| `onError` | `function` | `null` | Called on fetch/WS/SSE errors with `(url, error)` |
| `onRender` | `function` | `null` | Called after every template render with `(element, data)` |
| `wsProtocols` | `string[]` | `[]` | WebSocket sub-protocols passed to `new WebSocket(url, protocols)` -- use for handshake-based auth |
| `wsTokenProvider` | `function` | `null` | Called on every WebSocket connect; its return value is appended as `?token=<value>`. Use when load balancers strip sub-protocols. |

CSRF tokens are handled automatically. If your page includes `<meta name="csrf-token" content="...">`, ndesign adds an `X-CSRF-Token` header to every request.

---

## Complete Example: User Management Page

A realistic page combining REST binding, SSE, WebSocket, form actions, and button actions.

### HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>User Management</title>
  <link rel="stylesheet" href="/static/ndesign.css">
  <link rel="stylesheet" href="/static/themes/light.css" class="theme" title="light">
  <meta name="nd-theme" content="light" data-href="/static/themes/light.css">
  <meta name="nd-theme" content="dark" data-href="/static/themes/dark.css">
</head>
<body class="app-page">

  <nav>
    <span class="nd-nav-brand">Admin</span>
    <div class="nd-nav-end">
      <button class="nd-btn-secondary" data-nd-theme-toggle>Toggle Theme</button>
    </div>
  </nav>

  <main class="nd-p-lg">

    <!-- ── Stats via SSE ────────────────────────────────────── -->
    <div class="nd-row nd-mb-lg">
      <div class="nd-col-4">
        <div class="nd-card">
          <div class="nd-card-body">
            <p class="nd-text-secondary">CPU</p>
            <h2 data-nd-sse="/events/stream"
                data-nd-sse-event="metric"
                data-nd-field="cpu">--</h2>
          </div>
        </div>
      </div>
      <div class="nd-col-4">
        <div class="nd-card">
          <div class="nd-card-body">
            <p class="nd-text-secondary">Memory</p>
            <h2 data-nd-sse="/events/stream"
                data-nd-sse-event="metric"
                data-nd-field="memory">--</h2>
          </div>
        </div>
      </div>
      <div class="nd-col-4">
        <div class="nd-card">
          <div class="nd-card-body">
            <p class="nd-text-secondary">Disk</p>
            <h2 data-nd-sse="/events/stream"
                data-nd-sse-event="metric"
                data-nd-field="disk">--</h2>
          </div>
        </div>
      </div>
    </div>

    <div class="nd-row nd-mb-lg">

      <!-- ── User table via REST ────────────────────────────── -->
      <div class="nd-col-8">
        <div class="nd-card">
          <div class="nd-card-header">Users</div>
          <div class="nd-card-body">
            <div class="nd-table-responsive">
              <table class="nd-table-striped nd-table-hover">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody data-nd-bind="/api/users" data-nd-template="user-row">
                  <template id="user-row">
                    <tr>
                      <td>{{name}}</td>
                      <td>{{email}}</td>
                      <td><span class="nd-badge nd-badge-primary">{{role}}</span></td>
                      <td data-nd-if="active">
                        <span class="nd-badge nd-badge-success">Active</span>
                      </td>
                      <td>
                        <button data-nd-action="DELETE /api/users/{{id}}"
                                data-nd-confirm="Delete {{name}}?"
                                data-nd-success="reload"
                                class="nd-btn-danger nd-btn-sm">Delete</button>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Create user form ───────────────────────────────── -->
      <div class="nd-col-4">
        <div class="nd-card">
          <div class="nd-card-header">Create User</div>
          <div class="nd-card-body">
            <form data-nd-action="POST /api/users"
                  data-nd-success="reset"
                  data-nd-feedback="create-feedback">
              <div class="nd-form-group">
                <label for="name">Name</label>
                <input type="text" id="name" name="name" required>
                <span class="nd-form-error"></span>
              </div>
              <div class="nd-form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required>
                <span class="nd-form-error"></span>
              </div>
              <div class="nd-form-group">
                <label for="role">Role</label>
                <select id="role" name="role">
                  <option value="">Select role...</option>
                  <option value="admin">Administrator</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <span class="nd-form-error"></span>
              </div>
              <div id="create-feedback"></div>
              <button type="submit" class="nd-btn-primary">Create User</button>
            </form>
          </div>
        </div>
      </div>

    </div>

    <!-- ── Notification feed via WebSocket ───────────────────── -->
    <div class="nd-row">
      <div class="nd-col-12">
        <div class="nd-card">
          <div class="nd-card-header">Live Feed</div>
          <div class="nd-card-body"
               data-nd-ws="ws://localhost:28080/ws/feed"
               data-nd-template="feed-item"
               data-nd-mode="prepend"
               data-nd-max="30">
            <template id="feed-item">
              <div class="nd-alert nd-alert-info nd-mb-sm">
                <strong>{{type}}</strong> {{message}} {{symbol}} {{price}}
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

  </main>

  <script src="/static/ndesign.min.js"></script>
</body>
</html>
```

### Go backend

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "math/rand"
    "net/http"
    "os"
    "os/signal"
    "strings"
    "sync"
    "syscall"
    "time"

    "github.com/gorilla/websocket"
)

// ── Data types ─────────────────────────────────────────────

type User struct {
    ID     int    `json:"id"`
    Name   string `json:"name"`
    Email  string `json:"email"`
    Role   string `json:"role"`
    Active bool   `json:"active"`
}

type ValidationErrors struct {
    Errors map[string]string `json:"errors"`
}

// ── In-memory store ────────────────────────────────────────

var (
    mu         sync.Mutex
    users      = []User{
        {1, "Will Hattingh", "will@example.com", "admin", true},
        {2, "Sarah Kim", "sarah@example.com", "editor", true},
        {3, "James Miller", "james@example.com", "viewer", false},
    }
    nextID = 4
)

// ── REST: Users ────────────────────────────────────────────

func handleUsers(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case http.MethodGet:
        mu.Lock()
        data := make([]User, len(users))
        copy(data, users)
        mu.Unlock()
        writeJSON(w, http.StatusOK, data)

    case http.MethodPost:
        var body struct {
            Name  string `json:"name"`
            Email string `json:"email"`
            Role  string `json:"role"`
        }
        if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
            writeJSON(w, 400, ValidationErrors{
                Errors: map[string]string{"_form": "Invalid JSON"},
            })
            return
        }

        errs := make(map[string]string)
        if len(strings.TrimSpace(body.Name)) < 2 {
            errs["name"] = "Name must be at least 2 characters"
        }
        if !strings.Contains(body.Email, "@") {
            errs["email"] = "Invalid email address"
        }
        validRoles := map[string]bool{"admin": true, "editor": true, "viewer": true}
        if !validRoles[body.Role] {
            errs["role"] = "Role must be one of: admin, editor, viewer"
        }
        if len(errs) > 0 {
            writeJSON(w, 400, ValidationErrors{Errors: errs})
            return
        }

        mu.Lock()
        u := User{nextID, strings.TrimSpace(body.Name),
            strings.TrimSpace(body.Email), body.Role, true}
        nextID++
        users = append(users, u)
        mu.Unlock()

        writeJSON(w, 201, map[string]interface{}{
            "message": "User created successfully", "user": u,
        })
    }
}

// ── SSE: Metrics ───────────────────────────────────────────

func handleSSE(w http.ResponseWriter, r *http.Request) {
    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "Streaming not supported", 500)
        return
    }
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    flusher.Flush()

    ticker := time.NewTicker(3 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-r.Context().Done():
            return
        case <-ticker.C:
            data, _ := json.Marshal(map[string]interface{}{
                "cpu":    30.0 + rand.Float64()*50.0,
                "memory": 40.0 + rand.Float64()*40.0,
                "disk":   20.0 + rand.Float64()*60.0,
            })
            fmt.Fprintf(w, "event: metric\ndata: %s\n\n", data)
            flusher.Flush()
        }
    }
}

// ── WebSocket: Live feed ───────────────────────────────────

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
}

func handleWS(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        return
    }
    defer conn.Close()

    go func() {
        for { if _, _, err := conn.ReadMessage(); err != nil { break } }
    }()

    ticker := time.NewTicker(2 * time.Second)
    defer ticker.Stop()

    for range ticker.C {
        msg := map[string]interface{}{
            "type":    "trade",
            "symbol":  "BTC/USD",
            "price":   67234.50 + (rand.Float64()-0.5)*1344.69,
            "message": "",
        }
        if err := conn.WriteJSON(msg); err != nil {
            return
        }
    }
}

// ── Helpers ────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(v)
}

// ── Main ───────────────────────────────────────────────────

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/users", handleUsers)
    mux.HandleFunc("/events/stream", handleSSE)
    mux.HandleFunc("/ws/feed", handleWS)
    mux.Handle("/static/", http.StripPrefix("/static/",
        http.FileServer(http.Dir("./dist"))))

    srv := &http.Server{Addr: ":8080", Handler: mux}

    stop := make(chan os.Signal, 1)
    signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        fmt.Println("listening on http://localhost:8080")
        log.Fatal(srv.ListenAndServe())
    }()

    <-stop
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    srv.Shutdown(ctx)
}
```

---

## File Upload with Progress -- `data-nd-upload`

The `data-nd-upload` attribute turns a plain `<form>` into an XHR-backed file uploader with a live progress bar. Unlike `data-nd-action` (which is JSON-only), upload forms send `multipart/form-data` built from a native `FormData` — so every `<input type="file">` on the form is transmitted byte-for-byte. XHR is used instead of `fetch` because `fetch` cannot report upload progress events.

### Minimal form

```html
<form data-nd-upload="POST /api/upload"
      data-nd-feedback="upload-feedback"
      data-nd-success="refresh:#uploaded-files">
  <label class="nd-form-label" for="file">Choose a file</label>
  <input class="nd-input" type="file" name="file" id="file" required>

  <progress class="nd-upload-progress" value="0" max="100" hidden></progress>

  <div id="upload-feedback"></div>

  <button type="submit" class="nd-btn nd-btn-primary">Upload</button>
</form>
```

What happens on submit:

1. `clearFormErrors()` wipes any prior `.nd-form-error` messages.
2. A `FormData` is built from the form and posted with `X-Requested-With: NDesign`.
3. `xhr.upload.onprogress` updates the `<progress class="nd-upload-progress">` element live.
4. On `2xx` the `data-nd-success` chain fires (same vocabulary as `data-nd-action`).
5. On `4xx` with `{ "errors": { ... } }`, errors are field-mapped. Other errors go to the feedback element.
6. On network failure the feedback element shows `"Network error. Please try again."`.

The submit button is disabled and given the `.nd-loading` class for the duration; the progress bar is re-hidden 1 second after completion.

### Pairing with a bound file list

Combine an upload form with a bound table that refreshes on success to get a complete "upload + see result" loop with zero custom JavaScript:

```html
<form data-nd-upload="POST /api/upload"
      data-nd-feedback="upload-feedback"
      data-nd-success="refresh:#uploaded-files,reset">
  <input class="nd-input" type="file" name="file" required>
  <progress class="nd-upload-progress" value="0" max="100" hidden></progress>
  <div id="upload-feedback"></div>
  <button type="submit" class="nd-btn nd-btn-primary">Upload</button>
</form>

<table class="nd-table">
  <thead><tr><th>Name</th><th>Size</th><th>Uploaded</th></tr></thead>
  <tbody id="uploaded-files"
         data-nd-bind="/api/files"
         data-nd-template="file-row"></tbody>
</table>

<template id="file-row">
  <tr><td>{{name}}</td><td>{{size}}</td><td>{{uploaded_at}}</td></tr>
</template>
```

The chained `refresh:#uploaded-files,reset` on success re-fetches the file list and then clears the form — both declaratively.

### Server endpoint (Go)

Parse the multipart form, copy the upload to disk, and return JSON. Enforce a size limit with `http.MaxBytesReader`:

```go
func handleUpload(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Hard cap at 10 MB on the wire.
    r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
    if err := r.ParseMultipartForm(10 << 20); err != nil {
        writeJSON(w, http.StatusBadRequest, map[string]any{
            "errors": map[string]string{"file": "file too large (max 10 MB)"},
        })
        return
    }

    file, hdr, err := r.FormFile("file")
    if err != nil {
        writeJSON(w, http.StatusBadRequest, map[string]any{
            "errors": map[string]string{"file": "no file provided"},
        })
        return
    }
    defer file.Close()

    // Basename only — never trust client paths.
    name := filepath.Base(hdr.Filename)
    dst, err := os.Create(filepath.Join("./uploads", name))
    if err != nil {
        writeJSON(w, http.StatusInternalServerError, map[string]any{
            "message": "could not save file",
        })
        return
    }
    defer dst.Close()

    if _, err := io.Copy(dst, file); err != nil {
        writeJSON(w, http.StatusInternalServerError, map[string]any{
            "message": "write failed",
        })
        return
    }

    writeJSON(w, http.StatusOK, map[string]any{
        "message": fmt.Sprintf("uploaded %s", name),
        "name":    name,
        "size":    hdr.Size,
    })
}
```

**Security notes.**
- Always call `filepath.Base()` on `hdr.Filename` — browsers can and do send path segments. Never `filepath.Join(dir, hdr.Filename)` directly.
- Always wrap `r.Body` with `http.MaxBytesReader` to avoid unbounded memory use.
- If you accept arbitrary file types, store them under randomly-named files and serve them via a content-sniffing-aware handler to prevent stored XSS.

---

## Sortable (Drag-and-Drop) -- `data-nd-sortable`

The `data-nd-sortable` attribute turns any container element into a sortable list whose direct children can be reordered by dragging. Children are automatically marked `draggable="true"` on init; the module uses the native HTML5 drag-and-drop API and delegated listeners, so there is nothing per-item to wire up.

Every successful drop fires a `nd:sortable:reorder` custom event on the container with `detail.order` — an array of identifiers in their new order. The identifier for each child is its `data-id` attribute if present, otherwise the current index as a string.

### Client-only (fires an event, no server sync)

```html
<ul class="nd-list-reset" data-nd-sortable>
  <li data-id="a" class="nd-card nd-p-md">Alpha</li>
  <li data-id="b" class="nd-card nd-p-md">Bravo</li>
  <li data-id="c" class="nd-card nd-p-md">Charlie</li>
</ul>

<script>
  document.querySelector('[data-nd-sortable]')
    .addEventListener('nd:sortable:reorder', (e) => {
      console.log('new order:', e.detail.order); // ["b", "a", "c"]
    });
</script>
```

Use this pattern when the new order is purely a UI affordance, e.g. reordering filters in a local state store.

### Server sync (POSTs the new order)

Add a `METHOD URL` value to `data-nd-sortable`, and every drop POSTs `{ "order": [...] }` to that endpoint. The client DOM is already updated optimistically; on failure the container briefly gets the `nd-sortable-error` class (shake animation).

```html
<ul class="nd-list-reset" data-nd-sortable="POST /api/tasks/reorder">
  <li data-id="1" class="nd-card nd-p-md">Write report</li>
  <li data-id="2" class="nd-card nd-p-md">Send invoice</li>
  <li data-id="3" class="nd-card nd-p-md">Deploy build</li>
</ul>
```

### Server endpoint (Go)

```go
type reorderBody struct {
    Order []string `json:"order"`
}

func handleReorder(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }
    var body reorderBody
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        writeJSON(w, http.StatusBadRequest, map[string]string{"message": "bad json"})
        return
    }

    // Persist the new ordering — e.g. update a sort_index column.
    if err := tasks.Reorder(body.Order); err != nil {
        writeJSON(w, http.StatusInternalServerError, map[string]string{"message": err.Error()})
        return
    }

    writeJSON(w, http.StatusOK, map[string]any{
        "ok":    true,
        "order": body.Order,
    })
}
```

### Listening for the reorder event

You can always layer custom handling on top of the declarative attribute — the custom event still fires even when server sync is configured:

```js
document.querySelector('#task-list')
  .addEventListener('nd:sortable:reorder', (e) => {
    showToast(`Moved to position ${e.detail.order.indexOf(e.detail.item.dataset.id) + 1}`);
  });
```

### Accessibility limitation (v1)

The sortable module is **mouse/pointer-only** in v1. There is no keyboard affordance for lifting, moving, and dropping items — users with keyboard-only input cannot reorder the list via `data-nd-sortable` alone. The module does set `role="list"` / `role="listitem"` so the list is still announced correctly by screen readers, and `aria-grabbed` tracks the dragging state.

Until keyboard reorder lands in v2, provide an accessible fallback such as up/down buttons that dispatch `nd:sortable:reorder` manually, or a separate "Reorder items" modal that uses native `<select>` / position inputs.

---

## Attribute Reference

Quick reference of every `data-nd-*` attribute:

| Attribute | Elements | Description |
|-----------|----------|-------------|
| `data-nd-bind` | Any | Fetch JSON from a REST URL and render into this element |
| `data-nd-field` | Any | Extract a single field from the JSON response (dot notation supported) |
| `data-nd-attr` | With `data-nd-field` | Target an HTML attribute instead of textContent (e.g., `value`, `src`, `href`) |
| `data-nd-params` | With `data-nd-bind` | Query string appended to the bind URL (e.g., `page=1&per_page=25`) |
| `data-nd-select` | With `data-nd-bind` | Dot-notation path to pluck a sub-field from the response before rendering (e.g., `data`) |
| `data-nd-template` | Any | ID of a `<template>` element to clone and interpolate |
| `data-nd-mode` | Any with template | Render mode: `replace`, `append`, or `prepend` |
| `data-nd-max` | Any with template | Maximum number of rendered items (oldest removed) |
| `data-nd-if` | Inside template | Conditional rendering -- remove element if field is falsy |
| `data-nd-refresh` | With `data-nd-bind` | Polling interval in milliseconds |
| `data-nd-bind-trigger` | Any element | Dispatches `nd:refresh` on the selector target; auto-updates `data-nd-params` from href or own attribute |
| `data-nd-bind-mode` | With `data-nd-bind-trigger` | Sets `data-nd-mode` on the target before refresh (e.g., `append`) |
| `data-nd-ws` | Any | WebSocket URL to connect to |
| `data-nd-sse` | Any | SSE endpoint URL to subscribe to |
| `data-nd-sse-event` | With `data-nd-sse` | Named SSE event type to filter on |
| `data-nd-action` | `<form>`, `<button>`, any | Action to fire: `METHOD /url` |
| `data-nd-success` | With `data-nd-action` | Success behavior: `reset`, `redirect:/path`, `reload`, `refresh:#selector`, `emit:name` |
| `data-nd-feedback` | `<form>` with action | ID of element to show success/error messages in |
| `data-nd-confirm` | With `data-nd-action` | Confirmation prompt shown before the action fires |
| `data-nd-on` | Any | Custom event binding: `event:handlerFunctionName` |
| `data-nd-upload` | `<form>` | Upload endpoint: `METHOD /url`. Submits via XHR with live progress on child `<progress class="nd-upload-progress">` |
| `data-nd-sortable` | Any container | Make direct children draggable. Optional `METHOD /url` value POSTs the new order to the server on every drop |
