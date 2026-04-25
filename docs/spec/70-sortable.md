## Sortable

`data-nd-sortable` turns a container's direct children into a
drag-and-drop reorderable list with full keyboard support, optional
server-sync POST on every reorder, automatic revert on failure, and
opt-in cross-container drag for kanban-style boards. The runtime uses
the native HTML5 drag-and-drop API and a `MutationObserver` to wire
children added after init.

### When to use

- Reordering rows in a list whose order is meaningful (todo lists,
  playlist queues, prioritized backlogs).
- Kanban boards with N status columns — each column is one sortable
  container, all sharing a `data-nd-sortable-group`.
- Client-only reorders where the order is read on the next form submit
  (no URL on the attribute).

### When NOT to use

- For sorting by a column header (alphabetic / numeric) — use a sortable
  table component or a `data-nd-bind` re-fetch with sort params.
- For nested trees with drop-into-item semantics — sortable only
  reorders peers; it does not nest.

### Minimal example — single list with server sync

```html
<ul data-nd-sortable="POST ${api}/api/todos/reorder">
  <li data-id="1" tabindex="0">First</li>
  <li data-id="2" tabindex="0">Second</li>
  <li data-id="3" tabindex="0">Third</li>
</ul>
```

After every reorder the runtime POSTs `{"order": ["1","2","3"]}` to the
URL. On a non-2xx response, the DOM reverts to the pre-drag order, the
container shakes, and a toast surfaces the error.

### Markup and classes

The author MAY apply zero ndesign classes — `data-nd-sortable` alone is
enough. Children are made `draggable="true"` automatically. The
following classes are runtime-applied or available for theming.

| Class                           | Effect                                                                  |
|---------------------------------|-------------------------------------------------------------------------|
| `.nd-sortable` (optional)       | Authoring class for grab cursor, focus ring, dragging / grabbed states. |
| `.nd-dragging` (runtime)        | The item currently being mouse-dragged.                                 |
| `.nd-kb-grabbed` (runtime)      | The item picked up by keyboard.                                         |
| `.nd-sortable-error` (runtime)  | Applied for 2 s after a server-sync failure (shake + danger outline).   |
| `[aria-grabbed="true"]` (runtime) | Equivalent style hook to `.nd-kb-grabbed`.                            |

### Dynamic bindings

| Attribute                          | Location           | Behavior                                                                                                                                                              |
|------------------------------------|--------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `data-nd-sortable`                 | container element  | Empty value: client-only reorder. `"METHOD URL"`: POST `{order: [...]}` to the URL after every reorder. URL is `${var}`-resolved at fetch time.                       |
| `data-nd-sortable-group="NAME"`    | container element  | Two or more containers with the same non-empty group accept drops from each other (cross-container drag).                                                              |
| `data-nd-sortable-refresh="CSV"`   | container element  | Comma-separated CSS selectors. After a successful reorder, dispatches `nd:refresh` on every match — pair with `data-nd-bind` to re-pull sibling columns declaratively. |
| `data-id`                          | each direct child  | Identifier emitted in the `order` array. Falls back to the child's zero-based positional index as a string when omitted.                                              |

`data-nd-sortable-live` is auto-added to a hidden `aria-live` polite
region the runtime injects into `<body>` for screen-reader
announcements. Authors do not need to create it.

### Wiring

On init each `[data-nd-sortable]` container:

- Sets `role="listbox"` (skipped for `<ul>` / `<ol>`, which carry
  implicit list semantics) and a default `aria-label="Reorderable list"`
  if no label is present.
- Walks every direct child and applies `draggable="true"`,
  `tabindex="0"` (when absent), and `aria-grabbed="false"`. Non-list
  containers also get `role="option"` on each child.
- Registers a `MutationObserver` for child additions so dynamically
  rendered rows are wired automatically. Children removed by the
  application are forgotten naturally.

### Mouse drag behavior

While dragging the dragged item is reordered live so the user always
sees the drop slot. On drop:

1. `nd:sortable:reorder` is dispatched on the destination container with
   `detail = { order, item, source, crossContainer }`.
2. If the destination's `data-nd-sortable` carries a URL, the runtime
   POSTs `{ "order": [...] }` with the destination's new order. The
   source container is **not** re-POSTed on cross-container drops — the
   server is expected to infer the state change from the destination
   URL (e.g. a `?status=` query parameter).

### Keyboard behavior (WAI-ARIA Listbox reordering)

Tab to a child to focus it, then:

| Key            | When focused (no grab)                        | When grabbed                                                |
|----------------|-----------------------------------------------|-------------------------------------------------------------|
| `Space`        | Grab the item.                                | Drop at current position; submit reorder.                   |
| `ArrowUp`      | Move focus to the previous draggable.         | Move the grabbed item up one position.                      |
| `ArrowDown`    | Move focus to the next draggable.             | Move the grabbed item down one position.                    |
| `Home`         | —                                             | Move the grabbed item to the first position.                |
| `End`          | —                                             | Move the grabbed item to the last position.                 |
| `Escape`       | —                                             | Cancel the grab; restore pre-grab order.                    |

