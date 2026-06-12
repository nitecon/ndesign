## Select

> **Rules**
> - Every non-`multiple` `<select>` is auto-enhanced — write a plain `<select>` and ndesign wraps it; do NOT build `.nd-select` markup by hand.
> - For **dynamic options from JSON**: add `data-nd-bind` + `data-nd-options='VALUE:LABEL'` to the `<select>`. Static options (e.g. placeholder) are preserved across fetches; runtime options carry `data-nd-generated`.
> - After any programmatic `<option>` mutation, call `NDesign.refreshSelect(selectEl)` to rebuild the themed wrapper. Binding-driven population does this automatically.
> - Opt out of enhancement with `multiple` OR by pre-wrapping in `.nd-select` before `initSelects()` runs.
> - The open dropdown MUST NOT be clipped — ancestor panels, cards, and tables must NOT have `overflow: hidden` while a select is open.

### Dynamic-options recipe

Populate a `<select>` from a JSON array at runtime:

```html
<!-- Server returns: [{"id":1,"name":"Run A"},{"id":2,"name":"Run B"}] -->
<label for="run">Training run</label>
<select id="run" name="run"
        data-nd-bind="${api}/api/training/runs"
        data-nd-options="id:name">
  <option value="">Choose a run…</option>   <!-- static; preserved on refetch -->
</select>
```

- `data-nd-options="id:name"` — `value` from `item.id`, visible label from `item.name`.
- Runtime-generated options receive a `data-nd-generated` attribute; only these are removed on refetch.
- The custom-dropdown wrapper is rebuilt automatically by `refreshSelect()` after population; no extra JS needed.
- To refresh on a store change: `data-nd-success="refresh:#run"` or dispatch `nd:refresh` on the select element.

---

ndesign auto-enhances every non-multi `<select>` on the page into a
themed `.nd-select` wrapper at init time. The native `<select>` is hidden
but **kept in the layout** (zero-sized, opacity 0) so browser form
validation, the form-submission value, and `<label for>` association all
continue to work. The visible UI is a custom listbox driven by the
runtime, fully keyboard-accessible.

### When to use

- Single-choice form fields where consistent theming across browsers
  matters.
