/**
 * ndesign — Toast notification module.
 * Programmatic API for showing dismissible toast messages.
 * Auto-creates a `.nd-toast-container` on first use.
 *
 * @module toast
 */

import { escapeHTML } from './utils.js';

/** CSS class for the container element */
const CONTAINER_CLASS = 'nd-toast-container';

/** Default auto-dismiss duration in milliseconds */
const DEFAULT_DURATION = 5000;

/** Duration of the exit animation in milliseconds */
const EXIT_ANIMATION_MS = 200;

/** @type {HTMLElement|null} */
let container = null;

/**
 * Ensure the toast container exists in the DOM.
 * @returns {HTMLElement} the container element
 */
function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = document.querySelector(`.${CONTAINER_CLASS}`);
  if (!container) {
    container = document.createElement('div');
    container.className = CONTAINER_CLASS;
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Dismiss a single toast element with an exit animation.
 * @param {HTMLElement} el — the toast element to remove
 */
function dismiss(el) {
  if (el.dataset.ndDismissing) return;
  el.dataset.ndDismissing = '1';
  el.classList.add('nd-toast-exit');
  setTimeout(() => {
    el.remove();
  }, EXIT_ANIMATION_MS);
}

/**
 * Show a toast notification.
 *
 * @param {string} message           — text to display (HTML-escaped automatically)
 * @param {string} [type]            — one of 'success', 'error', 'warning', 'info'; omit for neutral
 * @param {number} [duration=5000]   — ms before auto-dismiss; pass 0 for persistent
 * @returns {HTMLElement} the created toast element
 *
 * @example
 * toast('Saved!', 'success');
 * toast('Oops', 'error', 8000);
 * toast('Heads up', 'info', 0); // persistent until manually closed
 */
export function toast(message, type, duration) {
  const dur = duration !== undefined ? duration : DEFAULT_DURATION;
  const target = ensureContainer();

  const el = document.createElement('div');
  el.className = 'nd-toast' + (type ? ` nd-toast-${type}` : '');

  const msg = document.createElement('span');
  msg.className = 'nd-toast-message';
  msg.textContent = escapeHTML(message);
  el.appendChild(msg);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'nd-toast-close';
  closeBtn.textContent = '\u00D7'; // multiplication sign (same as &times;)
  closeBtn.addEventListener('click', () => dismiss(el));
  el.appendChild(closeBtn);

  target.appendChild(el);

  if (dur > 0) {
    setTimeout(() => dismiss(el), dur);
  }

  return el;
}

/**
 * Initialize the toast subsystem. Creates the container element if it does
 * not already exist. No DOM scanning required.
 */
export function initToasts() {
  ensureContainer();
}

/**
 * Tear down the toast subsystem. Removes the container and all active toasts.
 */
export function destroyToasts() {
  if (container && document.body.contains(container)) {
    container.remove();
  }
  container = null;
}
