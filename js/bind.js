/**
 * ndesign — REST data binding handler.
 * Handles elements with data-nd-bind, fetching data from REST endpoints
 * and rendering via templates or scalar field binding.
 *
 * data-nd-defer: when present, skips the initial automatic fetch. The
 * element still responds to nd:refresh events fired externally.
 *
 * data-nd-set on a bind element: after a successful fetch the response
 * data is passed to applySetDirective(), enabling chained store writes.
 *
 * @module bind
 */

import { getByPath, buildHeaders } from './utils.js';
import { render } from './template.js';
import { resolveVars, applySetDirective } from './store.js';

/** @type {Map<string, Promise<any>>} in-flight request dedup cache */
const pendingRequests = new Map();

/** @type {Map<Element, number>} active polling intervals by element */
const pollingIntervals = new Map();

/** @type {MutationObserver|null} watches for removed polling elements */
let pollingObserver = null;

/**
 * Build the fetch URL for a bound element, applying ${var} interpolation
 * and appending any query parameters declared via data-nd-params.
 * @param {HTMLElement} el — element with data-nd-bind attribute
 * @returns {string} URL with query string appended, or the raw
 *                   data-nd-bind value if no params are present
 */
function buildFetchURL(el) {
  const rawUrl = el.getAttribute('data-nd-bind') || '';
  const url = resolveVars(rawUrl);
  const params = el.getAttribute('data-nd-params');
  if (!params) return url;
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + params;
}

/**
 * Fetch JSON from a URL with request deduplication.
 * Multiple elements bound to the same URL within the same tick share
 * a single fetch request.
 * @param {string} url     — absolute or relative URL
 * @param {Object} config  — NDesign configuration object
 * @returns {Promise<any>} parsed JSON response
 */
