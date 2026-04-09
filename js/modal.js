/**
 * ndesign — Modal dialog module.
 * Uses native <dialog> elements for backdrop, focus trapping, and escape-key
 * handling. Triggers are `[data-nd-modal]` buttons whose value is a CSS
 * selector pointing to a <dialog>.
 *
 * @module modal
 */

/** @type {AbortController|null} */
let controller = null;

/**
 * Dispatch a custom event on a dialog element.
 * @param {HTMLDialogElement} dialog — the dialog element
 * @param {string} name             — event suffix (e.g. "open", "close")
 */
function dispatch(dialog, name) {
  dialog.dispatchEvent(new CustomEvent(`nd:modal:${name}`, { bubbles: true }));
}

/**
 * Open a modal dialog by CSS selector.
 * @param {string} selector — CSS selector for the <dialog> element
 */
export function openModal(selector) {
  const dialog = document.querySelector(selector);
  if (!dialog || typeof dialog.showModal !== 'function') {
    console.warn(`[ndesign] openModal: no <dialog> found for "${selector}"`);
    return;
  }
  dialog.showModal();
  dispatch(dialog, 'open');
}

/**
 * Close a modal dialog by CSS selector.
 * @param {string} selector — CSS selector for the <dialog> element
 */
export function closeModal(selector) {
  const dialog = document.querySelector(selector);
  if (!dialog || typeof dialog.close !== 'function') {
    console.warn(`[ndesign] closeModal: no <dialog> found for "${selector}"`);
    return;
  }
  dialog.close();
}

/**
 * Initialize modal behavior. Scans the DOM for `[data-nd-modal]` triggers,
 * `.nd-modal-close` buttons, and `[data-nd-dismiss]` buttons inside dialogs.
 * Attaches click and close event listeners.
 */
export function initModals() {
  destroyModals();

  controller = new AbortController();
  const signal = controller.signal;

  // Trigger buttons — [data-nd-modal] click opens the target dialog
  const triggers = document.querySelectorAll('[data-nd-modal]');
  for (const trigger of triggers) {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const selector = trigger.getAttribute('data-nd-modal');
      openModal(selector);
    }, { signal });
  }

  // Close buttons inside dialogs — .nd-modal-close and [data-nd-dismiss]
  const closeButtons = document.querySelectorAll(
    'dialog .nd-modal-close, dialog [data-nd-dismiss]'
  );
  for (const btn of closeButtons) {
    btn.addEventListener('click', () => {
      const dialog = btn.closest('dialog');
      if (dialog) dialog.close();
    }, { signal });
  }

  // Dialog-level events — close dispatch and backdrop click
  const dialogs = document.querySelectorAll('dialog');
  for (const dialog of dialogs) {
    // Dispatch nd:modal:close when the dialog closes (covers Escape, .close(), etc.)
    dialog.addEventListener('close', () => {
      dispatch(dialog, 'close');
    }, { signal });

    // Backdrop click detection: click on the dialog element itself where
    // coordinates fall outside the dialog's bounding rect means the user
    // clicked the ::backdrop pseudo-element.
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const outside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (outside) dialog.close();
    }, { signal });
  }
}

/**
 * Tear down all modal event listeners set up by initModals().
 */
export function destroyModals() {
  if (controller) {
    controller.abort();
    controller = null;
  }
}
