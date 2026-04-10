// Package main implements a development test server for the ndesign frontend
// framework. It exposes REST, WebSocket, and SSE endpoints that validate the
// framework's data binding system (data-nd-bind, data-nd-ws, data-nd-sse,
// data-nd-action, data-nd-refresh).
//
// Usage:
//
//	go run main.go
//	# => ndesign test server running on http://localhost:28080
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"net/mail"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

// User represents a user resource returned by the REST API.
type User struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Active bool   `json:"active"`
}

// Stats represents dashboard statistics returned by GET /api/stats.
type Stats struct {
	TotalUsers     int     `json:"total_users"`
	ActiveSessions int     `json:"active_sessions"`
	CPUUsage       float64 `json:"cpu_usage"`
	MemoryUsed     float64 `json:"memory_used"`
	MemoryTotal    float64 `json:"memory_total"`
	Uptime         string  `json:"uptime"`
	Version        string  `json:"version"`
}

// ValidationErrors is the standard server-side error response format defined
// in Architecture.md section 4.4.  Keys map to input name attributes; the
// special key "_form" targets the data-nd-feedback element.
type ValidationErrors struct {
	Errors map[string]string `json:"errors"`
}

// PushMessage is the payload accepted by POST /api/push. The server broadcasts
// the Data field to every connected WebSocket client.
type PushMessage struct {
	Channel string      `json:"channel"`
	Data    interface{} `json:"data"`
}

// PaginationMeta describes a pagination envelope returned by paginated list
// endpoints.  Frontend clients use these fields to render page controls.
type PaginationMeta struct {
	Page       int  `json:"page"`
	PerPage    int  `json:"per_page"`
	Total      int  `json:"total"`
	TotalPages int  `json:"total_pages"`
	HasNext    bool `json:"has_next"`
	HasPrev    bool `json:"has_prev"`
}

// PaginatedResponse is the standard envelope for paginated list endpoints.
type PaginatedResponse struct {
	Data interface{}    `json:"data"`
	Meta PaginationMeta `json:"meta"`
}

// FeedItem represents a single entry in the /api/feed infinite-scroll stream.
// The schema is union-style: optional fields are populated based on Type.
type FeedItem struct {
	ID          int     `json:"id"`
	Type        string  `json:"type"`
	Time        string  `json:"time"`
	Symbol      string  `json:"symbol,omitempty"`
	Price       float64 `json:"price,omitempty"`
	Version     string  `json:"version,omitempty"`
	Environment string  `json:"environment,omitempty"`
	Level       string  `json:"level,omitempty"`
	Message     string  `json:"message,omitempty"`
}

// maxRequestBodyBytes is the maximum accepted size for POST/PUT request bodies.
// Requests larger than this are rejected by http.MaxBytesReader before the
// JSON decoder runs.
const maxRequestBodyBytes = 1 << 20 // 1 MB

// ---------------------------------------------------------------------------
// In-memory store (mutex-protected)
// ---------------------------------------------------------------------------

var (
	usersMu   sync.Mutex
	usersData = []User{
		{ID: 1, Name: "Will Hattingh", Email: "will@example.com", Role: "admin", Active: true},
		{ID: 2, Name: "Sarah Kim", Email: "sarah@example.com", Role: "editor", Active: true},
		{ID: 3, Name: "James Miller", Email: "james@example.com", Role: "viewer", Active: false},
	}
	nextUserID = 4
)

// validRoles defines the allowable role values for user creation and updates.
var validRoles = map[string]bool{
	"admin":  true,
	"editor": true,
	"viewer": true,
}

