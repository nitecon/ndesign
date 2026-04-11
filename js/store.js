/**
 * ndesign — Tiny client-side store backed by <meta> tags.
 *
 * Philosophy: the server renders the page, including <meta> tags that declare
 * URL bases (endpoint:*) and initial values (var:*). This module reads those
 * at init time, exposes a minimal get/set surface, and provides ${var}
 * interpolation for data-nd-* URL attributes. No reactivity — reads are lazy,
 * resolved at the moment of fetch/submit.
 *
 * @module store
 */

import { getByPath, setByPath } from './utils.js';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** @type {Map<string,string>} URL base fragments keyed by name */
export const endpoints = new Map();

/** @type {Map<string,any>} Arbitrary vars keyed by top-level name */
export const vars = new Map();

/**
 * WeakMap tracking event listeners per element so destroyStore() can
 * remove them cleanly without leaking references.
 * @type {WeakMap<Element, Array<{type:string, handler:Function}>>}
 */
const elementListeners = new WeakMap();

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Scan <meta> tags and populate endpoints and vars.
 *
 * Recognises two name prefixes:
 *   <meta name="endpoint:NAME" content="https://api.example.com">
 *   <meta name="var:NAME"      content="42">
 *
 * All values are stored as strings; numeric coercion happens at consumption
 * time (e.g. inside arithmetic eval, or when writing to a type="number" input).
 *
 * @returns {void}
 */
export function initStoreFromMeta() {
  const metas = document.querySelectorAll('meta[name]');
  for (const meta of metas) {
    const name = meta.getAttribute('name') || '';
    const content = meta.getAttribute('content') || '';

    if (name.startsWith('endpoint:')) {
      const key = name.slice('endpoint:'.length);
      if (key) endpoints.set(key, content);
    } else if (name.startsWith('var:')) {
      const key = name.slice('var:'.length);
      if (key) vars.set(key, content);
    }
  }
}

// ---------------------------------------------------------------------------
// Var accessors
// ---------------------------------------------------------------------------

/**
 * Read a var using dot-notation path.
 * 'user.first_name' → vars.get('user')?.first_name (via getByPath).
 *
 * @param {string} path — dot-delimited path; first segment is the Map key
 * @returns {*} the resolved value, or undefined if any segment is missing
 */
export function getVar(path) {
  if (!path) return undefined;
  const dot = path.indexOf('.');
  const topKey = dot === -1 ? path : path.slice(0, dot);
  const rest = dot === -1 ? '' : path.slice(dot + 1);
  const top = vars.get(topKey);
  if (top === undefined) return undefined;
  if (!rest) return top;
  // Nested path — only valid if top is an object
  return getByPath(top, rest);
}

/**
 * Write a value using dot-notation path.
 * Top-level key maps directly to the Map; nested writes are performed via
 * setByPath on the stored object.
 *
 * Emits an `nd:var-change` CustomEvent on `document` after writing so that
 * `data-nd-model` inputs bound to the same top-level key can re-sync. This
 * is the ONLY place ndesign implements reactive behaviour — other directives
 * (bind, action, sse, ws) remain explicitly non-reactive by design.
 *
 * @param {string} path  — dot-delimited path
 * @param {*}      value — value to store
 * @returns {void}
 */
export function setVar(path, value) {
  if (!path) return;
  const dot = path.indexOf('.');
  const topKey = dot === -1 ? path : path.slice(0, dot);
  if (dot === -1) {
    vars.set(path, value);
  } else {
    const rest = path.slice(dot + 1);
    let top = vars.get(topKey);
    if (top == null || typeof top !== 'object') {
      top = {};
      vars.set(topKey, top);
    }
    setByPath(top, rest, value);
  }
  // Notify model listeners (scoped reactivity for form inputs only).
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('nd:var-change', {
      detail: { path, topKey, value: vars.get(topKey) },
    }));
  }
}

/**
 * Return the URL base for a named endpoint, or '' if not registered.
 * @param {string} name — endpoint name (without "endpoint:" prefix)
 * @returns {string}
 */
