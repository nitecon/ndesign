// Package main — test coverage for the ndesign test server.
//
// These tests exercise every REST endpoint, the SSE stream, the WebSocket
// feed, and the validateUser helper.  They use only the standard library
// (net/http/httptest) and the already-required gorilla/websocket module.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// resetUsers restores the in-memory user store to a known state so individual
// tests do not leak mutations into one another.
func resetUsers() {
	usersMu.Lock()
	defer usersMu.Unlock()
	usersData = []User{
		{ID: 1, Name: "Will Hattingh", Email: "will@example.com", Role: "admin", Active: true},
		{ID: 2, Name: "Sarah Kim", Email: "sarah@example.com", Role: "editor", Active: true},
		{ID: 3, Name: "James Miller", Email: "james@example.com", Role: "viewer", Active: false},
	}
	nextUserID = 4
}

// doJSON performs an in-process request against a handler and returns the
// recorder plus the decoded JSON body (as a generic map).
func doJSON(t *testing.T, handler http.HandlerFunc, method, target string, body interface{}) (*httptest.ResponseRecorder, map[string]interface{}) {
	t.Helper()
	var reqBody *bytes.Buffer
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
		reqBody = bytes.NewBuffer(b)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}
	req := httptest.NewRequest(method, target, reqBody)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler(w, req)

	out := map[string]interface{}{}
	if w.Body.Len() > 0 {
		// The response might be an array — try object first, then ignore on failure.
		_ = json.Unmarshal(w.Body.Bytes(), &out)
	}
	return w, out
}

// ---------------------------------------------------------------------------
// validateUser — unit tests
// ---------------------------------------------------------------------------

func TestValidateUser(t *testing.T) {
	tests := []struct {
		name       string
		inName     string
		inEmail    string
		inRole     string
		wantNil    bool
		wantFields []string // fields that must appear in the errors map
	}{
		{"empty name", "", "a@b.co", "admin", false, []string{"name"}},
		{"short name", "a", "a@b.co", "admin", false, []string{"name"}},
		{"missing email", "Alice", "", "admin", false, []string{"email"}},
		{"bad email @", "Alice", "@", "admin", false, []string{"email"}},
		{"bad email foo@", "Alice", "foo@", "admin", false, []string{"email"}},
		{"valid email", "Alice", "test@example.com", "admin", true, nil},
		{"bad role", "Alice", "test@example.com", "king", false, []string{"role"}},
		{"valid role admin", "Alice", "test@example.com", "admin", true, nil},
		{"valid role editor", "Alice", "test@example.com", "editor", true, nil},
		{"valid role viewer", "Alice", "test@example.com", "viewer", true, nil},
		{"all invalid", "", "nope", "nope", false, []string{"name", "email", "role"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := validateUser(tc.inName, tc.inEmail, tc.inRole)
			if tc.wantNil {
				if got != nil {
					t.Fatalf("expected nil ValidationErrors, got %+v", got.Errors)
				}
				return
			}
			if got == nil {
				t.Fatalf("expected ValidationErrors, got nil")
			}
			for _, f := range tc.wantFields {
				if _, ok := got.Errors[f]; !ok {
					t.Errorf("expected field %q in errors map, got %+v", f, got.Errors)
				}
			}
		})
	}

	// Spot-check specific messages.
	if ve := validateUser("", "x@y.co", "admin"); ve == nil || ve.Errors["name"] != "Name must be at least 2 characters" {
		t.Errorf("empty name: unexpected message: %+v", ve)
	}
	if ve := validateUser("Alice", "bad", "admin"); ve == nil || ve.Errors["email"] != "Invalid email address" {
		t.Errorf("bad email: unexpected message: %+v", ve)
	}
}

// ---------------------------------------------------------------------------
// GET /api/users
// ---------------------------------------------------------------------------

func TestListUsers(t *testing.T) {
	resetUsers()
	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	w := httptest.NewRecorder()
	handleUsers(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var arr []map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &arr); err != nil {
		t.Fatalf("unmarshal array: %v", err)
	}
	if len(arr) != 3 {
		t.Fatalf("len = %d, want 3", len(arr))
	}
	required := []string{"id", "name", "email", "role", "active"}
	for i, u := range arr {
		for _, f := range required {
			if _, ok := u[f]; !ok {
				t.Errorf("user[%d] missing field %q", i, f)
			}
		}
	}
}

// ---------------------------------------------------------------------------
// GET /api/users/:id
// ---------------------------------------------------------------------------

