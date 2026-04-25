## Layouts

ndesign ships **three canonical starting layouts**. Every new page begins
from one of them. Picking the wrong skeleton later means rewriting the
entire shell, so **agents MUST ask the user which of the three to start
from before writing a single line of HTML.** Do not guess from the task
description, do not default silently, do not invent a fourth. Ask.

| ID              | Best for                                                       | Key markers                                              |
|-----------------|----------------------------------------------------------------|----------------------------------------------------------|
| `control-panel` | Dashboards, admin UIs, data-heavy internal tools with a sidebar. | `.app-layout` + `.sidebar` + `.app-body` + top `<header>` |
| `app-shell`     | Multi-page SaaS apps with a fixed sidebar and per-page content. | `.sidebar.sidebar-fixed` + `.app-main`                   |
| `blog`          | Editorial content — posts, articles, docs, marketing copy.     | Top `<nav>` + `.nd-container` + `.nd-panel` + `.nd-prose` |

The required prompt to the user, before writing any markup:

> Which of the three starting layouts should this page use —
> **control-panel** (sidebar + scrollable content for a dashboard),
> **app-shell** (fixed sidebar for a multi-page SaaS app), or
> **blog** (centered prose panel for an article)?

Once the user picks, copy the matching skeleton verbatim and build
inside it. Do NOT mix layouts (e.g. do not add `.nd-container` to
`control-panel`, do not add `.sidebar` to `blog`). If the user's need
truly does not fit one of the three, flag it and discuss — do not
silently invent a hybrid.

All three skeletons share the same `<head>`. Only the `<body>` varies.

**Shared `<head>` (use for all three layouts):**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page title</title>
    <link rel="stylesheet"
          href="https://storage.googleapis.com/ndesign-cdn/ndesign/latest/ndesign.min.css">
    <link rel="stylesheet"
          href="https://storage.googleapis.com/ndesign-cdn/ndesign/latest/themes/light.min.css"
          class="theme" data-theme="light">
    <meta name="nd-theme" content="light"
          data-href="https://storage.googleapis.com/ndesign-cdn/ndesign/latest/themes/light.min.css">
    <meta name="nd-theme" content="dark"
          data-href="https://storage.googleapis.com/ndesign-cdn/ndesign/latest/themes/dark.min.css">
    <meta name="endpoint:api" content="https://test.nitecon.org">
  </head>
  <!-- body goes here — pick ONE of the three skeletons below -->
  <script src="https://storage.googleapis.com/ndesign-cdn/ndesign/latest/ndesign.min.js"></script>
</html>
```

For production, replace `latest` with a pinned `v<semver>` (see
[Getting started](#getting-started)).

### control-panel

Use for admin UIs, dashboards, operations consoles — any data-heavy
application with persistent left navigation, a top header bar, and a
scrollable content area.

Reference demo: `demo/control-panel.html`.

```html
<body class="app-page">
  <div class="app-layout nd-h-screen nd-overflow-hidden">

    <!-- Sidebar -->
    <nav class="sidebar" id="app-sidebar">
      <span class="nd-nav-brand">AppName</span>
      <p class="nd-nav-section">Main</p>
      <ul class="nd-nav-menu">
        <li><a href="#" class="nd-active">Dashboard</a></li>
        <li><a href="#">Users</a></li>
      </ul>
    </nav>

    <!-- Main column: header + scrollable content -->
    <div class="app-body">
      <header>
        <div class="app-header-left">
          <button class="hamburger"
                  data-nd-toggle="sidebar"
                  aria-label="Toggle navigation">&#9776;</button>
          <h1 class="app-header-title">Dashboard</h1>
        </div>
        <div class="app-header-right">
          <button class="nd-btn-ghost nd-btn-sm" data-nd-theme-toggle>Toggle Theme</button>
        </div>
      </header>

      <main class="app-content">
        <!-- Page content. Use .nd-row / .nd-col-* for grids.
             Do NOT wrap in .nd-container. -->
      </main>
    </div>

  </div>
