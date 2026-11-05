package pages

import (
	"context"
	"encoding/json"
	"testing"
)

// A BATCH IS A SENTENCE FOR THE APP TO SAY: every, up to, or both. The server
// sends the key and the declared values, never the words.
func TestAStreamsBatchNamesItsSentence(t *testing.T) {
	for i, want := range []string{
		`{"k":"streams.batch.both","a":{"every":{"k":"summary.unit.minute","n":2},"records":{"$":"num","v":2000}}}`,
		`{"k":"summary.unit.second","n":30}`,
		`{"k":"streams.batch.records","a":{"records":{"$":"num","v":500}}}`,
	} {
		s := []Stream{
			{Config: sourceConfig(field("buffer.flush.every", "2m"), field("buffer.flush.records", 2000.0))},
			{Config: sourceConfig(field("buffer.flush.every", "30s"))},
			{Config: sourceConfig(field("buffer.flush.records", 500.0))},
		}[i]
		if raw, err := json.Marshal(s.Batch()); err != nil || string(raw) != want {
			t.Errorf("batch %d = %s (%v), want %s", i, raw, err, want)
		}
	}
	if got := (Stream{}).Batch(); got != nil {
		t.Errorf("no buffer declared says %v", got)
	}
	// What is not one whole unit stays as written.
	if got := DurationMsg("1500us"); got != "1500us" {
		t.Errorf("1500us is %v", got)
	}
}

// THE COMPACT BATCH is the declared values, not words: the app writes "2m · 2,000" from them in any language.
func TestAStreamRowCarriesTheDeclaredBatch(t *testing.T) {
	ctx := context.Background()
	row := streamRowJSON(ctx, Stream{Config: sourceConfig(field("buffer.flush.every", "2m"), field("buffer.flush.records", 2000.0))}, StreamHealth{})
	if row.BatchEvery != "2m" || row.BatchRecords == nil || *row.BatchRecords != 2000 {
		t.Errorf("batch = %q, %v", row.BatchEvery, row.BatchRecords)
	}
	if none := streamRowJSON(ctx, Stream{}, StreamHealth{}); none.BatchEvery != "" || none.BatchRecords != nil {
		t.Error("no buffer declared says a batch")
	}
}
