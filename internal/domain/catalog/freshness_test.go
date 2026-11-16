package catalog

import (
	"testing"
	"time"

	"brevis.sh/brevis/internal/domain/schedule"
)

func sched(cron, tz string) *schedule.Schedule {
	return &schedule.Schedule{WorkflowSlug: "wf", Cron: cron, Timezone: tz, Active: true}
}

func at(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestFreshnessReadsLatenessFromTheWritersOwnSchedule(t *testing.T) {
	cases := []struct {
		name string
		w    Writer
		now  string
		want Status
	}{
		// Hourly, landing five minutes past the hour. Grace is the 10-minute floor.
		{"hourly, before the next slot", Writer{Schedule: sched("0 * * * *", "UTC"), Last: at("2026-10-07T10:05:00Z"), Lag: 0}, "2026-10-07T10:59:00Z", OnTime},
		{"hourly, next slot inside its grace", Writer{Schedule: sched("0 * * * *", "UTC"), Last: at("2026-10-07T10:05:00Z"), Lag: 0}, "2026-10-07T11:09:00Z", OnTime},
		{"hourly, one slot missed", Writer{Schedule: sched("0 * * * *", "UTC"), Last: at("2026-10-07T10:05:00Z"), Lag: 0}, "2026-10-07T11:11:00Z", Late},
		{"hourly, still one slot missed", Writer{Schedule: sched("0 * * * *", "UTC"), Last: at("2026-10-07T10:05:00Z"), Lag: 0}, "2026-10-07T12:09:00Z", Late},
		{"hourly, two slots missed", Writer{Schedule: sched("0 * * * *", "UTC"), Last: at("2026-10-07T10:05:00Z"), Lag: 0}, "2026-10-07T12:11:00Z", Stale},

		// The same table read as daily: three hours old is fine.
		{"daily, hours later", Writer{Schedule: sched("0 5 * * *", "UTC"), Last: at("2026-10-07T05:20:00Z"), Lag: 0}, "2026-10-07T08:00:00Z", OnTime},
		{"daily, next morning missed", Writer{Schedule: sched("0 5 * * *", "UTC"), Last: at("2026-10-07T05:20:00Z"), Lag: 0}, "2026-10-08T06:00:00Z", Late},
		// Midnight daily. (Descriptors like @daily are not accepted by the
		// engine's five-field parser, so no published schedule has one.)
		{"daily at midnight", Writer{Schedule: sched("0 0 * * *", "UTC"), Last: at("2026-10-07T00:20:00Z"), Lag: 0}, "2026-10-09T00:11:00Z", Stale},
		{"every five minutes", Writer{Schedule: sched("*/5 * * * *", "UTC"), Last: at("2026-10-07T10:01:00Z"), Lag: 0}, "2026-10-07T10:21:00Z", Stale},

		// A writer that usually lands 40 minutes after its slot gets 40
		// minutes of grace, not the floor.
		{"the lag widens the grace", Writer{Schedule: sched("0 * * * *", "UTC"), Last: at("2026-10-07T10:40:00Z"), Lag: 40 * time.Minute}, "2026-10-07T11:35:00Z", OnTime},
		{"the lag widens it, and no further", Writer{Schedule: sched("0 * * * *", "UTC"), Last: at("2026-10-07T10:40:00Z"), Lag: 40 * time.Minute}, "2026-10-07T11:41:00Z", Late},
		// A lag longer than the interval: an hourly job that lands 90 minutes
		// late every time is on time by its own measure.
		{"a lag longer than the interval", Writer{Schedule: sched("0 * * * *", "UTC"), Last: at("2026-10-07T10:30:00Z"), Lag: 90 * time.Minute}, "2026-10-07T12:25:00Z", OnTime},

		// A clock that ran ahead must not make a table look late.
		{"last load in the future", Writer{Schedule: sched("0 * * * *", "UTC"), Last: at("2026-10-07T12:00:00Z"), Lag: 0}, "2026-10-07T11:00:00Z", OnTime},

		{"paused is a choice, never stale", Writer{Schedule: &schedule.Schedule{Cron: "0 * * * *", Active: false}, Last: at("2026-01-01T00:00:00Z")}, "2026-10-07T11:00:00Z", Paused},
		{"no schedule, no verdict", Writer{Schedule: nil, Last: at("2026-01-01T00:00:00Z"), Lag: 0}, "2026-10-07T11:00:00Z", Unscheduled},
		{"an unreadable cron gives no verdict", Writer{Schedule: sched("not a cron", "UTC"), Last: at("2026-10-07T10:00:00Z"), Lag: 0}, "2026-10-07T11:00:00Z", Unscheduled},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Freshness(c.w, at(c.now)).Status; got != c.want {
				t.Fatalf("Freshness = %s, want %s", got, c.want)
			}
		})
	}
}

