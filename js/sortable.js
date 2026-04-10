/**
 * ndesign — Sortable lists.
 * Declarative drag-and-drop reordering via `data-nd-sortable` on a
 * container. Children become draggable and can be reordered with the
 * mouse. An optional `METHOD URL` value on the attribute causes the
 * new order to be POSTed to the server after every drop. A custom
 * `nd:sortable:reorder` event is dispatched on the container with
 * `detail.order` containing the new ordering.
 *
 * Uses the native HTML5 drag-and-drop API with delegated listeners at
 * the container level. No external dependencies.
 *
 * ACCESSIBILITY LIMITATION (v1): Keyboard-driven reorder (e.g. Space to
 * lift, Arrow to move, Space to drop) is NOT YET SUPPORTED. This module
 * is mouse/pointer-only in v1. A future v2 pass will add WAI-ARIA APG
 * "Listbox with Reordering" keyboard semantics. For v1, users who cannot
 * use a pointing device must rely on alternate ordering controls (e.g.
 * up/down buttons) provided alongside the sortable list.
 *
 * SERVER SYNC EDGE CASE: If a reorder POST fails the client DOM is
 * already reordered — the server's `nd-sortable-error` visual flash
 * signals the divergence but we do NOT revert automatically. Callers
 * that need strict consistency should listen for the POST failure via
 * a bound element refresh or emit a custom event from the server
 * response. Rapid drag cycles during a failed request can compound
 * divergence; callers needing stricter semantics should re-fetch the
 * authoritative order after an error.
 *
 * @module sortable
 */

/** @type {Array<{container: HTMLElement, handlers: Object}>} */
let instances = [];

/** @type {HTMLElement|null} Currently dragged item, shared across containers. */
let draggedItem = null;

/**
 * Check whether a DOM element is a direct draggable child of a sortable
 * container. Returns the container if so, else null.
 * @param {HTMLElement} el
 * @returns {HTMLElement|null}
 */
function sortableContainerFor(el) {
  if (!el || !el.parentElement) return null;
  const parent = el.parentElement;
  if (parent.hasAttribute('data-nd-sortable')) return parent;
  return null;
}

/**
 * Collect an array of identifiers for the current child ordering of a
 * sortable container. Uses `data-id` when present, falling back to the
 * child's positional index as a string.
 * @param {HTMLElement} container
 * @returns {Array<string>}
 */
function collectOrder(container) {
  return Array.from(container.children)
    .filter(el => el.getAttribute('draggable') === 'true')
    .map((el, i) => el.dataset.id || String(i));
}

/**
 * Fire-and-forget POST of the new order to the configured endpoint.
 * On network or HTTP failure, adds `nd-sortable-error` class to the
 * container briefly for visual feedback.
 * @param {HTMLElement}   container
 * @param {string}        action    — "METHOD /url" (method optional)
 * @param {Array<string>} order
 */
async function submitReorder(container, action, order) {
  const parts = action.trim().split(/\s+/);
  let method = 'POST';
  let url = parts[0];
  if (parts.length >= 2) {
    method = parts[0].toUpperCase();
    url = parts[1];
  }
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    if (!response.ok) {
      container.classList.add('nd-sortable-error');
      setTimeout(() => container.classList.remove('nd-sortable-error'), 2000);
    }
  } catch (err) {
    console.error('[ndesign] Sortable reorder failed:', err);
    container.classList.add('nd-sortable-error');
    setTimeout(() => container.classList.remove('nd-sortable-error'), 2000);
  }
}

/**
 * Mark the hovered child as the drag source and seed the DataTransfer.
 * Required for Firefox: it refuses to initiate a drag unless some data
 * is set via `setData`.
 * @param {DragEvent} e
 */
function handleDragStart(e) {
  const target = /** @type {HTMLElement} */ (e.target);
  const item = target.closest && target.closest('[draggable="true"]');
  if (!item) return;
  if (!sortableContainerFor(item)) return;
  draggedItem = item;
  item.classList.add('nd-dragging');
  item.setAttribute('aria-grabbed', 'true');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', '');
    } catch (_) { /* some browsers throw on empty data — ignore */ }
  }
}

