package api

import (
	"net/http"

	"brevis.sh/brevis/internal/auth"
	"brevis.sh/brevis/internal/branding"
	"brevis.sh/brevis/web/i18n"
)

// sessionView is what the React app needs before it can draw anything: who is
// looking, in which language, and what the console runs. It is the JSON twin
// of what base.templ reads from the request's context.
type sessionView struct {
	// Operator is empty when the installation has no credential: the console
	// is open, and the app shows no sign-out button, as the layout does.
	Operator string `json:"operator"`
	Lang     string `json:"lang"`
	Version  string `json:"version"`
	// SQL says whether the SQL tabs exist at all, so the app does not draw a
	// link to a service this installation does not run.
	SQL bool `json:"sql"`
}

func (u *UI) session(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, sessionView{
		Operator: auth.De(r.Context()),
		Lang:     i18n.Negotiate(r),
		Version:  u.version,
		SQL:      u.preview.Configured(),
	})
}

// brandingView is the installation's identity. CSS is the theme the server
// already writes for the pages (branding.CSS): the app injects it as it is, so
// a client's colours have one source and no second reading of the same file.
type brandingView struct {
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle"`
	Phrase      string `json:"phrase"`
	Logo        string `json:"logo"`
	Attribution string `json:"attribution"`
	CSS         string `json:"css"`
}

func (u *UI) branding(w http.ResponseWriter, _ *http.Request) {
	logo := u.brand.Logo
	if logo == "" {
		logo = branding.DefaultLogo
	}
	// Static for the life of the process (the brand is read at start): the
	// validator is cheap and a changed brand arrives with the next deploy.
	w.Header().Set("Cache-Control", "no-cache")
	writeJSON(w, http.StatusOK, brandingView{
		Title:       u.brand.Title,
		Subtitle:    u.brand.Subtitle,
		Phrase:      u.brand.Phrase,
		Logo:        logo,
		Attribution: branding.Attribution,
		CSS:         u.brand.CSS(),
	})
}
