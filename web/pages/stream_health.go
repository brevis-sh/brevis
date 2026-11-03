package pages

// A stream's health, as far as the console can truthfully say it.
//
// WHAT THE ENGINE HOLDS: a stream's published CONFIGURATION (gateway_streams,
// gateway_destinations, the config history) and nothing about its traffic. The
// gateway shares no database or call with the engine (docs/GATEWAY.md): it
// writes no landings, reports no counts, and its dead letter is files or a
// bucket the console never reads. Accepted, rejected, delivered and buried
// records live on the gateway's /metrics, by decision, because a console
// number a minute old is worse than the dashboard.
//
// So there is NO honest "healthy", "degraded" or "failing" for a gateway
// stream today, and this file does not invent one: the catalog's "continuous"
// is a statement about HOW the stream writes (as events arrive), not about
// whether it is working, and landings on the same destination from workflow
// steps say how THOSE steps are doing, which the catalog itself refuses to
// read as the stream's (a gateway counts as a writer that is always
// arriving). What can be said truthfully is whether the console is able to
// know anything, and why not.

// HealthUnknown is the only state the console can honestly report for a
// gateway stream until the gateway reports its traffic.
const HealthUnknown = "unknown"

// The reasons a stream's health is unknown. They are machine keys; the app
// writes the sentence in the reader's language.
const (
	// ReasonNotReported: the stream's destination is known, but its traffic
	// is only on the gateway's /metrics.
	ReasonNotReported = "not_reported"

	// ReasonDestinationUnnamed: the manifest could not name where the stream
	// lands, so there is not even a destination to look at.
	ReasonDestinationUnnamed = "destination_unnamed"
)

// StreamHealth is a stream's state and the stable key of its reason.
type StreamHealth struct {
	State  string `json:"state"`
	Reason string `json:"reason"`
}

// Health is what the console can say about the stream (see the file comment).
func (s Stream) Health() StreamHealth {
	if s.Sink.URI == "" {
		return StreamHealth{State: HealthUnknown, Reason: ReasonDestinationUnnamed}
	}
	return StreamHealth{State: HealthUnknown, Reason: ReasonNotReported}
}
