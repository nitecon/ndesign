/**
 * Unit tests for sortable.js — node:test with a minimal DOM stub.
 * Because sortable.js uses browser globals (document, HTMLElement, etc.)
 * we install lightweight stubs before importing the module.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Minimal DOM stub — just enough for sortable's logic to run.
// ---------------------------------------------------------------------------

class FakeElement {
  constructor(tag) {
    this.tagName = (tag || 'DIV').toUpperCase();
    this.children = [];
    this.classList = {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    };
    this._attrs = {};
    this._listeners = {};
    this.nodeType = 1;
    this.textContent = '';
    this.dataset = {};
    this.style = {};
    this.parentElement = null;
  }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; }
  hasAttribute(k) { return k in this._attrs; }
  removeAttribute(k) { delete this._attrs[k]; }
  addEventListener(ev, fn) {
    if (!this._listeners[ev]) this._listeners[ev] = [];
    this._listeners[ev].push(fn);
  }
  removeEventListener(ev, fn) {
    if (!this._listeners[ev]) return;
    this._listeners[ev] = this._listeners[ev].filter(f => f !== fn);
  }
  dispatchEvent(evt) {
    const handlers = this._listeners[evt.type] || [];
    for (const h of handlers) h(evt);
    return true;
  }
  appendChild(child) {
    child.parentElement = this;
    // Remove from current parent's children if already there.
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    this.children.push(child);
    return child;
  }
  insertBefore(newNode, refNode) {
    newNode.parentElement = this;
    const fromIdx = this.children.indexOf(newNode);
    if (fromIdx !== -1) this.children.splice(fromIdx, 1);
    const toIdx = refNode ? this.children.indexOf(refNode) : this.children.length;
    this.children.splice(toIdx === -1 ? this.children.length : toIdx, 0, newNode);
    return newNode;
  }
  get previousElementSibling() {
    if (!this.parentElement) return null;
    const idx = this.parentElement.children.indexOf(this);
    return idx > 0 ? this.parentElement.children[idx - 1] : null;
  }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const idx = siblings.indexOf(this);
    return idx < siblings.length - 1 ? siblings[idx + 1] : null;
  }
  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) this.parentElement.children.splice(idx, 1);
      this.parentElement = null;
    }
  }
  contains(el) {
    if (el === this) return true;
    for (const child of this.children) {
      if (child.contains && child.contains(el)) return true;
    }
    return false;
  }
  closest(selector) {
    // Only handles [attr="val"] and [attr] patterns needed by sortable.
    const attrEqMatch = selector.match(/^\[([^=\]]+)="([^"]+)"\]$/);
    if (attrEqMatch) {
      const [, attr, val] = attrEqMatch;
      let el = this;
      while (el) {
        if (el.getAttribute && el.getAttribute(attr) === val) return el;
        el = el.parentElement;
      }
      return null;
    }
    const attrMatch = selector.match(/^\[([^\]]+)\]$/);
    if (attrMatch) {
      const [, attr] = attrMatch;
      let el = this;
      while (el) {
        if (el.hasAttribute && el.hasAttribute(attr)) return el;
        el = el.parentElement;
      }
      return null;
    }
    return null;
  }
  get firstElementChild() { return this.children[0] || null; }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement('BODY');
    this._elements = new Map();
  }
  createElement(tag) { return new FakeElement(tag); }
  querySelector(selector) {
    // Support [data-nd-sortable] and [data-nd-sortable-live].
    const attrMatch = selector.match(/^\[([^\]]+)\]$/);
    if (attrMatch) {
      const attr = attrMatch[1];
      return this._findByAttr(this.body, attr);
    }
    return null;
  }
  querySelectorAll(selector) {
    const attrMatch = selector.match(/^\[([^\]]+)\]$/);
    if (attrMatch) {
      const attr = attrMatch[1];
      const results = [];
      this._collectByAttr(this.body, attr, results);
      return results;
    }
    return [];
  }
  _findByAttr(el, attr) {
    if (el.hasAttribute && el.hasAttribute(attr)) return el;
    for (const child of (el.children || [])) {
      const found = this._findByAttr(child, attr);
      if (found) return found;
    }
    return null;
  }
  _collectByAttr(el, attr, results) {
    if (el.hasAttribute && el.hasAttribute(attr)) results.push(el);
    for (const child of (el.children || [])) {
      this._collectByAttr(child, attr, results);
    }
  }
}

class FakeCustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init && init.detail;
    this.bubbles = init && init.bubbles;
  }
}

class FakeMutationObserver {
  constructor(cb) { this._cb = cb; this._target = null; }
  observe(target, opts) { this._target = target; target.__fakeObserver = this; }
  disconnect() { if (this._target) delete this._target.__fakeObserver; }
  // Test helper: trigger as if nodes were added.
  triggerAdded(nodes) {
    this._cb([{ addedNodes: nodes }]);
  }
}

// Install globals before module import.
global.document = new FakeDocument();
global.HTMLElement = FakeElement;
global.CustomEvent = FakeCustomEvent;
global.MutationObserver = FakeMutationObserver;
global.requestAnimationFrame = (fn) => { fn(); };

// ---------------------------------------------------------------------------
// Now import sortable (must be after globals are set).
// ---------------------------------------------------------------------------
const { initSortable, destroySortable } = await import('./sortable.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(tag = 'DIV', action = '') {
  const c = new FakeElement(tag);
  c.setAttribute('data-nd-sortable', action);
  // Register it so querySelectorAll can find it.
  global.document.body.appendChild(c);
  return c;
}

function addItem(container, id) {
  const item = new FakeElement('DIV');
  item.dataset = { id };
  item.setAttribute('data-id', id);
  item.textContent = `Item ${id}`;
  container.appendChild(item);
  return item;
}

function fireKeydown(container, key, targetItem) {
  const evt = {
    type: 'keydown',
    key,
    currentTarget: container,
    target: targetItem,
    preventDefault: () => {},
  };
  const handlers = container._listeners['keydown'] || [];
  for (const h of handlers) h(evt);
}

// Reset state between tests: destroy + rebuild document body.
function resetDOM() {
  destroySortable();
  global.document = new FakeDocument();
  // Re-point to fresh document.
  global.document.body = new FakeElement('BODY');
}

// ---------------------------------------------------------------------------
// Tests: Public API surface
// ---------------------------------------------------------------------------

test('sortable exports initSortable and destroySortable', () => {
  assert.equal(typeof initSortable, 'function');
  assert.equal(typeof destroySortable, 'function');
});

// ---------------------------------------------------------------------------
// Tests: FE-1 adjacency — collectOrder falls back to index
// ---------------------------------------------------------------------------

describe('collectOrder', () => {
  beforeEach(() => { resetDOM(); });

  test('marks children draggable on init', () => {
    const c = makeContainer();
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    initSortable();
    assert.equal(a.getAttribute('draggable'), 'true');
    assert.equal(b.getAttribute('draggable'), 'true');
  });

  test('sets role=listbox on non-UL/OL container', () => {
    const c = makeContainer('DIV');
    addItem(c, 'x');
    initSortable();
    assert.equal(c.getAttribute('role'), 'listbox');
  });

  test('does not overwrite existing role', () => {
    const c = makeContainer('DIV');
    c.setAttribute('role', 'list');
    addItem(c, 'x');
    initSortable();
    assert.equal(c.getAttribute('role'), 'list');
  });

  test('sets aria-label when none present', () => {
    const c = makeContainer();
    addItem(c, 'x');
    initSortable();
    assert.ok(c.getAttribute('aria-label'));
  });

  test('skips already-initialized containers', () => {
    const c = makeContainer();
    addItem(c, 'a');
    initSortable();
    initSortable(); // second call must not double-register
    assert.equal((c._listeners['dragstart'] || []).length, 1);
  });
});

// ---------------------------------------------------------------------------
// Tests: FE-2 — Keyboard pattern
// ---------------------------------------------------------------------------

describe('keyboard grab/move/drop (FE-2)', () => {
  beforeEach(() => { resetDOM(); });

  test('Space grabs item — sets aria-grabbed and nd-kb-grabbed class', () => {
    const c = makeContainer();
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    initSortable();

    fireKeydown(c, ' ', a);
    assert.equal(a.getAttribute('aria-grabbed'), 'true');
    assert.ok(a.classList.contains('nd-kb-grabbed'));
  });

  test('ArrowDown with grab moves item down', () => {
    const c = makeContainer();
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    initSortable();

    fireKeydown(c, ' ', a);          // grab a
    fireKeydown(c, 'ArrowDown', a);  // move a down past b

    assert.equal(c.children[0], b);
    assert.equal(c.children[1], a);
  });

  test('ArrowUp with grab moves item up', () => {
    const c = makeContainer();
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    initSortable();

    fireKeydown(c, ' ', b);        // grab b
    fireKeydown(c, 'ArrowUp', b);  // move b up past a

    assert.equal(c.children[0], b);
    assert.equal(c.children[1], a);
  });

  test('Home with grab moves item to first position', () => {
    const c = makeContainer();
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    const cc = addItem(c, 'c');
    initSortable();

    fireKeydown(c, ' ', cc);      // grab c (last)
    fireKeydown(c, 'Home', cc);   // move to first

    assert.equal(c.children[0], cc);
  });

  test('End with grab moves item to last position', () => {
    const c = makeContainer();
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    const cc = addItem(c, 'c');
    initSortable();

    fireKeydown(c, ' ', a);      // grab a (first)
    fireKeydown(c, 'End', a);    // move to last

    assert.equal(c.children[c.children.length - 1], a);
  });

  test('Space (second) drops item and fires nd:sortable:reorder', () => {
    const c = makeContainer();
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    initSortable();

    let firedEvent = null;
    c.addEventListener('nd:sortable:reorder', (e) => { firedEvent = e; });

    fireKeydown(c, ' ', a);          // grab
    fireKeydown(c, 'ArrowDown', a);  // move
    fireKeydown(c, ' ', a);          // drop

    assert.ok(firedEvent, 'nd:sortable:reorder should fire on drop');
    assert.equal(a.getAttribute('aria-grabbed'), 'false');
    assert.ok(!a.classList.contains('nd-kb-grabbed'));
  });

  test('Escape cancels and reverts DOM order', () => {
    const c = makeContainer();
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    initSortable();

    fireKeydown(c, ' ', a);          // grab a
    fireKeydown(c, 'ArrowDown', a);  // move a to position 2

    // Before escape: b is first.
    assert.equal(c.children[0], b);

    fireKeydown(c, 'Escape', a);     // cancel

    // After escape: a should be back at first.
    assert.equal(c.children[0], a);
    assert.equal(a.getAttribute('aria-grabbed'), 'false');
  });

  test('ArrowDown without grab moves focus (no DOM reorder)', () => {
    const c = makeContainer();
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    // Patch focus to detect call.
    let focused = null;
    b.focus = () => { focused = b; };
    initSortable();

    fireKeydown(c, 'ArrowDown', a);  // no grab — should focus b

    assert.equal(focused, b);
    // DOM order unchanged.
    assert.equal(c.children[0], a);
    assert.equal(c.children[1], b);
  });
});

// ---------------------------------------------------------------------------
// Tests: FE-3 — MutationObserver auto-init
// ---------------------------------------------------------------------------

describe('MutationObserver auto-wires new children (FE-3)', () => {
  beforeEach(() => { resetDOM(); });

  test('dynamically added child gets draggable + tabindex', () => {
    const c = makeContainer();
    addItem(c, 'a');
    initSortable();

    // Simulate adding a new child.
    const newItem = new FakeElement('DIV');
    newItem.textContent = 'New';
    newItem.dataset = {};
    c.appendChild(newItem);

    // Trigger the observer manually.
    const obs = c.__fakeObserver;
    assert.ok(obs, 'MutationObserver should be attached');
    obs.triggerAdded([newItem]);

    assert.equal(newItem.getAttribute('draggable'), 'true');
    assert.equal(newItem.getAttribute('tabindex'), '0');
  });
});

// ---------------------------------------------------------------------------
// Tests: FE-4 — Revert on failure (via submitReorder / revertAndNotify)
// ---------------------------------------------------------------------------

describe('revert on failure (FE-4)', () => {
  beforeEach(() => { resetDOM(); });

  test('nd:sortable:revert event is dispatched on non-2xx via keyboard drop', async () => {
    // Setup a container with an action that will fail.
    const c = makeContainer('DIV', 'POST /api/test-fail');
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    initSortable();

    let revertFired = false;
    c.addEventListener('nd:sortable:revert', () => { revertFired = true; });

    // Mock fetch to return a 500.
    const origFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 500 });

    // Keyboard grab → move → drop → triggers submitReorder.
    fireKeydown(c, ' ', a);
    fireKeydown(c, 'ArrowDown', a);
    fireKeydown(c, ' ', a);

    // Wait for async submitReorder.
    await new Promise(r => setTimeout(r, 20));

    assert.ok(revertFired, 'nd:sortable:revert should fire on server failure');

    // Restore.
    global.fetch = origFetch;
  });

  test('keyboard drop uses real snapshot — DOM reverts to original order on failure', async () => {
    const c = makeContainer('DIV', 'POST /api/test-fail');
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    initSortable();

    const origFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 500, headers: { get: () => null } });

    // Grab a, move down (so b is first), then drop.
    fireKeydown(c, ' ', a);
    fireKeydown(c, 'ArrowDown', a);
    // After move: b is [0], a is [1].
    assert.equal(c.children[0], b);
    fireKeydown(c, ' ', a);

    await new Promise(r => setTimeout(r, 30));

    // After server failure + revert: a must be back at [0].
    assert.equal(c.children[0], a, 'DOM should revert to pre-drag order');
    assert.equal(c.children[1], b);

    global.fetch = origFetch;
  });

  test('server errors._form message shown in toast on non-2xx JSON response', async () => {
    const c = makeContainer('DIV', 'POST /api/test-fail');
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    initSortable();

    let toastMessage = null;
    // Intercept toast by patching the imported module via global mock on document.body.appendChild.
    // Simpler: check the aria-live announcer text after async completes.
    const liveEl = global.document.querySelector('[data-nd-sortable-live]')
      || (() => { const el = global.document.createElement('div'); el.setAttribute('data-nd-sortable-live', ''); global.document.body.appendChild(el); return el; })();

    const origFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 500,
      headers: { get: (h) => h === 'Content-Type' ? 'application/json' : null },
      json: async () => ({ errors: { _form: 'Simulated reorder failure' } }),
    });

    fireKeydown(c, ' ', a);
    fireKeydown(c, 'ArrowDown', a);
    fireKeydown(c, ' ', a);

    await new Promise(r => setTimeout(r, 30));

    // The aria-live region should contain the server's message.
    assert.equal(liveEl.textContent, 'Simulated reorder failure');

    global.fetch = origFetch;
  });

  test('submitReorder uses buildHeaders (CSRF token included when meta present)', async () => {
    // Install a csrf meta tag into fake document.
    const meta = new FakeElement('META');
    meta.setAttribute('name', 'csrf-token');
    meta.setAttribute('content', 'test-csrf-abc');
    global.document.body.appendChild(meta);
    // Override querySelector to find meta[name="csrf-token"].
    const origQS = global.document.querySelector.bind(global.document);
    global.document.querySelector = (sel) => {
      if (sel === 'meta[name="csrf-token"]') return meta;
      return origQS(sel);
    };

    let capturedHeaders = null;
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => {
      capturedHeaders = opts.headers;
      return { ok: true };
    };

    const c = makeContainer('DIV', 'POST /api/reorder');
    const a = addItem(c, 'a');
    const b = addItem(c, 'b');
    initSortable();

    fireKeydown(c, ' ', a);
    fireKeydown(c, ' ', a);

    await new Promise(r => setTimeout(r, 20));

    assert.ok(capturedHeaders, 'fetch should have been called');
    assert.equal(capturedHeaders['X-CSRF-Token'], 'test-csrf-abc', 'CSRF token must be in request headers');

    global.fetch = origFetch;
    global.document.querySelector = origQS;
    // Clean up meta from body.
    meta.remove();
  });

  test('destroySortable disconnects observer and removes attributes', () => {
    const c = makeContainer();
    const a = addItem(c, 'a');
    initSortable();

    assert.equal(a.getAttribute('draggable'), 'true');
    destroySortable();

    assert.equal(a.getAttribute('draggable'), null);
    assert.equal(a.getAttribute('tabindex'), null);
    assert.equal(c.__ndSortableBound, undefined);
  });
});

// ---------------------------------------------------------------------------
// Tests: Cross-container drag (data-nd-sortable-group)
// ---------------------------------------------------------------------------

/**
 * Fire a synthetic mouse-drag event on `container`. Callers pass the
 * listener-matching `target` (e.g. the dragged item for dragstart, the
 * hover target for dragover). `preventDefaulted` is flipped whenever a
 * handler calls `preventDefault()` — used by cross-container tests to
 * assert that an intended drop target was actually accepted.
 * @param {FakeElement} container
 * @param {string}      type
 * @param {FakeElement} target
 * @param {Object}      [extra]
 */
