package layouts

// ThemeCookie names the visitor's choice of theme.
//
// A COOKIE AND NOT localStorage, because the server is the one drawing the
// page: it writes `data-theme` on <html> before anything is painted, and a
// preference only a script can read is a page drawn dark and then repainted.
const ThemeCookie = "brevis_theme"
