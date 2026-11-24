package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var Upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for local development and local Wi-Fi devices
		return true
	},
}

// Hub maintains the set of active clients and broadcasts messages to rooms.
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[*websocket.Conn]bool
}

// NewHub creates a new WebSocket Hub instance.
func NewHub() *Hub {
	return &Hub{
		rooms: make(map[string]map[*websocket.Conn]bool),
	}
}

// Register adds a new connection to a room.
func (h *Hub) Register(code string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	connections, exists := h.rooms[code]
	if !exists {
		connections = make(map[*websocket.Conn]bool)
		h.rooms[code] = connections
	}
	connections[conn] = true
	log.Printf("[WS] Registered client in room %s (total: %d)", code, len(connections))
}

// Unregister removes a connection from a room and closes it.
func (h *Hub) Unregister(code string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if connections, exists := h.rooms[code]; exists {
		if _, ok := connections[conn]; ok {
			delete(connections, conn)
			_ = conn.Close()
			log.Printf("[WS] Unregistered client in room %s (remaining: %d)", code, len(connections))
		}
		if len(connections) == 0 {
			delete(h.rooms, code)
		}
	}
}

// Broadcast sends a message to all active clients in a room.
func (h *Hub) Broadcast(code string, message any) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("[WS] Failed to marshal broadcast message: %v", err)
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	connections, exists := h.rooms[code]
	if !exists || len(connections) == 0 {
		return
	}

	var deadConns []*websocket.Conn
	for conn := range connections {
		_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			log.Printf("[WS] Write error to client in room %s: %v", code, err)
			deadConns = append(deadConns, conn)
		}
	}

	// Clean up dead connections
	for _, conn := range deadConns {
		delete(connections, conn)
		_ = conn.Close()
	}

	if len(connections) == 0 {
		delete(h.rooms, code)
	}
}