// paginatedUsers is a fixed 42-element dataset used exclusively by
// GET /api/users/paginated.  Unlike usersData, this slice is never mutated
// — it exists so frontend pagination tests have a stable, deterministic
// source of truth across cultures/roles/active-states.
var paginatedUsers = []User{
	{1, "Will Hattingh", "will@example.com", "admin", true},
	{2, "Sarah Kim", "sarah@example.com", "editor", true},
	{3, "James Miller", "james@example.com", "viewer", false},
	{4, "Alice Johnson", "alice@example.com", "admin", true},
	{5, "Kenji Tanaka", "kenji@example.com", "editor", true},
	{6, "Priya Patel", "priya@example.com", "viewer", true},
	{7, "Diego Ramirez", "diego@example.com", "editor", false},
	{8, "Fatima Al-Sayed", "fatima@example.com", "admin", true},
	{9, "Oluwaseun Adeyemi", "seun@example.com", "viewer", true},
	{10, "Emma Thompson", "emma@example.com", "editor", true},
	{11, "Liam O'Brien", "liam@example.com", "viewer", false},
	{12, "Mei Chen", "mei@example.com", "admin", true},
	{13, "Noah Weber", "noah@example.com", "editor", true},
	{14, "Ana Silva", "ana@example.com", "viewer", true},
	{15, "Raj Gupta", "raj@example.com", "editor", false},
	{16, "Yuki Nakamura", "yuki@example.com", "admin", true},
	{17, "Hana Park", "hana@example.com", "viewer", true},
	{18, "Mateus Oliveira", "mateus@example.com", "editor", true},
	{19, "Ingrid Larsson", "ingrid@example.com", "viewer", true},
	{20, "Carlos Mendoza", "carlos@example.com", "admin", false},
	{21, "Sofia Rossi", "sofia@example.com", "editor", true},
	{22, "Amara Okafor", "amara@example.com", "viewer", true},
	{23, "Dmitri Volkov", "dmitri@example.com", "admin", true},
	{24, "Leila Hosseini", "leila@example.com", "editor", true},
	{25, "Hiroshi Sato", "hiroshi@example.com", "viewer", false},
	{26, "Isabelle Dubois", "isabelle@example.com", "admin", true},
	{27, "Tomasz Kowalski", "tomasz@example.com", "editor", true},
	{28, "Chloe Wilson", "chloe@example.com", "viewer", true},
	{29, "Andres Vega", "andres@example.com", "editor", false},
	{30, "Nia Williams", "nia@example.com", "admin", true},
	{31, "Ravi Krishnan", "ravi@example.com", "viewer", true},
	{32, "Elena Petrova", "elena@example.com", "editor", true},
	{33, "Seok-jin Lee", "seokjin@example.com", "admin", true},
	{34, "Zara Ahmed", "zara@example.com", "viewer", true},
	{35, "Gabriel Costa", "gabriel@example.com", "editor", false},
	{36, "Aisha Khan", "aisha@example.com", "admin", true},
	{37, "Lukas Müller", "lukas@example.com", "viewer", true},
	{38, "Nadia Ivanova", "nadia@example.com", "editor", true},
	{39, "Kwame Boateng", "kwame@example.com", "viewer", true},
	{40, "Yasmin Haddad", "yasmin@example.com", "admin", false},
	{41, "Finn O'Sullivan", "finn@example.com", "editor", true},
	{42, "Lin Wei", "linwei@example.com", "viewer", true},
}

// feedItems is a fixed 200-element dataset used by GET /api/feed.  It's
// generated once at package init and never mutated.  The mix of trade /
// deploy / alert types exercises the frontend's union-type rendering path.
var feedItems = buildFeedItems()

// buildFeedItems generates 200 deterministic-ish feed items cycling through
// trade, deploy, and alert types.  Values are chosen to look realistic but
// are not cryptographically random — this is a test server.
func buildFeedItems() []FeedItem {
	symbols := []string{"BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD", "ADA/USD"}
	basePrices := map[string]float64{
		"BTC/USD":  67234.50,
		"ETH/USD":  3456.78,
		"SOL/USD":  178.42,
		"DOGE/USD": 0.1523,
		"ADA/USD":  0.4521,
	}
	versions := []string{"2.4.1", "2.4.2", "2.4.3", "2.5.0-rc1", "2.5.0"}
	envs := []string{"staging", "production", "canary"}
	levels := []string{"info", "warning", "error"}
	alertMsgs := []string{
		"API latency >200ms",
		"Memory usage above 80%",
		"New deployment detected",
		"Certificate expiring in 7 days",
		"Database connection pool saturated",
	}

	// Seed a local RNG so repeated builds produce the same sequence — this
	// makes frontend tests reproducible.
	r := rand.New(rand.NewSource(1))
	out := make([]FeedItem, 200)
	base := time.Date(2026, 4, 10, 14, 0, 0, 0, time.UTC)
	for i := 0; i < 200; i++ {
		ts := base.Add(time.Duration(i*7) * time.Second).Format("15:04:05")
		item := FeedItem{ID: i + 1, Time: ts}
		switch i % 3 {
		case 0:
			sym := symbols[r.Intn(len(symbols))]
			bp := basePrices[sym]
			item.Type = "trade"
			item.Symbol = sym
			item.Price = math.Round((bp+(r.Float64()-0.5)*bp*0.02)*100) / 100
		case 1:
			item.Type = "deploy"
			item.Version = versions[r.Intn(len(versions))]
			item.Environment = envs[r.Intn(len(envs))]
		case 2:
			item.Type = "alert"
			item.Level = levels[r.Intn(len(levels))]
			item.Message = alertMsgs[r.Intn(len(alertMsgs))]
		}
		out[i] = item
	}
	return out
}

