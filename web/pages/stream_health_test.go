package pages

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"brevis.sh/brevis/internal/infrastructure/postgres"
)

// A stream's health is never "continuous", "healthy" or "failing" while the
// console holds no traffic: it is unknown, and says whether the destination
// is at least known.
func TestAStreamsHealthIsUnknownAndSaysWhy(t *testing.T) {
	cases := []struct {
		name   string
		stream Stream
		reason string
	}{
		{"a named destination", Stream{Sink: Place{URI: "postgres://warehouse/sales/events", Kind: "postgres"}}, ReasonNotReported},
		{"a destination the manifest could not name", Stream{Sink: Place{Note: "no locator"}}, ReasonDestinationUnnamed},
		{"a stream with only a dead letter", Stream{DeadLetter: &Place{URI: "file:///dl/"}}, ReasonDestinationUnnamed},
	}
	for _, c := range cases {
		if got := c.stream.Health(); got.State != HealthUnknown || got.Reason != c.reason {
			t.Errorf("%s: health = %+v, want unknown/%s", c.name, got, c.reason)
		}
	}
}

// Landings of a workflow step on the stream's own destination must not move
// its health: they are the step's, not the stream's.
func TestAStreamsHealthIgnoresWorkflowLandingsOnItsDestination(t *testing.T) {
	now := time.Now()
	e := printFixtures(now)
	before := BuildStreams(e, StreamFilter{}).HealthCounts
	for i := range e {
		if e[i].Target == "postgres://warehouse/sales/events" {
			e[i].Writers = append(e[i].Writers, step("daily", "load", "0 * * * *", now.Add(-72*time.Hour), 10))
		}
	}
	after := BuildStreams(e, StreamFilter{}).HealthCounts
	if len(before) != 1 || before[HealthUnknown] == 0 || before[HealthUnknown] != after[HealthUnknown] {
		t.Errorf("health counts moved: %v -> %v", before, after)
	}
}

func TestTheStreamsJSONCarriesHealthAndItsCounts(t *testing.T) {
	v := BuildStreams(printFixtures(time.Now()), StreamFilter{Q: "clicks"})
	if v.HealthCounts[HealthUnknown] != v.Total || v.Total <= len(v.Rows) {
		t.Fatalf("counts %v are not every stream's (total %d, shown %d)", v.HealthCounts, v.Total, len(v.Rows))
	}
	raw, err := json.Marshal(StreamsAsJSON(context.Background(), v))
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		Rows         []struct{ Health StreamHealth } `json:"rows"`
		HealthCounts map[string]int                  `json:"healthCounts"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Rows) == 0 || out.Rows[0].Health.State != "unknown" || out.Rows[0].Health.Reason == "" || out.HealthCounts["unknown"] != v.Total {
		t.Errorf("json = %s", raw)
	}
	var d struct{ Health StreamHealth }
	s := StreamAsJSON(context.Background(), BuildStream(v.Rows[0], (*postgres.TargetDetail)(nil)))
	raw, _ = json.Marshal(s)
	_ = json.Unmarshal(raw, &d)
	if d.Health.State != "unknown" {
		t.Errorf("detail health = %+v", d.Health)
	}
}
