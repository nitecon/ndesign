/**
 * ndesign — Shared utility helpers.
 * No external dependencies. Pure functions only.
 * @module utils
 */

/**
 * HTML-escape a string to prevent XSS when interpolating user data.
 * @param {string} str — raw string
 * @returns {string} escaped string safe for insertion into HTML
 */
export function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Resolve a value from a nested object using dot-notation path.
 * @param {Object} obj  — source object
 * @param {string} path — dot-delimited key path (e.g. "user.address.city")
 * @returns {*} the resolved value, or undefined if any segment is missing
 */
export function getByPath(obj, path) {
  if (obj == null || !path) return undefined;
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Set a value on a nested object using dot-notation path, creating
 * intermediate objects as needed.
 * @param {Object} obj  — target object (mutated in place)
 * @param {string} path — dot-delimited key path
 * @param {*} value     — value to set
 */
export function setByPath(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Read the CSRF token from a <meta name="csrf-token"> element.
 * @returns {string|null} the token value, or null if not present
 */
export function getCSRFToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : null;
}

/**
 * Build a headers object for fetch requests, including CSRF and any
 * user-configured headers.
 * @param {Object} [configHeaders={}] — extra headers from NDesign.configure()
 * @returns {Object} merged headers
 */
export function buildHeaders(configHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...configHeaders,
  };
  const csrf = getCSRFToken();
  if (csrf) {
    headers['X-CSRF-Token'] = csrf;
  }
  return headers;
}

/**
 * Fetch a URL with an AbortController-based timeout.
 * On timeout the controller aborts and fetch rejects with an AbortError.
 * Callers identify timeout vs. network failure by checking
 * `err.name === 'AbortError'` (timeout) vs. `err instanceof TypeError`
 * (network / CORS / DNS).
 *
 * @param {string} url                 — request URL
 * @param {RequestInit} [options={}]   — fetch init (method, headers, body…)
 * @param {number} [timeoutMs=15000]   — ms before the request is aborted
 * @returns {Promise<Response>}        — the fetch Response
 * @throws {DOMException} AbortError when the timeout fires before a response
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
