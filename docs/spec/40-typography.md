## Typography

ndesign styles the full HTML5 text-level vocabulary by default. Native headings (`<h1>`–`<h6>`), inline elements (`<code>`, `<kbd>`, `<samp>`, `<abbr>`, `<cite>`, `<mark>`), and block elements (`<pre>`, `<address>`, `<figure>`, `<details>`) render correctly without any classes. Modifier classes only exist for cases the native vocabulary cannot express.

### When to use

- Use semantic HTML first: `<h2>` for a section heading, `<code>` for inline code, `<kbd>` for a key, `<mark>` for a highlight.
- Reach for a class only to alter color, weight, or alignment beyond the semantic default.

### Minimal example

```html
<h1>Account settings</h1>
<p class="nd-text-lead">Manage your profile, security, and notifications.</p>

<p>Press <kbd>Ctrl</kbd>+<kbd>S</kbd> to save. The <code>email</code> field
is <mark>required</mark>.</p>

<details>
  <summary>Advanced options</summary>
  <p>Hidden until the disclosure is opened.</p>
</details>
```

### Native elements styled by default

| Element | Treatment |
|---|---|
| `<h1>`–`<h6>` | Tight line-height, decreasing scale, semibold/bold weights |
| `<code>` | Inline mono on a tinted background |
| `<pre>` | Block mono with horizontal scroll on overflow |
| `<kbd>` | Keycap appearance (border + inset shadow) |
| `<samp>` | Same surface as `<code>` (program output) |
| `<abbr title>` | Dotted underline, help cursor |
| `<cite>` | Italic, muted color |
| `<mark>` | Highlighted on the warning tint |
| `<figure>` / `<figcaption>` | Reset margin; caption is small and muted |
| `<details>` / `<summary>` | Bordered disclosure with a rotating marker |
| `<address>` | Italic reset, treated as a normal block |

### Modifier classes

| Class | Effect |
|---|---|
| `.nd-h1` … `.nd-h6` | Apply heading styles to a non-heading element (e.g. a `<div>`) |
| `.nd-text-lead` | Larger, looser body lead-in paragraph |
| `.nd-text-small` | `font-size: sm` |
| `.nd-text-xs` | `font-size: xs` |
| `.nd-text-muted` | `color: var(--nd-text-muted)` |
| `.nd-text-secondary` | `color: var(--nd-text-secondary)` |
| `.nd-text-accent` | `color: var(--nd-accent)` |
| `.nd-text-success` / `.nd-text-warning` / `.nd-text-danger` / `.nd-text-info` | Semantic colors |
| `.nd-text-left` / `.nd-text-center` / `.nd-text-right` / `.nd-text-justify` | Alignment |
| `.nd-text-uppercase` / `.nd-text-lowercase` / `.nd-text-capitalize` | Casing |
| `.nd-text-truncate` | Single-line ellipsis (`overflow: hidden; text-overflow: ellipsis`) |
| `.nd-text-break` | `overflow-wrap: anywhere` |
| `.nd-text-nowrap` | `white-space: nowrap` |
| `.nd-font-normal` / `.nd-font-medium` / `.nd-font-semibold` / `.nd-font-bold` | Weight overrides |
| `.nd-link-muted` | Muted-color link that brightens on hover |
| `.nd-prose` | Long-form container: 75ch max-width, looser leading, styled descendants (lists, blockquote, links, images) |

### Pitfalls

- Do NOT set heading sizes manually with `.nd-text-*` classes. Use the actual `<h1>`–`<h6>` element so screen readers and document outlines work.
- `.nd-prose` deliberately constrains `max-width: 75ch`. Wrap a UI region in `.nd-prose` only if it is long-form reading content.
- The Inter / JetBrains Mono `@import` is hard-coded in `_typography.scss`. Pages served offline MUST self-host these fonts and override the `--nd-font-family-*` tokens.

### See also

- [Buttons](#buttons), [Forms](#forms)
- Source: `scss/_typography.scss`, `scss/_utilities.scss`
