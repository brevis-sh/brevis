// Package spa serves the React app (web/spa/src) from the binary.
//
// dist/ is the Vite build, committed like web/assets/app.css: the image needs
// no Node, and //go:embed fails the Go build if dist/ is missing, not
// production with a blank page. `make generate` rebuilds it.
package spa

import (
	"bytes"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"io/fs"
	"net/http"
	"path"
	"strings"
	"time"
)

//go:embed dist
var dist embed.FS

// Prefix is where the app is mounted. vite.config.ts writes the same one into
// every URL of the build (`base`).
const Prefix = "/app/"

// Handler serves dist/ under Prefix.
//
// A path naming a file is that file or a 404. Only a path WITHOUT an
// extension is a client route and gets index.html: answering a missing
// /app/assets/x.js with the HTML shell would turn a stale asset into a script
// that fails to parse, which reads as a bug in the page and not in the cache.
//
// Vite names everything under assets/ by its content hash, so those are cached
// for a year; index.html is the one file whose name never changes and is
// revalidated by digest.
func Handler() http.Handler {
	root, _ := fs.Sub(dist, "dist")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, Prefix)
		if name != "" && path.Ext(name) != "" {
			b, err := fs.ReadFile(root, name)
			if err != nil {
				http.NotFound(w, r)
				return
			}
			if strings.HasPrefix(name, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-cache")
			}
			http.ServeContent(w, r, path.Base(name), time.Time{}, bytes.NewReader(b))
			return
		}
		b, err := fs.ReadFile(root, "index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		sum := sha256.Sum256(b)
		w.Header().Set("ETag", `"`+hex.EncodeToString(sum[:16])+`"`)
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(b))
	})
}
