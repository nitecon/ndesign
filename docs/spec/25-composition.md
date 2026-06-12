## Composition & stacking

> **Rules**
> - **Panel** = PRIMARY container for raw/primary data in the main grid. Use it first.
> - **Card** = region that needs a distinct header/body/footer split; sits INSIDE a panel or standalone in a grid.
> - **Well** = secondary inset for quoted content, code, empty states, or key facts; ALWAYS inside a panel or card.
> - **Aside** = small informational callouts only; keep OUTSIDE the main data panel.
> - Nest up to 3 levels where each layer adds visual and semantic meaning — `Panel › Card › Well` is the canonical stack. Stop at 3; flatten a 4th surface.
> - Never nest a container just to add spacing — use padding utilities instead.

### Container roles at a glance

| Container | Role | Lives inside | Children |
|-----------|------|-------------|----------|
| Panel | Primary data wrapper | Main grid | Anything, incl. cards |
| Card | Scannable item with header/footer | Panel or grid | Body content, wells |
| Well | Inset secondary info | Panel or card body | Text, code, figures |
| Aside | Tangential callout | Outside data panels | Brief prose only |

### Layer diagram

```
app-content (main grid)
├── section.nd-panel            ← Level 1 · PRIMARY data region
│   ├── article.nd-card         ← Level 2 · scannable item / overview
│   │   ├── .nd-card-header
│   │   ├── .nd-card-body
│   │   │   └── div.nd-well     ← Level 3 · key facts / code / quotes
│   │   └── .nd-card-footer
│   └── article.nd-card         ← another card in the same panel
└── aside (or .fold)            ← Aside lives OUTSIDE the data panel
```

A fourth level of nesting (e.g. a well inside a card inside a panel inside another panel) creates visual noise that degrades readability and conflicts with the inner-shadow model. Flatten: promote the inner surface or eliminate a layer.

### Example 1 — panel with an aside

Use this pattern for the most common dashboard layout: a main data panel alongside a small informational callout.

```html
<main class="app-content">

  <!-- Primary data region -->
  <section class="nd-panel">
    <header class="nd-panel-header">
      <h2>Run #42 — results</h2>
    </header>
    <p>Accuracy: <strong>94.7 %</strong></p>
    <p>Loss: <strong>0.213</strong></p>
    <footer class="nd-panel-footer">
      <button class="nd-btn-primary nd-btn-sm">Export</button>
    </footer>
  </section>

  <!-- Small informational aside — OUTSIDE the panel -->
  <aside>
    <strong>Note.</strong> Results reflect the validation split only.
    Re-run on the full dataset before publishing.
  </aside>

</main>
```

### Example 2 — Panel › Card › Well (three-level stack)

Use this pattern when a panel contains discrete items (cards) and each item includes a highlighted fact block (well).

```html
<section class="nd-panel">
  <header class="nd-panel-header">
    <h2>Recent deployments</h2>
  </header>

  <article class="nd-card">
    <header class="nd-card-header">
      <h3 class="nd-card-title">v1.4.0 — production</h3>
      <span class="nd-badge nd-badge-success">Live</span>
    </header>
    <div class="nd-card-body">
      <p>Deployed by Alice · 2 hours ago</p>
      <!-- Well for a key fact block inside the card -->
      <div class="nd-well nd-well-sm">
        <p class="nd-well-title">Config snapshot</p>
        <pre><code>replicas: 3
strategy: rolling</code></pre>
      </div>
    </div>
    <footer class="nd-card-footer">
      <button class="nd-btn-ghost nd-btn-sm">View logs</button>
    </footer>
  </article>

</section>
```

### Pitfalls

- **Do NOT add a fourth nested surface.** If you reach Panel › Card › Well → *something else*, flatten: either merge the fourth level's content into the well, or pull it out as a sibling card.
- **Asides inside a data panel produce visual confusion** — the left-accent strip reads as an error callout beside your data. Keep asides as siblings of panels, not children.
- **Do NOT use a card just to add a border.** If there is no logical header/footer division, use a panel.
- **Do NOT wrap a well in a well.** Double-inset shadows fight each other visually. Merge the content.

### See also

- [Layouts](#layouts) — the three canonical page skeletons that host panels and asides.
- [Panels](#panels), [Cards](#cards), [Wells](#wells), [Asides](#asides)
