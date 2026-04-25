# ndesign — Frontend Specification

ndesign is a small runtime that turns plain HTML attributes into data-bound,
server-talking UI. It is shipped as one CSS file and one JavaScript file that
a server-rendered page loads from a CDN. Pages declare behaviour with
`data-nd-*` attributes (HTML attributes the runtime processes at init time);
no build step, package manager, or client-side router is involved. This
document is the authoritative, self-contained specification for that runtime.
It is written to be read by coding agents that must build real applications
against the bundle alone.

Every runnable example targets the public test server at
`https://test.nitecon.org`. Examples can be pasted verbatim into an HTML
file and loaded in a browser.

## How to read this document

The spec is organised as one continuous document. Read it top-to-bottom the
first time, then use the table below to jump to a specific topic.

- **[Philosophy](#philosophy)** — the framework's nature, lifecycle, and
  layout posture. Read this before writing any markup.
- **[Getting started](#getting-started)** — CDN URLs, the minimal page, and
  a first taste of data binding.
- **[Layouts](#layouts)** — the three canonical page skeletons. **Agents
  MUST ask the user which layout to use** before writing markup.
- **[Data binding](#data-binding)** — the core runtime mechanics:
  `data-nd-bind`, `data-nd-action`, `data-nd-set`, `data-nd-model`,
  `data-nd-sse`, `data-nd-ws`, the unified error envelope, lifecycle, and
  pitfalls. This section is the heart of the spec.
- **[Reference](#reference)** — alphabetical lookup tables for every
  attribute, meta tag, runtime class, JS API method, and event.

Component sections appear after **Data binding** and before
**Reference**. Each component is self-contained.

### Components

Visual primitives:

- [Typography](#typography), [Buttons](#buttons), [Forms](#forms),
  [Tables](#tables), [Cards](#cards), [Panels](#panels),
  [Wells](#wells), [Alerts](#alerts), [Badges](#badges),
  [Breadcrumbs](#breadcrumbs), [Pagination](#pagination),
  [Skeletons](#skeletons), [Progress](#progress), [Avatars](#avatars),
  [Asides](#asides).

Interactive components:

- [Modals](#modals), [Toasts](#toasts), [Tooltips](#tooltips),
  [Tabs](#tabs), [Dropdowns](#dropdowns), [Navigation](#navigation),
  [Select](#select), [Theme](#theme), [Sortable](#sortable),
  [Upload](#upload).

When this document and the runtime source diverge, the source
(`js/*.js` and the compiled `dist/ndesign.min.js` + `dist/ndesign.min.css`)
wins. Open an issue or PR against the spec when you find a mismatch.
