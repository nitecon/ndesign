/**
 * ndesign — Tabs module.
 * Native HTML tabs with ARIA roles, auto-wired via delegated event listeners.
 * Supports click activation and full keyboard navigation per WAI-ARIA APG.
 * No external dependencies. Plain functions and closures only.
 *
 * Activation model: MANUAL activation (per WAI-ARIA Authoring Practices).
 * - Arrow keys (Left/Right, Up/Down for vertical) move focus between tabs
 *   WITHOUT activating them — the user previews each tab before committing.
 * - Home/End jump focus to the first/last enabled tab.
 * - Enter, Space, or mouse click ACTIVATES the focused tab (shows its panel).
 *
 * This is the recommended pattern for tabs whose panels contain non-trivial
 * content or are expensive to render. For auto-activation on focus, a caller
 * can listen for focus events and call the click handler manually — but the
 * default here is manual activation for accessibility and predictability.
 *
 * @module tabs
 */

/** @type {Function|null} */
let clickHandler = null;

/** @type {Function|null} */
let keyHandler = null;

/**
 * Get the parent .nd-tabs container for a given tab element.
 * @param {HTMLElement} tab — the [role="tab"] element
 * @returns {HTMLElement|null}
 */
function getContainer(tab) {
  return tab.closest('.nd-tabs, .nd-tabs-vertical');
}

/**
 * Get all non-disabled tabs inside a container, in DOM order.
 * @param {HTMLElement} container — the .nd-tabs element
 * @returns {HTMLElement[]}
 */
function getTabs(container) {
  return Array.from(container.querySelectorAll(':scope > [role="tablist"] [role="tab"], :scope [role="tablist"] > [role="tab"]'));
}

/**
 * Get all tabpanels inside a container, in DOM order.
 * @param {HTMLElement} container — the .nd-tabs element
 * @returns {HTMLElement[]}
 */
function getPanels(container) {
  return Array.from(container.querySelectorAll(':scope > [role="tabpanel"], :scope [role="tabpanel"]'))
    .filter(panel => panel.closest('.nd-tabs, .nd-tabs-vertical') === container);
}

/**
 * Activate a tab: update ARIA state on all sibling tabs and show the
 * corresponding panel (hiding all others).
 * @param {HTMLElement} tab — the [role="tab"] to activate
 */
function activateTab(tab) {
  if (tab.hasAttribute('disabled')) return;

  const container = getContainer(tab);
  if (!container) return;

  const tabs = getTabs(container);
  const panels = getPanels(container);

  for (const t of tabs) {
    t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    t.setAttribute('tabindex', t === tab ? '0' : '-1');
  }

  const controls = tab.getAttribute('aria-controls');
  for (const panel of panels) {
    if (panel.id === controls) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  }
}

/**
 * Move focus to a tab at the given index, wrapping and skipping disabled tabs.
 * @param {HTMLElement[]} tabs — ordered list of tabs in the container
 * @param {number}        from — index to start searching from
 * @param {number}        step — +1 for forward, -1 for backward
 */
function focusTab(tabs, from, step) {
  if (tabs.length === 0) return;

  const count = tabs.length;
  let idx = from;

  for (let i = 0; i < count; i++) {
    idx = (idx + step + count) % count;
    if (!tabs[idx].hasAttribute('disabled')) {
      tabs[idx].focus();
      return;
    }
  }
}

/**
 * Focus the first non-disabled tab in the list.
 * @param {HTMLElement[]} tabs
 */
function focusFirst(tabs) {
  for (const t of tabs) {
    if (!t.hasAttribute('disabled')) {
      t.focus();
      return;
    }
  }
}

/**
 * Focus the last non-disabled tab in the list.
 * @param {HTMLElement[]} tabs
 */
function focusLast(tabs) {
  for (let i = tabs.length - 1; i >= 0; i--) {
    if (!tabs[i].hasAttribute('disabled')) {
      tabs[i].focus();
      return;
    }
  }
}

/**
 * Prepare a tab container: apply ARIA defaults and ensure initial state.
 * Idempotent — safe to call on already-initialized containers.
 * @param {HTMLElement} container — the .nd-tabs element
 */
function prepareContainer(container) {
  const tablist = container.querySelector(':scope > [role="tablist"]');
  if (tablist && !tablist.hasAttribute('aria-orientation')) {
    tablist.setAttribute(
      'aria-orientation',
      container.classList.contains('nd-tabs-vertical') ? 'vertical' : 'horizontal'
    );
  }

  const tabs = getTabs(container);
  if (tabs.length === 0) return;

  let selected = tabs.find(t => t.getAttribute('aria-selected') === 'true' && !t.hasAttribute('disabled'));
  if (!selected) {
    selected = tabs.find(t => !t.hasAttribute('disabled'));
  }

  for (const t of tabs) {
    const isSelected = t === selected;
    if (!t.hasAttribute('aria-selected')) {
      t.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    }
    t.setAttribute('tabindex', isSelected ? '0' : '-1');
  }

  // Sync panel visibility with the selected tab
  if (selected) {
    const controls = selected.getAttribute('aria-controls');
    const panels = getPanels(container);
    for (const panel of panels) {
      if (panel.id === controls) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    }
  }
}

/**
 * Initialize tabs behavior. Scans for all `.nd-tabs` containers, applies
 * ARIA defaults, and attaches delegated click + keyboard handlers on
 * document. Called automatically by ndesign.init().
 */
export function initTabs() {
  const containers = document.querySelectorAll('.nd-tabs, .nd-tabs-vertical');
  for (const container of containers) {
    prepareContainer(container);
  }

  /** @param {MouseEvent} e */
  clickHandler = (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (!tab) return;
    if (!getContainer(tab)) return;
    if (tab.hasAttribute('disabled')) return;

    e.preventDefault();
    activateTab(tab);
    tab.focus();
  };

  /** @param {KeyboardEvent} e */
  keyHandler = (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (!tab) return;

    const container = getContainer(tab);
    if (!container) return;

    const tabs = getTabs(container);
    const currentIndex = tabs.indexOf(tab);
    if (currentIndex === -1) return;

    const isVertical = container.classList.contains('nd-tabs-vertical');
    const nextKeys = isVertical ? ['ArrowDown'] : ['ArrowRight'];
    const prevKeys = isVertical ? ['ArrowUp'] : ['ArrowLeft'];

    // Accept both axes regardless of orientation for user convenience
    if (nextKeys.includes(e.key) || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusTab(tabs, currentIndex, 1);
      return;
    }

    if (prevKeys.includes(e.key) || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusTab(tabs, currentIndex, -1);
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      focusFirst(tabs);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      focusLast(tabs);
      return;
    }
  };

  document.addEventListener('click', clickHandler);
  document.addEventListener('keydown', keyHandler);
}

/**
 * Remove all tabs event listeners. Used for re-initialization or teardown.
 */
export function destroyTabs() {
  if (clickHandler) {
    document.removeEventListener('click', clickHandler);
    clickHandler = null;
  }
  if (keyHandler) {
    document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
}
