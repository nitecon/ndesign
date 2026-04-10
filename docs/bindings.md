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
| `wsProtocols` | `string[]` | `[]` | WebSocket sub-protocols passed to `new WebSocket(url, protocols)` |

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

## Attribute Reference

Quick reference of every `data-nd-*` attribute:

| Attribute | Elements | Description |
|-----------|----------|-------------|
| `data-nd-bind` | Any | Fetch JSON from a REST URL and render into this element |
| `data-nd-field` | Any | Extract a single field from the JSON response (dot notation supported) |
| `data-nd-template` | Any | ID of a `<template>` element to clone and interpolate |
| `data-nd-mode` | Any with template | Render mode: `replace`, `append`, or `prepend` |
| `data-nd-max` | Any with template | Maximum number of rendered items (oldest removed) |
| `data-nd-if` | Inside template | Conditional rendering -- remove element if field is falsy |
| `data-nd-refresh` | With `data-nd-bind` | Polling interval in milliseconds |
| `data-nd-ws` | Any | WebSocket URL to connect to |
| `data-nd-sse` | Any | SSE endpoint URL to subscribe to |
| `data-nd-sse-event` | With `data-nd-sse` | Named SSE event type to filter on |
| `data-nd-action` | `<form>`, `<button>`, any | Action to fire: `METHOD /url` |
| `data-nd-success` | With `data-nd-action` | Success behavior: `reset`, `redirect:/path`, `reload`, `refresh:#selector`, `emit:name` |
| `data-nd-feedback` | `<form>` with action | ID of element to show success/error messages in |
| `data-nd-confirm` | With `data-nd-action` | Confirmation prompt shown before the action fires |
| `data-nd-on` | Any | Custom event binding: `event:handlerFunctionName` |