// ---------------------------------------------------------------------------
// WebSocket hub (mutex-protected)
// ---------------------------------------------------------------------------

var (
	wsMu    sync.Mutex
	wsConns = make(map[*websocket.Conn]struct{})
)

var upgrader = websocket.Upgrader{
	// Allow all origins for development CORS.
	CheckOrigin: func(r *http.Request) bool { return true },
}

// registerWSConn adds a WebSocket connection to the broadcast set.
func registerWSConn(c *websocket.Conn) {
	wsMu.Lock()
	wsConns[c] = struct{}{}
	wsMu.Unlock()
}

// unregisterWSConn removes a WebSocket connection from the broadcast set.
func unregisterWSConn(c *websocket.Conn) {
	wsMu.Lock()
	delete(wsConns, c)
	wsMu.Unlock()
}

// broadcastJSON sends a JSON payload to every connected WebSocket client.
// Connections that fail to write are silently removed.
func broadcastJSON(v interface{}) {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("[ws] broadcast marshal error: %v", err)
		return
	}
	wsMu.Lock()
	defer wsMu.Unlock()
	for c := range wsConns {
		if err := c.WriteMessage(websocket.TextMessage, data); err != nil {
			log.Printf("[ws] write error, removing client: %v", err)
			c.Close()
			delete(wsConns, c)
		}
	}
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// withCORS wraps a handler with permissive CORS headers for development use.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// withLogging logs every request to stdout with a timestamp.
func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s (%s)", r.Method, r.URL.Path, r.RemoteAddr, time.Since(start).Round(time.Microsecond))
	})
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

// writeJSON serialises v as JSON and writes it to the response with the given
// HTTP status code.  Content-Type is always application/json.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("[json] encode error: %v", err)
	}
}

// decodeJSON reads a JSON body into dst.  Returns false and writes a 400
// response if the body is malformed.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		writeJSON(w, http.StatusBadRequest, ValidationErrors{
			Errors: map[string]string{"_form": "Invalid JSON body"},
		})
		return false
	}
	return true
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// validateUser checks name, email, and role fields.  Returns a non-nil
// ValidationErrors if any rule is violated.
func validateUser(name, email, role string) *ValidationErrors {
	errs := make(map[string]string)
	if len(strings.TrimSpace(name)) < 2 {
		errs["name"] = "Name must be at least 2 characters"
	}
	if _, err := mail.ParseAddress(email); err != nil {
		errs["email"] = "Invalid email address"
	}
	if !validRoles[role] {
		errs["role"] = "Role must be one of: admin, editor, viewer"
	}
	if len(errs) > 0 {
		return &ValidationErrors{Errors: errs}
	}
	return nil
}

// ---------------------------------------------------------------------------
// REST handlers — Users
// ---------------------------------------------------------------------------

// handleUsers dispatches GET and POST on /api/users.
func handleUsers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		handleListUsers(w, r)
	case http.MethodPost:
		handleCreateUser(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleListUsers returns the full user list. GET /api/users
func handleListUsers(w http.ResponseWriter, _ *http.Request) {
	usersMu.Lock()
	data := make([]User, len(usersData))
	copy(data, usersData)
	usersMu.Unlock()
	writeJSON(w, http.StatusOK, data)
}

// handleCreateUser validates and appends a new user. POST /api/users
func handleCreateUser(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	var body struct {
		Name  string `json:"name"`
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if ve := validateUser(body.Name, body.Email, body.Role); ve != nil {
		writeJSON(w, http.StatusBadRequest, ve)
		return
	}
	usersMu.Lock()
	u := User{
		ID:     nextUserID,
		Name:   strings.TrimSpace(body.Name),
		Email:  strings.TrimSpace(body.Email),
		Role:   body.Role,
		Active: true,
	}
	nextUserID++
	usersData = append(usersData, u)
	usersMu.Unlock()

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "User created successfully",
		"user":    u,
	})
}

