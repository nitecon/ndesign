/**
 * ndesign — Server-Sent Events handler.
 * Manages SSE connections for elements with data-nd-sse.
 * Supports event filtering via data-nd-sse-event and template rendering.
 * @module sse
 */

import { getByPath } from './utils.js';
import { render } from './template.js';

/** @type {Map<HTMLElement, EventSource>} active SSE connections by element */
const sources = new Map();

/**
 * Apply a received SSE message to a bound element.
 * @param {HTMLElement} el    — the bound element
 * @param {Object} data       — parsed JSON from the SSE event
 * @param {Object} config     — NDesign configuration object
 */
function applyEvent(el, data, config) {
  const templateId = el.getAttribute('data-nd-template');
  const field = el.getAttribute('data-nd-field');
  const mode = el.getAttribute('data-nd-mode') || 'append';

  if (templateId) {
    render(el, templateId, data, mode);
  } else if (field) {
    const value = getByPath(data, field);
    el.textContent = value != null ? String(value) : '';
  } else {
    el.textContent = typeof data === 'string' ? data : JSON.stringify(data);
  }

  if (typeof config.onRender === 'function') {
    config.onRender(el, data);
  }
}

/**
 * Parse SSE event data as JSON, handling malformed messages gracefully.
 * @param {MessageEvent} event — the SSE MessageEvent
 * @returns {Object|null} parsed data, or null on parse failure
 */
function parseEventData(event) {
  try {
    return JSON.parse(event.data);
  } catch {
    console.warn('[ndesign] SSE received non-JSON message:', event.data);
    return null;
  }
}

/**
 * Initialize all data-nd-sse elements in the document.
 * Each element gets its own EventSource connection. The browser handles
 * auto-reconnect natively for SSE.
 * @param {Object} config — NDesign configuration object
 */
export function initSSE(config) {
  const elements = document.querySelectorAll('[data-nd-sse]');

  for (const el of elements) {
    const url = el.getAttribute('data-nd-sse');
    if (!url) continue;

    const fullURL = (config.baseURL || '') + url;
    const eventFilter = el.getAttribute('data-nd-sse-event');

    const source = new EventSource(fullURL);

    if (eventFilter) {
      // Listen only for the specific named event type
      source.addEventListener(eventFilter, (event) => {
        const data = parseEventData(event);
        if (data) {
          applyEvent(el, data, config);
        }
      });
    } else {
      // Listen for generic "message" events
      source.addEventListener('message', (event) => {
        const data = parseEventData(event);
        if (data) {
          applyEvent(el, data, config);
        }
      });
    }

    source.addEventListener('error', (err) => {
      console.error(`[ndesign] SSE error for ${fullURL}:`, err);
      if (typeof config.onError === 'function') {
        config.onError(fullURL, err);
      }
    });

    sources.set(el, source);
  }
}

/**
 * Tear down all SSE connections. Called on cleanup.
 */
export function destroySSE() {
  for (const [el, source] of sources) {
    source.close();
  }
  sources.clear();
}
