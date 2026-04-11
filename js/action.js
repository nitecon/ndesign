/**
 * ndesign — Form and button action handler.
 * Intercepts forms with data-nd-action, serializes to JSON, submits via
 * fetch, and handles server responses (success and error mapping).
 *
 * data-nd-body (buttons only): a JSON template string that, after ${var}
 * interpolation, is JSON-parsed and used as the request body instead of an
 * empty body. Invalid JSON after interpolation routes through the unified
 * error envelope path.
 *
 * data-nd-set on action elements: called on success with the response data,
 * enabling chained store writes (explicit or response forms).
 *
 * @module action
 */

import { setByPath, buildHeaders, fetchWithTimeout } from './utils.js';
import { resolveVars, applySetDirective } from './store.js';
import { confirmDialog } from './modal.js';

// Monotonic UID for auto-generated feedback element IDs
let _uidCounter = 0;
function _uid() { return ++_uidCounter; }

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

// ---------------------------------------------------------------------------
// Feedback element helpers (auto-slot for forms/buttons without data-nd-feedback)
// ---------------------------------------------------------------------------

/**
 * Resolve the feedback element for a form or button.
 *
 * For forms: if `data-nd-feedback` is declared, return that element; otherwise
 * auto-create a slot placed immediately before the submit button (or its
 * nearest ancestor that is a direct child of the form). Reuses any existing
 * auto-element stored on `form._ndAutoFeedbackEl`.
 *
 * For buttons: auto-create a slot inserted as the next sibling after the
 * button. Reuses `btn._ndAutoFeedbackEl`.
 *
 * @param {HTMLElement} el — form or button element
 * @returns {HTMLElement|null}
 */
function _ensureFeedbackEl(el) {
  if (el.tagName === 'FORM') {
    const declaredId = el.getAttribute('data-nd-feedback');
    if (declaredId) {
      return document.getElementById(declaredId);
    }
    if (el._ndAutoFeedbackEl && el._ndAutoFeedbackEl.isConnected) {
      return el._ndAutoFeedbackEl;
    }
    const autoEl = document.createElement('div');
    autoEl.id = `nd-auto-feedback-${_uid()}`;
    autoEl.className = 'nd-alert nd-form-feedback-auto';
    autoEl.style.display = 'none';
    autoEl.setAttribute('aria-live', 'assertive');
    autoEl.setAttribute('aria-atomic', 'true');

    // Place immediately before the submit button (or nearest ancestor
    // that is a direct child of the form).
    const submitBtn = el.querySelector('[type="submit"]');
    let insertBefore = submitBtn;
    if (submitBtn) {
      let cursor = submitBtn.parentElement;
      while (cursor && cursor !== el) {
        if (cursor.parentElement === el) {
          insertBefore = cursor;
          break;
        }
        cursor = cursor.parentElement;
      }
    }
    if (insertBefore && insertBefore.parentElement) {
      insertBefore.parentElement.insertBefore(autoEl, insertBefore);
    } else {
      el.appendChild(autoEl);
    }
    el._ndAutoFeedbackEl = autoEl;
    return autoEl;
  } else {
    if (el._ndAutoFeedbackEl && el._ndAutoFeedbackEl.isConnected) {
      return el._ndAutoFeedbackEl;
    }
    const autoEl = document.createElement('div');
    autoEl.id = `nd-auto-feedback-${_uid()}`;
    autoEl.className = 'nd-alert nd-form-feedback-auto';
    autoEl.style.display = 'none';
    autoEl.setAttribute('aria-live', 'assertive');
    autoEl.setAttribute('aria-atomic', 'true');
    if (el.parentElement) {
      el.parentElement.insertBefore(autoEl, el.nextSibling);
    }
    el._ndAutoFeedbackEl = autoEl;
    return autoEl;
  }
}

/**
 * Write a message to a feedback element with the appropriate severity class.
 * @param {HTMLElement|null} feedbackEl
 * @param {string} message
 * @param {'error'|'success'|'warning'|'info'} type
 */
function _showFeedbackEl(feedbackEl, message, type) {
  if (!feedbackEl) return;
  feedbackEl.textContent = message;
  const isAuto = feedbackEl.classList.contains('nd-form-feedback-auto');
  feedbackEl.className = `nd-alert nd-alert-${type}${isAuto ? ' nd-form-feedback-auto' : ''}`;
  feedbackEl.style.display = '';
}