// The verdict carries what the target page says in one sentence: which slot
// was missed, and how much grace it had.
func TestALateVerdictNamesTheMissedSlotAndTheGrace(t *testing.T) {
	v := Freshness(Writer{Schedule: sched("0 * * * *", "UTC"), Last: at("2026-10-07T10:05:00Z"), Lag: 12 * time.Minute}, at("2026-10-07T11:30:00Z"))
	if v.Status != Late {
		t.Fatalf("status = %s", v.Status)
	}
	if !v.Missed.Equal(at("2026-10-07T11:00:00Z")) || v.Grace != 12*time.Minute {
		t.Fatalf("missed %v with grace %v, want 11:00 and 12m", v.Missed, v.Grace)
	}
}

// A writer that lands at every tick stays on time across a daylight-saving
// change, in both directions and in two zones. An off-by-an-hour reading of the
// schedule would make a daily table late for one morning a year, twice.
func TestADailyWriterStaysOnTimeAcrossDaylightSaving(t *testing.T) {
	for _, tz := range []string{"America/New_York", "Europe/Lisbon"} {
		s := sched("30 6 * * *", tz)
		// A week either side of both 2026 transitions in each zone.
		for _, from := range []string{"2026-03-04T00:00:00Z", "2026-10-21T00:00:00Z", "2026-10-28T00:00:00Z", "2026-03-25T00:00:00Z"} {
			tick, err := s.Next(at(from))
			if err != nil {
				t.Fatal(err)
			}
			for day := 0; day < 14; day++ {
				landed := tick.Add(5 * time.Minute)
				next, _ := s.Next(tick)
				// Just before the next tick's grace runs out: on time.
				if got := Freshness(Writer{Schedule: s, Last: landed}, next.Add(9*time.Minute)).Status; got != OnTime {
					t.Fatalf("%s: landed %v, at %v: %s, want on time", tz, landed, next.Add(9*time.Minute), got)
				}
				tick = next
			}
		}
	}
}

func TestBestTakesTheHealthiestWriter(t *testing.T) {
	// A gateway writes continuously: healthier than a late writer, though it
	// has no schedule to be on time against. One with no name ranks last.
	order := []Status{OnTime, Continuous, Late, Stale, Paused, Unscheduled, Unidentified}
	for i, a := range order {
		for j, b := range order {
			want := a
			if j < i {
				want = b
			}
			if got := Best(a, b); got != want {
				t.Errorf("Best(%s, %s) = %s, want %s", a, b, got, want)
			}
		}
	}
	if got := Best(); got != Unscheduled {
		t.Errorf("Best() = %s, want unscheduled: no writer, no verdict", got)
	}
}

// The slots that went by without a landing, each past its grace -- what the
// destination page draws as dashed bars after the last load.
func TestMissedSlotsListsTheTicksPastTheirGrace(t *testing.T) {
	w := Writer{Schedule: sched("0 * * * *", "UTC"), Last: at("2026-10-07T10:05:00Z"), Lag: 0}
	got := MissedSlots(w, at("2026-10-07T13:30:00Z"), 5)
	want := []string{"2026-10-07T11:00:00Z", "2026-10-07T12:00:00Z", "2026-10-07T13:00:00Z"}
	if len(got) != len(want) {
		t.Fatalf("missed = %v, want %v", got, want)
	}
	for i := range want {
		if !got[i].Equal(at(want[i])) {
			t.Fatalf("missed[%d] = %v, want %s", i, got[i], want[i])
		}
	}
	// 13:00 is past its grace at 13:30; 14:00 has not come.
	if n := len(MissedSlots(w, at("2026-10-07T13:30:00Z"), 2)); n != 2 {
		t.Errorf("the cap was not applied: %d", n)
	}
	if n := len(MissedSlots(w, at("2026-10-07T10:30:00Z"), 5)); n != 0 {
		t.Errorf("on time, yet %d missed", n)
	}
	if n := len(MissedSlots(Writer{Schedule: nil, Last: at("2026-10-07T10:05:00Z"), Lag: 0}, at("2026-10-09T00:00:00Z"), 5)); n != 0 {
		t.Errorf("no schedule, yet %d missed", n)
	}
}

