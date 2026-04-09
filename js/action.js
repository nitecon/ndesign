/**
 * ndesign — Form and button action handler.
 * Intercepts forms with data-nd-action, serializes to JSON, submits via
 * fetch, and handles server responses (success and error mapping).
 * @module action
 */

import { setByPath, buildHeaders } from './utils.js';

/**
 * Parse a data-nd-action attribute value into method and URL.
 * Format: "METHOD /path" (e.g. "POST /api/users", "DELETE /api/users/42").
 * @param {string} actionStr — the attribute value
 * @returns {{ method: string, url: string }} parsed action
 */
function parseAction(actionStr) {
  const spaceIdx = actionStr.indexOf(' ');
  if (spaceIdx === -1) {
    return { method: 'POST', url: actionStr };
  }
  return {
    method: actionStr.substring(0, spaceIdx).toUpperCase(),
    url: actionStr.substring(spaceIdx + 1).trim(),
  };
}

/**
 * Serialize a form's named inputs into a JSON-compatible object.
 * Supports dot-notation names for nesting (e.g. name="address.city").
 * Checkboxes serialize as true/false. Multi-selects serialize as arrays.
 * File inputs are skipped.
 * @param {HTMLFormElement} form — the form element
 * @returns {Object} serialized data
 */
function serializeForm(form) {
  const data = {};
  const elements = form.elements;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const name = el.name;
    if (!name || el.disabled || el.type === 'file' || el.type === 'submit' || el.type === 'button') {
      continue;
    }

    if (el.type === 'checkbox') {
      setByPath(data, name, el.checked);
      continue;
    }

    if (el.type === 'radio') {
      if (el.checked) {
        setByPath(data, name, el.value);
      }
      continue;
    }

    if (el.tagName === 'SELECT' && el.multiple) {
      const selected = [];
      for (const opt of el.options) {
        if (opt.selected) {
          selected.push(opt.value);
        }
      }
      setByPath(data, name, selected);
      continue;
    }

    // Number and range inputs
    if (el.type === 'number' || el.type === 'range') {
      setByPath(data, name, el.value === '' ? null : Number(el.value));
      continue;
    }

    setByPath(data, name, el.value);
  }

  return data;
}

/**
 * Clear all form error messages (elements with class .nd-form-error)
 * within a form.
 * @param {HTMLFormElement} form — the form element
 */
function clearFormErrors(form) {
  const errorEls = form.querySelectorAll('.nd-form-error');
  for (const el of errorEls) {
    el.textContent = '';
    el.style.display = 'none';
  }
  // Also remove error state from inputs
  const inputs = form.querySelectorAll('.nd-error');
  for (const el of inputs) {
    el.classList.remove('nd-error');
  }
}

/**
 * Display server-side validation errors on form fields.
 * Maps error keys to inputs by name, and shows messages in the nearest
 * .nd-form-error element.
 * @param {HTMLFormElement} form   — the form element
 * @param {Object} errors          — { fieldName: "error message", ... }
 * @param {string|null} feedbackId — ID of the global feedback element
 */
function displayErrors(form, errors, feedbackId) {
  for (const [field, message] of Object.entries(errors)) {
    if (field === '_form') {
      // Global form error goes to the feedback element
      if (feedbackId) {
        const feedbackEl = document.getElementById(feedbackId);
        if (feedbackEl) {
          feedbackEl.textContent = message;
          feedbackEl.className = 'nd-alert nd-alert-error';
          feedbackEl.style.display = '';
        }
      }
      continue;
    }

    const input = form.querySelector(`[name="${field}"]`);
    if (!input) continue;

    input.classList.add('nd-error');

    // Find the nearest .nd-form-error element — check siblings in the
    // parent .nd-form-group
    const group = input.closest('.nd-form-group');
    const errorEl = group
      ? group.querySelector('.nd-form-error')
      : input.parentElement?.querySelector('.nd-form-error');

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = '';
    }
  }
}

/**
 * Handle successful form submission based on data-nd-success attribute.
 * @param {HTMLFormElement|HTMLElement} el — the element with data-nd-success
 * @param {Object} responseData           — parsed JSON response from server
 */
function handleSuccess(el, responseData) {
  const successAttr = el.getAttribute('data-nd-success');
  if (!successAttr) return;

  if (successAttr.startsWith('redirect:')) {
    const path = successAttr.substring('redirect:'.length);
    window.location.href = path;
    return;
  }

  if (successAttr === 'reset' && el.tagName === 'FORM') {
    el.reset();
    return;
  }

  if (successAttr === 'reload') {
    window.location.reload();
    return;
  }

  if (successAttr.startsWith('emit:')) {
    const eventName = successAttr.substring('emit:'.length);
    el.dispatchEvent(
      new CustomEvent(eventName, { detail: responseData, bubbles: true })
    );
    return;
  }
}

/**
 * Submit a form action via fetch.
 * @param {HTMLFormElement} form — the form element
 * @param {Object} config       — NDesign configuration object
 */
