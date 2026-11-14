package scheduler

// SetMaxBackfillSlots lets a test hit the cap with a handful of slots; it returns the undo.
func SetMaxBackfillSlots(n int) (restore func()) {
	old := maxBackfillSlots
	maxBackfillSlots = n
	return func() { maxBackfillSlots = old }
}
