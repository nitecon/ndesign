/**
 * ndesign — Main entry point.
 * Auto-initializes on DOMContentLoaded. Scans for data-nd-* attributes
 * and sets up all bindings. Exports a global NDesign object when bundled
 * as an IIFE via esbuild.
 *
 * @module ndesign
 */

import { initBindings, destroyBindings } from './bind.js';
import { initActions, resolveConfirm, registerHook } from './action.js';
import { initUploads, destroyUploads } from './upload.js';
import { initWebSockets, destroyWebSockets } from './ws.js';
import { initSSE, destroySSE } from './sse.js';
import { initSelects, destroySelects, refreshSelect } from './select.js';
import { initNav, destroyNav } from './nav.js';
import { initDropdowns, destroyDropdowns } from './dropdown.js';
import { initModals, destroyModals, openModal, closeModal, confirmDialog } from './modal.js';
import { initToasts, destroyToasts, toast } from './toast.js';
import { initTabs, destroyTabs } from './tabs.js';
import { initTooltips, destroyTooltips } from './tooltip.js';
import { initSortable, destroySortable } from './sortable.js';
import { render, renderOne, interpolate } from './template.js';
import { escapeHTML, getByPath, setByPath, getCSRFToken } from './utils.js';
import {
  initStoreFromMeta,
  initSetTriggers,
  initModel,
  destroyStore,
  getVar,
  setVar,
  getEndpoint,
  resolveVars,
  vars,
  endpoints,
} from './store.js';

/**
 * Runtime configuration. Merged via configure().
 * @type {Object}
 */
const config = {
  headers: { 'X-Requested-With': 'NDesign' },
  onRequest: null,
  onResponse: null,
  /**
   * Default error handler — shows a toast with the unified envelope's
   * global message. Apps can override via NDesign.configure({onError: ...})
   * or pass `onError: null` to disable.
   *
   * Envelope shape:
   *   { errors: { error: "...", ...fieldErrors } }
   *
   * @param {string} url                 — URL that failed
   * @param {{errors: Object}} envelope  — unified error envelope
   * @param {Error|null} err             — original thrown error (may be null)
   */
  onError: function defaultOnError(url, envelope, err) {
    const msg =
      (envelope && envelope.errors && (envelope.errors.error || envelope.errors._form)) ||
      'Something went wrong';
    toast(msg, 'error');
  },
  onRender: null,
  /** Milliseconds before a fetch is aborted with a timeout error. */
  timeout: 15000,
  wsProtocols: [],
  wsTokenProvider: null,
};

/** Whether the runtime has been initialized */
let initialized = false;