/**
 * Clear and hide a feedback element (auto or declared).
 * @param {HTMLElement|null} feedbackEl
 */
function _hideFeedbackEl(feedbackEl) {
  if (!feedbackEl) return;
  feedbackEl.textContent = '';
  feedbackEl.style.display = 'none';
}

/**
 * Synthesize a global error message from a field-errors map.
 *
 * Priority:
 *   1. errors.error (canonical) or errors._form (legacy alias) — verbatim.
 *   2. 1 field error → "Please correct the highlighted field: <label|name>"
 *   3. N field errors → "Please correct the N highlighted fields below."
 *   4. Fallback → "Submit failed. Please try again."
 *
 * @param {HTMLElement|null} form — form element (used to look up labels)
 * @param {Object} errors
 * @returns {string}
 */
function _synthesizeGlobalMessage(form, errors) {
  if (!errors) return 'Submit failed. Please try again.';
  const globalMsg = errors.error || errors._form;
  if (globalMsg) return globalMsg;
  const fieldKeys = Object.keys(errors).filter(k => k !== 'error' && k !== '_form');
  if (fieldKeys.length === 0) return 'Submit failed. Please try again.';
  if (fieldKeys.length === 1) {
    const name = fieldKeys[0];
    let label = name;
    if (form) {
      const input = form.querySelector(`[name="${name}"]`);
      if (input && input.id) {
        const labelEl = form.querySelector(`label[for="${input.id}"]`);
        if (labelEl) label = labelEl.textContent.trim();
      }
    }
    return `Please correct the highlighted field: ${label}`;
  }
  return `Please correct the ${fieldKeys.length} highlighted fields below.`;
}

/**
 * Synthesize a unified error envelope from a thrown error.
 *   AbortError           → "Request timed out"
 *   TypeError (network)  → "Couldn't reach server"
 *   other                → err.message
 * @param {Error} err
 * @returns {{errors: Object}}
 */
function synthesizeEnvelope(err) {
  if (err.name === 'AbortError') {
    return { errors: { error: 'Request timed out' } };
  }
  if (err instanceof TypeError) {
    return { errors: { error: "Couldn't reach server" } };
  }
  return { errors: { error: err.message || 'Unexpected error' } };
}

/**
 * Uniform error handler for both form and button actions.
 *
 * Guarantees a visible global error message adjacent to the triggering
 * element. For forms: field-level errors are also highlighted inline.
 * Toast (via config.onError) fires IN ADDITION as belt-and-suspenders.
 *
 * @param {HTMLElement} el                — form or button
 * @param {{errors: Object}} envelope
 * @param {Object} config                 — NDesign config
 * @param {string|null} feedbackId        — declared feedback id (forms only)
 * @param {string} url
 * @param {Error|null} [err=null]
 */
function handleActionError(el, envelope, config, feedbackId, url, err = null) {
  el.classList.add('nd-error');
  if (el.tagName === 'FORM') {
    if (envelope.errors) {
      displayErrors(el, envelope.errors, feedbackId);
    }
    const feedbackEl = _ensureFeedbackEl(el);
    const globalMsg = _synthesizeGlobalMessage(el, envelope.errors);
    _showFeedbackEl(feedbackEl, globalMsg, 'error');
    // If declared feedback exists and displayErrors didn't populate it
    // (no error/_form key), write the synthesized message there too.
    if (feedbackId && !el._ndAutoFeedbackEl) {
      const declaredEl = document.getElementById(feedbackId);
      if (declaredEl && !declaredEl.textContent) {
        _showFeedbackEl(declaredEl, globalMsg, 'error');
      }
    }
  } else {
    const feedbackEl = _ensureFeedbackEl(el);
    const globalMsg = _synthesizeGlobalMessage(null, envelope.errors);
    _showFeedbackEl(feedbackEl, globalMsg, 'error');
  }
  // Reinforce via toast (secondary signal). Takes the NEW 3-arg signature.
  if (typeof config.onError === 'function') {
    config.onError(url, envelope, err);
  }
}

/**
 * Show success feedback near the triggering element. Uses the declared
 * feedback element if present; otherwise writes to the auto-slot if one
 * already exists (auto-hides after 3 s). Does NOT auto-create a slot
 * just to show success — success is lower urgency than error.
 * @param {HTMLElement} el
 * @param {string|null} feedbackId
 * @param {string} message
 */