function fireDrag(container, type, target, extra = {}) {
  const state = { defaulted: false };
  const evt = {
    type,
    target,
    currentTarget: container,
    clientY: extra.clientY !== undefined ? extra.clientY : 0,
    preventDefault: () => { state.defaulted = true; },
    dataTransfer: {
      effectAllowed: '',
      dropEffect: '',
      setData: () => {},
    },
    ...extra,
  };
  const handlers = container._listeners[type] || [];
  for (const h of handlers) h(evt);
  return state;
}

describe('cross-container drag (data-nd-sortable-group)', () => {
  beforeEach(() => { resetDOM(); });

  test('item moves to another container when groups match', () => {
    const src = makeContainer('UL', 'POST /api/src');
    src.setAttribute('data-nd-sortable-group', 'tasks');
    const dst = makeContainer('UL', 'POST /api/dst');
    dst.setAttribute('data-nd-sortable-group', 'tasks');

    const a = addItem(src, 'a');
    const b = addItem(dst, 'b');
    // Stub getBoundingClientRect so insertBefore math runs.
    b.getBoundingClientRect = () => ({ top: 0, height: 20 });
    initSortable();

    fireDrag(src, 'dragstart', a);
    const over = fireDrag(dst, 'dragover', b, { clientY: 5 });

    assert.ok(over.defaulted, 'dragover on matching-group container must preventDefault');
    assert.equal(a.parentElement, dst, 'item should move into destination container');
  });

  test('item does NOT move when groups differ', () => {
    const src = makeContainer('UL', 'POST /api/src');
    src.setAttribute('data-nd-sortable-group', 'alpha');
    const dst = makeContainer('UL', 'POST /api/dst');
    dst.setAttribute('data-nd-sortable-group', 'beta');

    const a = addItem(src, 'a');
    const b = addItem(dst, 'b');
    b.getBoundingClientRect = () => ({ top: 0, height: 20 });
    initSortable();

    fireDrag(src, 'dragstart', a);
    fireDrag(dst, 'dragover', b, { clientY: 5 });

    assert.equal(a.parentElement, src, 'item must stay in source when groups do not match');
  });

  test('item does NOT move when neither container has a group', () => {
    const src = makeContainer('UL', 'POST /api/src');
    const dst = makeContainer('UL', 'POST /api/dst');

    const a = addItem(src, 'a');
    const b = addItem(dst, 'b');
    b.getBoundingClientRect = () => ({ top: 0, height: 20 });
    initSortable();

    fireDrag(src, 'dragstart', a);
    fireDrag(dst, 'dragover', b, { clientY: 5 });

    assert.equal(a.parentElement, src, 'no group => no cross-container drop');
  });

  test('dropping into empty same-group container appends the item', () => {
    const src = makeContainer('UL', 'POST /api/src');
    src.setAttribute('data-nd-sortable-group', 'tasks');
    const dst = makeContainer('UL', 'POST /api/dst');
    dst.setAttribute('data-nd-sortable-group', 'tasks');

    const a = addItem(src, 'a');
    initSortable();

    fireDrag(src, 'dragstart', a);
    const over = fireDrag(dst, 'dragover', dst, { clientY: 5 });

    assert.ok(over.defaulted, 'dragover on empty destination must preventDefault');
    assert.equal(a.parentElement, dst);
  });

  test('cross-container drop POSTs to destination URL, not source', async () => {
    const src = makeContainer('UL', 'POST /api/src-reorder');
    src.setAttribute('data-nd-sortable-group', 'tasks');
    const dst = makeContainer('UL', 'POST /api/dst-reorder');
    dst.setAttribute('data-nd-sortable-group', 'tasks');

    const a = addItem(src, 'a');
    const b = addItem(dst, 'b');
    b.getBoundingClientRect = () => ({ top: 0, height: 20 });
    initSortable();

    let capturedUrl = null;
    let capturedBody = null;
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => {
      capturedUrl = url;
      capturedBody = opts.body;
      return { ok: true };
    };

    fireDrag(src, 'dragstart', a);
    fireDrag(dst, 'dragover', b, { clientY: 5 });
    fireDrag(dst, 'dragend', a);

    await new Promise(r => setTimeout(r, 20));

    assert.equal(capturedUrl, '/api/dst-reorder', 'POST must target destination URL');
    const body = JSON.parse(capturedBody);
    assert.ok(body.order.includes('a'), 'body order must include the moved item');

    global.fetch = origFetch;
  });

  test('cross-container drop fires nd:sortable:reorder with crossContainer=true', async () => {
    const src = makeContainer('UL', 'POST /api/src');
    src.setAttribute('data-nd-sortable-group', 'tasks');
    const dst = makeContainer('UL', 'POST /api/dst');
    dst.setAttribute('data-nd-sortable-group', 'tasks');

    const a = addItem(src, 'a');
    const b = addItem(dst, 'b');
    b.getBoundingClientRect = () => ({ top: 0, height: 20 });
    initSortable();

    let captured = null;
    dst.addEventListener('nd:sortable:reorder', (e) => { captured = e.detail; });

    const origFetch = global.fetch;
    global.fetch = async () => ({ ok: true });

    fireDrag(src, 'dragstart', a);
    fireDrag(dst, 'dragover', b, { clientY: 5 });
    fireDrag(dst, 'dragend', a);

    await new Promise(r => setTimeout(r, 10));

    assert.ok(captured, 'reorder event must fire on destination');
    assert.equal(captured.crossContainer, true);
    assert.equal(captured.source, src);

    global.fetch = origFetch;
  });

  test('failed cross-container POST moves item back to source', async () => {
    const src = makeContainer('UL', 'POST /api/src');
    src.setAttribute('data-nd-sortable-group', 'tasks');
    const dst = makeContainer('UL', 'POST /api/dst');
    dst.setAttribute('data-nd-sortable-group', 'tasks');

    const a = addItem(src, 'a');
    const b = addItem(dst, 'b');
    b.getBoundingClientRect = () => ({ top: 0, height: 20 });
    initSortable();

    const origFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 500, headers: { get: () => null } });

    fireDrag(src, 'dragstart', a);
    fireDrag(dst, 'dragover', b, { clientY: 5 });
    // Before dragend: a is in dst.
    assert.equal(a.parentElement, dst);
    fireDrag(dst, 'dragend', a);

    await new Promise(r => setTimeout(r, 30));

    assert.equal(a.parentElement, src, 'on failure the item must be restored to source container');

    global.fetch = origFetch;
  });

  test('data-nd-sortable-refresh dispatches nd:refresh on listed targets after success', async () => {
    const src = makeContainer('UL', 'POST /api/src');
    src.setAttribute('data-nd-sortable-group', 'tasks');
    src.setAttribute('id', 'src');
    const dst = makeContainer('UL', 'POST /api/dst');
    dst.setAttribute('data-nd-sortable-group', 'tasks');
    dst.setAttribute('id', 'dst');
    dst.setAttribute('data-nd-sortable-refresh', '#src,#dst');

    const a = addItem(src, 'a');
    const b = addItem(dst, 'b');
    b.getBoundingClientRect = () => ({ top: 0, height: 20 });
    initSortable();

    // Teach the fake document.querySelectorAll to match id selectors
    // AFTER initSortable — initSortable itself calls querySelectorAll
    // with `[data-nd-sortable]`, which we must keep delegating to the
    // original implementation.
    const origQSA = global.document.querySelectorAll.bind(global.document);
    global.document.querySelectorAll = (sel) => {
      if (sel === '#src') return [src];
      if (sel === '#dst') return [dst];
      return origQSA(sel);
    };

    let srcRefreshes = 0;
    let dstRefreshes = 0;
    src.addEventListener('nd:refresh', () => { srcRefreshes++; });
    dst.addEventListener('nd:refresh', () => { dstRefreshes++; });

    const origFetch = global.fetch;
    global.fetch = async () => ({ ok: true });

    fireDrag(src, 'dragstart', a);
    fireDrag(dst, 'dragover', b, { clientY: 5 });
    fireDrag(dst, 'dragend', a);

    await new Promise(r => setTimeout(r, 20));

    assert.equal(srcRefreshes, 1, 'source must receive nd:refresh');
    assert.equal(dstRefreshes, 1, 'destination must receive nd:refresh');

    global.fetch = origFetch;
  });
});
