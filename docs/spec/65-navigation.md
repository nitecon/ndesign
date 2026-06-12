## Navigation

> **Rules**
> - Use `<nav>` for top-bar or sidebar page navigation and mobile hamburger menus.
> - Do NOT use for in-page panel switching — use [Tabs](#tabs).
> - Do NOT use for action menus — use [Dropdowns](#dropdowns).
> - Do NOT mix `.nd-nav-side` and `data-nd-toggle="sidebar"` on the same element — they are independent code paths and will double-toggle.
> - `.nd-nav-toggle` MUST be inside a `<nav>` or `.nd-nav` ancestor — toggles outside that scope are silently ignored.

ndesign styles the native `<nav>` element by default and provides
responsive top-bar and sidebar layouts. The runtime wires hamburger
toggles, side-nav overlays, and an auto-close on resize above the large
breakpoint. There is no SPA router — every menu link is a regular `<a>`.

### When to use

- Top-bar navigation across pages of an application.
- Persistent sidebar navigation in admin panels and dashboards.
- Mobile collapse of either layout into a hamburger menu.

### When NOT to use

- For switching between panels of a single screen — use [Tabs](#tabs).
- For action menus — use [Dropdowns](#dropdowns).

### Minimal example — top bar with mobile collapse

```html
<nav>
  <a href="/" class="nd-nav-brand">Acme</a>

  <button class="nd-nav-toggle" aria-label="Toggle menu" aria-expanded="false">&#9776;</button>

  <ul class="nd-nav-menu">
    <li><a href="/dashboard" class="nd-active">Dashboard</a></li>
    <li><a href="/users">Users</a></li>
    <li><a href="/settings">Settings</a></li>
  </ul>

  <div class="nd-nav-end">
    <button class="nd-btn-ghost" data-nd-theme-toggle>Theme</button>
  </div>
</nav>
```

### Minimal example — sidebar

```html
<nav class="sidebar">
  <a href="/" class="nd-nav-brand">Acme</a>

  <div class="nd-nav-section">Workspace</div>
  <ul class="nd-nav-menu">
    <li><a href="/dashboard" class="nd-active">Dashboard</a></li>
    <li><a href="/projects">Projects</a></li>
  </ul>

  <div class="nd-nav-section">Account</div>
  <ul class="nd-nav-menu">
    <li><a href="/profile">Profile</a></li>
    <li><a href="/billing">Billing</a></li>
  </ul>
</nav>
```

### Markup and classes

| Class                    | Effect                                                                  |
|--------------------------|-------------------------------------------------------------------------|
| `<nav>`                  | Native element — sticky top bar by default.                             |
| `.sidebar`               | Resets top-bar styles and applies vertical sidebar layout.              |
| `.sidebar-fixed`         | `position: fixed` sidebar pinned to the viewport.                       |
| `.nd-nav-brand`          | The brand label / logo block.                                           |
| `.nd-nav-brand-sub`      | Muted sub-line under the brand.                                         |
| `.nd-nav-menu`           | Flex (top bar) or column (sidebar) list of links.                       |
| `.nd-nav-end`            | Right-aligned trailing slot for actions.                                |
| `.nd-nav-section`        | Section header inside a sidebar (uppercase, muted).                     |
| `.nd-nav-toggle`         | Hamburger button. Hidden above `1280 px`.                               |
| `.nd-nav-side`           | Apply to a `<nav>` to enable the overlay-driven side-drawer behavior.   |
| `.nd-nav-open`           | Runtime-applied while the nav is expanded.                              |
| `.nd-nav-overlay`        | Auto-created behind a `.nd-nav-side` while it is open.                  |
| `.nd-active` (on `<a>`)  | Marks the current-page link.                                            |

### Dynamic bindings

| Attribute                       | Location                | Behavior                                                                                                |
|---------------------------------|-------------------------|---------------------------------------------------------------------------------------------------------|
| `.nd-nav-toggle`                | inside `<nav>` / `.nd-nav` | On click: toggles `nd-nav-open` on the closest `nav` / `.nd-nav` ancestor. Syncs `aria-expanded` on the toggle. |
| `.nd-nav-side`                  | on the `<nav>`           | When opened, the runtime appends a `.nd-nav-overlay` to `<body>`; clicking the overlay closes the nav. |
| `data-nd-toggle="sidebar"`      | any clickable element    | Legacy shortcut: toggles `nd-nav-open` on the first `.sidebar` plus an overlay on `.overlay` / `.nd-nav-overlay`. Independent of `initNav()`. Syncs `aria-expanded` on the trigger. |

A window-level `resize` listener auto-closes every open nav when
`window.innerWidth > 1280` so the user does not see a mobile drawer
stuck open after a resize to desktop.

### Events fired

Navigation does not dispatch custom events. Listen for `click` on
specific links if a host application needs to react.

### JS API

Navigation is wired automatically by `NDesign.init()`. There is no
public method to open or close a nav programmatically — toggle the
`nd-nav-open` class directly on the `<nav>` and update `aria-expanded`
on the toggle button.

### Accessibility

- `.nd-nav-toggle` SHOULD carry `aria-label` (the hamburger glyph has no
  accessible name) and starts with `aria-expanded="false"`. The runtime
  syncs the value on every toggle.
- The auto-created `.nd-nav-overlay` is decorative — clicking it closes
  the nav, but it is not focusable.
- Use `class="nd-active"` on the current-page link so screen-reader
  users hear the active state. Pair with `aria-current="page"` for
  redundancy.
- Sidebar menu link clicks on viewports below `1280 px` close the
  sidebar automatically (the delegated click handler in `ndesign.js`).

### Pitfalls

- `.nd-nav-toggle` MUST be inside a `<nav>` or `.nd-nav` ancestor —
  toggles outside that scope are silently ignored at init.
- Do NOT mix `.nd-nav-side` with `data-nd-toggle="sidebar"` on the same
  element. They are independent code paths and double-handling will
  open and immediately close the menu.
- A `<nav>` styled as a sidebar uses `.sidebar` (not `.nd-sidebar`) for
  historical reasons. Both class names appear in legacy markup; the
  framework currently keys off `.sidebar`.
- The auto-close-on-resize threshold is fixed at `1280 px` to match
  `$nd-bp-lg`. There is no configuration option.

### See also

- [Tabs](#tabs) — for in-page panel switching.
- [Dropdowns](#dropdowns) — for action menus inside the nav.
- [Theme](#theme) — pair `data-nd-theme-toggle` with the trailing slot.
- Source: `js/nav.js`, `scss/_nav.scss`
