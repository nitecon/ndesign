/**
 * ndesign — Dropdown menu module.
 * Click-to-toggle dropdowns with full keyboard navigation and ARIA support.
 * No external dependencies. Plain functions and closures only.
 *
 * @module dropdown
 */

/** @type {Array<{wrapper: HTMLElement, trigger: HTMLButtonElement, keyHandler: Function, clickHandler: Function}>} */
let instances = [];

/** @type {Function|null} */
let outsideClickHandler = null;

/**
 * Close a single dropdown and reset its ARIA state.
 * @param {HTMLElement}      wrapper — the .nd-dropdown element
 * @param {HTMLButtonElement} trigger — the direct child button
 */
function closeDropdown(wrapper, trigger) {
  wrapper.classList.remove('nd-open');
  trigger.setAttribute('aria-expanded', 'false');
  clearHighlight(wrapper);
}

/**
 * Close every open dropdown.
 */
function closeAll() {
  for (const { wrapper, trigger } of instances) {
    closeDropdown(wrapper, trigger);
  }
}

/**
 * Get all menu item links inside a dropdown.
 * @param {HTMLElement} wrapper — the .nd-dropdown element
 * @returns {HTMLAnchorElement[]}
 */
function getItems(wrapper) {
  return Array.from(wrapper.querySelectorAll('li a[role="menuitem"]'));
}

/**
 * Get the index of the currently highlighted menu item, or -1.
 * @param {HTMLElement} wrapper — the .nd-dropdown element
 * @returns {number}
 */
function getHighlightedIndex(wrapper) {
  const items = getItems(wrapper);
  for (let i = 0; i < items.length; i++) {
    if (items[i].classList.contains('nd-highlighted')) return i;
  }
  return -1;
}

/**
 * Clear all highlights inside a dropdown.
 * @param {HTMLElement} wrapper — the .nd-dropdown element
 */
function clearHighlight(wrapper) {
  for (const item of getItems(wrapper)) {
    item.classList.remove('nd-highlighted');
  }
}

/**
 * Set highlight on a menu item by index, wrapping around edges.
 * @param {HTMLElement} wrapper — the .nd-dropdown element
 * @param {number}      index  — desired index
 */
function setHighlight(wrapper, index) {
  const items = getItems(wrapper);
  if (items.length === 0) return;

  clearHighlight(wrapper);

  let idx = index;
  if (idx < 0) idx = items.length - 1;
  if (idx >= items.length) idx = 0;

  items[idx].classList.add('nd-highlighted');
  items[idx].scrollIntoView({ block: 'nearest' });
}

/**
 * Apply ARIA attributes to a dropdown's menu and items.
 * @param {HTMLElement} wrapper — the .nd-dropdown element
 */
function applyAria(wrapper) {
  const menu = wrapper.querySelector('ul, ol, [class*="nd-dropdown-menu"]');
  if (menu) {
    menu.setAttribute('role', 'menu');
  }

  const items = wrapper.querySelectorAll('li a');
  for (const item of items) {
    item.setAttribute('role', 'menuitem');
  }
}

/**
 * Initialize dropdown behavior for all `.nd-dropdown` elements.
 * Adds click toggling, keyboard navigation, ARIA attributes, and
 * click-outside-to-close. Called automatically by ndesign.init().
 */
export function initDropdowns() {
  const dropdowns = document.querySelectorAll('.nd-dropdown');

  for (const wrapper of dropdowns) {
    const trigger = wrapper.querySelector(':scope > button');
    if (!trigger) continue;

    // Apply ARIA
    trigger.setAttribute('aria-expanded', 'false');
    applyAria(wrapper);

    // Click handler on trigger
    /** @param {MouseEvent} e */
    const clickHandler = (e) => {
      e.stopPropagation();
      const isOpen = wrapper.classList.contains('nd-open');

      // Close all other dropdowns first
      closeAll();

      if (!isOpen) {
        wrapper.classList.add('nd-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    };

    // Keyboard handler on trigger
    /** @param {KeyboardEvent} e */
    const keyHandler = (e) => {
      const isOpen = wrapper.classList.contains('nd-open');

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (!isOpen) {
            closeAll();
            wrapper.classList.add('nd-open');
            trigger.setAttribute('aria-expanded', 'true');
            setHighlight(wrapper, 0);
          } else {
            const idx = getHighlightedIndex(wrapper);
            setHighlight(wrapper, idx + 1);
          }
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          if (isOpen) {
            const idx = getHighlightedIndex(wrapper);
            setHighlight(wrapper, idx - 1);
          }
          break;
        }

        case 'Enter': {
          if (isOpen) {
            e.preventDefault();
            const items = getItems(wrapper);
            const idx = getHighlightedIndex(wrapper);
            if (idx >= 0 && items[idx]) {
              items[idx].click();
            }
            closeDropdown(wrapper, trigger);
          }
          break;
        }

        case 'Escape': {
          if (isOpen) {
            e.preventDefault();
            closeDropdown(wrapper, trigger);
            trigger.focus();
          }
          break;
        }

        default:
          break;
      }
    };

    trigger.addEventListener('click', clickHandler);
    trigger.addEventListener('keydown', keyHandler);

    instances.push({ wrapper, trigger, keyHandler, clickHandler });
  }

  // Outside click handler (once)
  if (!outsideClickHandler) {
    outsideClickHandler = (e) => {
      if (!e.target.closest('.nd-dropdown')) {
        closeAll();
      }
    };
    document.addEventListener('click', outsideClickHandler);
  }
}

/**
 * Remove all dropdown event listeners and clean up ARIA attributes.
 * Used for re-initialization or teardown.
 */
export function destroyDropdowns() {
  for (const { wrapper, trigger, keyHandler, clickHandler } of instances) {
    trigger.removeEventListener('click', clickHandler);
    trigger.removeEventListener('keydown', keyHandler);
    trigger.setAttribute('aria-expanded', 'false');
    wrapper.classList.remove('nd-open');
  }
  instances = [];

  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
}
