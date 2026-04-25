/**
 * Unit tests for the bundled public entrypoint surface.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ndesign from './ndesign.js';

test('ndesign exports refreshSelect on the public API', () => {
  assert.equal(typeof ndesign.refreshSelect, 'function');
});

test('NDesign.store.set routes through reactive setVar', () => {
  const doc = new EventTarget();
  globalThis.document = doc;
  const OriginalCustomEvent = globalThis.CustomEvent;
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      this.detail = init.detail;
    }
  };

  const events = [];
  doc.addEventListener('nd:var-change', (e) => events.push(e.detail));

  ndesign.store.set('user.email', 'a@example.com');

  assert.equal(events.length, 1);
  assert.equal(events[0].path, 'user.email');
  assert.equal(events[0].topKey, 'user');
  assert.equal(events[0].value.email, 'a@example.com');

  ndesign.store.clear();
  delete globalThis.document;
  if (OriginalCustomEvent) {
    globalThis.CustomEvent = OriginalCustomEvent;
  } else {
    delete globalThis.CustomEvent;
  }
});
