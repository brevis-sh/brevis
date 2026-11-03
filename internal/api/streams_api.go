package api

import (
	"net/http"

	"brevis.sh/brevis/internal/infrastructure/postgres"
	"brevis.sh/brevis/web/pages"
)

// streamEntries is the catalog with every stream's configuration attached.
func (u *UI) streamEntries(r *http.Request) ([]postgres.CatalogEntry, error) {
	if u.catalog == nil {
		return nil, nil
	}
	entries, err := u.catalog.Catalog(r.Context())
	if err != nil {
		return nil, err
	}
	configs, err := u.catalog.StreamConfigs(r.Context())
	if err != nil {
		return nil, err
	}
	pages.AttachStreamConfigs(entries, configs)
	return entries, nil
}

// streamsAPI is the Streams list under the page's filter (kind, q).
func (u *UI) streamsAPI(w http.ResponseWriter, r *http.Request) {
	entries, err := u.streamEntries(r)
	if err != nil {
		u.ingestFail(w, "the streams", err)
		return
	}
	v := pages.BuildStreams(entries, pages.ParseStreamFilter(r.URL.Query()))
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, pages.StreamsAsJSON(ingestCtx(r), v))
}
