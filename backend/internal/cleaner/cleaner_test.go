package cleaner_test

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"dj-app-backend/internal/cleaner"
)

type mockCleanerStore struct {
	cleanCalls int32
	roomsCount int64
	mu         sync.Mutex
}

func (m *mockCleanerStore) CleanExpiredRooms(ctx context.Context, maxAge time.Duration) (int64, error) {
	atomic.AddInt32(&m.cleanCalls, 1)
	m.mu.Lock()
	defer m.mu.Unlock()
	cleaned := m.roomsCount
	m.roomsCount = 0
	return cleaned, nil
}

func TestCleaner_RunOnce(t *testing.T) {
	store := &mockCleanerStore{roomsCount: 3}
	c := cleaner.New(store, 1*time.Minute, 24*time.Hour)

	deleted, err := c.RunOnce(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if deleted != 3 {
		t.Errorf("expected 3 deleted rooms, got %d", deleted)
	}

	if atomic.LoadInt32(&store.cleanCalls) != 1 {
		t.Errorf("expected 1 call, got %d", atomic.LoadInt32(&store.cleanCalls))
	}
}

func TestCleaner_MaybeClean_Throttling(t *testing.T) {
	store := &mockCleanerStore{roomsCount: 2}
	c := cleaner.New(store, 50*time.Millisecond, 24*time.Hour)

	// First call should execute cleanup
	deleted, err := c.MaybeClean(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if deleted != 2 {
		t.Errorf("expected 2 deleted rooms on first call, got %d", deleted)
	}

	// Immediate second call should be throttled (skipped)
	store.mu.Lock()
	store.roomsCount = 5
	store.mu.Unlock()

	deleted, err = c.MaybeClean(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if deleted != 0 {
		t.Errorf("expected 0 deleted rooms when throttled, got %d", deleted)
	}
	if atomic.LoadInt32(&store.cleanCalls) != 1 {
		t.Errorf("expected 1 total DB call while throttled, got %d", atomic.LoadInt32(&store.cleanCalls))
	}

	// After interval passes, next call should execute cleanup again
	time.Sleep(60 * time.Millisecond)
	deleted, err = c.MaybeClean(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if deleted != 5 {
		t.Errorf("expected 5 deleted rooms after interval, got %d", deleted)
	}
	if atomic.LoadInt32(&store.cleanCalls) != 2 {
		t.Errorf("expected 2 total DB calls, got %d", atomic.LoadInt32(&store.cleanCalls))
	}
}
