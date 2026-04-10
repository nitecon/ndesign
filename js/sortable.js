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
 * KEYBOARD (WAI-ARIA Listbox reordering pattern):
 *   Space       — Grab focused item / drop grabbed item at current position
 *   ArrowUp/Down — Move grabbed item up/down one position (or focus without grab)
 *   Home/End    — Move grabbed item to first/last position
 *   Escape      — Cancel active keyboard drag (revert to snapshot order)
 *
 * REVERT ON FAILURE: When a server POST returns non-2xx, the DOM is
 * automatically reverted to the pre-drag order, a shake animation
 * plays, and NDesign.toast() is called with an error message. A
 * nd:sortable:revert event is dispatched on the container.
 *
 * @module sortable
 */

import { toast } from './toast.js';
import { buildHeaders } from './utils.js';

/** @type {Array<{container: HTMLElement, handlers: Object, observer: MutationObserver|null}>} */
let instances = [];

/** @type {HTMLElement|null} Currently dragged item (mouse drag), shared across containers. */
let draggedItem = null;

/** @type {{container: HTMLElement, item: HTMLElement, snapshot: Array<HTMLElement>}|null} */
let keyboardDrag = null;

/** @type {HTMLElement|null} Shared aria-live announcer element. */
let liveRegion = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure a single shared aria-live polite region exists in the document.
 * @returns {HTMLElement}
 */
function ensureLiveRegion() {
  if (liveRegion && document.body.contains(liveRegion)) return liveRegion;
  liveRegion = document.querySelector('[data-nd-sortable-live]');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('data-nd-sortable-live', '');
    liveRegion.className = 'nd-sr-only';
    document.body.appendChild(liveRegion);
  }
  return liveRegion;
}

/**
 * Announce a message to screen readers via the shared live region.
 * @param {string} message
 */
function announce(message) {
  const region = ensureLiveRegion();
  region.textContent = '';
  // Force a re-render tick so repeated identical messages re-announce.
  requestAnimationFrame(() => { region.textContent = message; });
}

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
 * Return the array of draggable children in DOM order.
 * @param {HTMLElement} container
 * @returns {Array<HTMLElement>}
 */
function draggableChildren(container) {
  return Array.from(container.children).filter(
    el => el.getAttribute('draggable') === 'true'
  );
}

/**
 * Snapshot the current DOM order of draggable children for potential revert.
 * @param {HTMLElement} container
 * @returns {Array<HTMLElement>}
 */
function snapshotOrder(container) {
  return draggableChildren(container).slice();
}

/**
 * Restore a container's children to a previously snapshotted order.
 * @param {HTMLElement} container
 * @param {Array<HTMLElement>} snapshot
 */
function restoreOrder(container, snapshot) {
  for (const el of snapshot) {
    container.appendChild(el);
  }
}

/**
 * Fire-and-forget POST of the new order to the configured endpoint.
 * On non-2xx, restores the snapshot order, fires nd:sortable:revert,
 * shows a toast, and adds a brief shake animation.
 * @param {HTMLElement}        container
 * @param {string}             action      — "METHOD /url"
 * @param {Array<string>}      order
 * @param {Array<HTMLElement>} snapshot    — pre-drag DOM order for revert
 * @param {HTMLElement}        item        — the item that was moved
 */
async function submitReorder(container, action, order, snapshot, item) {
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
      headers: buildHeaders(),
      body: JSON.stringify({ order }),
    });
    if (!response.ok) {
      let message = 'Reorder failed — order has been reverted.';
      try {
        const ct = response.headers.get('Content-Type') || '';
        if (ct.includes('application/json')) {
          const data = await response.json();
          const serverMsg = (data.errors && data.errors._form) || data.message;
          if (serverMsg) message = String(serverMsg);
        }
      } catch (_) { /* malformed JSON — use fallback message */ }
      revertAndNotify(container, snapshot, item, message);
    }
  } catch (err) {
    console.error('[ndesign] Sortable reorder failed:', err);
    revertAndNotify(container, snapshot, item, 'Reorder failed — order has been reverted.');
  }
}

/**
 * Revert container to snapshot order, shake, toast, and dispatch event.
 * @param {HTMLElement}        container
 * @param {Array<HTMLElement>} snapshot
 * @param {HTMLElement}        item
 * @param {string}             [message]  — user-visible error text for the toast
 */
function revertAndNotify(container, snapshot, item, message) {
  const msg = message || 'Reorder failed — order has been reverted.';
  restoreOrder(container, snapshot);

  container.classList.add('nd-sortable-error');
  setTimeout(() => container.classList.remove('nd-sortable-error'), 2000);

  toast(msg, 'error');

  container.dispatchEvent(new CustomEvent('nd:sortable:revert', {
    detail: { item },
    bubbles: true,
  }));

  announce(msg);
}

// ---------------------------------------------------------------------------
// Mouse drag handlers
// ---------------------------------------------------------------------------

/**
 * Mark the hovered child as the drag source and seed the DataTransfer.
 * @param {DragEvent} e
 */