export function getEndpoint(name) {
  return endpoints.get(name) ?? '';
}

// ---------------------------------------------------------------------------
// ${var} interpolation
// ---------------------------------------------------------------------------

/** Regex that matches ${identifier.with.dots.and-dashes} */
const TOKEN_RE = /\$\{([a-zA-Z_][\w.\-]*)\}/g;

/**
 * Resolve ${...} tokens in a template string.
 * Lookup order: vars (via getVar) first, then endpoints (via getEndpoint).
 * Unknown tokens produce an empty string and a console.warn (once per token).
 *
 * @param {string} template — string potentially containing ${name} tokens
 * @returns {string} the string with all known tokens substituted
 */
export function resolveVars(template) {
  if (typeof template !== 'string' || !template.includes('${')) return template;

  const warned = new Set();

  return template.replace(TOKEN_RE, (_match, name) => {
    // Vars take precedence over endpoints
    const v = getVar(name);
    if (v !== undefined) {
      return v === null ? '' : String(v);
    }
    // Check endpoints (top-level name only, no dot allowed in endpoint names)
    const ep = endpoints.get(name);
    if (ep !== undefined) {
      return ep;
    }
    // Unknown — warn once per token name
    if (!warned.has(name)) {
      warned.add(name);
      console.warn(`[ndesign] unresolved var: \${${name}}`);
    }
    return '';
  });
}

// ---------------------------------------------------------------------------
// data-nd-set RHS parser
// ---------------------------------------------------------------------------

/**
 * @typedef {{ type: 'literal', value: any }} LiteralNode
 * @typedef {{ type: 'ref', path: string }} RefNode
 * @typedef {{ type: 'arith', refPath: string, op: string, operand: number }} ArithNode
 * @typedef {{ type: 'response' }} ResponseNode
 * @typedef {LiteralNode|RefNode|ArithNode|ResponseNode} SetRHSNode
 */

/**
 * Parse the right-hand side of a data-nd-set expression.
 *
 * Grammar:
 *   rhs      := literal | ref | ref op literal | $response
 *   literal  := null | true | false | NUMBER | 'STRING'
 *   ref      := ${name} or ${name.dot.path}
 *   op       := + | - | * | /
 *   NUMBER   := optional leading minus, int or float
 *   STRING   := single-quoted, supports \' and \\ escapes
 *   $response := the sentinel token $response
 *
 * @param {string} rhs — the raw right-hand side string (trimmed)
 * @returns {SetRHSNode} parsed AST node
 * @throws {Error} on unrecognised input
 */
export function parseSetRHS(rhs) {
  const s = rhs.trim();
  if (!s) throw new Error('[ndesign] data-nd-set: empty RHS');

  // $response sentinel
  if (s === '$response') {
    return { type: 'response' };
  }

  // null / true / false literals
  if (s === 'null') return { type: 'literal', value: null };
  if (s === 'true') return { type: 'literal', value: true };
  if (s === 'false') return { type: 'literal', value: false };

  // Single-quoted string literal: 'STRING' (possibly with \' and \\ escapes)
  if (s.startsWith("'")) {
    // Find the closing unescaped quote
    let i = 1;
    let str = '';
    while (i < s.length) {
      const ch = s[i];
      if (ch === '\\' && i + 1 < s.length) {
        const next = s[i + 1];
        if (next === "'") { str += "'"; i += 2; }
        else if (next === '\\') { str += '\\'; i += 2; }
        else { str += ch; i++; }
      } else if (ch === "'") {
        i++;
        break;
      } else {
        str += ch;
        i++;
      }
    }
    const remainder = s.slice(i).trim();
    if (remainder.length > 0) {
      throw new Error(`[ndesign] data-nd-set: unexpected tokens after string literal: ${remainder}`);
    }
    return { type: 'literal', value: str };
  }

  // NUMBER literal (optional leading -, int or float)
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    return { type: 'literal', value: Number(s) };
  }

  // ${ref} — optionally followed by op number
  if (s.startsWith('${')) {
    const closeIdx = s.indexOf('}');
    if (closeIdx === -1) {
      throw new Error(`[ndesign] data-nd-set: unclosed \${...} in RHS: ${s}`);
    }
    const refPath = s.slice(2, closeIdx);
    if (!refPath || !/^[a-zA-Z_][\w.\-]*$/.test(refPath)) {
      throw new Error(`[ndesign] data-nd-set: invalid var name in \${...}: ${refPath}`);
    }
    const after = s.slice(closeIdx + 1).trim();
    if (!after) {
      return { type: 'ref', path: refPath };
    }
    // arithmetic: op NUMBER
    const arithMatch = after.match(/^([+\-*/])\s*(-?\d+(\.\d+)?)$/);
    if (!arithMatch) {
      throw new Error(`[ndesign] data-nd-set: expected arithmetic operator and number after \${${refPath}}, got: ${after}`);
    }
    return {
      type: 'arith',
      refPath,
      op: arithMatch[1],
      operand: Number(arithMatch[2]),
    };
  }

  throw new Error(`[ndesign] data-nd-set: unrecognised RHS: ${s}`);
}