func TestGetUserByID_OK(t *testing.T) {
	resetUsers()
	req := httptest.NewRequest(http.MethodGet, "/api/users/1", nil)
	w := httptest.NewRecorder()
	handleUserByID(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var u User
	if err := json.Unmarshal(w.Body.Bytes(), &u); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if u.ID != 1 {
		t.Errorf("id = %d, want 1", u.ID)
	}
}

func TestGetUserByID_NotFound(t *testing.T) {
	resetUsers()
	req := httptest.NewRequest(http.MethodGet, "/api/users/999", nil)
	w := httptest.NewRecorder()
	handleUserByID(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}
	var ve ValidationErrors
	if err := json.Unmarshal(w.Body.Bytes(), &ve); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if ve.Errors["_form"] != "User not found" {
		t.Errorf("errors._form = %q, want %q", ve.Errors["_form"], "User not found")
	}
}

func TestGetUserByID_BadFormat(t *testing.T) {
	resetUsers()
	req := httptest.NewRequest(http.MethodGet, "/api/users/notanumber", nil)
	w := httptest.NewRecorder()
	handleUserByID(w, req)

	if w.Code != http.StatusBadRequest && w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 400 or 404", w.Code)
	}
}

// ---------------------------------------------------------------------------
// POST /api/users
// ---------------------------------------------------------------------------

func TestCreateUser_EmptyBody(t *testing.T) {
	resetUsers()
	w, _ := doJSON(t, handleUsers, http.MethodPost, "/api/users", map[string]string{})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	var ve ValidationErrors
	if err := json.Unmarshal(w.Body.Bytes(), &ve); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for _, f := range []string{"name", "email", "role"} {
		if _, ok := ve.Errors[f]; !ok {
			t.Errorf("missing field error %q, got %+v", f, ve.Errors)
		}
	}
}

func TestCreateUser_InvalidEmail(t *testing.T) {
	resetUsers()
	body := map[string]string{"name": "Alice", "email": "not-an-email", "role": "admin"}
	w, _ := doJSON(t, handleUsers, http.MethodPost, "/api/users", body)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	var ve ValidationErrors
	_ = json.Unmarshal(w.Body.Bytes(), &ve)
	if _, ok := ve.Errors["email"]; !ok {
		t.Errorf("expected email error, got %+v", ve.Errors)
	}
}

func TestCreateUser_InvalidRole(t *testing.T) {
	resetUsers()
	body := map[string]string{"name": "Alice", "email": "a@b.co", "role": "king"}
	w, _ := doJSON(t, handleUsers, http.MethodPost, "/api/users", body)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	var ve ValidationErrors
	_ = json.Unmarshal(w.Body.Bytes(), &ve)
	if _, ok := ve.Errors["role"]; !ok {
		t.Errorf("expected role error, got %+v", ve.Errors)
	}
}

func TestCreateUser_Valid(t *testing.T) {
	resetUsers()
	body := map[string]string{"name": "Alice", "email": "alice@example.com", "role": "editor"}
	w, out := doJSON(t, handleUsers, http.MethodPost, "/api/users", body)
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201", w.Code)
	}
	if out["message"] == nil {
		t.Errorf("expected message field")
	}
	user, ok := out["user"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected user object, got %T", out["user"])
	}
	if id, _ := user["id"].(float64); int(id) != 4 {
		t.Errorf("new user id = %v, want 4", user["id"])
	}
	if user["name"] != "Alice" {
		t.Errorf("name = %v, want Alice", user["name"])
	}
}

// ---------------------------------------------------------------------------
// PUT /api/users/:id
// ---------------------------------------------------------------------------

