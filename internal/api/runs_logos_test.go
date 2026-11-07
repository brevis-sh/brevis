package api

import (
	"slices"
	"testing"

	wf "brevis.sh/brevis/internal/domain/workflow"
)

func TestRunsInDetectsHostAndTags(t *testing.T) {
	t.Run("step with host go and compiled binary", func(t *testing.T) {
		def := wf.Workflow{
			Slug: "citizen_push_alerts",
			Nodes: []wf.Node{
				{
					ID:   "push",
					Host: "go",
					Run:  "/usr/local/bin/push_citizen --dataset alerts --hours 24",
				},
			},
		}
		got := runsIn(def, 0)
		if !slices.Equal(got, []string{"go"}) {
			t.Errorf("runsIn = %v, want [go]", got)
		}
	})

	t.Run("steps with host go and host dbt", func(t *testing.T) {
		def := wf.Workflow{
			Slug: "vendors_alert_cemaden",
			Nodes: []wf.Node{
				{
					ID:   "fetch",
					Host: "go",
					Run:  "/usr/local/bin/fetch_cemaden",
				},
				{
					ID:   "transform",
					Host: "dbt",
					Run:  "dbt-step run --select cemaden",
				},
			},
		}
		got := runsIn(def, 0)
		if !slices.Equal(got, []string{"go", "dbt"}) {
			t.Errorf("runsIn = %v, want [go dbt]", got)
		}
	})

	t.Run("fallback to workflow tags when steps cannot be detected", func(t *testing.T) {
		def := wf.Workflow{
			Slug: "tagged_workflow",
			Tags: []string{"zarv", "environment", "citizen", "go"},
			Nodes: []wf.Node{
				{
					ID:  "step",
					Run: "/opt/bin/opaque_binary",
				},
			},
		}
		got := runsIn(def, 0)
		if !slices.Equal(got, []string{"go"}) {
			t.Errorf("runsIn = %v, want [go]", got)
		}
	})

	t.Run("max limits the returned logos", func(t *testing.T) {
		def := wf.Workflow{
			Slug: "multi_step",
			Nodes: []wf.Node{
				{ID: "s1", Host: "go"},
				{ID: "s2", Host: "python"},
				{ID: "s3", Host: "dbt"},
			},
		}
		got := runsIn(def, 2)
		if len(got) != 2 || !slices.Equal(got, []string{"go", "python"}) {
			t.Errorf("runsIn = %v, want [go python]", got)
		}
	})
}
