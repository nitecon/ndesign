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

test('action.js: initActions is the only public export', () => {
  const keys = Object.keys(action).sort();
  assert.deepEqual(keys, ['initActions']);
});
