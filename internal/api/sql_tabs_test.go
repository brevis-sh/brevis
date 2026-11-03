package api_test

import (
	"net/url"
	"strings"
	"testing"
)

// NO TAB STATE REACHES A URL.
//
// Console 2.0's rule, and the reason is unchanged: a statement in a link is
// a statement in a proxy log, in a browser's history and in a Referer
// header. Tabs are the obvious thing to put in a query string -- it is how
// every other editor shares one -- so the refusal is written down where a
// change to it fails.
func TestNoTabStateReachesAURL(t *testing.T) {
	_, ui := browsing(t)
	_, raw := get(t, ui, "/assets/sql.js")
	js := strip(raw)

	for _, forbidden := range []string{
		"pushState", "replaceState", "location.search", "location.hash", "URLSearchParams",
	} {
		if strings.Contains(js, forbidden) {
			t.Errorf("the island uses %s: tab state in an address bar is a statement in a history file", forbidden)
		}
	}

	_, body := get(t, ui, "/sql")
	if strings.Contains(body, `name="tab"`) {
		t.Error("the form carries a tab field, which a GET would put in the URL")
	}

	// AND THE SERVER IGNORES ONE ANYWAY.
	_, with := get(t, ui, "/sql?tab=2&target="+url.QueryEscape(probeTarget))
	if strings.Contains(with, `value="2"`) {
		t.Error("a tab index in the URL reached the page")
	}
}
