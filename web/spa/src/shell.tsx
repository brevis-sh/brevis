import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { useConfig } from "./api/session";
import { Skeleton } from "./ui/skeleton";
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
  useEffect(() => {
    document.title = brand.title;
  }, [brand.title]);

  return (
    <>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            <div className="px-3 pt-3 pb-10 min-[860px]:px-6">
              <Suspense fallback={<Skeleton w="8rem" h="1.5rem" />}>
                <Outlet />
              </Suspense>
            </div>
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
