package api_test

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"brevis.sh/brevis/internal/api"
	"brevis.sh/brevis/internal/branding"
	dom "brevis.sh/brevis/internal/domain/run"
	wf "brevis.sh/brevis/internal/domain/workflow"
	"brevis.sh/brevis/internal/infrastructure/postgres"
)

// failingList answers the failing workflows, as RunRepo would.
type failingList struct{ list []postgres.FailingWorkflow }

func (f failingList) FailingWorkflows(context.Context) ([]postgres.FailingWorkflow, error) {
	return f.list, nil
}
func (f failingList) FailureStreak(context.Context, string) (int, error) { return 0, nil }

// attentionExecs answers each failed run and its logs, and counts the logs
// read.
type attentionExecs struct {
	execsFake
	runs  map[uuid.UUID]dom.Run
	logs  map[uuid.UUID][]postgres.StepLog
	reads *int
}

func (e attentionExecs) Get(_ context.Context, id uuid.UUID) (dom.Run, error) {
	if r, ok := e.runs[id]; ok {
		return r, nil
	}
	return dom.Run{}, pgx.ErrNoRows
}
func (e attentionExecs) LogsDaRun(_ context.Context, id uuid.UUID) ([]postgres.StepLog, error) {
	*e.reads++
	return e.logs[id], nil
}

type failed struct {
	slug   string
	ago    time.Duration
	streak int
	log    string
	params map[string]string
}

func attentionUI(t *testing.T, fs ...failed) (*api.UI, *int) {
	t.Helper()
	return attentionUIWith(t, nil, fs...)
}

// attentionUIWith also has runs in flight; the workflow every failure belongs
// to declares one param, `region`.
func attentionUIWith(t *testing.T, inFlight []postgres.RunSummary, fs ...failed) (*api.UI, *int) {
	t.Helper()
	reads := 0
	e := attentionExecs{runs: map[uuid.UUID]dom.Run{}, logs: map[uuid.UUID][]postgres.StepLog{}, reads: &reads}
	var list []postgres.FailingWorkflow
	for _, f := range fs {
		id := uuid.New()
		list = append(list, postgres.FailingWorkflow{Slug: f.slug, RunID: id, FailedAt: time.Now().Add(-f.ago), Streak: f.streak})
		e.runs[id] = dom.Run{ID: id, WorkflowSlug: f.slug, Status: dom.StatusFailed, Params: f.params}
		code := 1
		e.logs[id] = []postgres.StepLog{{NodeID: "test", MapIndex: dom.Unmapped, Status: "failed", ExitCode: &code, Log: f.log}}
	}
	def := defsFake{w: wf.Workflow{Params: []wf.Param{{Name: "region", Type: wf.ParamString}}}}
	ui := api.NewUI(overviewReads{inFlight: inFlight, asked: &struct {
		span  time.Duration
		grain postgres.Grain
		n     int
	}{}}, def, e, &triggerSpy{}, nil, nil, branding.Default(), slog.New(slog.DiscardHandler)).WithFailing(failingList{list})
	return ui, &reads
}

func postTrigger(t *testing.T, ui *api.UI, slug string, form url.Values) *httptest.ResponseRecorder {
	t.Helper()
	mux := http.NewServeMux()
	ui.Registrar(mux)
	r := httptest.NewRequest(http.MethodPost, "/workflows/"+slug+"/trigger", strings.NewReader(form.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, r)
	return rec
}

// RERUN FROM THE OVERVIEW COMES BACK TO IT, saying the run was made and
// where to follow it -- the page the reader is watching is the list.
func TestARerunFromTheOverviewComesBack(t *testing.T) {
	spy := &triggerSpy{}
	ui := api.NewUI(nil, nil, nil, spy, nil, nil, branding.Default(), slog.New(slog.DiscardHandler))
	rec := postTrigger(t, ui, "daily", url.Values{"back": {"/"}, "param.region": {"br"}})
	if rec.Code != http.StatusSeeOther || rec.Header().Get("Location") != "/" {
		t.Fatalf("answered %d to %q; wanted 303 to /", rec.Code, rec.Header().Get("Location"))
	}
	cookie, _ := url.QueryUnescape(rec.Header().Get("Set-Cookie"))
	if !strings.Contains(cookie, "Rerun of daily created") || !regexp.MustCompile(`/runs/[0-9a-f-]{36}`).MatchString(cookie) {
		t.Errorf("the flash does not say it, with the run: %s", cookie)
	}
	if spy.got["region"] != "br" {
		t.Errorf("the rerun lost its values: %v", spy.got)
	}
}

// Only a path on this site: back is the reader's to send, and a redirect
// anywhere is a phishing link with this console's name on it.
func TestABackOffThisSiteIsIgnored(t *testing.T) {
	for _, back := range []string{"//evil.example", "https://evil.example/", `/\evil.example`, "javascript:alert(1)", "runs"} {
		ui := api.NewUI(nil, nil, nil, &triggerSpy{}, nil, nil, branding.Default(), slog.New(slog.DiscardHandler))
		rec := postTrigger(t, ui, "daily", url.Values{"back": {back}})
		if loc := rec.Header().Get("Location"); !strings.HasPrefix(loc, "/runs/") {
			t.Errorf("back %q sent the reader to %q", back, loc)
		}
	}
}
