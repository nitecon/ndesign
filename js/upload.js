/**
 * ndesign — File upload handler with progress.
 * Intercepts forms with data-nd-upload, submits via XHR (fetch does not
 * expose upload progress events), and updates a <progress> element
 * inside the form as bytes are transmitted.
 * @module upload
 */

import { handleSuccess, clearFormErrors, displayErrors } from './action.js';

/** @type {Map<HTMLFormElement, (e: SubmitEvent) => void>} submit handlers by form */
const uploadHandlers = new Map();

/**
 * Parse a data-nd-upload attribute value into method and URL.
 * Format: "METHOD /path" (e.g. "POST /api/upload"). Defaults to POST.
 * @param {string} uploadStr — the attribute value
 * @returns {{ method: string, url: string }} parsed upload target
 */
function parseUpload(uploadStr) {
  const spaceIdx = uploadStr.indexOf(' ');
  if (spaceIdx === -1) {
    return { method: 'POST', url: uploadStr };
  }
  return {
    method: uploadStr.substring(0, spaceIdx).toUpperCase(),
    url: uploadStr.substring(spaceIdx + 1).trim(),
  };
}

/**
 * Show a feedback message in the configured feedback element.
 * @param {string|null} feedbackId — ID of the feedback element
 * @param {string} message         — message text
 * @param {string} type            — 'success' or 'error'
 */
function showFeedback(feedbackId, message, type) {
  if (!feedbackId) return;
  const el = document.getElementById(feedbackId);
  if (!el) return;
  el.textContent = message;
  el.className = `nd-alert nd-alert-${type}`;
  el.style.display = '';
}

/**
 * Submit a form upload via XHR with progress reporting.
 * @param {HTMLFormElement} form — the form element
 */
function submitUpload(form) {
  const uploadStr = form.getAttribute('data-nd-upload');
  if (!uploadStr) return;

  const { method, url } = parseUpload(uploadStr);
  const feedbackId = form.getAttribute('data-nd-feedback') || null;

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
      feedbackEl.className = '';
    }
  }

  // Build FormData from the form (native API handles file inputs)
  const formData = new FormData(form);

  // Progress bar element (optional but expected)
  const progressEl = form.querySelector('progress.nd-upload-progress');
  if (progressEl) {
    progressEl.value = 0;
    progressEl.removeAttribute('hidden');
  }

  // Submit button — disable while uploading
  const submitBtn = form.querySelector('[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('nd-loading');
  }

  const xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  xhr.setRequestHeader('X-Requested-With', 'NDesign');

  // Upload progress
  xhr.upload.addEventListener('progress', (e) => {
    if (!progressEl) return;
    if (e.lengthComputable) {
      const percent = (e.loaded / e.total) * 100;
      progressEl.value = percent;
      progressEl.max = 100;
    }
  });

  const cleanup = () => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('nd-loading');
    }
    if (progressEl) {
      setTimeout(() => {
        progressEl.setAttribute('hidden', '');
        progressEl.value = 0;
      }, 1000);
    }
  };

  xhr.addEventListener('load', () => {
    let responseData = null;
    const contentType = xhr.getResponseHeader('Content-Type') || '';
    if (contentType.includes('application/json')) {
      try {
        responseData = JSON.parse(xhr.responseText);
      } catch (_) {
        responseData = null;
      }
    }

    if (xhr.status >= 200 && xhr.status < 300) {
      showFeedback(
        feedbackId,
        (responseData && responseData.message) || 'Upload complete',
        'success'
      );
      handleSuccess(form, responseData);
    } else {
      if (responseData && responseData.errors) {
        displayErrors(form, responseData.errors, feedbackId);
      } else {
        showFeedback(
          feedbackId,
          (responseData && responseData.message) ||
            `Error: ${xhr.statusText || 'Upload failed'}`,
          'error'
        );
      }
    }
    cleanup();
  });

  xhr.addEventListener('error', () => {
    console.error(`[ndesign] Upload error for ${url}`);
    showFeedback(feedbackId, 'Network error. Please try again.', 'error');
    cleanup();
  });

  xhr.addEventListener('abort', () => {
    showFeedback(feedbackId, 'Upload cancelled.', 'error');
    cleanup();
  });

  xhr.send(formData);
}

/**
 * Initialize all data-nd-upload forms in the document.
 * Intercepts submit events and routes them through XHR upload.
 */
export function initUploads() {
  const forms = document.querySelectorAll('form[data-nd-upload]');
  for (const form of forms) {
    // Skip if already wired
    if (uploadHandlers.has(form)) continue;

    const handler = (e) => {
      e.preventDefault();
      submitUpload(form);
    };
    form.addEventListener('submit', handler);
    uploadHandlers.set(form, handler);
  }
}

/**
 * Tear down all upload form handlers. Called on cleanup/re-init.
 */
export function destroyUploads() {
  for (const [form, handler] of uploadHandlers) {
    form.removeEventListener('submit', handler);
  }
  uploadHandlers.clear();
}
