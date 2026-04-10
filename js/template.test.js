/**
 * Unit tests for template.js interpolate() — pure function, no DOM needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpolate } from './template.js';

test('interpolate: simple field', () => {
  assert.equal(interpolate('Hello {{name}}', { name: 'Will' }), 'Hello Will');
});

test('interpolate: multiple fields', () => {
  assert.equal(
    interpolate('{{a}} and {{b}}', { a: 'foo', b: 'bar' }),
    'foo and bar'
  );
});

test('interpolate: dot notation', () => {
  assert.equal(
    interpolate('{{user.name}}', { user: { name: 'Will' } }),
    'Will'
  );
});

test('interpolate: deeply nested dot notation', () => {
  assert.equal(
    interpolate('{{a.b.c}}', { a: { b: { c: 'deep' } } }),
    'deep'
  );
});

test('interpolate: escapes HTML in values', () => {
  assert.equal(interpolate('{{msg}}', { msg: '<script>' }), '&lt;script&gt;');
});

test('interpolate: escapes ampersands and quotes', () => {
  assert.equal(
    interpolate('{{msg}}', { msg: 'Tom & "Jerry"' }),
    'Tom &amp; &quot;Jerry&quot;'
  );
});

test('interpolate: missing field becomes empty', () => {
  assert.equal(interpolate('{{missing}}', {}), '');
  assert.equal(interpolate('x={{missing}}y', {}), 'x=y');
});

test('interpolate: whitespace in braces', () => {
  assert.equal(interpolate('{{ name }}', { name: 'Will' }), 'Will');
  assert.equal(interpolate('{{  user.name  }}', { user: { name: 'Will' } }), 'Will');
});

test('interpolate: no placeholders is identity', () => {
  assert.equal(interpolate('plain text', {}), 'plain text');
  assert.equal(interpolate('', {}), '');
});

test('interpolate: coerces numeric and boolean values', () => {
  assert.equal(interpolate('{{n}}', { n: 42 }), '42');
  assert.equal(interpolate('{{b}}', { b: true }), 'true');
});

test('interpolate: same field used multiple times', () => {
  assert.equal(
    interpolate('{{x}}-{{x}}-{{x}}', { x: 'a' }),
    'a-a-a'
  );
});