// handleUserByID dispatches GET, PUT, DELETE on /api/users/:id.
func handleUserByID(w http.ResponseWriter, r *http.Request) {
	// Parse the trailing ID segment from the URL path.
	idStr := strings.TrimPrefix(r.URL.Path, "/api/users/")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		writeJSON(w, http.StatusBadRequest, ValidationErrors{
			Errors: map[string]string{"_form": "Invalid user ID"},
		})
		return
	}
	switch r.Method {
	case http.MethodGet:
		handleGetUser(w, id)
	case http.MethodPut:
		handleUpdateUser(w, r, id)
	case http.MethodDelete:
		handleDeleteUser(w, id)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleGetUser returns a single user by ID. GET /api/users/:id
func handleGetUser(w http.ResponseWriter, id int) {
	usersMu.Lock()
	defer usersMu.Unlock()
	for _, u := range usersData {
		if u.ID == id {
			writeJSON(w, http.StatusOK, u)
			return
		}
	}
	writeJSON(w, http.StatusNotFound, ValidationErrors{
		Errors: map[string]string{"_form": "User not found"},
	})
}

// handleUpdateUser validates and updates an existing user. PUT /api/users/:id
func handleUpdateUser(w http.ResponseWriter, r *http.Request, id int) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	var body struct {
		Name  string `json:"name"`
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if ve := validateUser(body.Name, body.Email, body.Role); ve != nil {
		writeJSON(w, http.StatusBadRequest, ve)
		return
	}
	usersMu.Lock()
	defer usersMu.Unlock()
	for i, u := range usersData {
		if u.ID == id {
			usersData[i].Name = strings.TrimSpace(body.Name)
			usersData[i].Email = strings.TrimSpace(body.Email)
			usersData[i].Role = body.Role
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"message": "User updated successfully",
				"user":    usersData[i],
			})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, ValidationErrors{
		Errors: map[string]string{"_form": "User not found"},
	})
}

// handleDeleteUser removes a user by ID. DELETE /api/users/:id
func handleDeleteUser(w http.ResponseWriter, id int) {
	usersMu.Lock()
	defer usersMu.Unlock()
	for i, u := range usersData {
		if u.ID == id {
			usersData = append(usersData[:i], usersData[i+1:]...)
			writeJSON(w, http.StatusOK, map[string]string{
				"message": "User deleted",
			})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, ValidationErrors{
		Errors: map[string]string{"_form": "User not found"},
	})
}

// ---------------------------------------------------------------------------
// REST handlers — Paginated users
// ---------------------------------------------------------------------------

// handlePaginatedUsers returns a page of the fixed paginatedUsers dataset.
// GET /api/users/paginated?page=N&per_page=M
//
// Query params:
//   - page      (int, default 1, min 1)
//   - per_page  (int, default 5, max 50)
//
// Response is the standard {"data": [...], "meta": {...}} envelope.  If the
// requested page is past the end, an empty data slice is returned with
// accurate meta fields.
func handlePaginatedUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	page := parseIntQuery(r, "page", 1)
	if page < 1 {
		page = 1
	}
	perPage := parseIntQuery(r, "per_page", 5)
	if perPage < 1 {
		perPage = 5
	}
	if perPage > 50 {
		perPage = 50
	}

	total := len(paginatedUsers)
	totalPages := (total + perPage - 1) / perPage
	if totalPages == 0 {
		totalPages = 1
	}

	offset := (page - 1) * perPage
	end := offset + perPage
	var slice []User
	switch {
	case offset >= total:
		slice = []User{}
	case end > total:
		slice = paginatedUsers[offset:total]
	default:
		slice = paginatedUsers[offset:end]
	}

	writeJSON(w, http.StatusOK, PaginatedResponse{
		Data: slice,
		Meta: PaginationMeta{
			Page:       page,
			PerPage:    perPage,
			Total:      total,
			TotalPages: totalPages,
			HasNext:    page < totalPages,
			HasPrev:    page > 1,
		},
	})
}