async function submitForm(form, config) {
  const actionStr = form.getAttribute('data-nd-action');
  if (!actionStr) return;

  const { method, url } = parseAction(actionStr);
  const fullURL = (config.baseURL || '') + url;
  const feedbackId = form.getAttribute('data-nd-feedback') || null;

  // Check for confirmation prompt
  const confirmMsg = form.getAttribute('data-nd-confirm');
  if (confirmMsg && !window.confirm(confirmMsg)) {
    return;
  }

  clearFormErrors(form);

  // Clear feedback area
  if (feedbackId) {
    const feedbackEl = document.getElementById(feedbackId);
    if (feedbackEl) {
      feedbackEl.textContent = '';
      feedbackEl.style.display = 'none';
    }
  }

  const data = serializeForm(form);
  const headers = buildHeaders(config.headers);
  const options = {
    method,
    headers,
    body: JSON.stringify(data),
  };

  if (typeof config.onRequest === 'function') {
    config.onRequest(fullURL, options);
  }

  // Disable submit button during request
  const submitBtn = form.querySelector('[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('nd-loading');
  }

  try {
    const response = await fetch(fullURL, options);

    if (typeof config.onResponse === 'function') {
      config.onResponse(fullURL, response);
    }

    let responseData = null;
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    }

    if (!response.ok) {
      // Map server errors to form fields
      if (responseData && responseData.errors) {
        displayErrors(form, responseData.errors, feedbackId);
      } else {
        // Generic error
        if (feedbackId) {
          const feedbackEl = document.getElementById(feedbackId);
          if (feedbackEl) {
            feedbackEl.textContent =
              (responseData && responseData.message) ||
              `Error: ${response.statusText}`;
            feedbackEl.className = 'nd-alert nd-alert-error';
            feedbackEl.style.display = '';
          }
        }
      }
      return;
    }

    // Show success feedback
    if (feedbackId) {
      const feedbackEl = document.getElementById(feedbackId);
      if (feedbackEl) {
        feedbackEl.textContent =
          (responseData && responseData.message) || 'Success';
        feedbackEl.className = 'nd-alert nd-alert-success';
        feedbackEl.style.display = '';
      }
    }

    handleSuccess(form, responseData);
  } catch (err) {
    console.error(`[ndesign] Action error for ${fullURL}:`, err);
    if (feedbackId) {
      const feedbackEl = document.getElementById(feedbackId);
      if (feedbackEl) {
        feedbackEl.textContent = 'Network error. Please try again.';
        feedbackEl.className = 'nd-alert nd-alert-error';
        feedbackEl.style.display = '';
      }
    }
    if (typeof config.onError === 'function') {
      config.onError(fullURL, err);
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('nd-loading');
    }
  }
}

/**
 * Handle a button action (non-form element with data-nd-action).
 * @param {HTMLElement} el  — the button element
 * @param {Object} config   — NDesign configuration object
 */
async function submitButton(el, config) {
  const actionStr = el.getAttribute('data-nd-action');
  if (!actionStr) return;

  const { method, url } = parseAction(actionStr);
  const fullURL = (config.baseURL || '') + url;

  const confirmMsg = el.getAttribute('data-nd-confirm');
  if (confirmMsg && !window.confirm(confirmMsg)) {
    return;
  }

  el.disabled = true;
  el.classList.add('nd-loading');

  const headers = buildHeaders(config.headers);
  // No body for GET/DELETE button actions unless method needs it
  const options = { method, headers };

  if (typeof config.onRequest === 'function') {
    config.onRequest(fullURL, options);
  }

  try {
    const response = await fetch(fullURL, options);

    if (typeof config.onResponse === 'function') {
      config.onResponse(fullURL, response);
    }

    let responseData = null;
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    }

    if (!response.ok) {
      console.error(
        `[ndesign] Action error: ${response.status} ${response.statusText}`
      );
      el.classList.add('nd-error');
      if (typeof config.onError === 'function') {
        config.onError(fullURL, new Error(`HTTP ${response.status}`));
      }
      return;
    }

    el.classList.remove('nd-error');
    handleSuccess(el, responseData);
  } catch (err) {
    console.error(`[ndesign] Action error for ${fullURL}:`, err);
    el.classList.add('nd-error');
    if (typeof config.onError === 'function') {
      config.onError(fullURL, err);
    }
  } finally {
    el.disabled = false;
    el.classList.remove('nd-loading');
  }
}

/**
 * Initialize all data-nd-action elements in the document.
 * Forms are intercepted on submit; buttons/links are intercepted on click.
 * @param {Object} config — NDesign configuration object
 */
export function initActions(config) {
  // Form actions — intercept submit
  const forms = document.querySelectorAll('form[data-nd-action]');
  for (const form of forms) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitForm(form, config);
    });
  }

  // Button actions — intercept click (non-form elements)
  const buttons = document.querySelectorAll(
    '[data-nd-action]:not(form)'
  );
  for (const btn of buttons) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      submitButton(btn, config);
    });
  }

  // data-nd-on — custom event binding (escape hatch)
  const onElements = document.querySelectorAll('[data-nd-on]');
  for (const el of onElements) {
    const binding = el.getAttribute('data-nd-on');
    const colonIdx = binding.indexOf(':');
    if (colonIdx === -1) continue;

    const eventName = binding.substring(0, colonIdx).trim();
    const handlerName = binding.substring(colonIdx + 1).trim();

    el.addEventListener(eventName, (e) => {
      const handler = window[handlerName];
      if (typeof handler === 'function') {
        handler(e, el);
      } else {
        console.warn(
          `[ndesign] Handler "${handlerName}" not found on window`
        );
      }
    });
  }
}