/**
 * While dragging, reorder the DOM live so the user sees the drop slot.
 * Uses the vertical midpoint of the element under the cursor to decide
 * whether to insert before or after it.
 * @param {DragEvent} e
 */
function handleDragOver(e) {
  if (!draggedItem) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

  const target = /** @type {HTMLElement} */ (e.target);
  const over = target.closest && target.closest('[draggable="true"]');
  if (!over || over === draggedItem) return;

  // Only reorder within the same container.
  if (over.parentElement !== draggedItem.parentElement) return;

  const rect = over.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;

  if (e.clientY < midY) {
    over.parentElement.insertBefore(draggedItem, over);
  } else {
    over.parentElement.insertBefore(draggedItem, over.nextSibling);
  }
}

/**
 * Required for the drop event to fire at all in some browsers.
 * @param {DragEvent} e
 */
function handleDrop(e) {
  if (draggedItem) {
    e.preventDefault();
  }
}

/**
 * Clean up dragging state, dispatch `nd:sortable:reorder`, and
 * optionally POST the new order to the server.
 * @param {DragEvent} _e
 */
function handleDragEnd(_e) {
  if (!draggedItem) return;
  const container = draggedItem.parentElement;
  draggedItem.classList.remove('nd-dragging');
  draggedItem.setAttribute('aria-grabbed', 'false');
  const item = draggedItem;
  draggedItem = null;

  if (!container || !container.hasAttribute('data-nd-sortable')) return;

  const order = collectOrder(container);

  container.dispatchEvent(new CustomEvent('nd:sortable:reorder', {
    detail: { order, item },
    bubbles: true,
  }));

  const action = container.getAttribute('data-nd-sortable');
  if (action && action.trim()) {
    submitReorder(container, action, order);
  }
}

/**
 * Initialize every `[data-nd-sortable]` container on the page.
 * Marks each child as `draggable` and attaches delegated listeners.
 * Safe to call repeatedly — already-initialized containers are
 * skipped.
 */
export function initSortable() {
  const containers = document.querySelectorAll('[data-nd-sortable]');

  for (const container of containers) {
    if (container.__ndSortableBound) continue;
    container.__ndSortableBound = true;

    // Mark children as draggable. We intentionally do NOT watch for
    // DOM mutations here — callers who add children dynamically
    // should run initSortable() again, or set draggable="true"
    // themselves. We also set role="listitem" and aria-grabbed="false"
    // so assistive tech can at least announce the items as a list,
    // even though full keyboard reorder is a v2 feature.
    const containerTag = container.tagName;
    const needsListRole = containerTag !== 'UL' && containerTag !== 'OL';
    if (needsListRole && !container.hasAttribute('role')) {
      container.setAttribute('role', 'list');
    }
    for (const child of container.children) {
      if (child.nodeType === 1) {
        child.setAttribute('draggable', 'true');
        if (needsListRole && !child.hasAttribute('role')) {
          child.setAttribute('role', 'listitem');
        }
        if (!child.hasAttribute('aria-grabbed')) {
          child.setAttribute('aria-grabbed', 'false');
        }
      }
    }

    container.addEventListener('dragstart', handleDragStart);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);
    container.addEventListener('dragend', handleDragEnd);

    instances.push({
      container,
      handlers: {
        dragstart: handleDragStart,
        dragover: handleDragOver,
        drop: handleDrop,
        dragend: handleDragEnd,
      },
    });
  }
}

/**
 * Remove all sortable listeners and reset draggable attributes.
 * Used for re-initialization or teardown.
 */
export function destroySortable() {
  for (const { container, handlers } of instances) {
    container.removeEventListener('dragstart', handlers.dragstart);
    container.removeEventListener('dragover', handlers.dragover);
    container.removeEventListener('drop', handlers.drop);
    container.removeEventListener('dragend', handlers.dragend);
    delete container.__ndSortableBound;
    for (const child of container.children) {
      if (child.getAttribute && child.getAttribute('draggable') === 'true') {
        child.removeAttribute('draggable');
      }
    }
  }
  instances = [];
  draggedItem = null;
}