// ---------------------------------------------------------------------------
// REST handlers — Feed (infinite scroll)
// ---------------------------------------------------------------------------

// handleFeed returns a slice of feedItems for infinite-scroll / load-more UI.
// GET /api/feed?offset=N&limit=M
//
// Query params:
//   - offset  (int, default 0, min 0)
//   - limit   (int, default 20, max 100)
//
// Response is a bare JSON array (no envelope), matching typical infinite-
// scroll patterns.  If offset is past the end, an empty array is returned.
func handleFeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	offset := parseIntQuery(r, "offset", 0)
	if offset < 0 {
		offset = 0
	}
	limit := parseIntQuery(r, "limit", 20)
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	total := len(feedItems)
	if offset >= total {
		writeJSON(w, http.StatusOK, []FeedItem{})
		return
	}
	end := offset + limit
	if end > total {
		end = total
	}
	writeJSON(w, http.StatusOK, feedItems[offset:end])
}

// parseIntQuery extracts a named query parameter as an int.  Returns def when
// the parameter is missing or not a valid integer.
func parseIntQuery(r *http.Request, key string, def int) int {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	return v
}

// ---------------------------------------------------------------------------
// REST handlers — Stats
// ---------------------------------------------------------------------------

// handleStats returns fixed dashboard statistics. GET /api/stats
func handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, Stats{
		TotalUsers:     12847,
		ActiveSessions: 567,
		CPUUsage:       42.3,
		MemoryUsed:     6.2,
		MemoryTotal:    16.0,
		Uptime:         "14d 6h 23m",
		Version:        "2.4.1",
	})
}

// handleStatsLive returns stats with randomised values suitable for testing
// data-nd-refresh polling. GET /api/stats/live
func handleStatsLive(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, Stats{
		TotalUsers:     12847,
		ActiveSessions: 400 + rand.Intn(401),             // 400-800
		CPUUsage:       math.Round((30.0+rand.Float64()*50.0)*100) / 100,  // 30-80
		MemoryUsed:     math.Round((4.0+rand.Float64()*8.0)*100) / 100,    // 4.0-12.0
		MemoryTotal:    16.0,
		Uptime:         "14d 6h 23m",
		Version:        "2.4.1",
	})
}

// ---------------------------------------------------------------------------
// REST handlers — Login
// ---------------------------------------------------------------------------

// handleLogin validates credentials. POST /api/login
//
// Accepts {"username": "...", "password": "..."}.  Returns a token on success
// or a _form-level error on failure, matching the Architecture.md section 4.4
// error response contract.
func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.Username == "admin" && body.Password == "password" {
		writeJSON(w, http.StatusOK, map[string]string{
			"message": "Login successful",
			"token":   "abc123",
		})
		return
	}
	writeJSON(w, http.StatusUnauthorized, ValidationErrors{
		Errors: map[string]string{"_form": "Invalid username or password"},
	})
}

// ---------------------------------------------------------------------------
// REST handlers — Push (broadcast to WS clients)
// ---------------------------------------------------------------------------

// handlePush accepts a JSON body and broadcasts it to all connected WebSocket
// clients. POST /api/push
func handlePush(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	var msg PushMessage
	if !decodeJSON(w, r, &msg) {
		return
	}
	broadcastJSON(msg.Data)
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Broadcast sent",
	})
}

// ---------------------------------------------------------------------------
// WebSocket handler — /ws/feed
// ---------------------------------------------------------------------------

