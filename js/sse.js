/**
 * ndesign — Server-Sent Events handler.
 * Manages SSE connections for elements with data-nd-sse.
 * Supports event filtering via data-nd-sse-event and template rendering.
 * @module sse
 */

import { getByPath } from './utils.js';
import { render } from './template.js';

/**
 * @typedef {Object} SSEConnection
 * @property {EventSource} source     — the shared EventSource instance
 * @property {Set<HTMLElement>} elements — elements bound to this URL
 * @property {string|null} lastEventId — the most recently observed SSE event id
 */

/** @type {Map<string, SSEConnection>} shared connections keyed by full URL */
const connections = new Map();

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
 * Dispatch an SSE event to all elements bound to a connection,
 * respecting each element's individual data-nd-sse-event filter.
 * @param {SSEConnection} conn   — the shared connection object
 * @param {string} eventType     — the SSE event type ("message" or a named type)
 * @param {MessageEvent} event   — the raw SSE MessageEvent
 * @param {Object} config        — NDesign configuration object
 */
function dispatchToElements(conn, eventType, event, config) {
  // Track the last event id per connection so application code can
  // read it (e.g., for manual resume scenarios). Native EventSource
  // handles Last-Event-ID reconnect automatically — this is purely
  // for visibility.
  if (event && event.lastEventId) {
    conn.lastEventId = event.lastEventId;
    for (const el of conn.elements) {
      el.dataset.ndSseLastId = event.lastEventId;
    }
  }

  const data = parseEventData(event);
  if (!data) return;

  for (const el of conn.elements) {
    const elFilter = el.getAttribute('data-nd-sse-event');
    if (elFilter && elFilter !== eventType) continue;
    if (!elFilter && eventType !== 'message') continue;
    applyEvent(el, data, config);
  }
}

/**
 * Get the last observed SSE event id for a given URL.
 * Useful for debugging or manual resume scenarios.
 * @param {string} url — the full SSE URL (including baseURL if applicable)
 * @returns {string|null} the last event id, or null if not tracked
 */
export function getLastEventId(url) {
  const conn = connections.get(url);
  return conn ? (conn.lastEventId || null) : null;
}

/**
 * Initialize all data-nd-sse elements in the document.
 * Elements sharing the same SSE URL share a single EventSource connection.
 * The browser handles auto-reconnect natively for SSE.
 * @param {Object} config — NDesign configuration object
 */
export function initSSE(config) {
  const elements = document.querySelectorAll('[data-nd-sse]');

  // Group elements by their resolved URL
  /** @type {Map<string, Set<HTMLElement>>} */
  const grouped = new Map();

  for (const el of elements) {
    const url = el.getAttribute('data-nd-sse');
    if (!url) continue;

    const fullURL = (config.baseURL || '') + url;
    if (!grouped.has(fullURL)) {
      grouped.set(fullURL, new Set());
    }
    grouped.get(fullURL).add(el);
  }

  // Create one EventSource per unique URL
  for (const [fullURL, elSet] of grouped) {
    if (connections.has(fullURL)) {
      // Connection already exists — merge elements
      const conn = connections.get(fullURL);
      for (const el of elSet) {
        conn.elements.add(el);
      }
      continue;
    }

    const source = new EventSource(fullURL);
    const conn = { source, elements: elSet, lastEventId: null };

    // Collect all distinct event types needed by bound elements
    const namedEvents = new Set();
    let needsGenericMessage = false;

    for (const el of elSet) {
      const eventFilter = el.getAttribute('data-nd-sse-event');
      if (eventFilter) {
        namedEvents.add(eventFilter);
      } else {
        needsGenericMessage = true;
      }
    }

    // Register one listener per distinct named event type
    for (const eventType of namedEvents) {
      source.addEventListener(eventType, (event) => {
        dispatchToElements(conn, eventType, event, config);
      });
    }

    // Register the generic "message" listener if any element needs it
    if (needsGenericMessage) {
      source.addEventListener('message', (event) => {
        dispatchToElements(conn, 'message', event, config);
      });
    }

    source.addEventListener('error', (err) => {
      console.error(`[ndesign] SSE error for ${fullURL}:`, err);
      if (typeof config.onError === 'function') {
        config.onError(fullURL, err);
      }
    });

    connections.set(fullURL, conn);
  }
}

/**
 * Tear down all SSE connections. Each EventSource is closed once.
 * Called on cleanup.
 */
export function destroySSE() {
  for (const [url, conn] of connections) {
    conn.source.close();
  }
  connections.clear();
}
