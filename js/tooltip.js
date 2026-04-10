/**
 * ndesign — Tooltip module.
 * Declarative tooltips via the `data-nd-tooltip` attribute. A single
 * reusable `<div class="nd-tooltip">` element is appended to <body> and
 * shown/hidden/positioned on demand via delegated mouse + focus events.
 *
 * Usage:
 *   <button data-nd-tooltip="Save the document">Save</button>
 *   <a data-nd-tooltip="External link" data-nd-tooltip-placement="bottom">Docs</a>
 *
 * Placements: top (default), bottom, left, right.
 *
 * @module tooltip
 */

/** Delay (ms) before showing a tooltip after mouseenter/focus. */
const SHOW_DELAY = 200;

/** Distance (px) between the tooltip and its anchor. */
const OFFSET = 8;

/** Padding (px) to keep tooltip inside the viewport when clamped. */
const VIEWPORT_PADDING = 4;

/** Id applied to the shared tooltip element (used for aria-describedby). */
const TOOLTIP_ID = 'nd-tooltip-active';

/** Valid placement values. */
const PLACEMENTS = ['top', 'bottom', 'left', 'right'];

/** @type {HTMLDivElement|null} — the single reused tooltip element */
let tooltipEl = null;

/** @type {HTMLElement|null} — currently anchored target */
let currentTarget = null;

/** @type {number|null} — pending show timer */
let showTimer = null;

/** @type {boolean} — whether listeners have been attached */
let initialized = false;

/**
 * Create the shared tooltip element (once) and append it to <body>.
 * @returns {HTMLDivElement}
 */
