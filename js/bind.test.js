/**
 * Unit tests for bind.js — verifies data-nd-defer behaviour and
 * data-nd-set response form integration.
 *
 * Because bind.js accesses the DOM we install minimal stubs.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Global stubs required before any import that touches DOM globals ─────────
// MutationObserver is used in initBindings; stub it so tests run in Node.
class FakeMutationObserver {
  constructor(cb) { this._cb = cb; }
  observe() {}
  disconnect() {}
}
globalThis.MutationObserver = FakeMutationObserver;
globalThis.Node = { ELEMENT_NODE: 1 };
// CustomEvent stub
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
    this.bubbles = init.bubbles || false;
  }
};

import * as bind from './bind.js';

test('bind.js exports initBindings and destroyBindings', () => {
  assert.equal(typeof bind.initBindings, 'function');
  assert.equal(typeof bind.destroyBindings, 'function');
});

// ---------------------------------------------------------------------------
// data-nd-defer: skip initial fetch
// ---------------------------------------------------------------------------

describe('data-nd-defer', () => {
  let fetchCalls;
  let originalFetch;

  beforeEach(() => {
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    // Install a spy fetch that resolves immediately with an empty array
    globalThis.fetch = (url) => {
      fetchCalls.push(url);
      return Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => [],
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    bind.destroyBindings();
  });

  function makeEl(attrs = {}) {
    const el = {
      _attrs: { ...attrs },
      _listeners: {},
      getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; },
      hasAttribute(k) { return k in this._attrs; },
      setAttribute(k, v) { this._attrs[k] = v; },
      classList: { add() {}, remove() {}, contains() { return false; } },
      childNodes: [],
      children: [],
      nodeName: 'DIV',
      querySelectorAll() { return []; },
      querySelector() { return null; },
      appendChild() {},
      removeChild() {},
      textContent: '',
      addEventListener(ev, fn) {
        if (!this._listeners[ev]) this._listeners[ev] = [];
        this._listeners[ev].push(fn);
      },
      dispatchEvent(ev) {
        const handlers = this._listeners[ev.type];
        if (handlers) handlers.forEach(h => h(ev));
      },
    };
    return el;
  }

  test('normal bind element triggers initial fetch', async () => {
    const el = makeEl({ 'data-nd-bind': 'https://test.nitecon.org/api/stats' });
    // Provide a stub document
    globalThis.document = {
      querySelectorAll(sel) {
        if (sel === '[data-nd-bind]') return [el];
        return [];
      },
      querySelector() { return null; },
      body: { contains() { return true; } },
    };

    const config = { headers: {}, onRequest: null, onResponse: null, onError: null, onRender: null };
    bind.initBindings(config);

    // Wait for microtasks
    await new Promise(r => setTimeout(r, 10));

    assert.equal(fetchCalls.length, 1);
    assert.ok(fetchCalls[0].includes('api/stats'));

    delete globalThis.document;
  });

  test('data-nd-defer element skips initial fetch', async () => {
    const el = makeEl({
      'data-nd-bind': 'https://test.nitecon.org/api/stats',
      'data-nd-defer': '',
    });

    globalThis.document = {
      querySelectorAll(sel) {
        if (sel === '[data-nd-bind]') return [el];
        return [];
      },
      querySelector() { return null; },
      body: { contains() { return true; } },
    };

    const config = { headers: {}, onRequest: null, onResponse: null, onError: null, onRender: null };
    bind.initBindings(config);

    await new Promise(r => setTimeout(r, 10));

    assert.equal(fetchCalls.length, 0, 'deferred element should not trigger initial fetch');

    delete globalThis.document;
  });

  test('data-nd-defer element fetches when nd:refresh is dispatched', async () => {
    const el = makeEl({
      'data-nd-bind': 'https://test.nitecon.org/api/stats',
      'data-nd-defer': '',
    });

    globalThis.document = {
      querySelectorAll(sel) {
        if (sel === '[data-nd-bind]') return [el];
        return [];
      },
      querySelector() { return null; },
      body: { contains() { return true; } },
    };

    const config = { headers: {}, onRequest: null, onResponse: null, onError: null, onRender: null };
    bind.initBindings(config);

    await new Promise(r => setTimeout(r, 10));
    assert.equal(fetchCalls.length, 0, 'no fetch before refresh');

    // Dispatch nd:refresh
    el.dispatchEvent({ type: 'nd:refresh' });

    await new Promise(r => setTimeout(r, 20));
    assert.equal(fetchCalls.length, 1, 'fetch triggered by nd:refresh');

    delete globalThis.document;
  });
});

// ---------------------------------------------------------------------------
// Templateless / fieldless bind — onRender must fire, and non-string payloads
// must NOT be JSON-stringified into textContent (surprised the training-team
// when hidden <div data-nd-bind> pickers rendered JSON blobs as visible text).
// ---------------------------------------------------------------------------

describe('templateless bind', () => {
  let originalFetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete globalThis.document;
    bind.destroyBindings();
  });

  function makeEl(attrs = {}, tagName = 'DIV') {
    const el = {
      _attrs: { ...attrs },
      _listeners: {},
      tagName,
      getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; },
      hasAttribute(k) { return k in this._attrs; },
      setAttribute(k, v) { this._attrs[k] = v; },
      removeAttribute(k) { delete this._attrs[k]; },
      classList: { add() {}, remove() {}, contains() { return false; } },
      childNodes: [],
      children: [],
      nodeName: tagName,
      querySelectorAll() { return []; },
      querySelector() { return null; },
      appendChild() {},
      removeChild() {},
      textContent: '',
      addEventListener(ev, fn) {
        if (!this._listeners[ev]) this._listeners[ev] = [];
        this._listeners[ev].push(fn);
      },
      dispatchEvent(ev) {
        const handlers = this._listeners[ev.type];
        if (handlers) handlers.forEach(h => h(ev));
      },
    };
    return el;
  }

  function installDoc(el) {
    globalThis.document = {
      querySelectorAll(sel) {
        if (sel === '[data-nd-bind]') return [el];
        return [];
      },
      querySelector() { return null; },
      body: { contains() { return true; } },
    };
  }

  function installFetch(payload) {
    originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => payload,
    });
  }

  test('object payload leaves textContent untouched and fires onRender', async () => {
    installFetch([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    const el = makeEl({ 'data-nd-bind': 'https://test.nitecon.org/api/demo' });
    installDoc(el);

    let renderedWith = null;
    const config = {
      headers: {}, onRequest: null, onResponse: null, onError: null,
      onRender: (_el, data) => { renderedWith = data; },
    };

    bind.initBindings(config);
    await new Promise(r => setTimeout(r, 10));

    assert.equal(el.textContent, '', 'object payload must not be stringified into textContent');
    assert.ok(Array.isArray(renderedWith), 'onRender should have received the array');
    assert.equal(renderedWith.length, 2);
  });

  test('string payload is written to textContent', async () => {
    installFetch('1.2.3');
    const el = makeEl({ 'data-nd-bind': 'https://test.nitecon.org/api/version' });
    installDoc(el);

    const config = { headers: {}, onRequest: null, onResponse: null, onError: null, onRender: null };
    bind.initBindings(config);
    await new Promise(r => setTimeout(r, 10));

    assert.equal(el.textContent, '1.2.3');
  });
});
