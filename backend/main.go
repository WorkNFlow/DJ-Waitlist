package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"dj-app-backend/internal/db"
	"dj-app-backend/internal/handlers"
	"dj-app-backend/internal/middleware"
	"dj-app-backend/internal/ws"

	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if available
	if err := godotenv.Load(); err != nil {
		log.Println("[INFO] No .env file loaded, using system environment variables")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/dj_app?sslmode=disable"
	}

	log.Printf("[INIT] Starting DJ Request App Backend on port %s...", port)

	// Connect to PostgreSQL
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	pool, err := db.Connect(ctx, dbURL)
	cancel()
	if err != nil {
		log.Fatalf("[FATAL] Could not connect to PostgreSQL: %v\nCheck your DATABASE_URL or make sure PostgreSQL is running.", err)
	}
	defer pool.Close()
	log.Println("[INIT] Connected to PostgreSQL successfully")

	// Initialize tables and indexes
	ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
	if err := db.InitSchema(ctx, pool); err != nil {
		cancel()
		log.Fatalf("[FATAL] Failed to initialize database schema: %v", err)
	}
	cancel()
	log.Println("[INIT] Database schema initialized")

	// Initialize store, websocket hub, and handlers
	store := db.NewStore(pool)
	hub := ws.NewHub()
	h := handlers.NewHandler(store, hub)

	// Router setup (Go 1.22+ standard net/http mux)
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// API Endpoints
	mux.HandleFunc("POST /api/rooms", h.CreateRoom)
	mux.HandleFunc("GET /api/rooms/{code}", h.GetRoom)
	mux.HandleFunc("POST /api/rooms/{code}/requests", h.CreateRequest)
	mux.HandleFunc("PATCH /api/rooms/{code}/requests/{id}", h.UpdateRequestStatus)

	// WebSocket Endpoint
	mux.HandleFunc("GET /ws/{code}", h.ServeWS)

	// Wrap mux with CORS and Logging middlewares
	handler := middleware.CORS(middleware.Logging(mux))

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Graceful shutdown channel
	shutdownChan := make(chan os.Signal, 1)
	signal.Notify(shutdownChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[READY] Server is listening on http://localhost:%s", port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[FATAL] Server HTTP error: %v", err)
		}
	}()

	// Wait for termination signal
	sig := <-shutdownChan
	log.Printf("[SHUTDOWN] Received signal %v, shutting down gracefully...", sig)

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("[ERROR] Server shutdown error: %v", err)
	}

	log.Println("[SHUTDOWN] Server stopped cleanly")
}
