package api_test

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"brevis.sh/brevis/internal/api"
	"brevis.sh/brevis/internal/auth"
	"brevis.sh/brevis/internal/branding"
	"brevis.sh/brevis/web/i18n"
)

func sessionUI(brand branding.Brand) *api.UI {
	return api.NewUI(nil, nil, nil, nil, nil, catalogFake{}, brand, slog.New(slog.DiscardHandler)).
		WithVersion("1.2.3", nil)
}

func getJSON(t *testing.T, ui *api.UI, target string, req func(*http.Request)) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	mux := http.NewServeMux()
	ui.Registrar(mux)
	r := httptest.NewRequest(http.MethodGet, target, nil)
	if req != nil {
		req(r)
	}
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, r)
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("%s is not JSON: %v\n%s", target, err, rec.Body.String())
	}
	return rec, body
}

// THE APP ASKS WHO IS LOOKING before it draws a thing: the operator the Gate
// put in the context, the language the cookie chose, the version it runs.
func TestTheSessionNamesTheOperatorLanguageAndVersion(t *testing.T) {
	rec, body := getJSON(t, sessionUI(branding.Default()), "/api/session", func(r *http.Request) {
		*r = *r.WithContext(auth.IntoContext(context.Background(), "ana"))
		r.AddCookie(&http.Cookie{Name: i18n.Cookie, Value: "pt-BR"})
	})
	if rec.Code != http.StatusOK || rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("%d, cache %q; a session is never cached", rec.Code, rec.Header().Get("Cache-Control"))
	}
	if body["operator"] != "ana" || body["version"] != "1.2.3" || body["lang"] != "pt-BR" {
		t.Errorf("session = %v", body)
	}
}

// AN OPEN CONSOLE has no operator: the field is empty, not absent, so the app
// reads one shape.
func TestAnOpenConsoleHasAnEmptyOperator(t *testing.T) {
	_, body := getJSON(t, sessionUI(branding.Default()), "/api/session", nil)
	if op, ok := body["operator"]; !ok || op != "" {
		t.Errorf("operator = %v (present %v); want an empty string", op, ok)
	}
}

// THE BRAND IS ONE SOURCE: the logo falls back to the embedded mark, and the
// theme is the very CSS the pages inject.
func TestTheBrandingCarriesTheLogoAndTheServersTheme(t *testing.T) {
	brand := branding.Default()
	brand.Title = "Acme Ops"
	brand.Theme.Accent = "#ff6600"
	rec, body := getJSON(t, sessionUI(brand), "/api/branding", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	if body["title"] != "Acme Ops" || body["logo"] != branding.DefaultLogo || body["attribution"] != branding.Attribution {
		t.Errorf("branding = %v", body)
	}
	if body["css"] != brand.CSS() || body["css"] == "" {
		t.Errorf("css = %q; want the pages' theme %q", body["css"], brand.CSS())
	}
}