// handleWSFeed upgrades to a WebSocket connection and sends randomised trade,
// alert, and metric events every 2 seconds until the client disconnects.
//
// Authentication is optional on this test server but two methods are
// recognised so frontend auth flows can be exercised end-to-end:
//
//  1. Sub-protocol header: Sec-WebSocket-Protocol: jwt.<token>
//  2. Query parameter:     /ws/feed?token=<token>
//
// Sub-protocol tokens take precedence.  When a token is supplied it is logged
// (truncated) — no cryptographic validation is performed.
func handleWSFeed(w http.ResponseWriter, r *http.Request) {
	// ---- Auth extraction (non-blocking; permissive on failure) ----
	var token string
	var respHeader http.Header
	for _, p := range websocket.Subprotocols(r) {
		if strings.HasPrefix(p, "jwt.") {
			token = strings.TrimPrefix(p, "jwt.")
			// Echo the selected sub-protocol back to the client so the
			// handshake completes successfully.
			respHeader = http.Header{"Sec-WebSocket-Protocol": []string{p}}
			break
		}
	}
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token != "" {
		trunc := token
		if len(trunc) > 12 {
			trunc = trunc[:12]
		}
		log.Printf("[ws] client connected with token: %s... (%s)", trunc, r.RemoteAddr)
	} else {
		log.Printf("[ws] client connected (no auth) (%s)", r.RemoteAddr)
	}

	conn, err := upgrader.Upgrade(w, r, respHeader)
	if err != nil {
		log.Printf("[ws] upgrade error: %v", err)
		return
	}
	registerWSConn(conn)

	// Drain incoming messages so the read goroutine detects disconnects.
	go func() {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}()

	symbols := []string{"BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD"}
	tick := 0
	ticker := time.NewTicker(2 * time.Second)
	defer func() {
		ticker.Stop()
		unregisterWSConn(conn)
		conn.Close()
		log.Printf("[ws] client disconnected (%s)", conn.RemoteAddr())
	}()

	for range ticker.C {
		var msg interface{}
		switch tick % 4 {
		case 0, 1:
			// Trade event with randomised price/volume.
			sym := symbols[rand.Intn(len(symbols))]
			basePrice := map[string]float64{
				"BTC/USD":  67234.50,
				"ETH/USD":  3456.78,
				"SOL/USD":  178.42,
				"DOGE/USD": 0.1523,
			}[sym]
			msg = map[string]interface{}{
				"type":   "trade",
				"symbol": sym,
				"price":  math.Round((basePrice+(rand.Float64()-0.5)*basePrice*0.02)*100) / 100,
				"volume": math.Round((0.1+rand.Float64()*20.0)*100) / 100,
				"time":   time.Now().Format("15:04:05"),
			}
		case 2:
			// Alert event.
			levels := []string{"info", "warning", "error"}
			messages := []string{
				"API latency >200ms",
				"Memory usage above 80%",
				"New deployment detected",
				"Certificate expiring in 7 days",
			}
			services := []string{"gateway", "auth", "payments", "scheduler"}
			msg = map[string]interface{}{
				"type":    "alert",
				"level":   levels[rand.Intn(len(levels))],
				"message": messages[rand.Intn(len(messages))],
				"service": services[rand.Intn(len(services))],
			}
		case 3:
			// Metric event.
			msg = map[string]interface{}{
				"type":  "metric",
				"name":  "requests_per_sec",
				"value": 800 + rand.Intn(900),
			}
		}

		data, err := json.Marshal(msg)
		if err != nil {
			log.Printf("[ws] marshal error: %v", err)
			return
		}
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			return // Client disconnected; deferred cleanup will fire.
		}
		tick++
	}
}

// ---------------------------------------------------------------------------
// SSE handler — /events/stream
// ---------------------------------------------------------------------------

