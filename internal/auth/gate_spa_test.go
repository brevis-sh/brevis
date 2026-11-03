package auth_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"brevis.sh/brevis/internal/auth"
)

func spaGate(t *testing.T) (*auth.Gate, *[]string) {
	t.Helper()
	var arrived []string
	return &auth.Gate{
		Cred: credential(t, "operador", "senha-de-teste-longa"),
		Next: http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { arrived = append(arrived, r.URL.Path) }),
	}, &arrived
}

// Exactly what the React login screen needs is public, and a near miss of each
// path is not.
func TestOnlyTheLoginScreensPathsAreOpenWithNoSession(t *testing.T) {
	gate, arrived := spaGate(t)
	open := map[string]string{
		"/app/login": "GET", "/app/assets/index-abc.js": "GET", "/app/assets/x/y.css": "GET",
		"/api/config": "GET", "/api/messages": "GET", "/api/login": "POST", "/api/logout": "POST",
	}
	for p, m := range open {
		gate.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(m, p, nil))
	}
	if len(*arrived) != len(open) {
		t.Errorf("%v got through; expected %d open paths", *arrived, len(open))
	}

	*arrived = nil
	for _, p := range []string{
		"/app/", "/app", "/app/runs", "/app/login/x", "/app/loginx", "/app/assets", "/app/index.html", "/app/../api/session",
		"/api/session", "/api/loginx", "/api/config/x", "/api/projects", "/api/release", "/api/runs/1/graph",
	} {
		rec := httptest.NewRecorder()
		gate.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		if rec.Code != http.StatusSeeOther && rec.Code != http.StatusUnauthorized {
			t.Errorf("GET %s = %d with no session", p, rec.Code)
		}
	}
	if len(*arrived) != 0 {
		t.Errorf("gated paths reached the handler: %v", *arrived)
	}
}

func TestAnAPIRequestWithNoSessionIs401JSONForEveryMethod(t *testing.T) {
	gate, arrived := spaGate(t)
	for _, m := range []string{"GET", "POST", "PUT", "DELETE"} {
		rec := httptest.NewRecorder()
		gate.ServeHTTP(rec, httptest.NewRequest(m, "/api/session", nil))
		if rec.Code != 401 || strings.TrimSpace(rec.Body.String()) != `{"error":"sign in"}` ||
			!strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json") || rec.Header().Get("Location") != "" {
			t.Errorf("%s: %d %q %v", m, rec.Code, rec.Body, rec.Header())
		}
	}
	if len(*arrived) != 0 {
		t.Error("reached the handler")
	}
}

func TestAnAppPageWithNoSessionGoesToTheAppLoginAndOtherPagesToTheOldOne(t *testing.T) {
	gate, _ := spaGate(t)
	for p, want := range map[string]string{
		"/app/runs?state=failed": "/app/login?next=%2Fapp%2Fruns%3Fstate%3Dfailed",
		"/app/":                  "/app/login?next=%2Fapp%2F",
		"/app":                   "/app/login?next=%2Fapp",
		"/runs?page=2":           "/login?next=%2Fruns%3Fpage%3D2",
	} {
		rec := httptest.NewRecorder()
		gate.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		if rec.Code != http.StatusSeeOther || rec.Header().Get("Location") != want {
			t.Errorf("GET %s = %d -> %q, want 303 -> %q", p, rec.Code, rec.Header().Get("Location"), want)
		}
	}
	// A non-API POST keeps the plain 401.
	rec := httptest.NewRecorder()
	gate.ServeHTTP(rec, httptest.NewRequest("POST", "/workflows/x/trigger", nil))
	if rec.Code != 401 || !strings.Contains(rec.Body.String(), "session expired") {
		t.Errorf("POST = %d %q", rec.Code, rec.Body)
	}
}

func TestAValidSessionStillReachesAnAPIPath(t *testing.T) {
	cred := credential(t, "operador", "senha-de-teste-longa")
	var user string
	gate := &auth.Gate{Cred: cred, Insecure: true, Next: http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { user = auth.De(r.Context()) })}
	rec := httptest.NewRecorder()
	if !gate.SignIn(rec, "operador", "senha-de-teste-longa") {
		t.Fatal("sign-in refused")
	}
	req := httptest.NewRequest("GET", "/api/session", nil)
	req.AddCookie(rec.Result().Cookies()[0])
	gate.ServeHTTP(httptest.NewRecorder(), req)
	if user != "operador" {
		t.Errorf("user = %q", user)
	}
}
