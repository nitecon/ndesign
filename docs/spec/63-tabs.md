## Tabs

Tabs partition a single screen into mutually exclusive content panels.
ndesign implements the WAI-ARIA Authoring Practices tab pattern with
**manual activation**: arrow keys move focus between tabs, but the panel
only changes when the user presses Enter, Space, or clicks. Both
horizontal (default) and vertical layouts are supported.

### When to use

- Switching between views of the same record (Profile / Security /
  Notifications on a settings page).
- Showing alternate representations of one dataset (Table / Chart /
  Raw JSON).

### When NOT to use

- For top-level page navigation — use [Navigation](#navigation) instead.
- For a long sequence of steps — use a stepper / wizard pattern; tabs
  imply equal peers, not progression.

### Minimal example

```html
<div class="nd-tabs">
  <div role="tablist" aria-label="Account settings">
    <button role="tab" id="tab-profile"  aria-controls="p-profile"  aria-selected="true">Profile</button>
    <button role="tab" id="tab-security" aria-controls="p-security">Security</button>
    <button role="tab" id="tab-notif"    aria-controls="p-notif"   disabled>Notifications</button>
  </div>
  <section role="tabpanel" id="p-profile"  aria-labelledby="tab-profile">Profile content</section>
  <section role="tabpanel" id="p-security" aria-labelledby="tab-security" hidden>Security content</section>
  <section role="tabpanel" id="p-notif"    aria-labelledby="tab-notif"    hidden>Notifications content</section>
</div>
```

Vertical layout: replace `.nd-tabs` with `.nd-tabs-vertical`. The runtime
sets `aria-orientation="vertical"` on the tablist automatically.

### Markup and classes

| Class                  | Effect                                                       |
|------------------------|--------------------------------------------------------------|
| `.nd-tabs`             | Horizontal tablist + panels. Tabs along the top.             |
| `.nd-tabs-vertical`    | Vertical tablist on the left, panel on the right.            |

ARIA roles drive the runtime — class names are visual only.

| Role           | Required on                | Notes                                                            |
|----------------|----------------------------|------------------------------------------------------------------|
| `tablist`      | container of the tab buttons | Direct child of `.nd-tabs`. The runtime sets `aria-orientation`. |
| `tab`          | each tab button             | MUST carry `aria-controls="PANEL_ID"`. Use `<button>`.           |
| `tabpanel`     | each panel                  | MUST carry an `id` matching some tab's `aria-controls`.          |

Disabled tabs MUST carry the standard `disabled` attribute. The runtime
skips them during keyboard navigation and refuses to activate them.

### Dynamic bindings

Tabs do not consume any `data-nd-*` attributes — the contract is pure
ARIA. Tab panels MAY contain [Data binding](#data-binding) elements
(e.g. `data-nd-bind`) that are wired the moment the runtime initializes;
hidden panels still have their bindings active so that switching to a
panel reveals already-rendered content.

### Events fired

Tabs do not dispatch custom events. Listen for `click` on
`[role="tab"]` if a host application needs to react to activation, or
observe the `hidden` attribute on panels.

### JS API

Tabs are wired automatically by `NDesign.init()` and exposed only via
internal `initTabs()` / `destroyTabs()` lifecycle hooks. There is no
public method to programmatically activate a tab — call
`tabElement.click()` to activate one from script.

### Accessibility

The runtime applies the WAI-ARIA pattern in full:

- **Initial state** — the tab marked `aria-selected="true"` (or the
  first non-disabled tab if none is marked) gets `tabindex="0"`; every
  other tab gets `tabindex="-1"`. The matching panel is shown; all
  others receive `hidden`.
- **Activation** — clicking or pressing Enter / Space on a focused tab
  flips `aria-selected` and `tabindex` on every tab and toggles
  `hidden` on every panel.

Keyboard map (focus must be on a tab):

| Key                   | Effect                                                            |
|-----------------------|-------------------------------------------------------------------|
| `ArrowRight` / `ArrowDown` | Move focus to the next non-disabled tab. Wraps at the end.   |
| `ArrowLeft`  / `ArrowUp`   | Move focus to the previous non-disabled tab. Wraps at the start. |
| `Home`                | Focus the first non-disabled tab.                                 |
| `End`                 | Focus the last non-disabled tab.                                  |
| `Enter` / `Space`     | Activate the focused tab.                                         |

For `.nd-tabs-vertical`, both axes are accepted regardless of
orientation — the runtime uses ArrowRight/ArrowLeft and ArrowUp/ArrowDown
interchangeably for user convenience.

### Pitfalls

- A tab whose `aria-controls` does not match any panel id will activate
  but will not reveal a panel — no warning is logged.
- Disabled tabs MUST use the HTML `disabled` attribute, not
  `aria-disabled="true"`. The runtime checks the attribute, not the
  ARIA state.
- Do not nest `.nd-tabs` containers and expect arrow keys to "stop" at
  the inner boundary. The runtime scopes by closest `.nd-tabs` /
  `.nd-tabs-vertical` ancestor of the focused tab; design tab content
  to avoid nested tab widgets where possible.
- Activation is manual on purpose. Auto-activation on focus is
  inappropriate when panels are expensive to render or contain
  side-effecting content. To opt into auto-activation, attach a `focus`
  listener that calls `tab.click()` — but accept the accessibility
  trade-off.

### See also

- [Navigation](#navigation) — for cross-page navigation.
- [Dropdowns](#dropdowns) — for compact tab-like menus that do not need
  panel switching.
- Source: `js/tabs.js`, `scss/_tabs.scss`