async function fetchJSON(url, config) {
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url);
  }

  const headers = buildHeaders(config.headers);
  // Remove Content-Type for GET requests (no body)
  delete headers['Content-Type'];

  const options = { method: 'GET', headers };

  if (typeof config.onRequest === 'function') {
    config.onRequest(url, options);
  }

  const promise = fetch(url, options)
    .then(async (response) => {
      if (typeof config.onResponse === 'function') {
        config.onResponse(url, response);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .finally(() => {
      pendingRequests.delete(url);
    });

  pendingRequests.set(url, promise);
  return promise;
}

/**
 * Process a single data-nd-bind element: fetch data and render it.
 * @param {HTMLElement} el    — element with data-nd-bind attribute
 * @param {Object} config    — NDesign configuration object
 */
async function processBind(el, config) {
  const rawURL = el.getAttribute('data-nd-bind');
  if (!rawURL) return;
  const url = buildFetchURL(el);

  // Show loading placeholder if a loading template exists
  const loadingTpl = el.querySelector('template[data-nd-loading]');
  if (loadingTpl && !el.querySelector('[data-nd-loading-active]')) {
    const fragment = loadingTpl.content.cloneNode(true);
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-nd-loading-active', '');
    wrapper.appendChild(fragment);
    el.appendChild(wrapper);
  }

  try {
    el.classList.remove('nd-error');
    el.classList.add('nd-loading');

    const data = await fetchJSON(url, config);

    el.classList.remove('nd-loading');

    // Remove loading placeholder
    const loadingEl = el.querySelector('[data-nd-loading-active]');
    if (loadingEl) loadingEl.remove();

    const templateId = el.getAttribute('data-nd-template');
    const field = el.getAttribute('data-nd-field');
    const mode = el.getAttribute('data-nd-mode') || 'replace';

    // Optional sub-field extraction: when the backend returns an envelope
    // like {data: [...], meta: {...}}, data-nd-select="data" picks out the
    // array before rendering. Supports dot-notation paths.
    const selectPath = el.getAttribute('data-nd-select');
    const renderData = selectPath ? getByPath(data, selectPath) : data;

    if (templateId) {
      render(el, templateId, renderData, mode);
    } else if (field) {
      const value = getByPath(data, field);
      const attr = el.getAttribute('data-nd-attr');
      if (attr) {
        if (value != null) {
          el.setAttribute(attr, String(value));
        } else {
          el.removeAttribute(attr);
        }
      } else {
        el.textContent = value != null ? String(value) : '';
      }
    } else {
      // No template, no field — treat data as plain text
      el.textContent = typeof data === 'string' ? data : JSON.stringify(data);
    }

    // Handle empty state — show empty template if the rendered data is an
    // empty array (honours data-nd-select so envelope-wrapped responses
    // trigger the empty state correctly).
    if (Array.isArray(renderData) && renderData.length === 0) {
      const emptyTpl = el.querySelector('template[data-nd-empty]');
      if (emptyTpl) {
        const fragment = emptyTpl.content.cloneNode(true);
        // Clear non-template children
        Array.from(el.childNodes).forEach(child => {
          if (child.nodeName !== 'TEMPLATE') el.removeChild(child);
        });
        el.appendChild(fragment);
      }
    }

    if (typeof config.onRender === 'function') {
      config.onRender(el, data);
    }

    // data-nd-set on a bind element: write response (or explicit RHS) to store
    if (el.hasAttribute('data-nd-set')) {
      applySetDirective(el, data);
    }
  } catch (err) {
    el.classList.remove('nd-loading');
    // Remove loading placeholder on error too
    const loadingEl = el.querySelector('[data-nd-loading-active]');
    if (loadingEl) loadingEl.remove();
    el.classList.add('nd-error');
    console.error(`[ndesign] Bind error for ${url}:`, err);

    // Synthesize a unified error envelope (same shape as action.js)
    let envelope;
    if (err.name === 'AbortError') {
      envelope = { errors: { error: 'Request timed out' } };
    } else if (err instanceof TypeError) {
      envelope = { errors: { error: "Couldn't reach server" } };
    } else {
      envelope = { errors: { error: err.message || 'Unexpected error' } };
    }

    // Render <template data-nd-error> if present; otherwise fall through to onError
    const errorTpl = el.querySelector('template[data-nd-error]');
    if (errorTpl) {
      const fragment = errorTpl.content.cloneNode(true);
      // Clear non-template children
      Array.from(el.childNodes).forEach(child => {
        if (child.nodeName !== 'TEMPLATE') el.removeChild(child);
      });
      el.appendChild(fragment);
    } else if (typeof config.onError === 'function') {
      config.onError(url, envelope, err);
    }
  }
}

/**
 * Initialize all data-nd-bind elements in the document.
 * Sets up initial fetch and optional polling via data-nd-refresh.
 * @param {Object} config — NDesign configuration object
 */
export function initBindings(config) {
  const elements = document.querySelectorAll('[data-nd-bind]');

  for (const el of elements) {
    // Listen for nd:refresh custom event to allow external re-triggers
    el.addEventListener('nd:refresh', () => processBind(el, config));

    // data-nd-defer: skip the initial automatic fetch.
    // The element will still respond to nd:refresh events fired externally.
    if (el.hasAttribute('data-nd-defer')) continue;

    // Initial fetch
    processBind(el, config);

    // Set up polling if data-nd-refresh is specified
    const refreshMs = parseInt(el.getAttribute('data-nd-refresh'), 10);
    if (refreshMs > 0) {
      // Clear any existing interval (in case of re-init)
      if (pollingIntervals.has(el)) {
        clearInterval(pollingIntervals.get(el));
      }
      const intervalId = setInterval(() => processBind(el, config), refreshMs);
      pollingIntervals.set(el, intervalId);
    }
  }

  // Watch for removed polling elements
  pollingObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const removed of mutation.removedNodes) {
        if (removed.nodeType !== Node.ELEMENT_NODE) continue;
        // Check if the removed node or any descendants had polling
        const checkElements = [removed];
        if (removed.querySelectorAll) {
          checkElements.push(...removed.querySelectorAll('[data-nd-refresh]'));
        }
        for (const el of checkElements) {
          if (pollingIntervals.has(el)) {
            clearInterval(pollingIntervals.get(el));
            pollingIntervals.delete(el);
          }
        }
      }
    }
  });
  pollingObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Tear down all active polling intervals. Called on cleanup/re-init.
 */
export function destroyBindings() {
  if (pollingObserver) {
    pollingObserver.disconnect();
    pollingObserver = null;
  }
  for (const [el, intervalId] of pollingIntervals) {
    clearInterval(intervalId);
  }
  pollingIntervals.clear();
  pendingRequests.clear();
}