// handleSSEStream sends Server-Sent Events every 3 seconds, cycling through
// deployment, notification, and metric event types.  Closes when the client
// disconnects (detected via r.Context().Done()).
//
// Supports the EventSource auto-reconnect protocol: if the client sends a
// Last-Event-ID header, the monotonic event counter is restored to that
// value + 1 so downstream consumers can deduplicate correctly.  Every event
// is emitted with a leading `id: N` line.
func handleSSEStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	flusher.Flush()

	// Parse Last-Event-ID for reconnect resume.  EventSource sends this header
	// automatically after a dropped connection.
	lastID := 0
	if hdr := r.Header.Get("Last-Event-ID"); hdr != "" {
		if parsed, err := strconv.Atoi(hdr); err == nil && parsed >= 0 {
			lastID = parsed
			log.Printf("[sse] resume from Last-Event-ID=%d (%s)", lastID, r.RemoteAddr)
		}
	}
	nextID := lastID + 1

	log.Printf("[sse] client connected (%s)", r.RemoteAddr)
	defer log.Printf("[sse] client disconnected (%s)", r.RemoteAddr)

	ctx := r.Context()
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	tick := 0
	envs := []string{"staging", "production", "canary"}
	versions := []string{"2.4.2", "2.4.3", "2.5.0-rc1"}
	notifMsgs := []string{
		"Backup completed successfully",
		"SSL certificate renewed",
		"Database migration applied",
		"Cache purge completed",
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			var eventType string
			var data interface{}

			switch tick % 3 {
			case 0:
				// Deployment event — running.
				eventType = "deployment"
				data = map[string]interface{}{
					"version":     versions[rand.Intn(len(versions))],
					"environment": envs[rand.Intn(len(envs))],
					"status":      "running",
					"timestamp":   time.Now().UTC().Format(time.RFC3339),
				}
			case 1:
				// Deployment event — complete.
				eventType = "deployment"
				data = map[string]interface{}{
					"version":     versions[rand.Intn(len(versions))],
					"environment": envs[rand.Intn(len(envs))],
					"status":      "complete",
					"timestamp":   time.Now().UTC().Format(time.RFC3339),
				}
			case 2:
				// Alternating notification and metric events.
				if tick%2 == 0 {
					eventType = "notification"
					data = map[string]interface{}{
						"message": notifMsgs[rand.Intn(len(notifMsgs))],
						"level":   "info",
					}
				} else {
					eventType = "metric"
					data = map[string]interface{}{
						"cpu":    math.Round((30.0+rand.Float64()*50.0)*100) / 100,
						"memory": math.Round((40.0+rand.Float64()*40.0)*100) / 100,
						"disk":   math.Round((20.0+rand.Float64()*60.0)*100) / 100,
					}
				}
			}

			jsonData, err := json.Marshal(data)
			if err != nil {
				log.Printf("[sse] marshal error: %v", err)
				return
			}

			fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", nextID, eventType, jsonData)
			flusher.Flush()
			nextID++
			tick++
		}
	}
}

// ---------------------------------------------------------------------------
// Upload state
// ---------------------------------------------------------------------------

// UploadedFile records a single file that was POSTed to /api/upload.
// It's returned by GET /api/uploaded-files so the demo page can show a
// live table of uploads rendered via data-nd-bind.
type UploadedFile struct {
	ID       int    `json:"id"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
	Type     string `json:"type"`
	Uploaded string `json:"uploaded"`
}

var (
	uploadMu      sync.Mutex
	uploadedFiles = []UploadedFile{}
	nextUploadID  = 1
)

// handleUpload accepts multipart/form-data POSTs at /api/upload. Files are
// drained to count their size (simulating a real save) and then recorded
// in the in-memory uploadedFiles slice. Responds with a summary JSON
// payload listing each uploaded file's metadata.
func handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, ValidationErrors{
			Errors: map[string]string{"_form": "Method not allowed"},
		})
		return
	}

	// Cap uploads at 10 MB
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, ValidationErrors{
			Errors: map[string]string{"_form": "Upload too large or invalid: " + err.Error()},
		})
		return
	}

	files := make([]map[string]interface{}, 0)

	if r.MultipartForm != nil {
		uploadMu.Lock()
		for fieldName, headers := range r.MultipartForm.File {
			for _, hdr := range headers {
				file, err := hdr.Open()
				if err != nil {
					continue
				}
				// Read to count bytes (in real app, write to disk or S3)
				size := int64(0)
				buf := make([]byte, 32*1024)
				for {
					n, readErr := file.Read(buf)
					size += int64(n)
					if readErr != nil {
						break
					}
				}
				file.Close()

				files = append(files, map[string]interface{}{
					"field":    fieldName,
					"filename": hdr.Filename,
					"size":     size,
					"type":     hdr.Header.Get("Content-Type"),
				})

				uploadedFiles = append(uploadedFiles, UploadedFile{
					ID:       nextUploadID,
					Filename: hdr.Filename,
					Size:     size,
					Type:     hdr.Header.Get("Content-Type"),
					Uploaded: time.Now().Format("2006-01-02 15:04:05"),
				})
				nextUploadID++
			}
		}
		uploadMu.Unlock()
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"files":   files,
		"message": fmt.Sprintf("Uploaded %d file(s) successfully", len(files)),
	})
}

// handleUploadedFiles returns the list of previously uploaded files as JSON.
// Used by the demo's data-nd-bind table to show an up-to-date upload history.
func handleUploadedFiles(w http.ResponseWriter, r *http.Request) {
	uploadMu.Lock()
	defer uploadMu.Unlock()
	// Return a copy to avoid holding the lock during JSON encoding.
	out := make([]UploadedFile, len(uploadedFiles))
	copy(out, uploadedFiles)
	writeJSON(w, http.StatusOK, out)
}

// ---------------------------------------------------------------------------
// REST handlers — Sortable reorder
// ---------------------------------------------------------------------------

// handleReorder accepts a POST body of the form {"order": [...]} and
// echoes it back after logging. It exists so the sortable demo has a
// live endpoint to talk to.
func handleReorder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, ValidationErrors{
			Errors: map[string]string{"_form": "Method not allowed"},
		})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)

	var payload struct {
		Order []string `json:"order"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	log.Printf("[reorder] New order: %v", payload.Order)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Order saved",
		"order":   payload.Order,
	})
}