Keyboard drag is intentionally **constrained to the grabbed
container** — there is no obvious arrow-key affordance for jumping
between columns. Cross-container moves are mouse-only by design.

### Revert-on-failure

When a server POST returns non-2xx (or the request fails outright):

1. The source container's children are restored to the pre-drag
   snapshot. For cross-container drops, the moved item is returned to
   the source first, then the snapshot is applied — both columns end
   up in their pre-drag state.
2. The destination receives `nd-sortable-error` for 2 s (shake animation
   + danger outline).
3. `NDesign.toast(message, 'error')` fires. The message is read from
   `responseData.errors._form` or `responseData.message` when the
   response is JSON; otherwise a generic
   *"Reorder failed — order has been reverted."* is shown.
4. `nd:sortable:revert` is dispatched on the destination with
   `detail = { item, source }`.
5. The same message is announced via the shared `aria-live` region.

The reorder POST honors `NDesign.configure({ headers: ... })` —
bearer tokens and `X-CSRF-Token` set globally reach the endpoint
unchanged. See [Data binding](#data-binding) for the full configuration
surface.

### Cross-container drag (`data-nd-sortable-group`)

Two or more containers declaring the same non-empty
`data-nd-sortable-group` accept drops from each other. Containers
without a group attribute keep the prior in-container-only behavior.
After a successful cross-container POST, `data-nd-sortable-refresh` on
*either* container dispatches `nd:refresh` on every selected element so
sibling columns can re-pull their contents declaratively.

#### Kanban example

```html
<section class="kanban">
  <ul data-nd-sortable="POST ${api}/api/tasks/move?status=todo"
      data-nd-sortable-group="tasks"
      data-nd-sortable-refresh="#doing,#done"
      id="todo"></ul>

  <ul data-nd-sortable="POST ${api}/api/tasks/move?status=doing"
      data-nd-sortable-group="tasks"
      data-nd-sortable-refresh="#todo,#done"
      id="doing"></ul>

  <ul data-nd-sortable="POST ${api}/api/tasks/move?status=done"
      data-nd-sortable-group="tasks"
      data-nd-sortable-refresh="#todo,#doing"
      id="done"></ul>
</section>
```

Dragging a card from `#todo` into `#doing` POSTs
`/api/tasks/move?status=doing` with the new `#doing` order, then
dispatches `nd:refresh` on `#todo` and `#done`. Pair `nd:refresh` with
a `data-nd-bind` element whose URL reloads that column to close the
loop.

### Events fired

| Event                | Target                                       | Detail                                          | When                                                                                       |
|----------------------|----------------------------------------------|-------------------------------------------------|--------------------------------------------------------------------------------------------|
| `nd:sortable:reorder`| destination container                        | `{ order, item, source, crossContainer }`       | After a mouse drop OR a keyboard Space-to-drop. Bubbles.                                   |
| `nd:sortable:revert` | destination container                        | `{ item, source }`                              | After a server POST failure has restored the snapshot. Bubbles.                            |
| `nd:refresh`         | every match of `data-nd-sortable-refresh`    | none                                            | After a successful reorder. Bubbles. Consumed by `data-nd-bind` to re-fetch.               |

### JS API

Sortable is wired by `NDesign.init()`. There is no public method to
trigger a reorder programmatically — manipulate `container.children`
directly and the `MutationObserver` will keep them wired.

`destroySortable()` is exported for re-init: cancels any active
keyboard grab, removes listeners, disconnects the observer, and clears
the `draggable` / `tabindex` attributes the runtime added.

### Accessibility

- Each child becomes keyboard-focusable (`tabindex="0"`).
- The shared `aria-live` polite region announces grab, every position
  change while grabbed, drop, cancel, and server-side errors.
- `aria-grabbed` is toggled on the active item during both mouse and
  keyboard drag.
- The container's `aria-label` defaults to `"Reorderable list"` —
  override it (or use `aria-labelledby`) for any non-trivial UI so
  screen readers identify the list.

### Pitfalls

- The container MUST be a stable parent. Replacing the entire container
  with `data-nd-bind` mode `replace` discards the runtime's listeners
  and the `MutationObserver`. Use mode `inner` or wrap the binding
  inside the sortable container.
- `data-id` on each child is strongly recommended. Without it, the
  emitted `order` array is just `["0","1","2",...]`, which is useless
  to a server endpoint.
- Cross-container drag requires **both** containers to opt in. A drag
  from a grouped container into a non-grouped one is silently rejected
  during `dragover`.
- Keyboard drag does not cross containers even when groups match —
  this is intentional. Implement an explicit "Move to column X" menu
  if cross-column keyboard moves are required.
- The reorder POST sends only `{ "order": [...] }` — there is no
  per-item position field, no `from` / `to` indices, and no delta
  encoding. The server is responsible for diffing against its current
  ordering.

### See also

- [Data binding](#data-binding) — `nd:refresh` and the unified error
  envelope.
- [Toasts](#toasts) — surface the revert message.
- Source: `js/sortable.js`, `scss/_sortable.scss`
