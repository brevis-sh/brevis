import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { useConfig } from "./api/session";
import { useT } from "./i18n";
import { metaFor, useCurrentCrumb } from "./shell/nav";
import { Palette } from "./shell/palette";
import { setDrawer } from "./shell/prefs";
import { installHints } from "./shell/hint";
import { Shortcuts, useShortcuts } from "./shell/shortcuts";
import { Sidebar } from "./shell/sidebar";
import { Toasts } from "./shell/toast";
import { Topbar } from "./shell/topbar";
import { UpdateNotice, VersionModal } from "./shell/version";
import "./shell/shell.css";

// The console's frame (web/layouts/base.templ): sidebar, topbar, and beside
// them the screen. Everything here is static or already known (the session, the
// config and the catalog are read before the first render), so nothing in the
// frame waits; only the screen below it may show a skeleton.
export function Shell() {
  const { brand } = useConfig();
  const { pathname } = useLocation();
  useShortcuts();
  useEffect(() => installHints(), []);

  // The server's theme (branding.CSS): one source for a client's colours.
  useEffect(() => {
    if (!brand.css) return;
    const el = document.createElement("style");
    el.dataset.brand = "";
    el.textContent = brand.css;
    document.head.appendChild(el);
    return () => el.remove();
  }, [brand.css]);

  // A new page closes the phone's drawer; the title follows the brand.
  useEffect(() => setDrawer(false), [pathname]);
  // The tab reads as the old pages did: "<page> · <brand>".
  const { t } = useT();
  const meta = metaFor(pathname);
  const crumb = useCurrentCrumb();
  const page = meta ? (meta.named && crumb ? crumb.text : t(meta.title)) : "";
  useEffect(() => {
    document.title = page ? `${page} · ${brand.title}` : brand.title;
  }, [page, brand.title]);

  return (
    <>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            {/* The page draws its own header and its own body gutters, as base.templ
                does (header px-3 pt-3, body px-3 pb-10): padding here would double
                them. No skeleton as a fallback either: every screen draws its static
                frame at once and skeletons only its data. */}
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
      <Palette />
      <Shortcuts />
      <VersionModal />
      <UpdateNotice />
      <Toasts />
    </>
  );
}
