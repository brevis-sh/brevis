package spa_test

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"brevis.sh/brevis/web/spa"
)

func get(t *testing.T, target string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	spa.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodGet, target, nil))
	return w
}

// THE SHELL ANSWERS THE APP'S ROUTES: the root and any client-side route
// (which the server has never heard of) are index.html, revalidated by digest.
func TestRoutesAreTheShell(t *testing.T) {
	for _, target := range []string{"/app/", "/app/runs/0d0e88ab"} {
		w := get(t, target)
		if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `id="root"`) {
			t.Errorf("%s: %d, want the shell", target, w.Code)
		}
		if w.Header().Get("ETag") == "" || w.Header().Get("Cache-Control") != "no-cache" {
			t.Errorf("%s: the shell needs a validator and no-cache, got %q / %q", target, w.Header().Get("ETag"), w.Header().Get("Cache-Control"))
		}
	}
}

// EVERYTHING THE SHELL ASKS FOR IS SERVED, and cached for good: it is named by
// its hash. The same walk assets_test does for the server-rendered pages.
func TestWhatTheShellReferencesIsServed(t *testing.T) {
	refs := regexp.MustCompile(`(?:src|href)="(/app/assets/[^"]+)"`).FindAllStringSubmatch(get(t, "/app/").Body.String(), -1)
	if len(refs) == 0 {
		t.Fatal("the shell references no asset: is dist/ built?")
	}
	for _, m := range refs {
		w := get(t, m[1])
		if w.Code != http.StatusOK || !strings.Contains(w.Header().Get("Cache-Control"), "immutable") {
			t.Errorf("%s: %d, cache %q; want 200 and immutable", m[1], w.Code, w.Header().Get("Cache-Control"))
		}
	}
}

// A MISSING FILE IS A 404, NOT THE SHELL: a stale hashed asset answered with
// HTML would be a script that fails to parse.
func TestAMissingFileIsNotTheShell(t *testing.T) {
	if w := get(t, "/app/assets/index-gone.js"); w.Code != http.StatusNotFound {
		t.Errorf("a missing asset: %d, want 404", w.Code)
	}
}
