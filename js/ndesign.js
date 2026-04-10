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
import { initNav, destroyNav } from './nav.js';
import { initDropdowns, destroyDropdowns } from './dropdown.js';
import { initModals, destroyModals, openModal, closeModal } from './modal.js';
import { initToasts, destroyToasts, toast } from './toast.js';
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
    destroyNav();
    destroyDropdowns();
    destroyModals();
    destroyToasts();
  }

  initBindings(config);
  initActions(config);
  initWebSockets(config);
  initSSE(config);
  initSelects();
  initNav();
  initDropdowns();
  initModals();
  initToasts();

  // ── Auto-wiring: single delegated click handler ──────────────────────
  document.addEventListener('click', (e) => {
    // Switch auto-toggle (aria-pressed)
    const sw = e.target.closest('.nd-switch');
    if (sw && !sw.disabled) {
      const pressed = sw.getAttribute('aria-pressed') === 'true';
      sw.setAttribute('aria-pressed', String(!pressed));
      return;
    }

    // Theme set — data-nd-theme="<name>"
    const themeBtn = e.target.closest('[data-nd-theme]');
    if (themeBtn) {
      e.preventDefault();
      setTheme(themeBtn.getAttribute('data-nd-theme'));
      return;
    }

    // Theme cycle — data-nd-theme-toggle
    const themeCycle = e.target.closest('[data-nd-theme-toggle]');
    if (themeCycle) {
      e.preventDefault();
      toggleTheme();
      return;
    }

    // Sidebar toggle — data-nd-toggle="sidebar"
    const sidebarToggle = e.target.closest('[data-nd-toggle="sidebar"]');
    if (sidebarToggle) {
      const sidebar = document.querySelector('.sidebar');
      const overlay = document.querySelector('.overlay, .nd-nav-overlay');
      if (sidebar) sidebar.classList.toggle('nd-nav-open');
      if (overlay) overlay.classList.toggle('active');
      // Update aria-expanded
      const isOpen = sidebar ? sidebar.classList.contains('nd-nav-open') : false;
      sidebarToggle.setAttribute('aria-expanded', String(isOpen));
      return;
    }

    // Overlay click closes sidebar
    if (e.target.matches('.overlay.active, .nd-nav-overlay.nd-active')) {
      const sidebar = document.querySelector('.sidebar.nd-nav-open');
      if (sidebar) sidebar.classList.remove('nd-nav-open');
      e.target.classList.remove('active');
      e.target.classList.remove('nd-active');
      return;
    }

    // Sidebar nav active state
    const link = e.target.closest('.sidebar .nd-nav-menu a, .sidebar .sidebar-menu a');
    if (link) {
      const menu = link.closest('.nd-nav-menu, .sidebar-menu');
      if (menu) {
        menu.querySelectorAll('a').forEach(a => {
          a.classList.remove('nd-active', 'active');
        });
        link.classList.add(link.closest('.nd-nav-menu') ? 'nd-active' : 'active');
      }
      // Close sidebar on mobile
      if (window.innerWidth < 1280) {
        const sidebar = link.closest('.sidebar');
        const overlay = document.querySelector('.overlay, .nd-nav-overlay');
        if (sidebar) sidebar.classList.remove('nd-nav-open');
        if (overlay) {
          overlay.classList.remove('active');
          overlay.classList.remove('nd-active');
        }
      }
      return;
    }
  });

  initialized = true;
}

/**
 * Set a specific theme by name. Uses a single `<link class="theme">` tag
 * for the active stylesheet, and `<meta name="nd-theme">` tags to register
 * available themes with their href.
 *
 * HTML setup:
 *   <link rel="stylesheet" href="themes/dark.css" class="theme" title="dark">
 *   <meta name="nd-theme" content="light" data-href="themes/light.css">
 *   <meta name="nd-theme" content="dark"  data-href="themes/dark.css">
 *
 * @param {string} name — theme name matching a meta tag's content attribute
 */
export function setTheme(name) {
  const meta = document.querySelector(`meta[name="nd-theme"][content="${name}"]`);
  if (!meta) {
    console.warn(`[ndesign] Theme "${name}" not found in meta tags`);
    return;
  }
  const href = meta.getAttribute('data-href');
  if (!href) return;

  const link = document.querySelector('link.theme');
  if (link) {
    link.href = href;
    link.title = name;
  }
}

/**
 * Cycle to the next available theme. Reads all `<meta name="nd-theme">`
 * tags and advances to the next one after the currently active theme.
 */
export function toggleTheme() {
  const metas = Array.from(document.querySelectorAll('meta[name="nd-theme"]'));
  if (metas.length === 0) return;

  const link = document.querySelector('link.theme');
  const currentName = link ? link.title : '';
  const currentIndex = metas.findIndex(m => m.content === currentName);
  const nextIndex = (currentIndex + 1) % metas.length;
  setTheme(metas[nextIndex].content);
}

/**
 * Return an array describing every registered theme.
 * Each entry has { name, label, active }.
 *
 * @returns {Array<{name: string, label: string, active: boolean}>}
 */
export function getThemes() {
  const link = document.querySelector('link.theme');
  const currentName = link ? link.title : '';
  return Array.from(document.querySelectorAll('meta[name="nd-theme"]')).map(meta => ({
    name: meta.content,
    label: meta.content.charAt(0).toUpperCase() + meta.content.slice(1),
    active: meta.content === currentName
  }));
}

// Re-export utilities for advanced usage
export { render, renderOne, interpolate, escapeHTML, getByPath, setByPath, getCSRFToken, openModal, closeModal, toast };

// Auto-initialize on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded (script loaded with defer or at end of body)
    init();
  }
}
