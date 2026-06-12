/**
 * Unit tests for action.js — most internals require DOM, so we verify
 * the public API surface that can be safely imported in Node.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Global stubs required before importing action.js ────────────────────────
// CustomEvent is used by emit/refresh verbs. window/document are touched by
// the navigating built-ins (redirect/reload) and refresh.
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
    this.bubbles = init.bubbles || false;
  }
};

import * as action from './action.js';

test('action.js exports initActions', () => {
  assert.equal(typeof action.initActions, 'function');
});

test('action.js: exports expected public surface', () => {
  const keys = Object.keys(action).sort();
  assert.deepEqual(keys, [
    'clearFormErrors',
    'displayErrors',
    'handleSuccess',
    'initActions',
    'registerHook',
    'resolveConfirm',
    'runChain',
    'runLifecycle',
  ]);
});

// ---------------------------------------------------------------------------
// Lifecycle hook chains + extensible verb registry
// ---------------------------------------------------------------------------

/**
 * Minimal element stub for runChain/handleSuccess. Records dispatched events
 * and supports the attribute lookups runChain performs.
 */
function makeEl(attrs = {}, tagName = 'DIV') {
  return {
    tagName,
    _attrs: { ...attrs },
    dispatched: [],
    resetCount: 0,
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    setAttribute(k, v) { this._attrs[k] = v; },
    reset() { this.resetCount++; },
    dispatchEvent(ev) { this.dispatched.push(ev); return true; },
    closest() { return null; },
  };
}

describe('runChain — verb registry', () => {
  let savedDocument;

  beforeEach(() => {
    savedDocument = globalThis.document;
    // querySelectorAll for the refresh verb; default no matches.
    globalThis.document = { querySelectorAll() { return []; } };
  });

  afterEach(() => {
    globalThis.document = savedDocument;
  });

  test('built-in non-nav verb runs; emit carries ctx.data as detail', async () => {
    const el = makeEl();
    const data = { id: 7 };
    const navigated = await action.runChain('emit:saved', {
      element: el, response: null, data, error: null, phase: 'success',
    });
    assert.equal(navigated, false);
    assert.equal(el.dispatched.length, 1);
    assert.equal(el.dispatched[0].type, 'saved');
    assert.deepEqual(el.dispatched[0].detail, data);
  });

  test('reset only fires on FORM elements', async () => {
    const form = makeEl({}, 'FORM');
    await action.runChain('reset', { element: form, data: null, error: null, phase: 'success' });
    assert.equal(form.resetCount, 1);

    const div = makeEl({}, 'DIV');
    await action.runChain('reset', { element: div, data: null, error: null, phase: 'success' });
    assert.equal(div.resetCount, 0);
  });

  test('unknown verb is silently ignored (regression guard)', async () => {
    const el = makeEl();
    const navigated = await action.runChain('definitely-not-a-verb:x,emit:ok', {
      element: el, data: null, error: null, phase: 'success',
    });
    assert.equal(navigated, false);
    // The known verb after the unknown one still ran.
    assert.equal(el.dispatched.length, 1);
    assert.equal(el.dispatched[0].type, 'ok');
  });

  test('verb:arg splits on the FIRST colon (redirect keeps full URL)', async () => {
    const savedLoc = globalThis.window;
    let assigned = null;
    globalThis.window = { location: { set href(v) { assigned = v; }, reload() {} } };
    try {
      const el = makeEl();
      const navigated = await action.runChain('redirect:https://x/y?a=1', {
        element: el, data: null, error: null, phase: 'success',
      });
      assert.equal(navigated, true);
      assert.equal(assigned, 'https://x/y?a=1');
    } finally {
      globalThis.window = savedLoc;
    }
  });

  test('navigating verb short-circuits the chain', async () => {
    const savedWin = globalThis.window;
    globalThis.window = { location: { set href(_v) {}, reload() {} } };
    try {
      const el = makeEl();
      const navigated = await action.runChain('redirect:/done,emit:after', {
        element: el, data: null, error: null, phase: 'success',
      });
      assert.equal(navigated, true);
      // emit after redirect must NOT have fired.
      assert.equal(el.dispatched.length, 0);
    } finally {
      globalThis.window = savedWin;
    }
  });

  test('custom registered sync verb runs and ordering is preserved', async () => {
    const order = [];
    action.registerHook('record', (arg) => { order.push(`record:${arg}`); });
    const el = makeEl();
    el.dispatchEvent = (ev) => { order.push(`emit:${ev.type}`); };
    await action.runChain('record:first,emit:second,record:third', {
      element: el, data: null, error: null, phase: 'success',
    });
    assert.deepEqual(order, ['record:first', 'emit:second', 'record:third']);
  });

  test('custom async verb is awaited before the next verb runs', async () => {
    const order = [];
    action.registerHook('slow', async (arg) => {
      await new Promise(r => setTimeout(r, 5));
      order.push(`slow:${arg}`);
    });
    action.registerHook('fast', (arg) => { order.push(`fast:${arg}`); });
    const el = makeEl();
    await action.runChain('slow:1,fast:2', {
      element: el, data: null, error: null, phase: 'success',
    });
    // If slow were not awaited, fast:2 would land first.
    assert.deepEqual(order, ['slow:1', 'fast:2']);
  });

  test('registered verb returning {navigate:true} stops the chain', async () => {
    const order = [];
    action.registerHook('leave', () => ({ navigate: true }));
    action.registerHook('mark', (arg) => { order.push(arg); });
    const el = makeEl();
    const navigated = await action.runChain('leave,mark:should-not-run', {
      element: el, data: null, error: null, phase: 'success',
    });
    assert.equal(navigated, true);
    assert.deepEqual(order, []);
  });

  test('empty / null chain is a no-op returning false', async () => {
    const el = makeEl();
    assert.equal(await action.runChain(null, { element: el, data: null, error: null, phase: 'success' }), false);
    assert.equal(await action.runChain('', { element: el, data: null, error: null, phase: 'success' }), false);
    assert.equal(await action.runChain('  , ,', { element: el, data: null, error: null, phase: 'success' }), false);
  });
});

