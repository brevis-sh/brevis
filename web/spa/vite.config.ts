import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The SPA is served by the Go binary under /app/ (web/spa/spa.go embeds dist/),
// so every URL the build writes starts there.
export default defineConfig({
  base: "/app/",
  plugins: [
    react(),
    {
      // In production the Go binary swaps the placeholder for the stylesheet's
      // versioned URL (spa.go); in dev the server's own sheet is proxied.
      name: "brevis-app-css",
      apply: "serve",
      transformIndexHtml: (html) => html.replace("<!--brevis:app-css-->", '<link rel="stylesheet" href="/assets/app.css" />'),
    },
  ],
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  server: {
    // `make up` serves the API on 8080; the dev server proxies to it, so the
    // browser sees one origin and the session cookie works without CORS.
    proxy: {
      "/api": "http://localhost:8080",
      "/health": "http://localhost:8080",
      "/assets": "http://localhost:8080",
    },
  },
});