/**
 * Evaluate a parsed set-RHS AST node.
 *
 * @param {SetRHSNode}  node         — result of parseSetRHS()
 * @param {*}           responseData — the response value for 'response' nodes
 * @returns {*} the evaluated value
 * @throws {Error} on NaN in arithmetic
 */
export function evalSetRHS(node, responseData) {
  switch (node.type) {
    case 'literal':
      return node.value;

    case 'ref':
      return getVar(node.path);

    case 'arith': {
      const refRaw = getVar(node.refPath);
      const left = Number(refRaw);
      const right = node.operand;
      if (isNaN(left)) {
        throw new Error(`[ndesign] data-nd-set: arithmetic on non-numeric var "${node.refPath}" (value: ${refRaw})`);
      }
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/':
          if (right === 0) throw new Error('[ndesign] data-nd-set: division by zero');
          return left / right;
        default:
          throw new Error(`[ndesign] data-nd-set: unknown operator: ${node.op}`);
      }
    }

    case 'response':
      return responseData;

    default:
      throw new Error(`[ndesign] data-nd-set: unknown node type: ${node.type}`);
  }
}

// ---------------------------------------------------------------------------
// Comma splitting (quote-aware)
// ---------------------------------------------------------------------------

/**
 * Split a data-nd-set value on commas, respecting single-quoted strings
 * (commas inside quotes are not split points).
 *
 * @param {string} str — raw attribute value
 * @returns {string[]} array of trimmed op strings
 */
