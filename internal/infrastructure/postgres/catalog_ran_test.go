package postgres_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	dom "brevis.sh/brevis/internal/domain/run"
	"brevis.sh/brevis/internal/infrastructure/postgres"
)

// stepEnded is one recent run of slug in which `node` ended as status (with
// cause, for a skip) at `at`. attempt is the attempt the row belongs to.
func stepEnded(t *testing.T, pool *postgres.Pool, slug, node string, status dom.Status, cause string, at time.Time, mapIndex, attempt int) {
	t.Helper()
	id := aged(t, pool, slug, time.Hour, dom.StatusSuccess)
	if _, err := pool.Exec(context.Background(), `UPDATE runs SET created_at = $2 WHERE id = $1`, id, at); err != nil {
		t.Fatal(err)
	}
	taskRow(t, pool, id, node, status, cause, at, mapIndex, attempt)
}

func taskRow(t *testing.T, pool *postgres.Pool, run uuid.UUID, node string, status dom.Status, cause string, at time.Time, mapIndex, attempt int) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO task_runs (id, run_id, node_id, map_index, status, attempt, skip_cause, finished_at)
		VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), $8)`,
		uuid.New(), run, node, mapIndex, string(status), attempt, cause, at); err != nil {
		t.Fatal(err)
	}
}

func writerOfNode(t *testing.T, pool *postgres.Pool, target, node string) postgres.CatalogWriter {
	t.Helper()
	entries, err := postgres.NewReadRepo(pool).Catalog(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	for _, w := range entryFor(t, entries, target).Writers {
		if w.Node == node {
			return w
		}
	}
	t.Fatalf("no writer %q for %q", node, target)
	return postgres.CatalogWriter{}
}

// The real case: a cache-style table the step writes only when something is
// pending. The step ran every day and ended by its own decision; the last
// landing is from three days ago.
func TestAStepThatEndedWellKeepsItsTableFresh(t *testing.T) {
	pool := catalogDB(t)
	const target = "bigquery://zarv/bronze/vendors_wanted_zarvid_person_search"
	lastLanding := time.Date(2026, 11, 13, 9, 5, 0, 0, time.UTC)
	schedule(t, pool, "footprint_wanted_person", "0 9 * * *", "UTC", true)
	landAt(t, pool, "footprint_wanted_person", "fetch_person_search", target, lastLanding.Add(-5*time.Minute), 5*time.Minute, nil)

	// 14th: exit 0 with "skipped: nobody is pending" is a success row.
	stepEnded(t, pool, "footprint_wanted_person", "fetch_person_search", dom.StatusSuccess, "", time.Date(2026, 11, 14, 9, 0, 30, 0, time.UTC), -1, 0)
	// 16th: skipped by design (an empty unless_empty value).
	ranAt := time.Date(2026, 11, 16, 9, 0, 30, 0, time.UTC)
	stepEnded(t, pool, "footprint_wanted_person", "fetch_person_search", dom.StatusSkipped, "design", ranAt, -1, 0)

	w := writerOfNode(t, pool, target, "fetch_person_search")
	if !w.LastRan.Equal(ranAt) {
		t.Errorf("LastRan = %v, want %v", w.LastRan, ranAt)
	}
	if !w.LastLoaded.Equal(lastLanding) {
		t.Errorf("LastLoaded = %v, want %v: the page still says when it last landed", w.LastLoaded, lastLanding)
	}
}

// A step that never ran, or failed, keeps the table's own write as its only
// proof: nothing is counted.
func TestAStepThatNeverRanOrFailedCountsNothing(t *testing.T) {
	pool := catalogDB(t)
	const never, failed = "bigquery://zarv/bronze/never", "bigquery://zarv/bronze/failed"
	landing := time.Date(2026, 11, 13, 9, 5, 0, 0, time.UTC)
	schedule(t, pool, "wf_never", "0 9 * * *", "UTC", true)
	schedule(t, pool, "wf_failed", "0 9 * * *", "UTC", true)
	landAt(t, pool, "wf_never", "fetch", never, landing.Add(-5*time.Minute), 5*time.Minute, nil)
	landAt(t, pool, "wf_failed", "fetch", failed, landing.Add(-5*time.Minute), 5*time.Minute, nil)

	day := time.Date(2026, 11, 16, 9, 0, 30, 0, time.UTC)
	stepEnded(t, pool, "wf_failed", "fetch", dom.StatusFailed, "", day, -1, 0)

	for target, want := range map[string]string{never: "never ran", failed: "failed"} {
		if w := writerOfNode(t, pool, target, "fetch"); !w.LastRan.IsZero() {
			t.Errorf("a step that %s has LastRan = %v", want, w.LastRan)
		}
	}
}

// A step cut off because something it depends on failed did not keep its
// schedule, and a skip written before the cause existed is not trusted.
func TestAStepSkippedByAFailureOrBeforeTheCauseCountsNothing(t *testing.T) {
	pool := catalogDB(t)
	const upstream, legacy = "bigquery://zarv/bronze/upstream", "bigquery://zarv/bronze/legacy"
	landing := time.Date(2026, 11, 13, 9, 5, 0, 0, time.UTC)
	for _, slug := range []string{"wf_upstream", "wf_legacy"} {
		schedule(t, pool, slug, "0 9 * * *", "UTC", true)
	}
	landAt(t, pool, "wf_upstream", "fetch", upstream, landing.Add(-5*time.Minute), 5*time.Minute, nil)
	landAt(t, pool, "wf_legacy", "fetch", legacy, landing.Add(-5*time.Minute), 5*time.Minute, nil)

	day := time.Date(2026, 11, 16, 9, 0, 30, 0, time.UTC)
	stepEnded(t, pool, "wf_upstream", "fetch", dom.StatusSkipped, "upstream", day, -1, 0)
	stepEnded(t, pool, "wf_legacy", "fetch", dom.StatusSkipped, "", day, -1, 0)

	for _, target := range []string{upstream, legacy} {
		if w := writerOfNode(t, pool, target, "fetch"); !w.LastRan.IsZero() {
			t.Errorf("%s: LastRan = %v, want none", target, w.LastRan)
		}
	}
}

// One failed partition of a mapped step, or an attempt that failed before the
// retry succeeded: judged by the LAST attempt, and by every partition of it.
func TestAMappedStepCountsOnlyWhenEveryPartitionOfTheLastAttemptEndedWell(t *testing.T) {
	pool := catalogDB(t)
	const partial, retried = "bigquery://zarv/bronze/partial", "bigquery://zarv/bronze/retried"
	landing := time.Date(2026, 11, 13, 9, 5, 0, 0, time.UTC)
	for _, slug := range []string{"wf_partial", "wf_retried"} {
		schedule(t, pool, slug, "0 9 * * *", "UTC", true)
	}
	landAt(t, pool, "wf_partial", "fetch", partial, landing.Add(-5*time.Minute), 5*time.Minute, nil)
	landAt(t, pool, "wf_retried", "fetch", retried, landing.Add(-5*time.Minute), 5*time.Minute, nil)

	day := time.Date(2026, 11, 16, 9, 0, 30, 0, time.UTC)
	p := aged(t, pool, "wf_partial", time.Hour, dom.StatusFailed)
	taskRow(t, pool, p, "fetch", dom.StatusSuccess, "", day, 0, 0)
	taskRow(t, pool, p, "fetch", dom.StatusFailed, "", day, 1, 0)
	r := aged(t, pool, "wf_retried", time.Hour, dom.StatusSuccess)
	taskRow(t, pool, r, "fetch", dom.StatusFailed, "", day.Add(-10*time.Minute), -1, 0)
	taskRow(t, pool, r, "fetch", dom.StatusSuccess, "", day, -1, 1)

	if w := writerOfNode(t, pool, partial, "fetch"); !w.LastRan.IsZero() {
		t.Errorf("a partly failed mapped step counted: %v", w.LastRan)
	}
	if w := writerOfNode(t, pool, retried, "fetch"); !w.LastRan.Equal(day) {
		t.Errorf("a step that succeeded on its retry: LastRan = %v, want %v", w.LastRan, day)
	}
}

// MaxGap is the longest stretch between two landings: what quiet has meant for
// this table so far. One landing has no gap.
func TestTheCatalogReadsTheLongestGapBetweenLandings(t *testing.T) {
	pool := catalogDB(t)
	const gappy, single = "bigquery://zarv/bronze/gappy", "bigquery://zarv/bronze/single"
	schedule(t, pool, "wf_gappy", "0 9 * * *", "UTC", true)
	schedule(t, pool, "wf_single", "0 9 * * *", "UTC", true)
	day := time.Date(2026, 10, 1, 9, 0, 0, 0, time.UTC)
	for _, d := range []int{0, 1, 2, 9, 10, 12} { // the longest silence is seven days
		landAt(t, pool, "wf_gappy", "fetch", gappy, day.AddDate(0, 0, d), time.Minute, nil)
	}
	landAt(t, pool, "wf_single", "fetch", single, day, time.Minute, nil)

	if got := writerOfNode(t, pool, gappy, "fetch").MaxGap; got != 7*24*time.Hour {
		t.Errorf("MaxGap = %v, want 168h", got)
	}
	if got := writerOfNode(t, pool, single, "fetch").MaxGap; got != 0 {
		t.Errorf("a table with one landing has MaxGap = %v, want 0", got)
	}
	if g, s := writerOfNode(t, pool, gappy, "fetch").LandedRuns, writerOfNode(t, pool, single, "fetch").LandedRuns; g != 6 || s != 1 {
		t.Errorf("LandedRuns = %d and %d, want 6 and 1", g, s)
	}
}
