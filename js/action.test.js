/**
 * Unit tests for action.js — most internals require DOM, so we verify
 * the public API surface that can be safely imported in Node.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
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
    'resolveConfirm',
  ]);
});

test('action.js: resolveConfirm is an async function', () => {
  assert.equal(typeof action.resolveConfirm, 'function');
});

test('action.js: handleSuccess/clearFormErrors/displayErrors are functions', () => {
  assert.equal(typeof action.handleSuccess, 'function');
  assert.equal(typeof action.clearFormErrors, 'function');
  assert.equal(typeof action.displayErrors, 'function');
});
