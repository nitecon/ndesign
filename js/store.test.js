/**
 * Unit tests for store.js — uses node:test (zero dependencies).
 *
 * Because store.js calls document.querySelectorAll() inside initStoreFromMeta
 * and DOM-dependent functions, we install minimal stubs before each relevant
 * test. Tests that only touch pure functions (resolveVars, parseSetRHS, etc.)
 * do not need a DOM stub.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Import the module under test ─────────────────────────────────────────────
// We import everything at the top; individual tests manipulate the exported
// Maps (vars, endpoints) directly to set up state without going through
// initStoreFromMeta every time.
import {
  vars,
  endpoints,
  initStoreFromMeta,
  getVar,
  setVar,
  getEndpoint,
  resolveVars,
  parseSetRHS,
  evalSetRHS,
  applySetDirective,
  destroyStore,
} from './store.js';

// ---------------------------------------------------------------------------
// Helper: reset store state between tests
// ---------------------------------------------------------------------------
function resetStore() {
  vars.clear();
  endpoints.clear();
}

// ---------------------------------------------------------------------------
// Helper: minimal document stub for meta-tag tests
// ---------------------------------------------------------------------------
function makeMetaDoc(metas) {
  // metas = [{name, content}, ...]
  const elements = metas.map(({ name, content }) => ({
    getAttribute(attr) {
      if (attr === 'name') return name;
      if (attr === 'content') return content;
      return null;
    },
  }));
  return {
    querySelectorAll(sel) {
      if (sel === 'meta[name]') return elements;
      return [];
    },
    querySelector() { return null; },
  };
}

// ---------------------------------------------------------------------------
// initStoreFromMeta
// ---------------------------------------------------------------------------

describe('initStoreFromMeta', () => {
  beforeEach(resetStore);

  test('reads endpoint: prefix', () => {
    globalThis.document = makeMetaDoc([{ name: 'endpoint:api', content: 'https://api.example.com' }]);
    initStoreFromMeta();
    assert.equal(endpoints.get('api'), 'https://api.example.com');
    delete globalThis.document;
  });

  test('reads var: prefix', () => {
    globalThis.document = makeMetaDoc([{ name: 'var:order_count', content: '10' }]);
    initStoreFromMeta();
    assert.equal(vars.get('order_count'), '10');
    delete globalThis.document;
  });

  test('reads both prefixes at once', () => {
    globalThis.document = makeMetaDoc([
      { name: 'endpoint:api', content: 'https://api.example.com' },
      { name: 'var:count', content: '5' },
    ]);
    initStoreFromMeta();
    assert.equal(endpoints.get('api'), 'https://api.example.com');
    assert.equal(vars.get('count'), '5');
    delete globalThis.document;
  });

  test('ignores unrelated meta tags', () => {
    globalThis.document = makeMetaDoc([
      { name: 'csrf-token', content: 'abc123' },
      { name: 'viewport', content: 'width=device-width' },
      { name: 'nd-theme', content: 'dark' },
    ]);
    initStoreFromMeta();
    assert.equal(vars.size, 0);
    assert.equal(endpoints.size, 0);
    delete globalThis.document;
  });

  test('handles zero matching meta tags gracefully', () => {
    globalThis.document = makeMetaDoc([]);
    initStoreFromMeta();
    assert.equal(vars.size, 0);
    assert.equal(endpoints.size, 0);
    delete globalThis.document;
  });

  test('ignores endpoint/var with empty key', () => {
    globalThis.document = makeMetaDoc([
      { name: 'endpoint:', content: 'https://example.com' },
      { name: 'var:', content: 'orphan' },
    ]);
    initStoreFromMeta();
    assert.equal(endpoints.size, 0);
    assert.equal(vars.size, 0);
    delete globalThis.document;
  });
});

// ---------------------------------------------------------------------------
// getVar / setVar
// ---------------------------------------------------------------------------

describe('getVar / setVar', () => {
  beforeEach(resetStore);

  test('simple set and get', () => {
    setVar('name', 'Will');
    assert.equal(getVar('name'), 'Will');
  });

  test('getVar returns undefined for missing key', () => {
    assert.equal(getVar('missing'), undefined);
  });

  test('setVar overwrites existing value', () => {
    setVar('x', 1);
    setVar('x', 2);
    assert.equal(getVar('x'), 2);
  });

  test('setVar with dot path creates nested object', () => {
    setVar('user.first_name', 'Will');
    const u = vars.get('user');
    assert.equal(u.first_name, 'Will');
  });

  test('getVar with dot path reads nested value', () => {
    vars.set('user', { first_name: 'Will', last_name: 'H' });
    assert.equal(getVar('user.first_name'), 'Will');
    assert.equal(getVar('user.last_name'), 'H');
  });

  test('getVar with deep dot path', () => {
    vars.set('a', { b: { c: 'deep' } });
    assert.equal(getVar('a.b.c'), 'deep');
  });

  test('getVar with dot path returns undefined if intermediate missing', () => {
    vars.set('user', { name: 'Will' });
    assert.equal(getVar('user.address.city'), undefined);
  });

  test('getVar returns null when value is null', () => {
    vars.set('tok', null);
    assert.equal(getVar('tok'), null);
  });

  test('setVar empty path is a no-op', () => {
    setVar('', 'x');
    assert.equal(vars.size, 0);
  });
});

// ---------------------------------------------------------------------------
// getEndpoint
// ---------------------------------------------------------------------------

describe('getEndpoint', () => {
  beforeEach(resetStore);

  test('returns registered endpoint', () => {
    endpoints.set('api', 'https://api.example.com');
    assert.equal(getEndpoint('api'), 'https://api.example.com');
  });

  test('returns empty string for missing endpoint', () => {
    assert.equal(getEndpoint('nope'), '');
  });
});

// ---------------------------------------------------------------------------
// resolveVars
// ---------------------------------------------------------------------------

describe('resolveVars', () => {
  beforeEach(resetStore);

  test('no tokens — returns string unchanged', () => {
    assert.equal(resolveVars('hello world'), 'hello world');
  });

  test('empty string passthrough', () => {
    assert.equal(resolveVars(''), '');
  });

  test('single var token', () => {
    vars.set('name', 'Will');
    assert.equal(resolveVars('Hello ${name}'), 'Hello Will');
  });

  test('multiple tokens', () => {
    vars.set('host', 'api.example.com');
    vars.set('port', '8080');
    assert.equal(resolveVars('${host}:${port}'), 'api.example.com:8080');
  });

  test('endpoint token', () => {
    endpoints.set('api', 'https://api.example.com');
    assert.equal(resolveVars('${api}/users'), 'https://api.example.com/users');
  });

  test('var takes precedence over endpoint of same name', () => {
    vars.set('api', 'VAR');
    endpoints.set('api', 'ENDPOINT');
    assert.equal(resolveVars('${api}'), 'VAR');
  });

  test('nested dot-path token', () => {
    vars.set('user', { name: 'Will' });
    assert.equal(resolveVars('Hello ${user.name}'), 'Hello Will');
  });

  test('null value substitutes empty string', () => {
    vars.set('tok', null);
    assert.equal(resolveVars('x${tok}y'), 'xy');
  });

  test('unknown token warns and substitutes empty string', (t) => {
    const warned = [];
    t.mock.method(console, 'warn', (msg) => warned.push(msg));
    const result = resolveVars('${unknown_var}');
    assert.equal(result, '');
    assert.ok(warned.some(m => m.includes('unresolved var')));
  });

  test('non-string argument returns as-is', () => {
    assert.equal(resolveVars(42), 42);
    assert.equal(resolveVars(null), null);
  });

  test('mixed text and token', () => {
    vars.set('count', '7');
    assert.equal(resolveVars('You have ${count} items'), 'You have 7 items');
  });

  test('token with dashes and underscores', () => {
    vars.set('order_count', '3');
    assert.equal(resolveVars('qty=${order_count}'), 'qty=3');
  });
});

// ---------------------------------------------------------------------------
// parseSetRHS
// ---------------------------------------------------------------------------

describe('parseSetRHS', () => {
  test('null literal', () => {
    assert.deepEqual(parseSetRHS('null'), { type: 'literal', value: null });
  });

  test('true literal', () => {
    assert.deepEqual(parseSetRHS('true'), { type: 'literal', value: true });
  });

  test('false literal', () => {
    assert.deepEqual(parseSetRHS('false'), { type: 'literal', value: false });
  });

  test('integer literal', () => {
    assert.deepEqual(parseSetRHS('42'), { type: 'literal', value: 42 });
  });

  test('negative integer literal', () => {
    assert.deepEqual(parseSetRHS('-5'), { type: 'literal', value: -5 });
  });

  test('float literal', () => {
    assert.deepEqual(parseSetRHS('3.14'), { type: 'literal', value: 3.14 });
  });

  test('single-quoted string literal', () => {
    assert.deepEqual(parseSetRHS("'hello'"), { type: 'literal', value: 'hello' });
  });

  test('single-quoted string with escaped quote', () => {
    assert.deepEqual(parseSetRHS("'it\\'s'"), { type: 'literal', value: "it's" });
  });

  test('single-quoted string with escaped backslash', () => {
    assert.deepEqual(parseSetRHS("'back\\\\slash'"), { type: 'literal', value: 'back\\slash' });
  });

  test('single-quoted string with comma inside', () => {
    assert.deepEqual(parseSetRHS("'hi, there'"), { type: 'literal', value: 'hi, there' });
  });

  test('empty string literal', () => {
    assert.deepEqual(parseSetRHS("''"), { type: 'literal', value: '' });
  });

  test('${ref} — simple', () => {
    assert.deepEqual(parseSetRHS('${name}'), { type: 'ref', path: 'name' });
  });

  test('${ref} — dot path', () => {
    assert.deepEqual(parseSetRHS('${user.first_name}'), { type: 'ref', path: 'user.first_name' });
  });

  test('arith: + op', () => {
    assert.deepEqual(parseSetRHS('${count}+1'), {
      type: 'arith', refPath: 'count', op: '+', operand: 1
    });
  });

  test('arith: - op', () => {
    assert.deepEqual(parseSetRHS('${count}-1'), {
      type: 'arith', refPath: 'count', op: '-', operand: 1
    });
  });

  test('arith: * op', () => {
    assert.deepEqual(parseSetRHS('${count}*2'), {
      type: 'arith', refPath: 'count', op: '*', operand: 2
    });
  });

  test('arith: / op', () => {
    assert.deepEqual(parseSetRHS('${count}/4'), {
      type: 'arith', refPath: 'count', op: '/', operand: 4
    });
  });

  test('arith: spaces around op are ok', () => {
    const ast = parseSetRHS('${count} + 10');
    assert.equal(ast.type, 'arith');
    assert.equal(ast.op, '+');
    assert.equal(ast.operand, 10);
  });

  test('arith: negative operand', () => {
    const ast = parseSetRHS('${count}+-3');
    assert.equal(ast.type, 'arith');
    assert.equal(ast.operand, -3);
  });

  test('$response sentinel', () => {
    assert.deepEqual(parseSetRHS('$response'), { type: 'response' });
  });

  test('throws on empty RHS', () => {
    assert.throws(() => parseSetRHS(''), /empty RHS/);
  });

  test('throws on unrecognised input', () => {
    assert.throws(() => parseSetRHS('???'), /unrecognised RHS/);
  });

  test('throws on unclosed ${', () => {
    assert.throws(() => parseSetRHS('${missing'), /unclosed/);
  });

  test('throws on invalid var name inside ${}', () => {
    assert.throws(() => parseSetRHS('${123bad}'), /invalid var name/);
  });

  test('throws on extra tokens after string literal', () => {
    assert.throws(() => parseSetRHS("'hello' extra"), /unexpected tokens/);
  });

  test('throws on bad arith (non-number operand)', () => {
    assert.throws(() => parseSetRHS('${count}+abc'), /expected arithmetic/);
  });

  test('whitespace trimmed from RHS', () => {
    assert.deepEqual(parseSetRHS('  null  '), { type: 'literal', value: null });
  });
});

// ---------------------------------------------------------------------------
// evalSetRHS
// ---------------------------------------------------------------------------

describe('evalSetRHS', () => {
  beforeEach(resetStore);

  test('literal node returns value', () => {
    assert.equal(evalSetRHS({ type: 'literal', value: 42 }, undefined), 42);
    assert.equal(evalSetRHS({ type: 'literal', value: null }, undefined), null);
    assert.equal(evalSetRHS({ type: 'literal', value: 'hi' }, undefined), 'hi');
  });

  test('ref node reads from store', () => {
    vars.set('x', 'hello');
    assert.equal(evalSetRHS({ type: 'ref', path: 'x' }, undefined), 'hello');
  });

  test('arith node: addition', () => {
    vars.set('n', '5');
    assert.equal(evalSetRHS({ type: 'arith', refPath: 'n', op: '+', operand: 3 }, undefined), 8);
  });

  test('arith node: subtraction', () => {
    vars.set('n', '10');
    assert.equal(evalSetRHS({ type: 'arith', refPath: 'n', op: '-', operand: 4 }, undefined), 6);
  });

  test('arith node: multiplication', () => {
    vars.set('n', '3');
    assert.equal(evalSetRHS({ type: 'arith', refPath: 'n', op: '*', operand: 4 }, undefined), 12);
  });

  test('arith node: division', () => {
    vars.set('n', '10');
    assert.equal(evalSetRHS({ type: 'arith', refPath: 'n', op: '/', operand: 2 }, undefined), 5);
  });

  test('arith node: throws on NaN ref', () => {
    vars.set('n', 'not-a-number');
    assert.throws(
      () => evalSetRHS({ type: 'arith', refPath: 'n', op: '+', operand: 1 }, undefined),
      /arithmetic on non-numeric/
    );
  });

  test('arith node: throws on division by zero', () => {
    vars.set('n', '5');
    assert.throws(
      () => evalSetRHS({ type: 'arith', refPath: 'n', op: '/', operand: 0 }, undefined),
      /division by zero/
    );
  });

  test('response node returns responseData', () => {
    const data = { id: 1, name: 'Will' };
    assert.equal(evalSetRHS({ type: 'response' }, data), data);
  });

  test('numeric string from meta is coerced in arith', () => {
    // Meta tags deliver everything as strings; arith must coerce
    vars.set('order_count', '10');
    const result = evalSetRHS({ type: 'arith', refPath: 'order_count', op: '+', operand: 1 }, undefined);
    assert.equal(result, 11);
  });
});

// ---------------------------------------------------------------------------
// applySetDirective
// ---------------------------------------------------------------------------

describe('applySetDirective', () => {
  beforeEach(resetStore);

  function makeEl(setAttr) {
    return {
      _attrs: { 'data-nd-set': setAttr },
      getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; },
      hasAttribute(k) { return k in this._attrs; },
    };
  }

  test('single explicit set: literal', () => {
    const el = makeEl('count=42');
    applySetDirective(el, undefined);
    assert.equal(vars.get('count'), 42);
  });

  test('single explicit set: string literal', () => {
    const el = makeEl("msg='hello'");
    applySetDirective(el, undefined);
    assert.equal(vars.get('msg'), 'hello');
  });

  test('single explicit set: null', () => {
    vars.set('user', { name: 'Will' });
    const el = makeEl('user=null');
    applySetDirective(el, undefined);
    assert.equal(vars.get('user'), null);
  });

  test('comma-separated multiple writes', () => {
    const el = makeEl('a=1, b=2');
    applySetDirective(el, undefined);
    assert.equal(vars.get('a'), 1);
    assert.equal(vars.get('b'), 2);
  });

  test('comma inside single-quoted string is NOT a split', () => {
    const el = makeEl("msg='hi, there', count=5");
    applySetDirective(el, undefined);
    assert.equal(vars.get('msg'), 'hi, there');
    assert.equal(vars.get('count'), 5);
  });

  test('response form writes responseData', () => {
    const data = { id: 1, name: 'Will' };
    const el = makeEl('user');
    applySetDirective(el, data);
    assert.equal(vars.get('user'), data);
  });

  test('response form with undefined responseData warns', (t) => {
    const warned = [];
    t.mock.method(console, 'warn', (msg) => warned.push(msg));
    const el = makeEl('user');
    applySetDirective(el, undefined);
    assert.ok(warned.some(m => m.includes('response form')));
    assert.equal(vars.has('user'), false);
  });

  test('arith op updates existing var', () => {
    vars.set('count', '10');
    const el = makeEl('count=${count}+1');
    applySetDirective(el, undefined);
    assert.equal(vars.get('count'), 11);
  });

  test('dot-path LHS writes nested value', () => {
    vars.set('user', { name: 'Old' });
    const el = makeEl("user.name='New'");
    applySetDirective(el, undefined);
    assert.equal(vars.get('user').name, 'New');
  });

  test('missing data-nd-set attribute is a no-op', () => {
    const el = { getAttribute() { return null; }, hasAttribute() { return false; } };
    applySetDirective(el, undefined);
    assert.equal(vars.size, 0);
  });
});

// ---------------------------------------------------------------------------
// destroyStore
// ---------------------------------------------------------------------------

describe('destroyStore', () => {
  beforeEach(resetStore);

  test('clears vars and endpoints', () => {
    vars.set('x', 1);
    endpoints.set('api', 'https://example.com');
    // Provide minimal document stub for the querySelectorAll call in destroyStore
    globalThis.document = {
      querySelectorAll() { return []; },
      querySelector() { return null; },
    };
    destroyStore();
    assert.equal(vars.size, 0);
    assert.equal(endpoints.size, 0);
    delete globalThis.document;
  });
});

// ---------------------------------------------------------------------------
// Reactive setVar — nd:var-change dispatch
// ---------------------------------------------------------------------------

/**
 * Build a minimal document stub that extends EventTarget (so addEventListener
 * and dispatchEvent work) and provides query methods.
 * @param {Array<Element>} elements
 */