function ensureTooltipElement() {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'nd-tooltip';
  tooltipEl.id = TOOLTIP_ID;
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

/**
 * Resolve an event target to the nearest ancestor with `data-nd-tooltip`.
 * Returns null if no such ancestor exists or the attribute is empty.
 * @param {EventTarget|null} target
 * @returns {HTMLElement|null}
 */
function resolveTooltipTarget(target) {
  if (!target || !(target instanceof Element)) return null;
  const el = target.closest('[data-nd-tooltip]');
  if (!el) return null;
  const text = el.getAttribute('data-nd-tooltip');
  if (!text) return null;
  return /** @type {HTMLElement} */ (el);
}

/**
 * Read and normalize the placement attribute. Defaults to "top".
 * @param {HTMLElement} el
 * @returns {'top'|'bottom'|'left'|'right'}
 */
function getPlacement(el) {
  const raw = (el.getAttribute('data-nd-tooltip-placement') || 'top').toLowerCase();
  return /** @type {'top'|'bottom'|'left'|'right'} */ (
    PLACEMENTS.includes(raw) ? raw : 'top'
  );
}

/**
 * Compute absolute (document-relative) coordinates for the tooltip
 * given a target element and desired placement. Clamps to the viewport
 * so the tooltip never renders off-screen horizontally/vertically.
 *
 * @param {DOMRect} targetRect
 * @param {number}  tooltipWidth
 * @param {number}  tooltipHeight
 * @param {'top'|'bottom'|'left'|'right'} placement
 * @returns {{x: number, y: number}}
 */
function computePosition(targetRect, tooltipWidth, tooltipHeight, placement) {
  let x = 0;
  let y = 0;

  switch (placement) {
    case 'bottom':
      x = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      y = targetRect.bottom + OFFSET;
      break;
    case 'left':
      x = targetRect.left - tooltipWidth - OFFSET;
      y = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      break;
    case 'right':
      x = targetRect.right + OFFSET;
      y = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      break;
    case 'top':
    default:
      x = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      y = targetRect.top - tooltipHeight - OFFSET;
      break;
  }

  // Clamp horizontally to viewport.
  const maxX = window.innerWidth - tooltipWidth - VIEWPORT_PADDING;
  if (x < VIEWPORT_PADDING) x = VIEWPORT_PADDING;
  if (x > maxX) x = Math.max(VIEWPORT_PADDING, maxX);

  // Clamp vertically to viewport.
  const maxY = window.innerHeight - tooltipHeight - VIEWPORT_PADDING;
  if (y < VIEWPORT_PADDING) y = VIEWPORT_PADDING;
  if (y > maxY) y = Math.max(VIEWPORT_PADDING, maxY);

  // Convert viewport coords to document coords.
  return {
    x: x + window.scrollX,
    y: y + window.scrollY,
  };
}

/**
 * Show the tooltip for the given target element. Called after the
 * show-delay timer elapses.
 * @param {HTMLElement} target
 */
function showTooltip(target) {
  const el = ensureTooltipElement();
  const text = target.getAttribute('data-nd-tooltip') || '';
  const placement = getPlacement(target);

  // Reset placement classes.
  el.classList.remove(
    'nd-tooltip-top',
    'nd-tooltip-bottom',
    'nd-tooltip-left',
    'nd-tooltip-right'
  );
  el.classList.add(`nd-tooltip-${placement}`);

  // textContent prevents HTML injection (XSS).
  el.textContent = text;

  // Measure off-screen before positioning. The element is already in the
  // DOM with opacity 0, so offsetWidth/Height reflect its rendered size.
  // Temporarily clear any transform so measurement is stable.
  el.style.left = '0px';
  el.style.top = '0px';

  const rect = target.getBoundingClientRect();
  const { offsetWidth: w, offsetHeight: h } = el;
  const { x, y } = computePosition(rect, w, h, placement);

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  // Accessibility linkage.
  target.setAttribute('aria-describedby', TOOLTIP_ID);
  el.setAttribute('aria-hidden', 'false');

  // Trigger transition in next frame so the position change doesn't animate.
  requestAnimationFrame(() => {
    el.classList.add('nd-tooltip-visible');
  });

  currentTarget = target;
}

/**
 * Hide the tooltip and clear any pending show timer. Safe to call when
 * no tooltip is currently shown.
 */
function hideTooltip() {
  if (showTimer !== null) {
    clearTimeout(showTimer);
    showTimer = null;
  }

  if (currentTarget) {
    currentTarget.removeAttribute('aria-describedby');
    currentTarget = null;
  }

  if (tooltipEl) {
    tooltipEl.classList.remove('nd-tooltip-visible');
    tooltipEl.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Schedule a tooltip to be shown after the standard delay. Cancels any
 * previously pending show.
 * @param {HTMLElement} target
 */
function scheduleShow(target) {
  if (showTimer !== null) clearTimeout(showTimer);
  showTimer = window.setTimeout(() => {
    showTimer = null;
    showTooltip(target);
  }, SHOW_DELAY);
}

/** @param {Event} e */
function onPointerEnter(e) {
  const target = resolveTooltipTarget(e.target);
  if (!target) return;
  if (target === currentTarget) return;
  hideTooltip();
  scheduleShow(target);
}

/** @param {Event} e */
function onPointerLeave(e) {
  const target = resolveTooltipTarget(e.target);
  if (!target) return;
  hideTooltip();
}

/** @param {FocusEvent} e */
function onFocusIn(e) {
  const target = resolveTooltipTarget(e.target);
  if (!target) return;
  hideTooltip();
  scheduleShow(target);
}

/** @param {FocusEvent} e */
function onFocusOut(e) {
  const target = resolveTooltipTarget(e.target);
  if (!target) return;
  hideTooltip();
}

/** @param {KeyboardEvent} e */
function onKeyDown(e) {
  if (e.key === 'Escape' && currentTarget) {
    hideTooltip();
  }
}

/**
 * Hide the tooltip on scroll/resize — it would otherwise be mis-positioned.
 */
function onScrollOrResize() {
  if (currentTarget || showTimer !== null) {
    hideTooltip();
  }
}

/**
 * Initialize tooltip behavior. Attaches delegated listeners to the
 * document so elements with `data-nd-tooltip` anywhere in the page
 * (including future additions) automatically get tooltips. Idempotent.
 */
export function initTooltips() {
  if (initialized) return;

  ensureTooltipElement();

  // mouseover/mouseout bubble; mouseenter/mouseleave do not — use the
  // former for delegation.
  document.addEventListener('mouseover', onPointerEnter);
  document.addEventListener('mouseout', onPointerLeave);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);

  initialized = true;
}

/**
 * Tear down tooltip listeners and remove the shared tooltip element.
 * Used for re-initialization or teardown.
 */
export function destroyTooltips() {
  if (!initialized) return;

  hideTooltip();

  document.removeEventListener('mouseover', onPointerEnter);
  document.removeEventListener('mouseout', onPointerLeave);
  document.removeEventListener('focusin', onFocusIn);
  document.removeEventListener('focusout', onFocusOut);
  document.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('scroll', onScrollOrResize, true);
  window.removeEventListener('resize', onScrollOrResize);

  if (tooltipEl && tooltipEl.parentNode) {
    tooltipEl.parentNode.removeChild(tooltipEl);
  }
  tooltipEl = null;
  initialized = false;
}