// ---------------------------------------------------------------------------
// Router setup
// ---------------------------------------------------------------------------

// buildRouter constructs the HTTP mux with all API, WebSocket, SSE, and static
// file routes.
func buildRouter() http.Handler {
	mux := http.NewServeMux()

	// ---- REST API ----
	// Note: /api/users/paginated must be registered BEFORE /api/users/
	// so ServeMux's longest-match wins and the paginated handler fires
	// instead of handleUserByID trying to parse "paginated" as an int.
	mux.HandleFunc("/api/users/paginated", handlePaginatedUsers)
	mux.HandleFunc("/api/users", handleUsers)
	mux.HandleFunc("/api/users/", handleUserByID)
	mux.HandleFunc("/api/feed", handleFeed)
	mux.HandleFunc("/api/stats", handleStats)
	mux.HandleFunc("/api/stats/live", handleStatsLive)
	mux.HandleFunc("/api/login", handleLogin)
	mux.HandleFunc("/api/push", handlePush)
	mux.HandleFunc("/api/upload", handleUpload)
	mux.HandleFunc("/api/uploaded-files", handleUploadedFiles)
	mux.HandleFunc("/api/reorder", handleReorder)

	// ---- WebSocket ----
	mux.HandleFunc("/ws/feed", handleWSFeed)

	// ---- SSE ----
	mux.HandleFunc("/events/stream", handleSSEStream)

	// ---- Static files ----
	// Serve the demo/ directory at / and dist/ at /dist/.
	execDir := getProjectRoot()
	demoDir := filepath.Join(execDir, "..", "demo")
	distDir := filepath.Join(execDir, "..", "dist")

	mux.Handle("/dist/", http.StripPrefix("/dist/", http.FileServer(http.Dir(distDir))))
	mux.Handle("/", http.FileServer(http.Dir(demoDir)))

	// Apply middleware: CORS wraps logging wraps the mux.
	return withLogging(withCORS(mux))
}

// getProjectRoot returns the testserver directory so that relative paths to
// ../demo/ and ../dist/ resolve correctly.  When run via "go run", the
// compiled binary lives in a temp directory, so os.Executable() would return
// a misleading path.  Instead we use the current working directory, which is
// correct when invoked as "cd testserver && go run main.go" or simply
// "go run ./testserver" from the project root.
func getProjectRoot() string {
	cwd, err := os.Getwd()
	if err != nil {
		log.Printf("[init] warning: cannot determine cwd: %v", err)
		return "."
	}
	// If cwd is the project root (contains a "testserver" dir), adjust.
	if info, statErr := os.Stat(filepath.Join(cwd, "testserver")); statErr == nil && info.IsDir() {
		return filepath.Join(cwd, "testserver")
	}
	return cwd
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

func main() {
	const addr = ":28080"

	srv := &http.Server{
		Addr:         addr,
		Handler:      buildRouter(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0, // Disabled — SSE streams are long-lived.
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown on SIGINT / SIGTERM.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds)
		fmt.Println("ndesign test server running on http://localhost" + addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen error: %v", err)
		}
	}()

	<-stop
	fmt.Println("\nshutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Close all WebSocket connections before shutting down the server.
	wsMu.Lock()
	for c := range wsConns {
		c.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseGoingAway, "server shutdown"))
		c.Close()
		delete(wsConns, c)
	}
	wsMu.Unlock()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("shutdown error: %v", err)
	}
	fmt.Println("server stopped")
}
