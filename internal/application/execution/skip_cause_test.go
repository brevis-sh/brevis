package execution_test

import (
	"testing"

	dom "brevis.sh/brevis/internal/domain/run"
	wf "brevis.sh/brevis/internal/domain/workflow"
)

// The catalog's freshness reads the cause: a step that stood down because there
// was nothing to do kept its schedule, a step cut off by a failure did not.

// A step below a failed one was skipped UPSTREAM, and so is the step below it.
func TestAStepSkippedByAFailureIsSkippedUpstream(t *testing.T) {
	_, spy, err := flow(t, branching(wf.WhenAnyFailed), "extract")
	if err == nil {
		t.Fatal("the run should have failed")
	}
	for _, node := range []string{"transform", "report"} {
		if got := spy.skipCauses()[node]; got != dom.SkippedUpstream {
			t.Errorf("%s cause = %q, want %q", node, got, dom.SkippedUpstream)
		}
	}
}

// A failure handler that nothing triggered stood down by design, and so did the
// step below it, which only saw a dependency skipped by design.
func TestAStepThatStoodDownByDesignIsSkippedByDesign(t *testing.T) {
	w := wf.Workflow{
		Slug: "w",
		Nodes: []wf.Node{
			{ID: "extract"}, {ID: "handler", When: wf.WhenAnyFailed}, {ID: "after"},
		},
		Edges: []wf.Edge{{From: "extract", To: "handler"}, {From: "handler", To: "after"}},
	}
	_, spy, err := flow(t, w)
	if err != nil {
		t.Fatal(err)
	}
	for _, node := range []string{"handler", "after"} {
		if got := spy.skipCauses()[node]; got != dom.SkippedByDesign {
			t.Errorf("%s cause = %q, want %q", node, got, dom.SkippedByDesign)
		}
	}
}