function _showSuccessFeedback(el, feedbackId, message) {
  if (feedbackId) {
    const declaredEl = document.getElementById(feedbackId);
    if (declaredEl) {
      _showFeedbackEl(declaredEl, message, 'success');
      return;
    }
  }
  const autoEl = el._ndAutoFeedbackEl;
  if (autoEl && autoEl.isConnected) {
    _showFeedbackEl(autoEl, message, 'success');
    setTimeout(() => _hideFeedbackEl(autoEl), 3000);
  }
}

/**
 * Resolve a confirm prompt for an element.
 * If the attribute starts with '#', opens the referenced <dialog> via
 * confirmDialog(). Otherwise falls back to native window.confirm().
 * @param {HTMLElement} el
 * @returns {Promise<boolean>}
 */
export async function resolveConfirm(el) {
  const confirmAttr = el.getAttribute('data-nd-confirm');
  if (!confirmAttr) return true;
  if (confirmAttr.startsWith('#')) {
    return confirmDialog(confirmAttr);
  }
  return window.confirm(confirmAttr);
}

/**
 * Clear all form error messages (elements with class .nd-form-error)
 * within a form. Also clears and hides the auto-feedback element if present.
 * @param {HTMLFormElement} form — the form element
 */
export function clearFormErrors(form) {
  const errorEls = form.querySelectorAll('.nd-form-error');
  for (const el of errorEls) {
    el.textContent = '';
    el.style.display = 'none';
  }
  const inputs = form.querySelectorAll('.nd-error');
  for (const el of inputs) {
    el.classList.remove('nd-error');
  }
  if (form._ndAutoFeedbackEl) {
    _hideFeedbackEl(form._ndAutoFeedbackEl);
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
export function displayErrors(form, errors, feedbackId) {
  for (const [field, message] of Object.entries(errors)) {
    if (field === '_form' || field === 'error') {
      // Global form error goes to the feedback element.
      // Both `error` (canonical) and `_form` (legacy alias) route here.
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
 * Supports comma-separated chained actions (e.g. "refresh:#table,reset").
 * Actions that navigate away (redirect, reload) stop the chain.
 * @param {HTMLFormElement|HTMLElement} el — the element with data-nd-success
 * @param {Object} responseData           — parsed JSON response from server
 */
export function handleSuccess(el, responseData) {
  const successAttr = el.getAttribute('data-nd-success');
  if (!successAttr) return;

  // Support comma-separated chained actions
  const actions = successAttr.split(',').map(a => a.trim());

  for (const action of actions) {
    if (action.startsWith('redirect:')) {
      window.location.href = action.substring('redirect:'.length);
      return; // redirect stops the chain
    }

    if (action === 'reset' && el.tagName === 'FORM') {
      el.reset();
      continue;
    }

    if (action === 'reload') {
      window.location.reload();
      return; // reload stops the chain
    }

    if (action.startsWith('refresh:')) {
      const selector = action.substring('refresh:'.length);
      document.querySelectorAll(selector).forEach(target => {
        target.dispatchEvent(new CustomEvent('nd:refresh'));
      });
      continue;
    }

    if (action.startsWith('emit:')) {
      const eventName = action.substring('emit:'.length);
      el.dispatchEvent(
        new CustomEvent(eventName, { detail: responseData, bubbles: true })
      );
      continue;
    }

    if (action === 'close-modal') {
      _autoCloseDialog(el);
      continue;
    }
  }
}

/**
 * Close the nearest ancestor <dialog> of el, if any.
 * @param {HTMLElement} el
 */
function _autoCloseDialog(el) {
  const dialog = el.closest && el.closest('dialog');
  if (dialog && typeof dialog.close === 'function') {
    dialog.close();
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

  const parsed = parseAction(actionStr);
  const method = parsed.method;
  const url = resolveVars(parsed.url);
  const feedbackId = form.getAttribute('data-nd-feedback') || null;

  // Confirmation prompt — supports both native string and #dialog selector
  if (!(await resolveConfirm(form))) return;

  clearFormErrors(form);
  form.classList.remove('nd-error');

  // Clear declared feedback area
  if (feedbackId) {
    const feedbackEl = document.getElementById(feedbackId);
    if (feedbackEl) {
      feedbackEl.textContent = '';
      feedbackEl.style.display = 'none';
    }
  }

  const data = serializeForm(form);
  const headers = buildHeaders(config.headers);
  const options = { method, headers, body: JSON.stringify(data) };

  if (typeof config.onRequest === 'function') {
    config.onRequest(url, options);
  }

  // Disable submit button during request
  const submitBtn = form.querySelector('[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('nd-loading');
  }

  // Resolve timeout: data-nd-timeout overrides config.timeout (default 15s)
  const timeoutMs =
    parseInt(form.getAttribute('data-nd-timeout'), 10) || config.timeout || 15000;

  try {
    const response = await fetchWithTimeout(url, options, timeoutMs);

    if (typeof config.onResponse === 'function') {
      config.onResponse(url, response);
    }

    let responseData = null;
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    }

    if (!response.ok) {
      // Server-returned error envelope
      if (responseData && responseData.errors) {
        handleActionError(form, responseData, config, feedbackId, url, null);
      } else {
        // Generic error — synthesize envelope from statusText/message
        const envelope = {
          errors: {
            error: (responseData && responseData.message) || `Error: ${response.statusText}`,
          },
        };
        handleActionError(form, envelope, config, feedbackId, url, null);
      }
      return;
    }

    // Success
    _showSuccessFeedback(form, feedbackId, (responseData && responseData.message) || 'Success');

    handleSuccess(form, responseData);

    // data-nd-set on form: write response to store after success
    if (form.hasAttribute('data-nd-set')) {
      applySetDirective(form, responseData);
    }
  } catch (err) {
    console.error(`[ndesign] Action error for ${url}:`, err);
    // Synthesize a unified envelope from the thrown error and route it
    // through the same handler as server-returned errors.
    const envelope = synthesizeEnvelope(err);
    handleActionError(form, envelope, config, feedbackId, url, err);
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

  const parsed = parseAction(actionStr);
  const method = parsed.method;
  const url = resolveVars(parsed.url);
  const feedbackId = el.getAttribute('data-nd-feedback') || null;

  if (!(await resolveConfirm(el))) return;

  el.disabled = true;
  el.classList.add('nd-loading');
  el.classList.remove('nd-error');

  // Clear any previous auto-feedback on the button
  if (el._ndAutoFeedbackEl) {
    _hideFeedbackEl(el._ndAutoFeedbackEl);
  }

  const headers = buildHeaders(config.headers);
  const options = { method, headers };

  // data-nd-body: JSON template for button actions. Interpolate ${vars},
  // then JSON.parse. Invalid JSON surfaces as a unified error envelope
  // via handleActionError.
  const bodyTemplate = el.getAttribute('data-nd-body');
  if (bodyTemplate) {
    const interpolated = resolveVars(bodyTemplate);
    try {
      const bodyObj = JSON.parse(interpolated);
      options.body = JSON.stringify(bodyObj);
      options.headers['Content-Type'] = 'application/json';
    } catch (_) {
      const errMsg = 'data-nd-body: invalid JSON after interpolation';
      console.error(`[ndesign] ${errMsg}:`, interpolated);
      handleActionError(el, { errors: { error: errMsg } }, config, feedbackId, url, null);
      el.disabled = false;
      el.classList.remove('nd-loading');
      return;
    }
  }

  if (typeof config.onRequest === 'function') {
    config.onRequest(url, options);
  }

  // Resolve timeout: data-nd-timeout overrides config.timeout (default 15s)
  const timeoutMs =
    parseInt(el.getAttribute('data-nd-timeout'), 10) || config.timeout || 15000;

  try {
    const response = await fetchWithTimeout(url, options, timeoutMs);

    if (typeof config.onResponse === 'function') {
      config.onResponse(url, response);
    }

    let responseData = null;
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    }

    if (!response.ok) {
      console.error(`[ndesign] Action error: ${response.status} ${response.statusText}`);
      const envelope = (responseData && responseData.errors)
        ? responseData
        : { errors: { error: (responseData && responseData.message) || `Error: ${response.statusText}` } };
      handleActionError(el, envelope, config, feedbackId, url, null);
      return;
    }

    el.classList.remove('nd-error');
    _showSuccessFeedback(el, feedbackId, (responseData && responseData.message) || 'Done');

    handleSuccess(el, responseData);

    // data-nd-set on button: write response to store after success
    if (el.hasAttribute('data-nd-set')) {
      applySetDirective(el, responseData);
    }
  } catch (err) {
    console.error(`[ndesign] Action error for ${url}:`, err);
    const envelope = synthesizeEnvelope(err);
    handleActionError(el, envelope, config, feedbackId, url, err);
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
