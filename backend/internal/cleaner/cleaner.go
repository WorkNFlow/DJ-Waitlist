package cleaner

import (
	"context"
	"log"
	"sync"
	"time"
)

// Cleaner purges expired rooms from the database on demand, throttled by interval.
type Cleaner struct {
	store         RoomCleanerStore
	interval      time.Duration
	maxAge        time.Duration
	mu            sync.Mutex
	lastCleanedAt time.Time
}

// New creates a new Cleaner instance.
func New(store RoomCleanerStore, interval, maxAge time.Duration) *Cleaner {
	return &Cleaner{
		store:    store,
		interval: interval,
		maxAge:   maxAge,
	}
}

// RunOnce performs a single cleanup cycle immediately.
func (c *Cleaner) RunOnce(ctx context.Context) (int64, error) {
	return c.store.CleanExpiredRooms(ctx, c.maxAge)
}

// MaybeClean runs cleanup at most once per configured interval.
// Safe for concurrent calls; skips DB query if cleaned recently.
func (c *Cleaner) MaybeClean(ctx context.Context) (int64, error) {
	c.mu.Lock()
	if !c.lastCleanedAt.IsZero() && time.Since(c.lastCleanedAt) < c.interval {
		c.mu.Unlock()
		return 0, nil
	}
	c.lastCleanedAt = time.Now()
	c.mu.Unlock()

	count, err := c.RunOnce(ctx)
	if err != nil {
		// Reset lastCleanedAt on error so the next call can retry
		c.mu.Lock()
		c.lastCleanedAt = time.Time{}
		c.mu.Unlock()
		log.Printf("[CLEANER] Error cleaning expired rooms: %v", err)
		return 0, err
	}

	if count > 0 {
		log.Printf("[CLEANER] Deleted %d expired room(s)", count)
	}
	return count, nil
}
