package pages

import (
	"testing"
	"time"

	"brevis.sh/brevis/internal/domain/catalog"
	"brevis.sh/brevis/internal/infrastructure/postgres"
)

// footprint_wanted_person on 2026-11-16: a daily 09:00 UTC workflow whose
// fetchers ran and stood down ("skipped: nobody is pending"), so the tables
// they feed were last written on the 13th. The tables are caches the fetchers
// read, so the monitor must follow the run.
func TestAScheduleThatRanButWroteNothingIsNotStale(t *testing.T) {
	now := time.Date(2026, 11, 16, 10, 0, 0, 0, time.UTC)
	entry := postgres.CatalogEntry{Target: "bigquery://zarv/bronze/vendors_wanted_zarvid_person_search"}
	w := postgres.CatalogWriter{
		Workflow: "footprint_wanted_person", Node: "fetch_person_search",
		LastLoaded:  time.Date(2026, 11, 13, 9, 5, 0, 0, time.UTC),
		HasSchedule: true, Cron: "0 9 * * *", Timezone: "UTC", Active: true,
	}

	if got := verdictOf(entry, w, now).Status; got != catalog.Stale {
		t.Fatalf("with no run recorded the table is %q, want the old verdict (stale)", got)
	}
	w.LastRan = time.Date(2026, 11, 16, 9, 0, 30, 0, time.UTC)
	if got := verdictOf(entry, w, now).Status; got != catalog.OnTime {
		t.Errorf("a step that ended well at 09:00 on the 16th leaves the table %q, want on time", got)
	}
	// Both the 14th's and 15th's slots are covered by the later run, and a run
	// of the 17th is the next thing expected.
	if got := verdictOf(entry, w, time.Date(2026, 11, 17, 9, 30, 0, 0, time.UTC)).Status; got != catalog.Late {
		t.Errorf("the 17th's slot missed by half an hour is %q, want late", got)
	}
}

// The same schedule, but the last landing is fifteen days old and the table has
// never been quiet that long: running well is not enough, the data stopped.
func TestAScheduleThatRunsButHasWrittenNothingForTooLongIsStale(t *testing.T) {
	now := time.Date(2026, 11, 16, 10, 0, 0, 0, time.UTC)
	entry := postgres.CatalogEntry{Target: "bigquery://zarv/bronze/vendors_wanted_googlemaps_geocode"}
	w := postgres.CatalogWriter{
		Workflow: "footprint_wanted_person", Node: "fetch_geocoding",
		LastLoaded: time.Date(2026, 11, 1, 9, 5, 0, 0, time.UTC), LastRan: time.Date(2026, 11, 16, 9, 0, 30, 0, time.UTC),
		MaxGap:      2 * 24 * time.Hour,
		HasSchedule: true, Cron: "0 9 * * *", Timezone: "UTC", Active: true,
	}
	if v := verdictOf(entry, w, now); v.Status != catalog.Stale || !v.NoData || !v.Missed.Equal(w.LastLoaded) {
		t.Errorf("fifteen days without data, longest known gap two: %+v, want stale since the last landing", v)
	}
	w.MaxGap = 10 * 24 * time.Hour
	if got := verdictOf(entry, w, now).Status; got != catalog.OnTime {
		t.Errorf("a table that has been quiet for ten days before: %q, want on time", got)
	}
}
