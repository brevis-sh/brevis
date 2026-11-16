package catalog

import (
	"time"

	"brevis.sh/brevis/internal/domain/schedule"
)

// Status is how a destination stands against its writer's schedule.
type Status string

const (
	OnTime      Status = "on_time"
	Late        Status = "late"
	Stale       Status = "stale"
	Paused      Status = "paused"
	Unscheduled Status = "unscheduled"

	// Continuous is a gateway's: it writes as events arrive, with no schedule
	// to be late against. Its traffic is on the gateway's /metrics.
	Continuous Status = "continuous"

	// Unidentified is a published gateway destination its manifest could not
	// name -- no locator in the gateway's binary, or a relative path.
	Unidentified Status = "unidentified"
)

// minGrace is the least a slot is given before it counts as missed. Below
// this, a load that ends at :03 on an hourly schedule would flicker between
// late and on time every hour.
const minGrace = 10 * time.Minute

// Writer is one workflow step writing a destination, as freshness needs it.
type Writer struct {
	// Schedule is the writer's workflow schedule; nil when it has none.
	Schedule *schedule.Schedule

	// Last is when this writer last landed on the destination.
	Last time.Time

	// Lag is how long after its slot this writer's data usually lands: the p90
	// of loaded_at minus the run's slot over its recent landings. Queue,
	// retries and the step's own duration are all in it, which is the point.
	Lag time.Duration

	// Landed is when data last reached the destination, as opposed to Last,
	// which is the later of that and the step's last good run. They differ when
	// the step ran and wrote nothing, which a cache-style table does by design.
	// Zero when Last is all there is.
	Landed time.Time

	// MaxGap is the longest stretch between two landings in the writer's recent
	// history: what "quiet" has meant for this table so far. Zero when it has
	// fewer than two landings.
	MaxGap time.Duration

	// Runs is how many runs the writer has landed in, over its recent history
	// (up to 30 landings). It is what the table has had to learn from.
	Runs int
}

// A run keeps a table fresh only while its silence looks like the table's own.
// A step that runs well and writes nothing is how a cache table behaves, and
// also how a broken fetcher behaves; what tells them apart is how long the
// table has gone without data compared with the longest it has gone before.
const (
	// quietFloor is the least silence tolerated, for a table with little or no
	// history to learn from.
	quietFloor = 7 * 24 * time.Hour

	// learnedAfter is the fewest runs a table must have landed in before its
	// silence is judged. A table with fewer has not shown a rhythm yet: a
	// monthly public dataset, or one loaded once, looks exactly like a stopped
	// one, and calling it stale is the false alarm this exists to avoid.
	learnedAfter = 6

	// quietFactor is how many times its longest known gap a table may be quiet.
	quietFactor = 2
)

// Verdict is a writer's status and what it rests on.
type Verdict struct {
	Status Status

	// Missed is the first slot that went by without a landing; zero when none
	// has. Grace is how long each slot was given.
	Missed time.Time
	Grace  time.Duration

	// NoData is true when the status comes from the silence outgrowing the
	// table's own (see Freshness), not from a slot with no run: the writer ran,
	// and what to tell the reader is when data last landed. Missed then holds
	// that moment.
	NoData bool
}

// Freshness reads a writer's lateness from its OWN schedule.
//
// It never asks "is this table old" in absolute terms: an hourly table three
// hours old is stale and a daily one is fine, and only the cron knows which.
// The question is how many slots went by, each with its grace, since the last
// landing:
//
//	none -> on time      one -> late      two or more -> stale
//
// The schedule is read through schedule.Schedule.Next, the same reading the
// scheduler and the workflows list use, so a daylight-saving change moves the
// slot here exactly as it moves the run.
//
// A paused schedule is paused and never stale: the operator chose it. A writer
// with no schedule, or one whose cron cannot be read, gets no verdict --
// guessing an interval is the inference this catalog refuses.
//
// A step that ended well keeps the table on time even with no landing (see
// Writer.Last), unless the silence outgrew what the table has shown before:
// longer than quietFactor times its longest recent gap, and than quietFloor.
func Freshness(w Writer, now time.Time) Verdict {
	v := bySlots(w, now)
	if (v.Status != OnTime && v.Status != Late) || w.Landed.IsZero() || !w.Last.After(w.Landed) || w.Runs < learnedAfter {
		return v
	}
	if now.Sub(w.Landed) <= max(quietFloor, quietFactor*w.MaxGap) {
		return v
	}
	return Verdict{Status: Stale, Missed: w.Landed, Grace: v.Grace, NoData: true}
}

func bySlots(w Writer, now time.Time) Verdict {
	if w.Schedule == nil {
		return Verdict{Status: Unscheduled}
	}
	if !w.Schedule.Active {
		return Verdict{Status: Paused}
	}
	grace := max(minGrace, w.Lag)

	first, err := w.Schedule.Next(w.Last)
	if err != nil {
		return Verdict{Status: Unscheduled}
	}
	if !now.After(first.Add(grace)) {
		return Verdict{Status: OnTime, Grace: grace}
	}
	second, err := w.Schedule.Next(first)
	if err != nil {
		return Verdict{Status: Unscheduled}
	}
	if !now.After(second.Add(grace)) {
		return Verdict{Status: Late, Missed: first, Grace: grace}
	}
	return Verdict{Status: Stale, Missed: first, Grace: grace}
}

// rank orders statuses from healthiest. A destination takes its best writer's
// status: data arriving from any writer is data arriving.
var rank = map[Status]int{
	OnTime: 0, Continuous: 1, Late: 2, Stale: 3, Paused: 4, Unscheduled: 5, Unidentified: 6,
}

// Best returns the healthiest of the statuses, or Unscheduled when there are
// none -- no writer, no verdict.
func Best(statuses ...Status) Status {
	if len(statuses) == 0 {
		return Unscheduled
	}
	best := Unidentified
	for _, s := range statuses {
		if rank[s] < rank[best] {
			best = s
		}
	}
	return best
}

// MissedSlots lists the writer's ticks after its last landing that are past
// their grace, oldest first, up to limit. A paused or unscheduled writer has
// none: nothing was expected of it.
//
// limit bounds the work as well as the drawing: a minutely writer stopped for
// a week has ten thousand missed ticks, and the page needs a handful.
func MissedSlots(w Writer, now time.Time, limit int) []time.Time {
	if w.Schedule == nil || !w.Schedule.Active || limit <= 0 {
		return nil
	}
	grace := max(minGrace, w.Lag)
	var out []time.Time
	tick := w.Last
	for len(out) < limit {
		next, err := w.Schedule.Next(tick)
		if err != nil || now.Before(next.Add(grace)) {
			break
		}
		out = append(out, next)
		tick = next
	}
	return out
}