function splitSetOps(str) {
  const ops = [];
  let current = '';
  let inSingleQuote = false;
  let i = 0;

  while (i < str.length) {
    const ch = str[i];
    if (ch === '\\' && inSingleQuote && i + 1 < str.length) {
      // Escaped char inside quote — include both
      current += ch + str[i + 1];
      i += 2;
      continue;
    }
    if (ch === "'" && !inSingleQuote) {
      inSingleQuote = true;
      current += ch;
      i++;
      continue;
    }
    if (ch === "'" && inSingleQuote) {
      inSingleQuote = false;
      current += ch;
      i++;
      continue;
    }
    if (ch === ',' && !inSingleQuote) {
      ops.push(current.trim());
      current = '';
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  if (current.trim()) ops.push(current.trim());
  return ops.filter(Boolean);
}

// ---------------------------------------------------------------------------
// applySetDirective
// ---------------------------------------------------------------------------

/**
 * Process a data-nd-set attribute on an element, writing to the store.
 *
 * Two forms per op:
 *   - "name"        — response form: writes responseData into vars under name
 *   - "name=<rhs>" — explicit form: parses and evaluates RHS, writes result
 *
 * The LHS supports dot-notation (e.g. "user.display_name='Will'").
 *
 * @param {HTMLElement} el           — element bearing data-nd-set
 * @param {*}           responseData — server response (may be undefined for standalone set)
 * @returns {void}
 */
export function applySetDirective(el, responseData) {
  const raw = el.getAttribute('data-nd-set');
  if (!raw) return;

  const ops = splitSetOps(raw);

  for (const op of ops) {
    const eqIdx = op.indexOf('=');
    if (eqIdx === -1) {
      // Response form: "name" — requires responseData
      if (responseData === undefined) {
        console.warn(`[ndesign] data-nd-set: response form "${op}" used but no response data available`);
        continue;
      }
      setVar(op, responseData);
    } else {
      // Explicit form: "name=rhs"
      const lhs = op.slice(0, eqIdx).trim();
      const rhs = op.slice(eqIdx + 1);
      try {
        const ast = parseSetRHS(rhs);
        const value = evalSetRHS(ast, responseData);
        setVar(lhs, value);
      } catch (err) {
        console.error(`[ndesign] data-nd-set error in op "${op}":`, err.message);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// initSetTriggers
// ---------------------------------------------------------------------------

/**
 * Find standalone data-nd-set elements (not combined with action, bind,
 * upload, or sortable) and wire click listeners that execute the set
 * directive and dispatch an nd:set event.
 *
 * @param {Object} _config — NDesign config (reserved for future use)
 * @returns {void}
 */
export function initSetTriggers(_config) {
  const selector =
    '[data-nd-set]:not([data-nd-action]):not([data-nd-bind]):not([data-nd-upload]):not([data-nd-sortable])';
  const elements = document.querySelectorAll(selector);

  for (const el of elements) {
    const handler = (e) => {
      // Prevent <button type="submit"> or <a href="..."> default behaviour
      if (typeof e.preventDefault === 'function') e.preventDefault();
      applySetDirective(el, undefined);
      el.dispatchEvent(new CustomEvent('nd:set', { bubbles: true, detail: { el } }));
      // Chain data-nd-success actions (refresh:#selector, emit:eventName).
      // A deliberate subset of what action.js handleSuccess supports —
      // only the actions that make sense without a server response.
      _runSetSuccessActions(el);
    };
    el.addEventListener('click', handler);
    _trackListener(el, 'click', handler);
  }
}

/**
 * Minimal subset of action.js handleSuccess for set-trigger elements.
 * Supports `refresh:#selector` (dispatches nd:refresh on matching elements)
 * and `emit:eventName` (dispatches a bubbling custom event on the set element).
 * Comma-separated actions are run in order.
 *
 * @param {HTMLElement} el — the element bearing data-nd-success
 */
function _runSetSuccessActions(el) {
  const attr = el.getAttribute('data-nd-success');
  if (!attr) return;
  const actions = attr.split(',').map(a => a.trim()).filter(Boolean);
  for (const action of actions) {
    if (action.startsWith('refresh:')) {
      const sel = action.slice('refresh:'.length);
      document.querySelectorAll(sel).forEach(target => {
        target.dispatchEvent(new CustomEvent('nd:refresh', { bubbles: true }));
      });
    } else if (action.startsWith('emit:')) {
      const eventName = action.slice('emit:'.length);
      el.dispatchEvent(new CustomEvent(eventName, { bubbles: true }));
    }
    // Other actions (reset, reload, redirect) are intentionally not supported
    // here — they belong on fetch-backed elements via action.js handleSuccess.
  }
}

// ---------------------------------------------------------------------------
// initModel
// ---------------------------------------------------------------------------

/**
 * Find data-nd-model elements, sync their value from the store on init,
 * and wire input/change listeners to write back on user interaction.
 *
 * Coercions:
 *   - type="number" or type="range" → Number
 *   - type="checkbox"               → boolean (el.checked)
 *   - multiple <select>             → Array of selected values
 *   - all others                    → string
 *
 * @param {Object} _config — NDesign config (reserved for future use)
 * @returns {void}
 */
export function initModel(_config) {
  const elements = document.querySelectorAll('[data-nd-model]');

  for (const el of elements) {
    const name = el.getAttribute('data-nd-model');
    if (!name) continue;

    // Top-level key of the model path — used to match var-change events
    const topKey = name.indexOf('.') === -1 ? name : name.slice(0, name.indexOf('.'));

    // Write the given store value into the element's UI representation.
    const syncFromStore = () => {
      const stored = getVar(name);
      _isSyncingFromStore = true;
      try {
        if (el.type === 'checkbox') {
          el.checked = Boolean(stored);
        } else if (el.tagName === 'SELECT' && el.multiple) {
          const arr = Array.isArray(stored) ? stored : (stored == null ? [] : [String(stored)]);
          for (const opt of el.options) {
            opt.selected = arr.includes(opt.value);
          }
        } else {
          el.value = stored == null ? '' : String(stored);
        }
      } finally {
        _isSyncingFromStore = false;
      }
    };

    // Sync store → element on init
    if (getVar(name) !== undefined) {
      syncFromStore();
    } else if (el.defaultValue !== undefined && el.defaultValue !== '') {
      // Pre-populate store from the element's default if no store value exists
      setVar(name, _coerceFromInput(el));
    }

    // Wire element → store (user input)
    const inputHandler = () => {
      if (_isSyncingFromStore) return;
      const value = _coerceFromInput(el);
      setVar(name, value);
      el.dispatchEvent(new CustomEvent('nd:model', { bubbles: true, detail: { name, value } }));
    };

    const eventType = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(eventType, inputHandler);
    _trackListener(el, eventType, inputHandler);

    // Wire store → element (reactive sync from nd:var-change)
    const changeHandler = (e) => {
      if (!e.detail || e.detail.topKey !== topKey) return;
      // Skip if the UI already matches — avoids re-entrant updates
      syncFromStore();
    };
    document.addEventListener('nd:var-change', changeHandler);
    _trackDocumentListener('nd:var-change', changeHandler);
  }
}

/**
 * Flag set while initModel's syncFromStore() is writing into an element,
 * preventing the element's own input/change handler from bouncing back into
 * setVar and creating a notification loop.
 */
let _isSyncingFromStore = false;

/**
 * Read and coerce a form element's current value for storage.
 * @param {HTMLElement} el
 * @returns {*}
 */
function _coerceFromInput(el) {
  if (el.type === 'checkbox') {
    return el.checked;
  }
  if (el.tagName === 'SELECT' && el.multiple) {
    return Array.from(el.options)
      .filter(o => o.selected)
      .map(o => o.value);
  }
  if (el.type === 'number' || el.type === 'range') {
    return el.value === '' ? null : Number(el.value);
  }
  return el.value;
}

// ---------------------------------------------------------------------------
// destroyStore
// ---------------------------------------------------------------------------

/**
 * Track a listener on an element so destroyStore() can clean it up.
 * @param {HTMLElement} el
 * @param {string} type
 * @param {Function} handler
 */
function _trackListener(el, type, handler) {
  if (!elementListeners.has(el)) {
    elementListeners.set(el, []);
  }
  elementListeners.get(el).push({ type, handler });
}

/** @type {Array<{type: string, handler: Function}>} */
const documentListeners = [];

/**
 * Track a listener added to `document` so destroyStore() can clean it up.
 * @param {string} type
 * @param {Function} handler
 */
function _trackDocumentListener(type, handler) {
  documentListeners.push({ type, handler });
}

/**
 * Remove all listeners added by initModel / initSetTriggers and clear
 * the endpoints and vars maps.
 * @returns {void}
 */
export function destroyStore() {
  // elementListeners is a WeakMap so we can only clean up elements we still
  // hold a reference to. We use the querySelectorAll output as our reference.
  const allTracked = document.querySelectorAll('[data-nd-model], [data-nd-set]');
  for (const el of allTracked) {
    const listeners = elementListeners.get(el);
    if (!listeners) continue;
    for (const { type, handler } of listeners) {
      el.removeEventListener(type, handler);
    }
  }
  // Remove document-level nd:var-change listeners
  for (const { type, handler } of documentListeners) {
    document.removeEventListener(type, handler);
  }
  documentListeners.length = 0;
  endpoints.clear();
  vars.clear();
}