function makeEventDoc(elements = []) {
  const doc = new EventTarget();
  doc.querySelectorAll = (selector) => {
    // Very small selector matcher — enough for the tests below
    return elements.filter(el => {
      if (selector === '[data-nd-model]') return el._attrs && el._attrs['data-nd-model'] !== undefined;
      if (selector.includes('[data-nd-set]')) {
        // Approximate the compound :not() selector used by initSetTriggers
        if (!el._attrs || el._attrs['data-nd-set'] === undefined) return false;
        if (el._attrs['data-nd-action'] !== undefined) return false;
        if (el._attrs['data-nd-bind'] !== undefined) return false;
        if (el._attrs['data-nd-upload'] !== undefined) return false;
        if (el._attrs['data-nd-sortable'] !== undefined) return false;
        return true;
      }
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        return el._attrs && el._attrs.id === id;
      }
      return false;
    });
  };
  doc.querySelector = (selector) => doc.querySelectorAll(selector)[0] || null;
  return doc;
}

/**
 * Build a fake element that extends EventTarget.
 * @param {Object} attrs — initial data-* attrs
 * @param {Object} [props] — additional element props (type, value, etc.)
 */
function makeFakeEl(attrs, props = {}) {
  const el = new EventTarget();
  el._attrs = { ...attrs };
  el.tagName = props.tagName || 'INPUT';
  el.type = props.type || 'text';
  el.value = props.value ?? '';
  el.checked = props.checked ?? false;
  el.defaultValue = props.defaultValue ?? '';
  el.classList = { add() {}, remove() {}, contains() { return false; } };
  el.getAttribute = (name) => (name in el._attrs ? el._attrs[name] : null);
  el.setAttribute = (name, val) => { el._attrs[name] = val; };
  el.hasAttribute = (name) => name in el._attrs;
  el.removeAttribute = (name) => { delete el._attrs[name]; };
  return el;
}

