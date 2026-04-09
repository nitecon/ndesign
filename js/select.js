/**
 * ndesign — Custom select dropdown replacement.
 * Auto-upgrades native <select> elements into themed custom dropdowns
 * with full keyboard navigation and ARIA support.
 * No external dependencies. Plain functions and closures only.
 *
 * @module select
 */

import { escapeHTML } from './utils.js';

/** @type {Array<{wrapper: HTMLDivElement, select: HTMLSelectElement}>} */
let instances = [];

/** @type {Function|null} */
let outsideClickHandler = null;

/**
 * Close all open dropdowns.
 */
function closeAll() {
  for (const { wrapper } of instances) {
    wrapper.classList.remove('nd-open');
    const trigger = wrapper.querySelector('.nd-select-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }
}

/**
 * Get the index of the currently highlighted option in a dropdown,
 * or -1 if none is highlighted.
 * @param {HTMLUListElement} list — the dropdown list element
 * @returns {number}
 */
function getHighlightedIndex(list) {
  const options = list.querySelectorAll('.nd-select-option');
  for (let i = 0; i < options.length; i++) {
    if (options[i].classList.contains('nd-highlighted')) return i;
  }
  return -1;
}

/**
 * Set the highlighted option by index, skipping disabled options.
 * @param {HTMLUListElement} list   — the dropdown list element
 * @param {number}           index  — desired index
 * @param {number}           dir    — direction of movement (1 or -1)
 */
function setHighlight(list, index, dir) {
  const options = list.querySelectorAll('.nd-select-option');
  if (options.length === 0) return;

  // Clear existing highlight
  for (const opt of options) opt.classList.remove('nd-highlighted');

  // Find next non-disabled option in the given direction
  let idx = index;
  let attempts = 0;
  while (attempts < options.length) {
    if (idx < 0) idx = options.length - 1;
    if (idx >= options.length) idx = 0;
    if (!options[idx].classList.contains('nd-disabled')) {
      options[idx].classList.add('nd-highlighted');
      options[idx].scrollIntoView({ block: 'nearest' });
      return;
    }
    idx += dir;
    attempts++;
  }
}

/**
 * Select an option by its list item element.
 * @param {HTMLSelectElement} select  — the native select element
 * @param {HTMLDivElement}    wrapper — the custom wrapper
 * @param {HTMLLIElement}     optionEl — the clicked/selected option element
 */
function selectOption(select, wrapper, optionEl) {
  if (optionEl.classList.contains('nd-disabled')) return;

  const list = wrapper.querySelector('.nd-select-dropdown');
  const trigger = wrapper.querySelector('.nd-select-trigger');
  const valueSpan = trigger.querySelector('.nd-select-value');

  // Remove nd-selected and aria-selected from all options
  for (const opt of list.querySelectorAll('.nd-select-option')) {
    opt.classList.remove('nd-selected');
    opt.removeAttribute('aria-selected');
  }

  // Mark the new selection
  optionEl.classList.add('nd-selected');
  optionEl.setAttribute('aria-selected', 'true');

  // Update trigger text
  valueSpan.textContent = optionEl.textContent;

  // Sync back to native select
  const newValue = optionEl.dataset.value;
  select.value = newValue;

  // Dispatch change event on native select for form bindings
  select.dispatchEvent(new Event('change', { bubbles: true }));

  // Close dropdown
  wrapper.classList.remove('nd-open');
  trigger.setAttribute('aria-expanded', 'false');
}

/**
 * Build and wire up a custom dropdown for a single native <select>.
 * @param {HTMLSelectElement} select — the native select element
 */
function buildCustomSelect(select) {
  // Hide the native select
  select.style.display = 'none';

  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'nd-select';
  if (select.disabled) wrapper.classList.add('nd-disabled');

  // Create trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'nd-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const valueSpan = document.createElement('span');
  valueSpan.className = 'nd-select-value';

  const arrowSpan = document.createElement('span');
  arrowSpan.className = 'nd-select-arrow';

  trigger.appendChild(valueSpan);
  trigger.appendChild(arrowSpan);

  // Create dropdown list
  const list = document.createElement('ul');
  list.className = 'nd-select-dropdown';
  list.setAttribute('role', 'listbox');

  // Build options from native <option> elements
  const nativeOptions = select.querySelectorAll('option');
  let selectedText = '';

  for (const nativeOpt of nativeOptions) {
    const li = document.createElement('li');
    li.className = 'nd-select-option';
    li.setAttribute('role', 'option');
    li.dataset.value = nativeOpt.value;
    li.textContent = escapeHTML(nativeOpt.textContent);

    if (nativeOpt.value === '') {
      li.dataset.placeholder = '';
    }

    if (nativeOpt.disabled) {
      li.classList.add('nd-disabled');
    }

    if (nativeOpt.selected) {
      li.classList.add('nd-selected');
      li.setAttribute('aria-selected', 'true');
      selectedText = nativeOpt.textContent;
    }

    // Click handler for option
    li.addEventListener('click', (e) => {
      e.stopPropagation();
      selectOption(select, wrapper, li);
    });

    list.appendChild(li);
  }

  // Set initial display text
  valueSpan.textContent = selectedText;

  // Click trigger to toggle
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (wrapper.classList.contains('nd-disabled')) return;

    const isOpen = wrapper.classList.contains('nd-open');

    // Close all other dropdowns first
    closeAll();

    if (!isOpen) {
      wrapper.classList.add('nd-open');
      trigger.setAttribute('aria-expanded', 'true');

      // Set initial highlight to selected option
      const selectedOpt = list.querySelector('.nd-select-option.nd-selected');
      if (selectedOpt) {
        for (const opt of list.querySelectorAll('.nd-select-option')) {
          opt.classList.remove('nd-highlighted');
        }
        selectedOpt.classList.add('nd-highlighted');
        selectedOpt.scrollIntoView({ block: 'nearest' });
      }
    }
  });

  // Keyboard handling
  /** @type {string} */
  let typeBuffer = '';
  /** @type {number|null} */
  let typeTimer = null;

  trigger.addEventListener('keydown', (e) => {
    if (wrapper.classList.contains('nd-disabled')) return;

    const isOpen = wrapper.classList.contains('nd-open');
    const options = list.querySelectorAll('.nd-select-option');

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (!isOpen) {
          wrapper.classList.add('nd-open');
          trigger.setAttribute('aria-expanded', 'true');
          const currentIdx = getHighlightedIndex(list);
          setHighlight(list, currentIdx === -1 ? 0 : currentIdx, 1);
        } else {
          const idx = getHighlightedIndex(list);
          setHighlight(list, idx + 1, 1);
        }
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        if (!isOpen) {
          wrapper.classList.add('nd-open');
          trigger.setAttribute('aria-expanded', 'true');
          const currentIdx = getHighlightedIndex(list);
          setHighlight(list, currentIdx === -1 ? options.length - 1 : currentIdx, -1);
        } else {
          const idx = getHighlightedIndex(list);
          setHighlight(list, idx - 1, -1);
        }
        break;
      }

      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (!isOpen) {
          wrapper.classList.add('nd-open');
          trigger.setAttribute('aria-expanded', 'true');
          const selectedOpt = list.querySelector('.nd-select-option.nd-selected');
          if (selectedOpt) {
            for (const opt of options) opt.classList.remove('nd-highlighted');
            selectedOpt.classList.add('nd-highlighted');
          }
        } else {
          const highlighted = list.querySelector('.nd-select-option.nd-highlighted');
          if (highlighted) {
            selectOption(select, wrapper, highlighted);
          }
        }
        break;
      }

      case 'Escape': {
        e.preventDefault();
        if (isOpen) {
          wrapper.classList.remove('nd-open');
          trigger.setAttribute('aria-expanded', 'false');
        }
        break;
      }

      default: {
        // Type-ahead: jump to first option starting with typed character(s)
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          typeBuffer += e.key.toLowerCase();

          if (typeTimer !== null) clearTimeout(typeTimer);
          typeTimer = setTimeout(() => {
            typeBuffer = '';
            typeTimer = null;
          }, 500);

          // Open dropdown if closed
          if (!isOpen) {
            wrapper.classList.add('nd-open');
            trigger.setAttribute('aria-expanded', 'true');
          }

          // Find first matching non-disabled option
          for (let i = 0; i < options.length; i++) {
            const optText = options[i].textContent.toLowerCase();
            if (optText.startsWith(typeBuffer) && !options[i].classList.contains('nd-disabled')) {
              for (const opt of options) opt.classList.remove('nd-highlighted');
              options[i].classList.add('nd-highlighted');
              options[i].scrollIntoView({ block: 'nearest' });
              break;
            }
          }
        }
        break;
      }
    }
  });

  // Assemble and insert
  wrapper.appendChild(trigger);
  wrapper.appendChild(list);
  select.insertAdjacentElement('afterend', wrapper);

  // Track instance
  instances.push({ wrapper, select });
}

/**
 * Initialize custom select dropdowns for all eligible <select> elements.
 * Skips elements already wrapped in `.nd-select` and `<select multiple>`.
 * Called automatically by ndesign.init().
 */
export function initSelects() {
  const selects = document.querySelectorAll('select');

  for (const select of selects) {
    // Skip multi-selects
    if (select.multiple) continue;

    // Skip if already wrapped
    if (select.closest('.nd-select')) continue;

    buildCustomSelect(select);
  }

  // Set up outside click handler (once)
  if (!outsideClickHandler) {
    outsideClickHandler = (e) => {
      // If click is not inside any nd-select wrapper, close all
      if (!e.target.closest('.nd-select')) {
        closeAll();
      }
    };
    document.addEventListener('click', outsideClickHandler);
  }
}

/**
 * Remove all custom select wrappers and restore native <select> elements.
 * Used for re-initialization or teardown.
 */
export function destroySelects() {
  for (const { wrapper, select } of instances) {
    select.style.display = '';
    wrapper.remove();
  }
  instances = [];

  // Remove outside click handler
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
}
