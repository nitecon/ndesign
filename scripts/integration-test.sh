#!/usr/bin/env bash
# ndesign browser integration tests
# Uses agent-browser to smoke-test all demo pages.

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_PORT=28080
SERVER_URL="http://localhost:${SERVER_PORT}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

pass() { echo -e "${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
info() { echo -e "${BLUE}→${NC} $1"; }

# Kill any existing server on the port
info "Cleaning up any existing server on :${SERVER_PORT}"
lsof -ti:${SERVER_PORT} | xargs -r kill -9 2>/dev/null || true
sleep 1

# Start the server
info "Starting test server..."
cd "${PROJECT_ROOT}/testserver"
go build -o /tmp/ndesign-testserver . || { echo "Server build failed"; exit 1; }
cd "${PROJECT_ROOT}"
/tmp/ndesign-testserver > /tmp/ndesign-testserver.log 2>&1 &
SERVER_PID=$!

# Wait for server
sleep 2
curl -sf "${SERVER_URL}/api/stats" > /dev/null || { fail "Server did not start"; cat /tmp/ndesign-testserver.log; kill $SERVER_PID 2>/dev/null; exit 1; }
pass "Server is running"

cleanup() {
  info "Cleaning up..."
  kill $SERVER_PID 2>/dev/null || true
  agent-browser close 2>/dev/null || true
}
trap cleanup EXIT

# ===== Test 1: index.html loads =====
info "Test: index.html loads"
agent-browser open "${SERVER_URL}/index.html" > /dev/null
sleep 1
TITLE=$(agent-browser get title 2>/dev/null || echo "")
if [[ "$TITLE" == *"ndesign"* ]]; then
  pass "index.html: title contains 'ndesign'"
else
  fail "index.html: expected title with 'ndesign', got '$TITLE'"
fi

# ===== Test 2: bindings.html loads and binds data =====
info "Test: bindings.html REST binding"
agent-browser open "${SERVER_URL}/bindings.html" > /dev/null
sleep 3  # wait for fetch + render
# Use eval to check if user table has rows
ROW_COUNT=$(agent-browser eval 'document.querySelectorAll("#user-table tr").length' 2>/dev/null || echo "0")
if [[ "$ROW_COUNT" -ge 3 ]]; then
  pass "bindings.html: user table has $ROW_COUNT rows (>= 3)"
else
  fail "bindings.html: expected >= 3 rows in user table, got $ROW_COUNT"
fi

# ===== Test 3: Live stats are updating =====
info "Test: Live polling updates"
CPU1=$(agent-browser eval 'document.querySelector("[data-nd-refresh=\"2000\"]").textContent' 2>/dev/null || echo "")
sleep 3
CPU2=$(agent-browser eval 'document.querySelector("[data-nd-refresh=\"2000\"]").textContent' 2>/dev/null || echo "")
if [[ "$CPU1" != "$CPU2" ]]; then
  pass "Live stats are updating ($CPU1 → $CPU2)"
else
  fail "Live stats not updating (both reads: $CPU1)"
fi

# ===== Test 4: Theme toggle =====
info "Test: Theme toggle"
agent-browser open "${SERVER_URL}/index.html" > /dev/null
sleep 1
THEME1=$(agent-browser eval 'document.querySelector("link.theme").getAttribute("data-theme")' 2>/dev/null)
agent-browser eval 'NDesign.toggleTheme()' > /dev/null
sleep 1
THEME2=$(agent-browser eval 'document.querySelector("link.theme").getAttribute("data-theme")' 2>/dev/null)
if [[ "$THEME1" != "$THEME2" ]]; then
  pass "Theme toggled ($THEME1 → $THEME2)"
else
  fail "Theme did not change"
fi

# ===== Test 5: Form validation =====
info "Test: Form validation"
agent-browser open "${SERVER_URL}/bindings.html" > /dev/null
sleep 2
# Clear the form to avoid browser required validation, fill invalid data
agent-browser eval '
  const form = document.querySelector("form[data-nd-action=\"POST /api/users\"]");
  form.querySelector("[name=name]").value = "a";
  form.querySelector("[name=email]").value = "bad";
  form.dispatchEvent(new Event("submit", {cancelable: true, bubbles: true}));
' > /dev/null
sleep 2
ERROR_TEXT=$(agent-browser eval 'document.querySelector(".nd-form-error").textContent' 2>/dev/null || echo "")
if [[ -n "$ERROR_TEXT" ]]; then
  pass "Form validation: error text appeared ('$ERROR_TEXT')"
else
  fail "Form validation: no error text shown"
fi

# ===== Test 6: control-panel.html loads =====
info "Test: control-panel.html loads"
agent-browser open "${SERVER_URL}/control-panel.html" > /dev/null
sleep 1
SIDEBAR=$(agent-browser eval 'document.querySelector("nav.sidebar") !== null' 2>/dev/null || echo "false")
if [[ "$SIDEBAR" == "true" ]]; then
  pass "control-panel.html: sidebar nav exists"
else
  fail "control-panel.html: sidebar nav missing"
fi

# ===== Test 7: No console errors =====
info "Test: No console errors across demo pages"
# (agent-browser may not support console reading across navigations)
# Skip or use eval to check

# ===== Summary =====
echo ""
echo "========================================"
echo -e "Tests: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "========================================"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