- Selects whose options are populated dynamically from a server response
  via [Data binding](#data-binding) (`data-nd-options`).

### When NOT to use

- For multi-select inputs — `<select multiple>` is **skipped** at init
  and rendered as the native control. Ndesign does not provide a
  multi-select widget.
- For action menus — use [Dropdowns](#dropdowns).
- For very long option lists requiring server-side search — author a
  custom search input plus [Data binding](#data-binding) result list.

### Minimal example

```html
<label for="country">Country</label>
<select id="country" name="country" required>
  <option value="">Choose a country</option>
  <optgroup label="Europe">
    <option value="de">Germany</option>
    <option value="fr">France</option>
  </optgroup>
  <optgroup label="Americas">
    <option value="us" selected>United States</option>
    <option value="ca">Canada</option>
  </optgroup>
</select>
```

### Markup and classes

Authors write a plain `<select>`. The runtime inserts the wrapper
markup as a sibling immediately after the native element. The following
classes describe the runtime-generated DOM for theming reference.

| Class                       | Effect                                                                |
|-----------------------------|-----------------------------------------------------------------------|
| `.nd-select`                | Custom wrapper. `position: relative`.                                 |
| `.nd-select.nd-open`        | Runtime-applied while the dropdown is expanded.                       |
| `.nd-select.nd-disabled`    | Mirrors `<select disabled>`.                                          |
| `.nd-select-trigger`        | The visible `<button type="button">` that toggles the listbox.        |
| `.nd-select-value`          | The `<span>` showing the current option's label.                      |
| `.nd-select-arrow`          | Decorative chevron.                                                   |
| `.nd-select-dropdown`       | The `<ul role="listbox">`.                                            |
| `.nd-select-option`         | A `<li role="option">`.                                               |
| `.nd-select-option.nd-selected`    | Currently selected option.                                     |
| `.nd-select-option.nd-highlighted` | Keyboard / hover focus marker.                                  |
| `.nd-select-option.nd-disabled`    | Mirrors `<option disabled>`.                                    |
| `.nd-select-group`          | A `<li role="presentation">` rendered from each `<optgroup>` label.   |

`<optgroup>` labels are rendered as inert section headings; the options
inside are flat in the listbox.

### Dynamic bindings

The select wrapper itself does not consume `data-nd-*` attributes — but
two binding directives work in concert with this component:

| Attribute              | Location          | Behavior                                                                                                                     |
|------------------------|-------------------|------------------------------------------------------------------------------------------------------------------------------|
| `data-nd-options`      | the `<select>`    | Populates `<option>` elements from a JSON array fetched by [Data binding](#data-binding). Mechanics live in [Data binding](#data-binding). |
| `data-nd-bind`         | the `<select>`    | Re-fetches the option list when triggered. The binding runtime rebuilds the custom wrapper after `data-nd-options` populates options. |

When the native option list changes through application code
(`appendChild`, direct `innerHTML`, etc.) the visible custom dropdown
does not auto-rebuild. Call `NDesign.refreshSelect(selectEl)` to
rewrap. Binding-driven `data-nd-options` population does this
automatically.

### Events fired

The custom select forwards selection changes to the native `<select>`
and dispatches a standard bubbling `change` event on it. Application
code (and `data-nd-model`) MAY listen for `change` on the native
element exactly as it would for an unenhanced select.

### JS API

```javascript
import { initSelects, refreshSelect, destroySelects } from 'ndesign';
// or via NDesign global once init() has run
```

| Method                          | Behavior                                                                                                                                                  |
|---------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `initSelects()`                 | Wraps every eligible `<select>` (skips `multiple` and any select already inside `.nd-select`). Called automatically by `NDesign.init()`.                  |
| `refreshSelect(selectEl)`       | Tear down and rebuild the custom dropdown for one `<select>`. No-op if the element is not tracked. Used after `<option>` mutations.                       |
| `destroySelects()`              | Restore every native `<select>` and remove every wrapper. Called by `NDesign.init()` on re-init.                                                          |

### Accessibility

- The trigger has `aria-haspopup="listbox"` and `aria-expanded` synced
  with the open state.
- The list has `role="listbox"`; each option carries `role="option"` and
  `aria-selected` reflects the current value.
- A `<label for>` associated with the native `<select>` is mirrored as
  `aria-label` on the trigger so the visible custom UI is announced
  correctly.
- The native element is **not** removed — `required`, `pattern`, and
  custom validity messages still fire; submitting the form sends the
  native value.

Keyboard map (focus on the trigger):

| Key                 | Effect                                                                       |
|---------------------|------------------------------------------------------------------------------|
| `ArrowDown`         | Open if closed and highlight first / next option. Skips disabled options.    |
| `ArrowUp`           | Open if closed and highlight last / previous option. Skips disabled options. |
| `Enter` / `Space`   | Open if closed; otherwise commit the highlighted option.                     |
| `Escape`            | Close the dropdown without changing the value.                               |
| Printable character | Type-ahead: jump to the first option whose label starts with the buffered string. Buffer resets after 500 ms of inactivity. |

The dropdown closes on outside click. A form `reset` event re-syncs the
trigger label and the highlighted option after a deferred tick.

### Pitfalls

- The runtime checks for `<select multiple>` and **skips it**. If you
  need a multi-select, the native control is what your users see.
- Mutating `<option>` children after init does **not** update the
  custom UI. Call `NDesign.refreshSelect(selectEl)` after any
  programmatic mutation.
- To opt out of enhancement, either set `multiple` or wrap the
  `<select>` inside an existing `.nd-select` ancestor before
  `initSelects()` runs (the runtime detects pre-wrapped selects and
  leaves them alone).
- Custom `setCustomValidity()` messages are cleared automatically on
  every `change` event so the validation reset matches the visible
  UI's behavior.

### See also

- [Data binding](#data-binding) — `data-nd-options` and `data-nd-model`.
- [Dropdowns](#dropdowns) — for non-form action menus.
- Source: `js/select.js`, `scss/_forms.scss`
