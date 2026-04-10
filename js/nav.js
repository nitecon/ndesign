/**
 * ndesign — Responsive navigation module.
 * Handles mobile nav toggle, side-nav overlay, and auto-close on resize.
 * No external dependencies. Plain functions and closures only.
 *
 * @module nav
 */

/** Breakpoint above which mobile menus auto-close (matches $nd-bp-lg) */
const BP_LG = 1280;

/** @type {Array<{nav: HTMLElement, toggle: HTMLElement, handler: Function}>} */
let instances = [];

/** @type {Function|null} */
let resizeHandler = null;

/**
 * Remove the overlay element from the DOM if it exists.
 */
function removeOverlay() {
  const overlay = document.querySelector('.nd-nav-overlay');
  if (overlay) overlay.remove();
}

/**
 * Close a specific nav element — remove .nd-nav-open and clean up overlay.
 * @param {HTMLElement} nav — the .nd-nav element to close
 */
function closeNav(nav) {
  nav.classList.remove('nd-nav-open');
  if (nav.classList.contains('nd-nav-side')) {
    removeOverlay();
  }
}

/**
 * Close all open navs.
 */
function closeAllNavs() {
  for (const { nav } of instances) {
    closeNav(nav);
  }
}

/**
 * Initialize navigation toggle behavior for all `.nd-nav-toggle` buttons.
 * Supports standard and side-nav variants with overlay.
 * Called automatically by ndesign.init().
 */
export function initNav() {
  const toggles = document.querySelectorAll('.nd-nav-toggle');

  for (const toggle of toggles) {
    const nav = toggle.closest('nav, .nd-nav');
    if (!nav) continue;

    /** @param {MouseEvent} e */
    const handler = (e) => {
      e.stopPropagation();
      const isOpen = nav.classList.contains('nd-nav-open');

      if (isOpen) {
        closeNav(nav);
      } else {
        nav.classList.add('nd-nav-open');

        if (nav.classList.contains('nd-nav-side')) {
          // Create overlay if one doesn't already exist
          if (!document.querySelector('.nd-nav-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'nd-nav-overlay';
            overlay.addEventListener('click', () => {
              closeNav(nav);
            });
            document.body.appendChild(overlay);
          }
        }
      }

      // Sync aria-expanded with open state
      const isNowOpen = nav.classList.contains('nd-nav-open');
      toggle.setAttribute('aria-expanded', String(isNowOpen));
    };

    toggle.addEventListener('click', handler);
    instances.push({ nav, toggle, handler });
  }

  // Auto-close on resize above breakpoint (single shared handler)
  if (!resizeHandler && instances.length > 0) {
    resizeHandler = () => {
      if (window.innerWidth > BP_LG) {
        closeAllNavs();
      }
    };
    window.addEventListener('resize', resizeHandler);
  }
}

/**
 * Remove all navigation event listeners and overlays.
 * Used for re-initialization or teardown.
 */
export function destroyNav() {
  for (const { toggle, handler } of instances) {
    toggle.removeEventListener('click', handler);
  }
  instances = [];

  removeOverlay();

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
}
