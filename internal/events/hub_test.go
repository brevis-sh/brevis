package events

import (
	"context"
	"errors"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// clock lets a test decide when every detector's wait ends.
type clock struct {
	mu sync.Mutex
	ch []chan time.Time
}

func (c *clock) after(time.Duration) (<-chan time.Time, func()) {
	ch := make(chan time.Time, 1)
	c.mu.Lock()
	c.ch = append(c.ch, ch)
	c.mu.Unlock()
	return ch, func() {}
}

// waiting blocks until n detectors are parked on the clock.
func (c *clock) waiting(t *testing.T, n int) {
	t.Helper()
	eventually(t, func() bool { c.mu.Lock(); defer c.mu.Unlock(); return len(c.ch) >= n })
}

func (c *clock) fire() {
	c.mu.Lock()
	for _, ch := range c.ch {
		ch <- time.Now()
	}
	c.ch = nil
	c.mu.Unlock()
}

func eventually(t *testing.T, ok func() bool) {
	t.Helper()
	for i := 0; i < 400; i++ {
		if ok() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("condition not reached")
}

type fake struct {
	mu    sync.Mutex
	val   string
	err   error
	calls atomic.Int32
}

func (f *fake) Fingerprint(context.Context) (string, error) {
	f.calls.Add(1)
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.val, f.err
}

func (f *fake) set(v string, err error) { f.mu.Lock(); f.val, f.err = v, err; f.mu.Unlock() }

type rig struct {
	hub    *Hub
	clk    *clock
	det    map[string]*fake
	made   atomic.Int32
	cancel context.CancelFunc
}

func newRig(t *testing.T, max int) *rig {
	t.Helper()
	r := &rig{clk: &clock{}, det: map[string]*fake{}}
	var mu sync.Mutex
	ctx, cancel := context.WithCancel(context.Background())
	r.cancel = cancel
	t.Cleanup(cancel)
	r.hub = NewHub(ctx, func(name string) Detector {
		r.made.Add(1)
		mu.Lock()
		defer mu.Unlock()
		f := r.det[name]
		if f == nil {
			f = &fake{val: "v1"}
			r.det[name] = f
		}
		return f
	}, Options{MaxSubs: max, After: r.clk.after, Jitter: func() float64 { return 1 }})
	return r
}

// tick advances every parked detector by one period and waits for each to
// have probed again.
func (r *rig) tick(t *testing.T, topics ...string) {
	t.Helper()
	want := map[string]int32{}
	for _, n := range topics {
		want[n] = r.det[n].calls.Load() + 1
	}
	r.clk.waiting(t, len(topics))
	r.clk.fire()
	for n, w := range want {
		eventually(t, func() bool { return r.det[n].calls.Load() >= w })
	}
}

func got(s *Sub) (string, bool) {
	select {
	case v, ok := <-s.C:
		return v, ok
	case <-time.After(60 * time.Millisecond):
		return "", false
	}
}

func TestBaselineIsNotABroadcastButAChangeIs(t *testing.T) {
	r := newRig(t, 10)
	s, err := r.hub.Subscribe(context.Background(), []string{"runs"})
	if err != nil {
		t.Fatal(err)
	}
	r.tick(t, "runs") // same value as the baseline
	if v, ok := got(s); ok {
		t.Fatalf("got %q with nothing changed", v)
	}
	r.det["runs"].set("v2", nil)
	r.tick(t, "runs")
	if v, _ := got(s); v != "runs" {
		t.Fatalf("got %q, want runs", v)
	}
}

func TestAFailingFingerprintKeepsTheOldValue(t *testing.T) {
	r := newRig(t, 10)
	s, _ := r.hub.Subscribe(context.Background(), []string{"runs"})
	r.det["runs"].set("", errors.New("db down"))
	r.tick(t, "runs")
	r.det["runs"].set("v1", nil) // back to the baseline: nothing happened
	r.tick(t, "runs")
	if v, ok := got(s); ok {
		t.Fatalf("an error then the same value broadcast %q", v)
	}
}

func TestPendingChangesAreCoalescedUntilAcked(t *testing.T) {
	r := newRig(t, 10)
	s, _ := r.hub.Subscribe(context.Background(), []string{"runs"})
	r.det["runs"].set("v2", nil)
	r.tick(t, "runs")
	r.det["runs"].set("v3", nil)
	r.tick(t, "runs")
	if v, _ := got(s); v != "runs" {
		t.Fatal("first change missing")
	}
	if v, ok := got(s); ok {
		t.Fatalf("second change queued as %q instead of coalescing", v)
	}
	s.Ack("runs")
	r.det["runs"].set("v4", nil)
	r.tick(t, "runs")
	if v, _ := got(s); v != "runs" {
		t.Fatal("change after the ack missing")
	}
}

func TestASlowSubscriberIsDroppedAndOthersKeepGoing(t *testing.T) {
	r := newRig(t, 10)
	var names []string
	for i := 0; i < subBuffer+1; i++ {
		names = append(names, string(rune('a'+i)))
	}
	slow, _ := r.hub.Subscribe(context.Background(), names)
	fast, _ := r.hub.Subscribe(context.Background(), names[:1])
	for _, n := range names {
		r.det[n].set("v2", nil)
	}
	r.tick(t, names...)
	// slow never reads: nine queued topics do not fit in eight slots.
	eventually(t, func() bool { subs, _ := r.hub.Stats(); return subs == 1 })
	n := 0
	for range slow.C { // drains what was queued, then sees the close
		n++
	}
	if n > subBuffer {
		t.Fatalf("slow got %d", n)
	}
	if v, _ := got(fast); v != "a" {
		t.Fatalf("fast subscriber got %q", v)
	}
}

func TestDetectorsAreRefCountedAndLeakNothing(t *testing.T) {
	base := runtime.NumGoroutine()
	r := newRig(t, 10)
	a, _ := r.hub.Subscribe(context.Background(), []string{"runs", "nav"})
	b, _ := r.hub.Subscribe(context.Background(), []string{"runs"})
	if n := r.made.Load(); n != 2 {
		t.Fatalf("%d detectors built for two topics", n)
	}
	a.Close()
	if _, d := r.hub.Stats(); d != 1 {
		t.Fatalf("%d detectors after the nav watcher left, want 1 (runs still watched)", d)
	}
	b.Close()
	b.Close() // idempotent
	if s, d := r.hub.Stats(); s != 0 || d != 0 {
		t.Fatalf("subs=%d detectors=%d after everyone left", s, d)
	}
	eventually(t, func() bool { return runtime.NumGoroutine() <= base })
	c, _ := r.hub.Subscribe(context.Background(), []string{"runs"}) // restarts cleanly
	if r.made.Load() != 3 {
		t.Fatal("a topic with no watcher did not get a fresh detector")
	}
	c.Close()
}

func TestShutdownEndsEveryStreamAndRefusesNewOnes(t *testing.T) {
	base := runtime.NumGoroutine()
	r := newRig(t, 10)
	s1, _ := r.hub.Subscribe(context.Background(), []string{"runs", "nav"})
	s2, _ := r.hub.Subscribe(context.Background(), []string{"catalog"})
	r.cancel()
	for _, s := range []*Sub{s1, s2} {
		select {
		case _, ok := <-s.C:
			if ok {
				t.Fatal("event after shutdown")
			}
		case <-time.After(time.Second):
			t.Fatal("stream not ended by shutdown")
		}
	}
	if _, err := r.hub.Subscribe(context.Background(), []string{"runs"}); !errors.Is(err, ErrClosed) {
		t.Fatalf("err = %v, want ErrClosed", err)
	}
	eventually(t, func() bool { return runtime.NumGoroutine() <= base })
}

func TestCapacity(t *testing.T) {
	r := newRig(t, 2)
	a, _ := r.hub.Subscribe(context.Background(), []string{"runs"})
	if _, err := r.hub.Subscribe(context.Background(), []string{"runs"}); err != nil {
		t.Fatal(err)
	}
	if _, err := r.hub.Subscribe(context.Background(), []string{"runs"}); !errors.Is(err, ErrFull) {
		t.Fatalf("err = %v, want ErrFull", err)
	}
	a.Close()
	if _, err := r.hub.Subscribe(context.Background(), []string{"runs"}); err != nil {
		t.Fatalf("a freed slot was not reusable: %v", err)
	}
}

// THE CAP IS ON DETECTORS, NOT ONLY ON SUBSCRIBERS: a client that names many
// distinct runs or workflows must not be able to start a query per name per
// second. A refusal leaves nothing behind, and a shared topic costs nothing.
func TestDetectorsAreCapped(t *testing.T) {
	r := newRig(t, 100)
	r.hub.opt.MaxDetectors = 3
	ctx := context.Background()
	a, err := r.hub.Subscribe(ctx, []string{"runs", "nav"})
	if err != nil {
		t.Fatal(err)
	}
	// a shared topic starts no detector, so it fits even at the cap's edge
	if _, err := r.hub.Subscribe(ctx, []string{"runs", "workflow:x"}); err != nil {
		t.Fatalf("one new detector at 2 of 3 must fit: %v", err)
	}
	made := r.made.Load()
	if _, err := r.hub.Subscribe(ctx, []string{"workflow:y"}); !errors.Is(err, ErrFull) {
		t.Fatalf("a fourth detector: err = %v, want ErrFull", err)
	}
	if r.made.Load() != made || len(r.hub.topics) != 3 {
		t.Fatalf("a refused subscription left detectors behind: made %d -> %d, topics %d", made, r.made.Load(), len(r.hub.topics))
	}
	if len(r.hub.subs) != 2 {
		t.Fatalf("a refused subscription stayed registered: %d subs", len(r.hub.subs))
	}
	a.Close() // frees "nav": the cap is on what is WATCHED, so a slot comes back
	if _, err := r.hub.Subscribe(ctx, []string{"workflow:y"}); err != nil {
		t.Fatalf("a freed detector slot was not reusable: %v", err)
	}
}

func TestParseTopics(t *testing.T) {
	ok := "runs,run:9f1c7a0e-1b2c-4d3e-8f90-a1b2c3d4e5f6,workflow:daily_sales,runs"
	if got, err := ParseTopics(ok); err != nil || len(got) != 3 {
		t.Fatalf("ParseTopics(%q) = %v, %v", ok, got, err)
	}
	many := "workflow:a1"
	for i := 2; i <= 21; i++ {
		many += ",workflow:a" + string(rune('a'+i))
	}
	// a client names a few runs/workflows at most; the fixed topics are shared
	dyn := "runs,workflow:a,workflow:b,workflow:c,workflow:d"
	if _, err := ParseTopics(dyn); err != nil {
		t.Errorf("4 named topics refused: %v", err)
	}
	if _, err := ParseTopics(dyn + ",run:9f1c7a0e-1b2c-4d3e-8f90-a1b2c3d4e5f6"); err == nil {
		t.Error("5 named topics accepted")
	}
	for _, bad := range []string{"", ",", "nope", "run:xyz", "workflow:", "workflow:a b", "workflow:../x", "runs,", many} {
		if _, err := ParseTopics(bad); err == nil {
			t.Errorf("ParseTopics(%q) accepted", bad)
		}
	}
}
