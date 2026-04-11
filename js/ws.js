/**
 * ndesign — WebSocket handler.
 * Manages WebSocket connections for elements with data-nd-ws.
 * Supports shared connections, auto-reconnect with exponential backoff,
 * and template-based rendering of incoming messages.
 * @module ws
 */

import { getByPath } from './utils.js';
import { render } from './template.js';
import { resolveVars } from './store.js';

/**
 * @typedef {Object} WSConnection
 * @property {WebSocket|null} socket      — the WebSocket instance
 * @property {Set<HTMLElement>} elements   — elements bound to this connection
 * @property {number} retryDelay          — current backoff delay in ms
 * @property {number|null} retryTimer     — pending reconnect timeout ID
 * @property {boolean} intentionalClose   — whether close was triggered by teardown
 */

/** @type {Map<string, WSConnection>} shared connections keyed by URL */
const connections = new Map();

/** Backoff constants */
const MIN_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

/**
 * Build the final WebSocket URL. If the user has supplied a
 * `wsTokenProvider` function in config, its return value is appended
 * as a `token=` query parameter. This supports backends behind load
 * balancers that cannot read WebSocket sub-protocols for auth.
 * @param {string} url    — base WebSocket URL
 * @param {Object} config — NDesign configuration object
 * @returns {string} the URL to pass to `new WebSocket(...)`
 */
function buildWSURL(url, config) {
  if (typeof config.wsTokenProvider === 'function') {
    try {
      const token = config.wsTokenProvider();
      if (token) {
        const sep = url.includes('?') ? '&' : '?';
        return url + sep + 'token=' + encodeURIComponent(token);
      }
    } catch (err) {
      console.error('[ndesign] wsTokenProvider threw:', err);
    }
  }
  return url;
}

/**
 * Apply a received WebSocket message to a bound element.
 * @param {HTMLElement} el    — the bound element
 * @param {Object} data       — parsed JSON message
 * @param {Object} config     — NDesign configuration object
 */
function applyMessage(el, data, config) {
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
 * Update connection status CSS classes on all elements bound to a URL.
 * @param {WSConnection} conn   — the connection object
 * @param {boolean} connected   — whether the socket is open
 */
function updateStatus(conn, connected) {
  for (const el of conn.elements) {
    el.classList.toggle('nd-ws-connected', connected);
    el.classList.toggle('nd-ws-disconnected', !connected);
  }
}

/**
 * Open (or reconnect) a WebSocket connection for a given URL.
 * @param {string} url    — WebSocket URL
 * @param {Object} config — NDesign configuration object
 */
function connect(url, config) {
  const conn = connections.get(url);
  if (!conn) return;

  try {
    const protocols = config.wsProtocols || [];
    const fullURL = buildWSURL(url, config);
    const socket = protocols.length > 0
      ? new WebSocket(fullURL, protocols)
      : new WebSocket(fullURL);

    conn.socket = socket;

    socket.addEventListener('open', () => {
      conn.retryDelay = MIN_RETRY_MS;
      updateStatus(conn, true);
    });

    socket.addEventListener('message', (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        // Malformed JSON — degrade gracefully per coding guidelines
        console.warn('[ndesign] WebSocket received non-JSON message:', event.data);
        return;
      }

      for (const el of conn.elements) {
        const filter = el.getAttribute('data-nd-ws-filter');
        if (filter) {
          const colonIdx = filter.indexOf(':');
          if (colonIdx !== -1) {
            const filterField = filter.substring(0, colonIdx).trim();
            const filterValue = filter.substring(colonIdx + 1).trim();
            const actualValue = getByPath(data, filterField);
            if (String(actualValue) !== filterValue) continue;
          }
        }
        applyMessage(el, data, config);
      }
    });

    socket.addEventListener('close', () => {
      updateStatus(conn, false);
      if (!conn.intentionalClose) {
        scheduleReconnect(url, config);
      }
    });

    socket.addEventListener('error', (err) => {
      console.error(`[ndesign] WebSocket error for ${url}:`, err);
      if (typeof config.onError === 'function') {
        config.onError(url, err);
      }
    });
  } catch (err) {
    console.error(`[ndesign] Failed to create WebSocket for ${url}:`, err);
    if (typeof config.onError === 'function') {
      config.onError(url, err);
    }
    scheduleReconnect(url, config);
  }
}

/**
 * Schedule a reconnection attempt with exponential backoff.
 * @param {string} url    — WebSocket URL
 * @param {Object} config — NDesign configuration object
 */
function scheduleReconnect(url, config) {
  const conn = connections.get(url);
  if (!conn || conn.intentionalClose) return;

  if (conn.retryTimer != null) {
    clearTimeout(conn.retryTimer);
  }

  conn.retryTimer = setTimeout(() => {
    conn.retryTimer = null;
    connect(url, config);
  }, conn.retryDelay);

  // Exponential backoff with jitter to prevent thundering herd
  const jitter = Math.random() * 500;
  conn.retryDelay = Math.min((conn.retryDelay * 2) + jitter, MAX_RETRY_MS);
}

/**
 * Initialize all data-nd-ws elements in the document.
 * Elements sharing the same WebSocket URL share a single connection.
 * @param {Object} config — NDesign configuration object
 */
export function initWebSockets(config) {
  const elements = document.querySelectorAll('[data-nd-ws]');

  for (const el of elements) {
    const rawUrl = el.getAttribute('data-nd-ws');
    if (!rawUrl) continue;
    const url = resolveVars(rawUrl);

    if (connections.has(url)) {
      // Shared connection — just add this element
      connections.get(url).elements.add(el);
    } else {
      // New connection
      connections.set(url, {
        socket: null,
        elements: new Set([el]),
        retryDelay: MIN_RETRY_MS,
        retryTimer: null,
        intentionalClose: false,
      });
      connect(url, config);
    }

    // Set initial disconnected state
    el.classList.add('nd-ws-disconnected');
  }
}

/**
 * Tear down all WebSocket connections. Called on cleanup.
 */
export function destroyWebSockets() {
  for (const [url, conn] of connections) {
    conn.intentionalClose = true;
    if (conn.retryTimer != null) {
      clearTimeout(conn.retryTimer);
    }
    if (conn.socket) {
      conn.socket.close();
    }
  }
  connections.clear();
}