describe('setVar reactive notification', () => {
  beforeEach(resetStore);

  test('dispatches nd:var-change with path, topKey, and value', () => {
    globalThis.document = makeEventDoc();
    const events = [];
    globalThis.document.addEventListener('nd:var-change', (e) => events.push(e.detail));

    setVar('order_count', 42);

    assert.equal(events.length, 1);
    assert.equal(events[0].path, 'order_count');
    assert.equal(events[0].topKey, 'order_count');
    assert.equal(events[0].value, 42);

    delete globalThis.document;
  });

  test('dot-path setVar reports topKey correctly', () => {
    globalThis.document = makeEventDoc();
    const events = [];
    globalThis.document.addEventListener('nd:var-change', (e) => events.push(e.detail));

    vars.set('user', { name: 'Sarah' });
    setVar('user.email', 'sarah@example.com');

    assert.equal(events[0].path, 'user.email');
    assert.equal(events[0].topKey, 'user');
    assert.deepEqual(events[0].value, { name: 'Sarah', email: 'sarah@example.com' });

    delete globalThis.document;
  });
});

// ---------------------------------------------------------------------------
// initSetTriggers — data-nd-success refresh chain
// ---------------------------------------------------------------------------

describe('initSetTriggers success chain', () => {
  beforeEach(resetStore);

  test('data-nd-success="refresh:#target" dispatches nd:refresh on target', async () => {
    const { initSetTriggers: initSet } = await import('./store.js');

    const target = makeFakeEl({ id: 'target' });
    const button = makeFakeEl({
      'data-nd-set': 'foo=42',
      'data-nd-success': 'refresh:#target',
    }, { tagName: 'BUTTON' });

    globalThis.document = makeEventDoc([target, button]);

    let refreshFired = false;
    target.addEventListener('nd:refresh', () => { refreshFired = true; });

    initSet();
    button.dispatchEvent(new Event('click'));

    assert.equal(vars.get('foo'), 42);
    assert.equal(refreshFired, true);

    delete globalThis.document;
  });

  test('data-nd-success="emit:customEvent" dispatches on the set element', async () => {
    const { initSetTriggers: initSet } = await import('./store.js');

    const button = makeFakeEl({
      'data-nd-set': "theme='dark'",
      'data-nd-success': 'emit:themeChanged',
    }, { tagName: 'BUTTON' });

    globalThis.document = makeEventDoc([button]);

    let emitted = false;
    button.addEventListener('themeChanged', () => { emitted = true; });

    initSet();
    button.dispatchEvent(new Event('click'));

    assert.equal(vars.get('theme'), 'dark');
    assert.equal(emitted, true);

    delete globalThis.document;
  });
});
