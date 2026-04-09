/**
 * ndesign — Template engine.
 * Finds <template> elements, clones them, and interpolates {{field}}
 * placeholders with data from bound sources.
 * @module template
 */

import { escapeHTML, getByPath } from './utils.js';

/**
 * Interpolate all {{field}} placeholders in a string with values from data.
 * Dot-notation paths are supported (e.g. {{user.name}}).
 * All values are HTML-escaped by default.
 * @param {string} text — template string with {{field}} placeholders
 * @param {Object} data — data source
 * @returns {string} interpolated string with HTML-escaped values
 */
export function interpolate(text, data) {
  return text.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (_match, key) => {
    const value = getByPath(data, key.trim());
    return escapeHTML(value);
  });
}

/**
 * Process data-nd-if conditional elements within a cloned template fragment.
 * Elements with data-nd-if="fieldName" are removed if the field is falsy.
 * @param {DocumentFragment} fragment — cloned template content
 * @param {Object} data — data source for condition evaluation
 */
function processConditionals(fragment, data) {
  const conditionals = fragment.querySelectorAll('[data-nd-if]');
  for (const el of conditionals) {
    const field = el.getAttribute('data-nd-if');
    const value = getByPath(data, field);
    if (!value) {
      el.remove();
    }
  }
}

/**
 * Walk all text nodes and element attributes in a fragment, interpolating
 * {{field}} placeholders.
 * @param {DocumentFragment} fragment — cloned template content
 * @param {Object} data — data source
 */
function interpolateFragment(fragment, data) {
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }
  for (const node of textNodes) {
    if (node.textContent.includes('{{')) {
      node.textContent = interpolateText(node.textContent, data);
    }
  }

  const elements = fragment.querySelectorAll('*');
  for (const el of elements) {
    for (const attr of el.attributes) {
      if (attr.value.includes('{{')) {
        attr.value = interpolateRaw(attr.value, data);
      }
    }
  }
}

/**
 * Interpolate text node content. Uses textContent (not innerHTML) so the
 * escaped HTML entities render literally as safe text.
 * @param {string} text — raw text with {{field}} markers
 * @param {Object} data — data source
 * @returns {string} interpolated text (values are stringified, not HTML-escaped
 *   since textContent handles escaping inherently)
 */
function interpolateText(text, data) {
  return text.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (_match, key) => {
    const value = getByPath(data, key.trim());
    return value != null ? String(value) : '';
  });
}

/**
 * Interpolate attribute values. Values are HTML-escaped since attributes
 * are part of the DOM markup.
 * @param {string} text — attribute value with {{field}} markers
 * @param {Object} data — data source
 * @returns {string} interpolated attribute value
 */
function interpolateRaw(text, data) {
  return text.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (_match, key) => {
    const value = getByPath(data, key.trim());
    return escapeHTML(value);
  });
}

/**
 * Render a single data object through a <template> element, producing a
 * DocumentFragment ready for insertion.
 * @param {HTMLTemplateElement} tpl — the <template> element
 * @param {Object} data — data to interpolate
 * @returns {DocumentFragment} cloned and interpolated fragment
 */
export function renderOne(tpl, data) {
  const fragment = tpl.content.cloneNode(true);
  processConditionals(fragment, data);
  interpolateFragment(fragment, data);
  return fragment;
}

/**
 * Render data through a template and insert into a container element.
 * Arrays produce one clone per item; single objects produce one clone.
 * Respects data-nd-mode (replace|append|prepend) and data-nd-max.
 *
 * @param {HTMLElement} container — target element to render into
 * @param {string} templateId    — ID of the <template> element
 * @param {Object|Array} data    — data to render
 * @param {string} [mode="replace"] — render mode: replace, append, or prepend
 */
export function render(container, templateId, data, mode = 'replace') {
  const tpl = document.getElementById(templateId);
  if (!tpl) {
    console.warn(`[ndesign] Template #${templateId} not found`);
    return;
  }

  const items = Array.isArray(data) ? data : [data];
  const docFragment = document.createDocumentFragment();

  for (const item of items) {
    docFragment.appendChild(renderOne(tpl, item));
  }

  if (mode === 'replace') {
    // Preserve the <template> element itself, clear everything else
    const childNodes = Array.from(container.childNodes);
    for (const child of childNodes) {
      if (child.nodeName !== 'TEMPLATE') {
        container.removeChild(child);
      }
    }
    container.appendChild(docFragment);
  } else if (mode === 'prepend') {
    // Insert before the first non-template child
    const firstNonTemplate = Array.from(container.childNodes).find(
      (n) => n.nodeName !== 'TEMPLATE'
    );
    container.insertBefore(docFragment, firstNonTemplate || null);
  } else {
    // append
    container.appendChild(docFragment);
  }

  // Enforce data-nd-max limit
  const max = parseInt(container.getAttribute('data-nd-max'), 10);
  if (max > 0) {
    const children = Array.from(container.children).filter(
      (c) => c.nodeName !== 'TEMPLATE'
    );
    while (children.length > max) {
      const oldest = mode === 'prepend' ? children.pop() : children.shift();
      oldest.remove();
    }
  }
}
