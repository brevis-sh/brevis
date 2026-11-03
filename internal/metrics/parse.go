// Package metrics is the console's only time series: a collector that scrapes
// the Prometheus text exposition of the gateways and of the SQL APIs the
// operator named, turns counter deltas into per-minute buckets kept in memory,
// and answers "how much went into this stream / came through this endpoint,
// and when".
//
// WHAT IT IS NOT: a store. History lives in this process only, so a restart of
// the console starts the chart again (the API says since when). Anything
// longer belongs in the operator's Prometheus, which scrapes the same
// endpoints.
package metrics

import (
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"

	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"
)

// Sample is one series at one scrape. Histograms are flattened the way the
// text format spells them (`_bucket` with an `le` label, `_sum`, `_count`), so
// the rest of the package reads one shape whatever the exposition's types.
type Sample struct {
	Name   string
	Labels map[string]string
	Value  float64
}

// ErrTooLarge is a response past the size cap. It is an error and not a
// truncated parse: half an exposition would read as counters that vanished.
var ErrTooLarge = errors.New("exposition over the size cap")

// Parse reads a Prometheus text exposition of at most max bytes.
//
// The repo's existing dependency (prometheus/common/expfmt) does the parsing:
// escaped labels, histograms and the NaN/Inf spellings are exactly the corners
// a hand-rolled parser gets wrong, and it is already in go.mod for the
// engine's own exposition tests -- so this adds no module.
//
// NaN and Inf VALUES are dropped. A counter that is NaN has no delta, and one
// poisoned addition would turn a minute bucket into NaN for good.
func Parse(r io.Reader, max int64) ([]Sample, error) {
	lr := &io.LimitedReader{R: r, N: max + 1}
	p := expfmt.NewTextParser(model.UTF8Validation)
	fams, err := p.TextToMetricFamilies(lr)
	if lr.N <= 0 {
		return nil, ErrTooLarge
	}
	if err != nil {
		return nil, fmt.Errorf("unreadable exposition: %w", err)
	}
	var out []Sample
	add := func(name string, ls map[string]string, v float64) {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return
		}
		out = append(out, Sample{Name: name, Labels: ls, Value: v})
	}
	for name, mf := range fams {
		for _, m := range mf.GetMetric() {
			ls := make(map[string]string, len(m.GetLabel())+1)
			for _, l := range m.GetLabel() {
				ls[l.GetName()] = l.GetValue()
			}
			switch {
			case m.Histogram != nil:
				h := m.Histogram
				for _, b := range h.GetBucket() {
					bl := withLE(ls, strconv.FormatFloat(b.GetUpperBound(), 'g', -1, 64))
					if math.IsInf(b.GetUpperBound(), 1) {
						bl = withLE(ls, "+Inf")
					}
					add(name+"_bucket", bl, float64(b.GetCumulativeCount()))
				}
				// +Inf is the count; the parser may or may not list it.
				add(name+"_bucket", withLE(ls, "+Inf"), float64(h.GetSampleCount()))
				add(name+"_sum", ls, h.GetSampleSum())
				add(name+"_count", ls, float64(h.GetSampleCount()))
			case m.Counter != nil:
				add(name, ls, m.Counter.GetValue())
			case m.Gauge != nil:
				add(name, ls, m.Gauge.GetValue())
			case m.Untyped != nil:
				add(name, ls, m.Untyped.GetValue())
			}
			// Summaries are not used by either source: skipped, not guessed at.
		}
	}
	return out, nil
}

func withLE(ls map[string]string, le string) map[string]string {
	c := make(map[string]string, len(ls)+1)
	for k, v := range ls {
		c[k] = v
	}
	c["le"] = le
	return c
}
