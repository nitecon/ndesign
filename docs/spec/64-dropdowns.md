## Dropdowns

> **Rules**
> - Use for action menus (row actions, account menus) and compact lists of secondary commands.
> - Do NOT use for form input — use [Select](#select) which keeps native form validation semantics.
> - The trigger MUST be a direct-child `<button>` of `.nd-dropdown` — the runtime uses `:scope > button` selection.
> - Menu items MUST be `<li> <a>` or `<li> <button>` to receive `role="menuitem"`.
> - The dropdown does not auto-flip near viewport edges — use `.nd-dropdown-up` or `.nd-dropdown-right` declaratively.

A dropdown is a click-to-toggle menu anchored to a trigger button. ndesign
wires `role="menu"` and `role="menuitem"` automatically, supports keyboard
navigation, and closes on outside click. The trigger is a real `<button>`,
the menu is a `<ul>` or `<ol>` — no custom elements.

### When to use

- Action menus on a row or card (Edit / Duplicate / Delete).
- Account menus in a navigation bar.
- Compact lists of secondary commands that would clutter a toolbar.

### When NOT to use

- For form input — use the [Select](#select) component, which wraps a
  native `<select>` and keeps form validation semantics.
- For navigation between top-level pages — use [Navigation](#navigation).
- For long lists requiring filtering — build a search-driven menu using
  [Data binding](#data-binding) instead.

### Minimal example

```html
<div class="nd-dropdown">
  <button type="button">Actions</button>
  <ul class="nd-dropdown-menu">
    <li><a href="/edit">Edit</a></li>
    <li><a href="/duplicate">Duplicate</a></li>
    <li class="nd-dropdown-divider"></li>
    <li><a href="/delete">Delete</a></li>
  </ul>
</div>
```

### Markup and classes

A `.nd-dropdown` wraps exactly two children:

1. A direct-child `<button>` (the trigger). Other content before the
   list is ignored.
2. A `<ul>`, `<ol>`, or any element whose class includes
   `nd-dropdown-menu`.

| Class                    | Effect                                                       |
|--------------------------|--------------------------------------------------------------|
| `.nd-dropdown`           | Wrapper. `position: relative`.                               |
| `.nd-dropdown-menu`      | The popup list. Hidden until `.nd-open` is on the wrapper.    |
| `.nd-dropdown.nd-open`   | Runtime-applied when the dropdown is expanded.                |
| `.nd-dropdown-right`     | Right-align the menu under the trigger.                      |
| `.nd-dropdown-up`        | Open upward instead of downward.                             |
| `.nd-dropdown-divider`   | Horizontal separator inside the menu.                        |
| `.nd-active` (on `<li>`) | Highlight the current item.                                  |
| `.nd-highlighted`        | Runtime-applied while keyboard navigation hovers an item.    |

### Dynamic bindings

Dropdowns do not consume `data-nd-*` attributes directly. Menu items
typically link to URLs or carry [Data binding](#data-binding) attributes
themselves (`data-nd-action`, `data-nd-modal`, `data-nd-toast`, etc.) —
the dropdown is purely presentational scaffolding.

### Events fired

Dropdowns do not dispatch custom events. Listen for `click` on the menu
items if a host application needs to react to a selection.

### JS API

Dropdowns are wired automatically by `NDesign.init()`; there is no
public method to open / close one programmatically. To toggle from
script, call `wrapper.classList.toggle('nd-open')` and update
`aria-expanded` on the trigger button.

### Accessibility

ARIA wiring applied at init:

- The trigger gets `aria-expanded="false"`, flipped to `"true"` while
  open.
- The list element gets `role="menu"`.
- Each `<li> a` and `<li> button` gets `role="menuitem"`.

Keyboard map (focus on the trigger):

| Key            | Effect                                                                 |
|----------------|------------------------------------------------------------------------|
| `ArrowDown`    | Open the menu if closed; advance the highlighted item; wraps.           |
| `ArrowUp`      | Move highlight up; wraps.                                              |
| `Enter`        | Activate the highlighted item (`.click()`) and close the menu.         |
| `Escape`       | Close the menu and return focus to the trigger.                        |

Outside click — anywhere not inside a `.nd-dropdown` — closes every open
dropdown. Opening a second dropdown closes any already-open one.

### Pitfalls

- The trigger MUST be a direct-child `<button>`. A `<button>` nested
  inside another wrapper inside `.nd-dropdown` is ignored — the runtime
  uses `:scope > button` selection.
- Items MUST be `<li> <a>` or `<li> <button>`. A bare `<a>` directly
  under the menu element will not receive `role="menuitem"`.
- Tab does NOT cycle between the trigger and the menu items — focus
  remains on the trigger and ArrowUp/ArrowDown drive the highlight.
  This matches the WAI-ARIA menubar pattern but differs from listbox
  semantics.
- The dropdown does not flip automatically when it would overflow the
  viewport. Use `.nd-dropdown-up` or `.nd-dropdown-right` declaratively
  when you know the trigger sits near a viewport edge.

### See also

- [Select](#select) — for form-bound option lists.
- [Navigation](#navigation) — for top-bar and sidebar navigation.
- [Tooltips](#tooltips) — for read-only contextual hints.
- Source: `js/dropdown.js`, `scss/_dropdowns.scss`