/**
 * Merge user configuration into the runtime config.
 * Call before DOMContentLoaded if you need custom headers/hooks,
 * or call at any time to update.
 *
 * @param {Object} userConfig — partial config to merge
 * @param {Object} [userConfig.headers]            — extra headers for fetch requests
 * @param {Function} [userConfig.onRequest]        — callback before every fetch
 * @param {Function} [userConfig.onResponse]       — callback after every fetch
 * @param {Function} [userConfig.onError]          — callback on fetch/ws/sse errors
 * @param {Function} [userConfig.onRender]         — callback after template render
 * @param {Array<string>} [userConfig.wsProtocols] — WebSocket sub-protocols
 *        (e.g. `['ndesign.v1', 'jwt.eyJhbGci...']` to carry auth via the
 *        Sec-WebSocket-Protocol header)
 * @param {Function} [userConfig.wsTokenProvider] — function returning a
 *        token string; if set, ws.js appends `?token=<value>` to every
 *        WebSocket URL before connecting. Useful for backends behind
 *        load balancers that cannot inspect sub-protocols.
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
    destroyStore();
    destroyBindings();
    destroyWebSockets();
    destroySSE();
    destroySelects();
    destroyNav();
    destroyDropdowns();
    destroyModals();
    destroyToasts();
    destroyTabs();
    destroyTooltips();
    destroyUploads();
    destroySortable();
  }

  // Store must be initialised before any directive resolves a URL.
  initStoreFromMeta();

  initBindings(config);
  initActions(config);
  initWebSockets(config);
  initSSE(config);
  initSelects();
  initNav();
  initDropdowns();
  initModals();
  initToasts();
  initTabs();
  initTooltips();
  initUploads(config);
  initSortable(config);
  initSetTriggers(config);
  initModel(config);

  // ── Auto-wiring: single delegated click handler ──────────────────────
  document.addEventListener('click', (e) => {
    // Switch auto-toggle (aria-pressed)
    const sw = e.target.closest('.nd-switch');
    if (sw && !sw.disabled) {
      const pressed = sw.getAttribute('aria-pressed') === 'true';
      sw.setAttribute('aria-pressed', String(!pressed));
      return;
    }

    // Toast trigger — data-nd-toast="message"
    const toastBtn = e.target.closest('[data-nd-toast]');
    if (toastBtn) {
      e.preventDefault();
      const message = toastBtn.getAttribute('data-nd-toast');
      const type = toastBtn.getAttribute('data-nd-toast-type') || '';
      const duration = parseInt(toastBtn.getAttribute('data-nd-toast-duration'), 10);
      toast(message, type, isNaN(duration) ? 5000 : duration);
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
      e.preventDefault();
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

    // Bind trigger — data-nd-bind-trigger="#selector"
    // Refetches a bound element, optionally updating its params first.
    // Supports two sources for params:
    //   1. The trigger's own data-nd-params attribute (e.g. a Load More button)
    //   2. The query string of the trigger's href (e.g. a pagination link)
    // When sourced from href, also maintains aria-current="page" state
    // across sibling links for pagination active-state styling.
    const bindTrigger = e.target.closest('[data-nd-bind-trigger]');
    if (bindTrigger) {
      e.preventDefault();
      const selector = bindTrigger.getAttribute('data-nd-bind-trigger');
      const target = document.querySelector(selector);
      if (!target) return;

      // Prefer explicit data-nd-params on the trigger (load-more pattern);
      // otherwise fall back to extracting from the anchor's href (pagination).
      const ownParams = bindTrigger.getAttribute('data-nd-params');
      if (ownParams != null) {
        target.setAttribute('data-nd-params', ownParams);
      } else if (bindTrigger.tagName === 'A' && bindTrigger.href) {
        try {
          const url = new URL(bindTrigger.href, window.location.origin);
          if (url.search) {
            target.setAttribute('data-nd-params', url.search.substring(1));
          }
        } catch (_) { /* invalid URL — ignore */ }

        // Update aria-current on sibling pagination links.
        // Walk up until we find a container that holds multiple bind triggers
        // (the actual pagination list), rather than assuming <ul><li><a>.
        let scope = bindTrigger.parentElement;
        while (scope && scope.querySelectorAll('[data-nd-bind-trigger]').length < 2) {
          scope = scope.parentElement;
        }
        if (scope) {
          scope.querySelectorAll('[aria-current="page"]').forEach(el => el.removeAttribute('aria-current'));
          bindTrigger.setAttribute('aria-current', 'page');
        }
      }

      // Optional mode override (e.g. "append" for load-more)
      const mode = bindTrigger.getAttribute('data-nd-bind-mode');
      if (mode) {
        target.setAttribute('data-nd-mode', mode);
      }

      target.dispatchEvent(new CustomEvent('nd:refresh'));
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
 *   <link rel="stylesheet" href="themes/light.css" class="theme" data-theme="light">
 *   <meta name="nd-theme" content="light" data-href="themes/light.css">
 *   <meta name="nd-theme" content="dark"  data-href="themes/dark.css">
 *
 * IMPORTANT: Do NOT use the `title` attribute on the theme link. Per HTML
 * spec, `<link rel="stylesheet" title="...">` becomes an "alternate stylesheet"
 * that browsers will not apply unless explicitly selected. Use `data-theme`
 * instead to track the active theme name.
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

  const oldLink = document.querySelector('link.theme');
  if (!oldLink) return;

  // Skip if already active
  if (oldLink.getAttribute('data-theme') === name) return;

  // Create a fresh <link> element. Browsers don't always re-evaluate CSSOM
  // when only the href is updated, so replacing the element is more reliable.
  const newLink = document.createElement('link');
  newLink.rel = 'stylesheet';
  newLink.href = href;
  newLink.className = 'theme';
  newLink.setAttribute('data-theme', name);

  // Wait for the new stylesheet to load before removing the old one —
  // prevents a flash of unstyled content during the swap.
  newLink.addEventListener('load', () => {
    oldLink.remove();
  }, { once: true });

  oldLink.parentNode.insertBefore(newLink, oldLink.nextSibling);
}

/**
 * Cycle to the next available theme. Reads all `<meta name="nd-theme">`
 * tags and advances to the next one after the currently active theme.
 */
export function toggleTheme() {
  const metas = Array.from(document.querySelectorAll('meta[name="nd-theme"]'));
  if (metas.length === 0) return;

  const link = document.querySelector('link.theme');
  const currentName = link ? link.getAttribute('data-theme') : '';
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
  const currentName = link ? link.getAttribute('data-theme') : '';
  return Array.from(document.querySelectorAll('meta[name="nd-theme"]')).map(meta => ({
    name: meta.content,
    label: meta.content.charAt(0).toUpperCase() + meta.content.slice(1),
    active: meta.content === currentName
  }));
}

// Re-export utilities for advanced usage
export { render, renderOne, interpolate, escapeHTML, getByPath, setByPath, getCSRFToken, openModal, closeModal, confirmDialog, resolveConfirm, toast, refreshSelect };

// Action lifecycle hooks — register/override verbs for data-nd-success,
// data-nd-error, and data-nd-finally chains (e.g. NDesign.registerHook('toast', ...)).
export { registerHook };

// Store public API
export { resolveVars, getVar as storeGet, setVar as storeSet, getEndpoint as endpoint };

/**
 * Public store object — thin façade over the store module. Writes go
 * through setVar() so they fire nd:var-change events and reactive
 * data-nd-model inputs stay in sync. Supports dot-notation paths on
 * get/set/delete (e.g. 'user.email').
 *
 * NDesign.store.get('user'), NDesign.store.set('count', 5), etc.
 * @type {{ get: function, set: function, delete: function, has: function, clear: function }}
 */
export const store = {
  /** @param {string} path — dot-notation path @returns {*} */
  get(path) { return getVar(path); },
  /** @param {string} path @param {*} value */
  set(path, value) { setVar(path, value); },
  /** @param {string} path — only top-level keys are supported for delete */
  delete(path) {
    vars.delete(path);
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('nd:var-change', {
        detail: { path, topKey: path, value: undefined },
      }));
    }
  },
  /** @param {string} path @returns {boolean} */
  has(path) { return getVar(path) !== undefined; },
  clear() {
    const keys = [...vars.keys()];
    vars.clear();
    if (typeof document !== 'undefined') {
      for (const path of keys) {
        document.dispatchEvent(new CustomEvent('nd:var-change', {
          detail: { path, topKey: path, value: undefined },
        }));
      }
    }
  },
};

// Auto-initialize on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded (script loaded with defer or at end of body)
    init();
  }
}
