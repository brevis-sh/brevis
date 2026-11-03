package api_test

import (
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"brevis.sh/brevis/internal/api"
	"brevis.sh/brevis/internal/branding"
	wf "brevis.sh/brevis/internal/domain/workflow"
)

// loadsRunUI is loadCatalog's console with the workflows' definitions --
// daily_sales takes no parameters, multi takes one -- and a scheduler that
// keeps what it was asked.
func loadsRunUI(spy *triggerSpy) *api.UI {
	one, every := 0, 0
	defs := mapDefs{one: &one, every: &every, defs: map[string]wf.Workflow{
		"daily_sales": {Slug: "daily_sales", Nodes: []wf.Node{{ID: "report", Run: "echo"}}},
		"multi":       {Slug: "multi", Params: []wf.Param{{Name: "full", Type: wf.ParamBool, Default: "false"}}, Nodes: []wf.Node{{ID: "split", Run: "echo"}}},
	}}
	cat := loadCatalog()
	cat.detail.CatalogEntry = cat.entries[0]
	return api.NewUI(nil, defs, nil, spy, nil, cat, branding.Default(), slog.New(slog.DiscardHandler))
}

// AND THE RUN COMES BACK TO THE DRAWER, saying it was made and where to
// follow it.
func TestARunFromALoadComesBackToIt(t *testing.T) {
	spy := &triggerSpy{}
	back := "/ingest/loads/daily_sales/report?status=late"
	rec := postTrigger(t, loadsRunUI(spy), "daily_sales", url.Values{"back": {back}})
	if !spy.called || rec.Code != http.StatusSeeOther || rec.Header().Get("Location") != back {
		t.Fatalf("the run answered %d to %q (called %v)", rec.Code, rec.Header().Get("Location"), spy.called)
	}
	cookie := rec.Header().Get("Set-Cookie")
	if !strings.Contains(cookie, "brevis_flash") || !strings.Contains(cookie, "Run") || strings.Contains(cookie, "Rerun") {
		t.Errorf("coming back does not say a run -- not a rerun -- was made: %s", cookie)
	}
}
