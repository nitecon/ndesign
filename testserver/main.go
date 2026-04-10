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
func handleWSFeed(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[ws] upgrade error: %v", err)
		return
	}
	registerWSConn(conn)
	log.Printf("[ws] client connected (%s)", conn.RemoteAddr())

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

			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventType, jsonData)
			flusher.Flush()
			tick++
		}
	}
}

// ---------------------------------------------------------------------------
// Router setup
// ---------------------------------------------------------------------------

// buildRouter constructs the HTTP mux with all API, WebSocket, SSE, and static
// file routes.
func buildRouter() http.Handler {
	mux := http.NewServeMux()

	// ---- REST API ----
	mux.HandleFunc("/api/users", handleUsers)
	mux.HandleFunc("/api/users/", handleUserByID)
	mux.HandleFunc("/api/stats", handleStats)
	mux.HandleFunc("/api/stats/live", handleStatsLive)
	mux.HandleFunc("/api/login", handleLogin)
	mux.HandleFunc("/api/push", handlePush)

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
