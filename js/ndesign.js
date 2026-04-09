/**
 * ndesign — Main entry point.
 * Auto-initializes on DOMContentLoaded. Scans for data-nd-* attributes
 * and sets up all bindings. Exports a global NDesign object when bundled
 * as an IIFE via esbuild.
 *
 * @module ndesign
 */

import { initBindings, destroyBindings } from './bind.js';
import { initActions } from './action.js';
import { initWebSockets, destroyWebSockets } from './ws.js';
import { initSSE, destroySSE } from './sse.js';
import { initSelects, destroySelects } from './select.js';
import { render, renderOne, interpolate } from './template.js';
import { escapeHTML, getByPath, setByPath, getCSRFToken } from './utils.js';

/**
 * Runtime configuration. Merged via configure().
 * @type {Object}
 */
const config = {
  baseURL: '',
  headers: { 'X-Requested-With': 'NDesign' },
  onRequest: null,
  onResponse: null,
  onError: null,
  onRender: null,
  wsProtocols: [],
};

/** Whether the runtime has been initialized */
let initialized = false;

/**
 * Merge user configuration into the runtime config.
 * Call before DOMContentLoaded if you need custom headers/hooks,
 * or call at any time to update.
 *
 * @param {Object} userConfig — partial config to merge
 * @param {string} [userConfig.baseURL]           — prefix for all relative URLs
 * @param {Object} [userConfig.headers]            — extra headers for fetch requests
 * @param {Function} [userConfig.onRequest]        — callback before every fetch
 * @param {Function} [userConfig.onResponse]       — callback after every fetch
 * @param {Function} [userConfig.onError]          — callback on fetch/ws/sse errors
 * @param {Function} [userConfig.onRender]         — callback after template render
 * @param {Array<string>} [userConfig.wsProtocols] — WebSocket sub-protocols
 */
export function configure(userConfig) {
  if (userConfig.headers) {
    Object.assign(config.headers, userConfig.headers);
    delete userConfig.headers;
  }
  Object.assign(config, userConfig);
}

/**
 * Initialize the ndesign runtime. Scans the DOM for all data-nd-*
 * attributes and sets up bindings, actions, WebSocket, and SSE handlers.
 * Called automatically on DOMContentLoaded but can also be called
 * manually for re-initialization (e.g. after dynamic content loads).
 */
export function init() {
  if (initialized) {
    // Tear down existing bindings before re-init
    destroyBindings();
    destroyWebSockets();
    destroySSE();
    destroySelects();
  }

  initBindings(config);
  initActions(config);
  initWebSockets(config);
  initSSE(config);
  initSelects();

  initialized = true;
}

/**
 * Toggle the active theme. Swaps the <link id="nd-theme"> href between
 * light and dark themes. If the current href contains "light", switches
 * to "dark" and vice versa.
 */
export function toggleTheme() {
  const link = document.getElementById('nd-theme');
  if (!link) {
    console.warn('[ndesign] No <link id="nd-theme"> found for theme switching');
    return;
  }

  const href = link.getAttribute('href');
  if (href.includes('light')) {
    link.setAttribute('href', href.replace('light', 'dark'));
  } else if (href.includes('dark')) {
    link.setAttribute('href', href.replace('dark', 'light'));
  }
}

/**
 * Set a specific theme by name. Updates the <link id="nd-theme"> href,
 * replacing the theme filename segment.
 *
 * @param {string} name — theme name (e.g. "light", "dark", "solarized")
 */
export function setTheme(name) {
  const link = document.getElementById('nd-theme');
  if (!link) {
    console.warn('[ndesign] No <link id="nd-theme"> found for theme switching');
    return;
  }

  const href = link.getAttribute('href');
  // Replace the theme file name: themes/whatever.css -> themes/{name}.css
  // Handles both .css and .min.css extensions
  const newHref = href.replace(
    /themes\/[^/.]+(\.\w+)?\.css/,
    `themes/${name}$1.css`
  );
  link.setAttribute('href', newHref);
}

// Re-export utilities for advanced usage
export { render, renderOne, interpolate, escapeHTML, getByPath, setByPath, getCSRFToken };

// Auto-initialize on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded (script loaded with defer or at end of body)
    init();
  }
}