// A step that ran well and wrote nothing keeps a table on time only while the
// silence looks like the table's own: under 7 days, and under twice the
// longest gap it has shown.
func TestASilenceLongerThanTheTablesOwnIsStaleEvenWhenTheStepRuns(t *testing.T) {
	daily := sched("0 9 * * *", "UTC")
	ran := at("2026-11-16T09:00:30Z")
	cases := []struct {
		name   string
		landed string
		gap    time.Duration
		runs   int
		want   Status
	}{
		{"three days, no gaps: inside the floor", "2026-11-13T09:05:00Z", 0, 8, OnTime},
		{"eight days, no gaps: past the floor", "2026-11-08T09:05:00Z", 0, 8, Stale},
		{"eight days, but it has been quiet for five before", "2026-11-08T09:05:00Z", 5 * 24 * time.Hour, 8, OnTime},
		{"eleven days, longest known gap five", "2026-11-05T09:05:00Z", 5 * 24 * time.Hour, 8, Stale},
		{"thirty days, it has been quiet for twenty before", "2026-10-17T09:05:00Z", 20 * 24 * time.Hour, 8, OnTime},
		// Too little history to have a rhythm: a monthly dataset, or one load.
		{"fifteen days, one run: nothing learned yet", "2026-11-01T09:05:00Z", 0, 1, OnTime},
		{"fifteen days, five runs: still nothing learned", "2026-11-01T09:05:00Z", 2 * 24 * time.Hour, 5, OnTime},
		{"fifteen days, six runs: it has a rhythm now", "2026-11-01T09:05:00Z", 2 * 24 * time.Hour, 6, Stale},
	}
	for _, c := range cases {
		w := Writer{Schedule: daily, Last: ran, Landed: at(c.landed), MaxGap: c.gap, Runs: c.runs}
		v := Freshness(w, at("2026-11-16T10:00:00Z"))
		if v.Status != c.want {
			t.Errorf("%s: %s, want %s", c.name, v.Status, c.want)
		}
		// Stale by silence says when data last landed, and says the step ran.
		if want := c.want == Stale; v.NoData != want || (want && !v.Missed.Equal(w.Landed)) {
			t.Errorf("%s: NoData = %v, Missed = %v", c.name, v.NoData, v.Missed)
		}
	}
}

// With no run after the last landing the old rule stands: the landing is the
// only proof, and the limit only judges what a run is hiding.
func TestTheLearnedLimitOnlyJudgesWhatARunIsHiding(t *testing.T) {
	w := Writer{Schedule: sched("0 9 * * *", "UTC"), Last: at("2026-11-08T09:05:00Z"), Landed: at("2026-11-08T09:05:00Z"), Runs: 8}
	if got := Freshness(w, at("2026-11-08T21:00:00Z")).Status; got != OnTime {
		t.Errorf("a fresh landing: %s", got)
	}
	if got := Freshness(w, at("2026-11-16T10:00:00Z")).Status; got != Stale {
		t.Errorf("eight days of nothing, no run: %s, want stale", got)
	}
}

// A paused writer stays paused: the limit never overrides a choice.
func TestTheLearnedLimitNeverOverridesPaused(t *testing.T) {
	s := sched("0 9 * * *", "UTC")
	s.Active = false
	w := Writer{Schedule: s, Last: at("2026-11-16T09:00:30Z"), Landed: at("2026-10-01T09:05:00Z"), Runs: 8}
	if got := Freshness(w, at("2026-11-16T10:00:00Z")).Status; got != Paused {
		t.Errorf("%s, want paused", got)
	}
}
