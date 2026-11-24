package ws_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"dj-app-backend/internal/ws"

	"github.com/gorilla/websocket"
)

func TestHub_RegisterAndBroadcast(t *testing.T) {
	hub := ws.NewHub()

	// Create test HTTP server with WS upgrade
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		code := strings.TrimPrefix(r.URL.Path, "/ws/")
		conn, err := ws.Upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("failed to upgrade: %v", err)
		}
		hub.Register(code, conn)

		// Read to detect disconnect
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				hub.Unregister(code, conn)
				break
			}
		}
	}))
	defer s.Close()

	// Convert http URL to ws URL
	wsURL := "ws" + strings.TrimPrefix(s.URL, "http") + "/ws/1234"

	// Connect client 1
	c1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("client 1 failed to connect: %v", err)
	}
	defer c1.Close()

	// Connect client 2
	c2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("client 2 failed to connect: %v", err)
	}
	defer c2.Close()

	// Give time for registration
	time.Sleep(50 * time.Millisecond)

	// Broadcast test message
	testPayload := map[string]string{"type": "new_request", "song": "Song 1"}
	hub.Broadcast("1234", testPayload)

	// Read message from client 1
	_ = c1.SetReadDeadline(time.Now().Add(2 * time.Second))
	var msg1 map[string]string
	if err := c1.ReadJSON(&msg1); err != nil {
		t.Fatalf("client 1 failed to receive json: %v", err)
	}
	if msg1["song"] != "Song 1" {
		t.Errorf("client 1 got unexpected message: %v", msg1)
	}

	// Read message from client 2
	_ = c2.SetReadDeadline(time.Now().Add(2 * time.Second))
	var msg2 map[string]string
	if err := c2.ReadJSON(&msg2); err != nil {
		t.Fatalf("client 2 failed to receive json: %v", err)
	}
	if msg2["song"] != "Song 1" {
		t.Errorf("client 2 got unexpected message: %v", msg2)
	}

	// Test Unregister and broadcast to non-existent room
	c1.Close()
	time.Sleep(50 * time.Millisecond)
	hub.Broadcast("9999", testPayload) // should not panic
}