func TestUpdateUser(t *testing.T) {
	resetUsers()
	body := map[string]string{"name": "Willy H", "email": "will@example.com", "role": "admin"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPut, "/api/users/1", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleUserByID(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var out map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	user, ok := out["user"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected user object, got %T", out["user"])
	}
	if user["name"] != "Willy H" {
		t.Errorf("name = %v, want Willy H", user["name"])
	}
}

// ---------------------------------------------------------------------------
// DELETE /api/users/:id
// ---------------------------------------------------------------------------

func TestDeleteUser(t *testing.T) {
	resetUsers()
	req := httptest.NewRequest(http.MethodDelete, "/api/users/2", nil)
	w := httptest.NewRecorder()
	handleUserByID(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var out map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out["message"] == "" {
		t.Errorf("expected message field")
	}

	// Confirm the user is actually gone.
	usersMu.Lock()
	for _, u := range usersData {
		if u.ID == 2 {
			t.Errorf("user 2 still present after delete")
		}
	}
	usersMu.Unlock()
}

// ---------------------------------------------------------------------------
// GET /api/stats and /api/stats/live
// ---------------------------------------------------------------------------

func TestStats(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	w := httptest.NewRecorder()
	handleStats(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var s Stats
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if s.TotalUsers == 0 || s.Version == "" || s.Uptime == "" || s.MemoryTotal == 0 {
		t.Errorf("missing expected field in %+v", s)
	}
}

func TestStatsLive(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/stats/live", nil)
	w := httptest.NewRecorder()
	handleStatsLive(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	// Decode as raw map to inspect the exact numeric strings.
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// cpu_usage and memory_used should be rounded to 2 decimal places,
	// meaning their string representation should not contain more than
	// 2 fractional digits.
	for _, field := range []string{"cpu_usage", "memory_used"} {
		s := string(raw[field])
		if idx := strings.Index(s, "."); idx >= 0 {
			frac := s[idx+1:]
			if len(frac) > 2 {
				t.Errorf("%s has more than 2 decimals: %s", field, s)
			}
		}
	}
}

// ---------------------------------------------------------------------------
// POST /api/login
// ---------------------------------------------------------------------------

func TestLogin_Wrong(t *testing.T) {
	body := map[string]string{"username": "nobody", "password": "nope"}
	w, _ := doJSON(t, handleLogin, http.MethodPost, "/api/login", body)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
	var ve ValidationErrors
	if err := json.Unmarshal(w.Body.Bytes(), &ve); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if ve.Errors["_form"] == "" {
		t.Errorf("expected _form error, got %+v", ve.Errors)
	}
}

func TestLogin_Correct(t *testing.T) {
	body := map[string]string{"username": "admin", "password": "password"}
	w, out := doJSON(t, handleLogin, http.MethodPost, "/api/login", body)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if out["message"] == nil || out["token"] == nil {
		t.Errorf("expected message and token, got %+v", out)
	}
}

// ---------------------------------------------------------------------------
// POST /api/push
// ---------------------------------------------------------------------------

func TestPush(t *testing.T) {
	body := PushMessage{Channel: "test", Data: map[string]string{"hello": "world"}}
	w, out := doJSON(t, handlePush, http.MethodPost, "/api/push", body)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if out["message"] == nil {
		t.Errorf("expected message field, got %+v", out)
	}
}

// ---------------------------------------------------------------------------
// SSE — GET /events/stream
// ---------------------------------------------------------------------------

// sseRecorder is a ResponseRecorder that implements http.Flusher, which the
// SSE handler requires via a type assertion.
type sseRecorder struct {
	*httptest.ResponseRecorder
}

func (sseRecorder) Flush() {}

func TestSSEStream(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req := httptest.NewRequest(http.MethodGet, "/events/stream", nil).WithContext(ctx)
	rec := sseRecorder{httptest.NewRecorder()}

	done := make(chan struct{})
	go func() {
		handleSSEStream(rec, req)
		close(done)
	}()

	// The SSE stream emits every 3 seconds; wait ~4s for at least one event.
	select {
	case <-time.After(4 * time.Second):
	case <-done:
	}
	cancel()
	<-done

	if ct := rec.Header().Get("Content-Type"); ct != "text/event-stream" {
		t.Errorf("Content-Type = %q, want text/event-stream", ct)
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Errorf("Cache-Control = %q, want no-cache", cc)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "event:") {
		t.Errorf("body missing 'event:' line:\n%s", body)
	}
	if !strings.Contains(body, "data:") {
		t.Errorf("body missing 'data:' line:\n%s", body)
	}
}

// ---------------------------------------------------------------------------
// WebSocket — /ws/feed
// ---------------------------------------------------------------------------

func TestWSFeed(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(handleWSFeed))
	defer srv.Close()

	u, err := url.Parse(srv.URL)
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	u.Scheme = "ws"
	u.Path = "/ws/feed"

	dialer := websocket.DefaultDialer
	c, _, err := dialer.Dial(u.String(), nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.Close()

	// The feed ticks every 2 seconds; give it 4 seconds to produce a message.
	if err := c.SetReadDeadline(time.Now().Add(4 * time.Second)); err != nil {
		t.Fatalf("set deadline: %v", err)
	}
	_, data, err := c.ReadMessage()
	if err != nil {
		t.Fatalf("read message: %v", err)
	}
	var msg map[string]interface{}
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("unmarshal message: %v", err)
	}
	if _, ok := msg["type"]; !ok {
		t.Errorf("message missing 'type' field: %s", string(data))
	}
}