</body>
```

### app-shell

Use for multi-page SaaS apps where the sidebar is always visible and
the page's primary content sits in a single main column. Simpler than
`control-panel` (no top header bar reserved as a structural region).

Reference demo: `demo/app-shell.html`.

```html
<body class="app-page">

  <!-- Fixed sidebar -->
  <nav class="sidebar sidebar-fixed">
    <span class="nd-nav-brand">AppName</span>
    <p class="nd-nav-section">Main</p>
    <ul class="nd-nav-menu">
      <li><a href="#" class="nd-active">Dashboard</a></li>
      <li><a href="#">Reports</a></li>
    </ul>
  </nav>

  <!-- Overlay for mobile sidebar toggle -->
  <div class="nd-nav-overlay"></div>

  <!-- Main content area — .app-main reserves the 16 rem sidebar gutter -->
  <div class="app-main">
    <!-- Optional top bar -->
    <nav class="nd-relative nd-mb-lg">
      <button class="nd-nav-toggle"
              aria-label="Toggle sidebar"
              data-nd-toggle="sidebar">&#9776;</button>
      <span class="nd-nav-brand">Page Title</span>
      <div class="nd-nav-end">
        <button class="nd-btn-ghost nd-btn-sm" data-nd-theme-toggle>Theme</button>
      </div>
    </nav>

    <!-- Page content. Do NOT wrap in .nd-container. -->
  </div>

</body>
```

### blog

Use for blog posts, articles, documentation, marketing copy, and
similar long-form reading. This is the only layout that uses
`.nd-container` and `.nd-prose`.

Reference demo: `demo/blog-post.html`.

```html
<body class="app-page">

  <!-- Top nav (flush to viewport edges courtesy of .app-page) -->
  <nav>
    <a href="/" class="nd-nav-brand">Brand <span class="nd-nav-brand-sub">Journal</span></a>
    <ul class="nd-nav-menu">
      <li><a href="#" class="nd-active">Home</a></li>
      <li><a href="#">Archive</a></li>
    </ul>
    <div class="nd-nav-end">
      <button class="nd-btn-secondary nd-btn-sm" data-nd-theme-toggle>Theme</button>
      <button class="nd-btn-primary nd-btn-sm">Subscribe</button>
    </div>
  </nav>

  <!-- Centered 900 px column; the article sits on a floating .nd-panel -->
  <main class="nd-container nd-mt-lg nd-mb-2xl">
    <div class="nd-panel nd-shadow-lg">
      <article class="nd-prose nd-mx-auto">
        <h1>Article title</h1>
        <p class="nd-text-lead">Lead paragraph.</p>
        <p>Long-form body text…</p>
      </article>
    </div>
  </main>

</body>
```

### Layout misuse

The framework's full-width default exists for a reason. Common
misuses, all of which MUST be avoided:

- **Do NOT wrap `control-panel` or `app-shell` content in
  `.nd-container`.** The narrow 900 px column is for prose only. Apply
  it to a dashboard and you waste horizontal space and break the grid.
- **Do NOT mix layouts.** Don't bolt a `.sidebar` onto a `blog`
  skeleton, don't drop a `.nd-prose` `<article>` into the `app-content`
  region of a `control-panel`, don't add `.app-layout` to a `blog`.
  Each skeleton's CSS assumes the structural elements it expects.
- **Do NOT invent a fourth canonical layout.** If none of the three
  fit, flag the case and discuss with the user before improvising. The
  three layouts cover dashboard, SaaS app, and editorial — most pages
  fit one of them.
- **Do NOT add custom `<style>` blocks to "tweak" a layout.** The
  framework is HTML-only (see [Philosophy](#philosophy)). If a layout
  visibly needs adjustment, the framework is missing a utility class
  or modifier and the fix belongs in the framework, not the page.