function handleDragStart(e) {
  const target = /** @type {HTMLElement} */ (e.target);
  const item = target.closest && target.closest('[draggable="true"]');
  if (!item) return;
  const container = sortableContainerFor(item);
  if (!container) return;

  // Cancel any active keyboard drag on the same container.
  if (keyboardDrag && keyboardDrag.container === container) {
    cancelKeyboardDrag();
  }

  // Snapshot before drag.
  item.__ndSnapshot = snapshotOrder(container);

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
 * @param {DragEvent} e
 */
function handleDragOver(e) {
  if (!draggedItem) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

  const target = /** @type {HTMLElement} */ (e.target);
  const over = target.closest && target.closest('[draggable="true"]');
  if (!over || over === draggedItem) return;

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
 * Required for the drop event to fire in some browsers.
 * @param {DragEvent} e
 */
function handleDrop(e) {
  if (draggedItem) {
    e.preventDefault();
  }
}

/**
 * Clean up dragging state, dispatch nd:sortable:reorder, and optionally POST.
 * @param {DragEvent} _e
 */
function handleDragEnd(_e) {
  if (!draggedItem) return;
  const container = draggedItem.parentElement;
  draggedItem.classList.remove('nd-dragging');
  draggedItem.setAttribute('aria-grabbed', 'false');
  const item = draggedItem;
  const snapshot = item.__ndSnapshot || [];
  delete item.__ndSnapshot;
  draggedItem = null;

  if (!container || !container.hasAttribute('data-nd-sortable')) return;

  const order = collectOrder(container);

  container.dispatchEvent(new CustomEvent('nd:sortable:reorder', {
    detail: { order, item },
    bubbles: true,
  }));

  const action = container.getAttribute('data-nd-sortable');
  if (action && action.trim()) {
    submitReorder(container, action, order, snapshot, item);
  }
}

// ---------------------------------------------------------------------------
// Keyboard handlers (WAI-ARIA Listbox reordering)
// ---------------------------------------------------------------------------

/**
 * Cancel the active keyboard drag without reordering.
 */
function cancelKeyboardDrag() {
  if (!keyboardDrag) return;
  const { container, item, snapshot } = keyboardDrag;
  keyboardDrag = null;

  restoreOrder(container, snapshot);

  item.classList.remove('nd-kb-grabbed');
  item.setAttribute('aria-grabbed', 'false');

  const label = itemLabel(item);
  announce(`Cancelled. ${label} returned to its original position.`);
}

/**
 * Extract a human-readable label from a list item for announcements.
 * Uses aria-label, then textContent (trimmed, first 60 chars).
 * @param {HTMLElement} el
 * @returns {string}
 */
function itemLabel(el) {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  const text = el.textContent.trim().slice(0, 60);
  return text || 'item';
}

/**
 * Handle keydown events on a sortable container (keyboard reorder).
 * @param {KeyboardEvent} e
 */
function handleKeyDown(e) {
  const container = /** @type {HTMLElement} */ (e.currentTarget);
  const target = /** @type {HTMLElement} */ (e.target);

  // Only respond when focus is on a draggable child of THIS container.
  const item = target.closest && target.closest('[draggable="true"]');
  if (!item || item.parentElement !== container) return;

  const isGrabbed = keyboardDrag && keyboardDrag.item === item;

  switch (e.key) {
    case ' ': {
      e.preventDefault();
      if (!isGrabbed) {
        // Grab the item.
        keyboardDrag = {
          container,
          item,
          snapshot: snapshotOrder(container),
        };
        item.classList.add('nd-kb-grabbed');
        item.setAttribute('aria-grabbed', 'true');
        announce(`Grabbed ${itemLabel(item)}. Use arrow keys to move, Space to drop, Escape to cancel.`);
      } else {
        // Drop at current position — capture snapshot before clearing state.
        const dropOrder = collectOrder(container);
        const dropSnapshot = keyboardDrag.snapshot;
        keyboardDrag = null;
        item.classList.remove('nd-kb-grabbed');
        item.setAttribute('aria-grabbed', 'false');

        container.dispatchEvent(new CustomEvent('nd:sortable:reorder', {
          detail: { order: dropOrder, item },
          bubbles: true,
        }));

        const action = container.getAttribute('data-nd-sortable');
        if (action && action.trim()) {
          submitReorder(container, action, dropOrder, dropSnapshot, item);
        }

        const children = draggableChildren(container);
        const pos = children.indexOf(item) + 1;
        announce(`Dropped ${itemLabel(item)} at position ${pos} of ${children.length}.`);
      }
      break;
    }

    case 'ArrowUp': {
      e.preventDefault();
      if (isGrabbed) {
        const prev = item.previousElementSibling;
        if (prev && prev.getAttribute('draggable') === 'true') {
          container.insertBefore(item, prev);
          const children = draggableChildren(container);
          announce(`${itemLabel(item)}, position ${children.indexOf(item) + 1} of ${children.length}.`);
        }
      } else {
        // Move focus to previous item.
        const prev = item.previousElementSibling;
        if (prev && prev.getAttribute('draggable') === 'true') {
          /** @type {HTMLElement} */ (prev).focus();
        }
      }
      break;
    }

    case 'ArrowDown': {
      e.preventDefault();
      if (isGrabbed) {
        const next = item.nextElementSibling;
        if (next && next.getAttribute('draggable') === 'true') {
          container.insertBefore(item, next.nextSibling);
          const children = draggableChildren(container);
          announce(`${itemLabel(item)}, position ${children.indexOf(item) + 1} of ${children.length}.`);
        }
      } else {
        // Move focus to next item.
        const next = item.nextElementSibling;
        if (next && next.getAttribute('draggable') === 'true') {
          /** @type {HTMLElement} */ (next).focus();
        }
      }
      break;
    }

    case 'Home': {
      if (!isGrabbed) break;
      e.preventDefault();
      const children = draggableChildren(container);
      if (children[0] && children[0] !== item) {
        container.insertBefore(item, children[0]);
        const len = draggableChildren(container).length;
        announce(`${itemLabel(item)}, position 1 of ${len}.`);
      }
      break;
    }

    case 'End': {
      if (!isGrabbed) break;
      e.preventDefault();
      container.appendChild(item);
      const ch = draggableChildren(container);
      announce(`${itemLabel(item)}, position ${ch.length} of ${ch.length}.`);
      break;
    }

    case 'Escape': {
      if (isGrabbed) {
        e.preventDefault();
        cancelKeyboardDrag();
      }
      break;
    }

    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Initialization / teardown
// ---------------------------------------------------------------------------

/**
 * Wire a single draggable child: tabIndex, role, aria-grabbed.
 * @param {Element} child
 * @param {boolean} needsListRole
 */
function wireChild(child, needsListRole) {
  if (child.nodeType !== 1) return;
  child.setAttribute('draggable', 'true');
  if (!child.hasAttribute('tabindex')) {
    child.setAttribute('tabindex', '0');
  }
  if (needsListRole && !child.hasAttribute('role')) {
    child.setAttribute('role', 'option');
  }
  if (!child.hasAttribute('aria-grabbed')) {
    child.setAttribute('aria-grabbed', 'false');
  }
}

/**
 * Initialize every `[data-nd-sortable]` container on the page.
 * Marks each child as draggable and attaches delegated listeners.
 * A MutationObserver auto-wires dynamically added children.
 * Safe to call repeatedly — already-initialized containers are skipped.
 */
export function initSortable() {
  const containers = document.querySelectorAll('[data-nd-sortable]');

  for (const container of containers) {
    if (container.__ndSortableBound) continue;
    container.__ndSortableBound = true;

    const containerTag = container.tagName;
    // UL/OL get implicit listbox semantics; div/section containers need role.
    const needsListRole = containerTag !== 'UL' && containerTag !== 'OL';
    if (needsListRole && !container.hasAttribute('role')) {
      container.setAttribute('role', 'listbox');
    }
    if (!container.hasAttribute('aria-label') && !container.hasAttribute('aria-labelledby')) {
      container.setAttribute('aria-label', 'Reorderable list');
    }

    for (const child of container.children) {
      wireChild(child, needsListRole);
    }

    // MutationObserver: auto-wire dynamically added children (FE-3).
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            wireChild(/** @type {Element} */ (node), needsListRole);
          }
        }
      }
    });
    observer.observe(container, { childList: true });

    container.addEventListener('dragstart', handleDragStart);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);
    container.addEventListener('dragend', handleDragEnd);
    container.addEventListener('keydown', handleKeyDown);

    instances.push({
      container,
      observer,
      handlers: {
        dragstart: handleDragStart,
        dragover: handleDragOver,
        drop: handleDrop,
        dragend: handleDragEnd,
        keydown: handleKeyDown,
      },
    });
  }
}

/**
 * Remove all sortable listeners, disconnect observers, and reset attributes.
 * Used for re-initialization or teardown.
 */
export function destroySortable() {
  // Cancel any active keyboard drag first.
  if (keyboardDrag) {
    cancelKeyboardDrag();
  }

  for (const { container, observer, handlers } of instances) {
    container.removeEventListener('dragstart', handlers.dragstart);
    container.removeEventListener('dragover', handlers.dragover);
    container.removeEventListener('drop', handlers.drop);
    container.removeEventListener('dragend', handlers.dragend);
    container.removeEventListener('keydown', handlers.keydown);

    if (observer) observer.disconnect();
    delete container.__ndSortableBound;

    for (const child of container.children) {
      if (child.getAttribute && child.getAttribute('draggable') === 'true') {
        child.removeAttribute('draggable');
        child.removeAttribute('tabindex');
        child.classList.remove('nd-kb-grabbed', 'nd-dragging');
        child.setAttribute('aria-grabbed', 'false');
      }
    }
  }
  instances = [];
  draggedItem = null;
  keyboardDrag = null;
}
