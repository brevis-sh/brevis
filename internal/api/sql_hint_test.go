package api_test

import (
	"strings"
	"testing"
)

// AND THE LIST IS READABLE ON THIS PALETTE.
//
// show-hint ships `background:#fff` and `color:#000`. The console is dark --
// `--color-parchment` is `#141711` -- so the vendored default is a white box
// in the middle of a dark editor, and its selected row is a blue nobody here
// chose. A rule written and a rule SHIPPED are different facts, so this reads
// the sheet that is served.
func TestTheCompletionListIsDrawnInThisPalette(t *testing.T) {
	_, ui := browsing(t)
	_, css := get(t, ui, "/assets/app.css")

	for _, want := range []string{".CodeMirror-hints", ".CodeMirror-hint"} {
		if !strings.Contains(css, want) {
			t.Errorf("the served sheet never mentions %s: the completion list keeps the vendor's white box", want)
		}
	}
}
