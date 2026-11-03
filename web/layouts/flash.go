package layouts

import (
	"net/http"
	"net/url"
)

// FlashCookie carries one sentence from a POST to the page after it.
//
// A POST that changes something answers with a redirect, and a redirect's
// body is never seen -- so "orders paused" travels in a cookie that the next
// page draws as a toast, in the HTML, and clears. No script is needed to see
// it, and a reload does not say it twice.
const FlashCookie = "brevis_flash"

// linkSep separates a flash's text from its link.
const linkSep = "\x1f"

// Flash is what the next page says.
type Flash struct {
	Kind    string // ok, fail or run
	Message string
	// Action and Href are the toast's link -- "Follow" to the run a POST
	// made. Both or neither.
	Action, Href string
}

// SetFlashLink is SetFlash with a link in the toast. href is the server's
// own path, never the reader's input.
func SetFlashLink(w http.ResponseWriter, kind, message, action, href string) {
	v := flashKind(kind) + "|" + message
	if action != "" && href != "" {
		// The unit separator: a message can carry "|", and the link must not
		// be read out of one.
		v += linkSep + action + linkSep + href
	}
	http.SetCookie(w, &http.Cookie{
		Name: FlashCookie, Value: url.QueryEscape(v),
		Path: "/", MaxAge: 60, HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
}

func flashKind(k string) string {
	switch k {
	case "fail", "run":
		return k
	}
	return "ok"
}
