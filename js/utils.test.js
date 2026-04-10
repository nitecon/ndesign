/**
 * Unit tests for utils.js — uses node:test (zero dependencies).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHTML,
  getByPath,
  setByPath,
  buildHeaders,
  getCSRFToken,
} from './utils.js';

// --- escapeHTML ---------------------------------------------------------

test('escapeHTML: basic tag characters', () => {
  assert.equal(escapeHTML('<script>'), '&lt;script&gt;');
  assert.equal(escapeHTML('<div>hi</div>'), '&lt;div&gt;hi&lt;/div&gt;');
});

test('escapeHTML: ampersands are escaped first', () => {
  assert.equal(escapeHTML('a & b'), 'a &amp; b');
  assert.equal(escapeHTML('&lt;'), '&amp;lt;');
});

test('escapeHTML: double and single quotes', () => {
  assert.equal(escapeHTML('"quoted"'), '&quot;quoted&quot;');
  assert.equal(escapeHTML("it's"), 'it&#39;s');
});

test('escapeHTML: handles null and undefined', () => {
  assert.equal(escapeHTML(null), '');
  assert.equal(escapeHTML(undefined), '');
});

test('escapeHTML: coerces non-strings', () => {
  assert.equal(escapeHTML(42), '42');
  assert.equal(escapeHTML(true), 'true');
  assert.equal(escapeHTML(0), '0');
});

test('escapeHTML: plain string passes through unchanged', () => {
  assert.equal(escapeHTML('hello world'), 'hello world');
  assert.equal(escapeHTML(''), '');
});

// --- getByPath ----------------------------------------------------------

test('getByPath: simple key', () => {
  assert.equal(getByPath({ name: 'Will' }, 'name'), 'Will');
});

test('getByPath: dot notation', () => {
  assert.equal(getByPath({ user: { name: 'Will' } }, 'user.name'), 'Will');
});

test('getByPath: deeply nested path', () => {
  const obj = { a: { b: { c: { d: 'deep' } } } };
  assert.equal(getByPath(obj, 'a.b.c.d'), 'deep');
});

test('getByPath: missing key returns undefined', () => {
  assert.equal(getByPath({ a: 1 }, 'b.c.d'), undefined);
  assert.equal(getByPath({ a: { b: 1 } }, 'a.b.c'), undefined);
});

test('getByPath: null or empty inputs', () => {
  assert.equal(getByPath(null, 'a'), undefined);
  assert.equal(getByPath(undefined, 'a'), undefined);
  assert.equal(getByPath({ a: 1 }, ''), undefined);
});

test('getByPath: resolves falsy values correctly', () => {
  assert.equal(getByPath({ a: 0 }, 'a'), 0);
  assert.equal(getByPath({ a: false }, 'a'), false);
  assert.equal(getByPath({ a: '' }, 'a'), '');
});

// --- setByPath ----------------------------------------------------------

test('setByPath: simple assignment', () => {
  const obj = {};
  setByPath(obj, 'name', 'Will');
  assert.deepEqual(obj, { name: 'Will' });
});

test('setByPath: creates nested structure', () => {
  const obj = {};
  setByPath(obj, 'address.city', 'Cape Town');
  assert.deepEqual(obj, { address: { city: 'Cape Town' } });
});

test('setByPath: overwrites existing value', () => {
  const obj = { name: 'Old' };
  setByPath(obj, 'name', 'New');
  assert.deepEqual(obj, { name: 'New' });
});

test('setByPath: preserves sibling keys in nested objects', () => {
  const obj = { user: { name: 'Will', age: 30 } };
  setByPath(obj, 'user.email', 'a@b.com');
  assert.deepEqual(obj, { user: { name: 'Will', age: 30, email: 'a@b.com' } });
});

test('setByPath: replaces non-object intermediate with object', () => {
  const obj = { user: null };
  setByPath(obj, 'user.name', 'Will');
  assert.deepEqual(obj, { user: { name: 'Will' } });
});

// --- getCSRFToken / buildHeaders ---------------------------------------

test('getCSRFToken: returns null when no document/meta tag', () => {
  // Stub a minimal document with no matching meta
  globalThis.document = {
    querySelector: () => null,
  };
  assert.equal(getCSRFToken(), null);
  delete globalThis.document;
});

test('getCSRFToken: returns the token content when meta tag exists', () => {
  globalThis.document = {
    querySelector: (sel) => {
      if (sel === 'meta[name="csrf-token"]') {
        return { getAttribute: () => 'test-token-123' };
      }
      return null;
    },
  };
  assert.equal(getCSRFToken(), 'test-token-123');
  delete globalThis.document;
});

test('buildHeaders: includes default Content-Type', () => {
  globalThis.document = { querySelector: () => null };
  const headers = buildHeaders();
  assert.equal(headers['Content-Type'], 'application/json');
  assert.equal(headers['X-CSRF-Token'], undefined);
  delete globalThis.document;
});

test('buildHeaders: merges configured headers', () => {
  globalThis.document = { querySelector: () => null };
  const headers = buildHeaders({ 'X-Custom': 'yes', Authorization: 'Bearer x' });
  assert.equal(headers['Content-Type'], 'application/json');
  assert.equal(headers['X-Custom'], 'yes');
  assert.equal(headers.Authorization, 'Bearer x');
  delete globalThis.document;
});

test('buildHeaders: adds CSRF token when present', () => {
  globalThis.document = {
    querySelector: () => ({ getAttribute: () => 'abc123' }),
  };
  const headers = buildHeaders();
  assert.equal(headers['X-CSRF-Token'], 'abc123');
  delete globalThis.document;
});

test('buildHeaders: config headers can override Content-Type', () => {
  globalThis.document = { querySelector: () => null };
  const headers = buildHeaders({ 'Content-Type': 'text/plain' });
  assert.equal(headers['Content-Type'], 'text/plain');
  delete globalThis.document;
});
