package components

import (
	"context"
	"time"

	"brevis.sh/brevis/web/i18n"
)

// ---------------------------------------------------------------------------
// Formatadores compartilhados
// ---------------------------------------------------------------------------

// Duration picks the unit by order of magnitude. "0.4s" says more than "400ms" in
// a column whose neighbour takes minutes.
//
// ENGLISH, for the screens that call it without a context; i18n.Elapsed is
// the same in the page's language, and a screen moves to it when it is
// translated.
func Duration(d *time.Duration) string {
	if d == nil {
		return "—"
	}
	return i18n.Elapsed(context.Background(), *d)
}
