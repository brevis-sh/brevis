package api

import (
	"net/http"

	"brevis.sh/brevis/internal/auth"
	"brevis.sh/brevis/internal/branding"
	"brevis.sh/brevis/web/i18n"
)

// sessionView is who is looking and in which language: what changes from one
// person to the next, and so is never cached. What belongs to the installation
// is configView.
type sessionView struct {
	// Operator is empty when the installation has no credential: the console
	// is open, and the app shows no sign-out button, as the layout does.
	Operator string `json:"operator"`
	Lang     string `json:"lang"`
}

func (u *UI) session(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, sessionView{
		Operator: auth.De(r.Context()),
		Lang:     i18n.Negotiate(r),
	})
}

// configView is what the installation is, the same for everyone who opens it:
// its identity, the version it runs and which services it has. The app reads it
// once, before drawing anything.
type configView struct {
	Brand   brandView `json:"brand"`
	Version string    `json:"version"`
	// SQL says whether the SQL tabs exist at all, so the app does not draw a
	// link to a service this installation does not run.
	SQL bool `json:"sql"`
}

// brandView is the installation's identity. CSS is the theme the server
// already writes for the pages (branding.CSS): the app injects it as it is, so
// a client's colours have one source and no second reading of the same file.
type brandView struct {
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle"`
	Phrase      string `json:"phrase"`
	Logo        string `json:"logo"`
	Attribution string `json:"attribution"`
	CSS         string `json:"css"`
}

func (u *UI) config(w http.ResponseWriter, _ *http.Request) {
	logo := u.brand.Logo
	if logo == "" {
		logo = branding.DefaultLogo
	}
	// Fixed for the life of the process (the brand is read at start), so a
	// changed one arrives with the next deploy. no-cache: the app keeps it, but
	// asks again when it starts.
	w.Header().Set("Cache-Control", "no-cache")
	writeJSON(w, http.StatusOK, configView{
		Brand: brandView{
			Title:       u.brand.Title,
			Subtitle:    u.brand.Subtitle,
			Phrase:      u.brand.Phrase,
			Logo:        logo,
			Attribution: branding.Attribution,
			CSS:         u.brand.CSS(),
		},
		Version: u.version,
		SQL:     u.preview.Configured(),
	})
}
