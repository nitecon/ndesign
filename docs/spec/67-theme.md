## Theme

> **Rules**
> - Register each theme with a `<meta name="nd-theme" content="NAME" data-href="URL">` and mark the active stylesheet `<link class="theme" data-theme="NAME">`.
> - Do NOT use `title="..."` on the theme `<link>` — it becomes an alternate stylesheet the browser will not apply.
> - The active `<link>` MUST carry `class="theme"` — without it `setTheme()` no-ops because there is nothing to replace.
> - `prefers-color-scheme` is NOT consulted automatically — read the media query and call `NDesign.setTheme()` on first load if you want OS-driven defaults.
> - The runtime does not persist theme choice across reloads — use `localStorage` or a server-rendered class on `<html>`.

ndesign ships two themes — `light` and `dark` — and supports any number
of custom themes registered via `<meta>` tags. The runtime swaps the
active stylesheet by replacing a single `<link class="theme">` element
in the document head, waiting for the new sheet to load before removing
the old one to avoid a flash of unstyled content.

### When to use

- Adding a theme switcher (manual light / dark toggle, or N-way cycle).
- Loading a tenant- or user-specific theme stylesheet at runtime without
  reloading the page.

### When NOT to use

- For one-off color overrides — extend the theme with custom properties
  (`--nd-accent` etc.) on the parent stylesheet instead of swapping
  whole stylesheets.

### Setup

Declare each available theme twice:

1. A `<meta name="nd-theme">` tag registers the theme name and its
   stylesheet URL.
2. A `<link class="theme" data-theme="...">` carries the *currently
   active* theme. There MUST be exactly one such link in the document.

```html
<head>
  <!-- Registry: one meta per theme. -->
  <meta name="nd-theme" content="light" data-href="/dist/themes/light.min.css">
  <meta name="nd-theme" content="dark"  data-href="/dist/themes/dark.min.css">

  <!-- Active stylesheet — must carry class="theme" and data-theme. -->
  <link rel="stylesheet"
        href="/dist/themes/light.min.css"
        class="theme"
        data-theme="light">
</head>
```

### Markup and classes

| Selector                              | Effect                                                                                                                |
|---------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| `meta[name="nd-theme"][content]`      | Theme registry. `content` is the theme name; `data-href` is the stylesheet URL the runtime swaps in.                   |
| `link.theme`                          | The active theme stylesheet. Replaced atomically on switch. `data-theme` MUST match the registered name.              |

### Dynamic bindings

The single delegated click handler processes:

| Attribute                  | Location              | Behavior                                                  |
|----------------------------|-----------------------|-----------------------------------------------------------|
| `data-nd-theme="NAME"`     | any clickable element | Click calls `setTheme(NAME)`. Calls `e.preventDefault()`. |
| `data-nd-theme-toggle`     | any clickable element | Click calls `toggleTheme()`. Calls `e.preventDefault()`.  |

```html
<button class="nd-btn-ghost" data-nd-theme-toggle>Theme</button>

<button data-nd-theme="light">Light</button>
<button data-nd-theme="dark">Dark</button>
```

### JS API

```javascript
NDesign.setTheme('dark');           // → void
NDesign.toggleTheme();              // → void; cycles to the next registered theme
NDesign.getThemes();                // → [{name, label, active}, ...]
```

| Method               | Behavior                                                                                                                                                            |
|----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `setTheme(name)`     | Looks up `meta[name="nd-theme"][content="<name>"]`, inserts a fresh `<link class="theme">`, and removes the old one after `load`. No-op if the theme is unknown or already active. Warns when the theme name is not registered. |
| `toggleTheme()`      | Cycles through registered themes in document order, wrapping at the end.                                                                                            |
| `getThemes()`        | Returns one object per registered meta: `{ name, label, active }`. `label` is the name with the first character upper-cased (compatibility shim — apps SHOULD generate their own labels for i18n). |

### Accessibility

- Theme triggers SHOULD be real `<button>` elements (they call
  `e.preventDefault()` on click, but anchors without `href` are still
  not keyboard-accessible).
- The runtime does not announce the theme change to screen readers. If
  the visible label of the trigger changes (e.g. "Switch to dark"
  becoming "Switch to light"), the change is read on next focus.
- `prefers-color-scheme` is **not** consulted automatically. Application
  code SHOULD read the media query and call `setTheme()` on first load
  if it wants OS-driven defaults.

### Pitfalls

- **Do NOT use `title="..."` on the theme `<link>`.** Per the HTML
  spec, `<link rel="stylesheet" title>` becomes an "alternate
  stylesheet" that the browser will not apply unless explicitly
  selected via the View menu. Use `data-theme="..."` instead. This is
  the single most common theme bug.
- The active link MUST carry `class="theme"`. Without it, `setTheme()`
  no-ops because there is no element to replace.
- The `<meta name="nd-theme">` registry MUST be present at init time.
  Adding a meta after `NDesign.init()` does not retroactively register
  the theme — call `NDesign.setTheme()` instead, which scans the meta
  list on every call.
- The runtime does not persist theme choice. Persisting across reloads
  (localStorage, a cookie, or a server-rendered `class` on `<html>`)
  is the application's responsibility.
- A theme stylesheet that fails to load leaves the page in a broken
  state — the new `<link>` exists but never fires `load`, so the old
  stylesheet stays. Verify URLs in `data-href` against your CDN.

### See also

- [Navigation](#navigation) — typical home for the theme toggle.
- Source: `js/ndesign.js` (`setTheme`, `toggleTheme`, `getThemes`),
  `scss/themes/light.scss`, `scss/themes/dark.scss`.