describe('handleSuccess — back-compat wrapper', () => {
  let savedDocument;
  beforeEach(() => {
    savedDocument = globalThis.document;
    globalThis.document = { querySelectorAll() { return []; } };
  });
  afterEach(() => { globalThis.document = savedDocument; });

  test('reads data-nd-success and runs the chain with phase=success', async () => {
    const el = makeEl({ 'data-nd-success': 'emit:done' });
    const navigated = await action.handleSuccess(el, { ok: 1 });
    assert.equal(navigated, false);
    assert.equal(el.dispatched[0].type, 'done');
    assert.deepEqual(el.dispatched[0].detail, { ok: 1 });
  });

  test('no data-nd-success → no-op', async () => {
    const el = makeEl();
    const navigated = await action.handleSuccess(el, {});
    assert.equal(navigated, false);
    assert.equal(el.dispatched.length, 0);
  });
});

describe('runLifecycle — phase chain + data-nd-finally', () => {
  let savedDocument;
  beforeEach(() => {
    savedDocument = globalThis.document;
    globalThis.document = { querySelectorAll() { return []; } };
  });
  afterEach(() => { globalThis.document = savedDocument; });

  test('finally fires after the SUCCESS phase chain', async () => {
    const order = [];
    action.registerHook('rec', (arg) => { order.push(arg); });
    const el = makeEl({ 'data-nd-success': 'rec:s', 'data-nd-finally': 'rec:f' });
    await action.runLifecycle(el, el.getAttribute('data-nd-success'), {
      element: el, data: { ok: 1 }, error: null, phase: 'success',
    });
    assert.deepEqual(order, ['s', 'f']);
  });

  test('finally fires after the ERROR phase chain', async () => {
    const order = [];
    action.registerHook('rec', (arg) => { order.push(arg); });
    const el = makeEl({ 'data-nd-error': 'rec:e', 'data-nd-finally': 'rec:f' });
    await action.runLifecycle(el, el.getAttribute('data-nd-error'), {
      element: el, data: null, error: { errors: { error: 'boom' } }, phase: 'error',
    });
    assert.deepEqual(order, ['e', 'f']);
  });

  test('finally is SUPPRESSED when the phase chain navigated away', async () => {
    const savedWin = globalThis.window;
    globalThis.window = { location: { set href(_v) {}, reload() {} } };
    const order = [];
    action.registerHook('rec', (arg) => { order.push(arg); });
    try {
      const el = makeEl({
        'data-nd-success': 'rec:s,redirect:/gone',
        'data-nd-finally': 'rec:f',
      });
      await action.runLifecycle(el, el.getAttribute('data-nd-success'), {
        element: el, data: null, error: null, phase: 'success',
      });
      // 's' ran before redirect; finally 'f' must NOT run.
      assert.deepEqual(order, ['s']);
    } finally {
      globalThis.window = savedWin;
    }
  });

  test('finally context carries phase=finally', async () => {
    const phases = [];
    action.registerHook('phase', (_arg, ctx) => { phases.push(ctx.phase); });
    const el = makeEl({ 'data-nd-success': 'phase', 'data-nd-finally': 'phase' });
    await action.runLifecycle(el, el.getAttribute('data-nd-success'), {
      element: el, data: null, error: null, phase: 'success',
    });
    assert.deepEqual(phases, ['success', 'finally']);
  });
});

test('action.js: resolveConfirm is an async function', () => {
  assert.equal(typeof action.resolveConfirm, 'function');
});

test('action.js: handleSuccess/clearFormErrors/displayErrors are functions', () => {
  assert.equal(typeof action.handleSuccess, 'function');
  assert.equal(typeof action.clearFormErrors, 'function');
  assert.equal(typeof action.displayErrors, 'function');
});
