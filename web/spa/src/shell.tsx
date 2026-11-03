import { Suspense, useEffect } from "react";
import { NavLink, Outlet } from "react-router";
import { useConfig, useSession } from "./api/session";
import { useT } from "./i18n";
import { Skeleton } from "./ui/skeleton";
import "./ui/nav-group.css";

// The sidebar's identity block. It suspends on the session and the branding,
// so the shell around it draws at once and this part shows a skeleton of the
// same size.
function Identity() {
  const { brand } = useConfig();
  const session = useSession();

  // The server's theme, as it writes it for the pages (branding.CSS): one
  // source for a client's colours. Injected once, removed on unmount.
  useEffect(() => {
    if (!brand.css) return;
    const el = document.createElement("style");
    el.dataset.brand = "";
    el.textContent = brand.css;
    document.head.appendChild(el);
    return () => el.remove();
  }, [brand.css]);

  return (
    <>
      <span className="brand">
        <img src={brand.logo} alt="" width={20} height={20} /> <strong>{brand.title}</strong>
      </span>
      {session.operator && <small className="muted">{session.operator}</small>}
    </>
  );
}

// The shell is a placeholder for the real sidebar and topbar (base.templ). It
// fixes the responsive contract now: a column from 768px up, a bar below it.
function Nav() {
  const { t } = useT();
  const { sql } = useConfig();
  return (
    <>
      <NavLink to="/" end>
        {t("nav.overview")}
      </NavLink>
      <NavLink to="/workflows">{t("nav.workflows")}</NavLink>
      <NavLink to="/runs">{t("nav.runs")}</NavLink>
      <NavLink to="/projects">{t("nav.projects")}</NavLink>
      {sql && <NavLink to="/sql">{t("nav.sql")}</NavLink>}
      <div role="group" aria-label={t("nav.group.ingest")} className="nav-group">
        <small className="muted">{t("nav.group.ingest")}</small>
        <NavLink to="/ingest/streams">{t("nav.streams")}</NavLink>
        <NavLink to="/ingest/loads">{t("nav.loads")}</NavLink>
      </div>
      <NavLink to="/data" end>
        {t("nav.catalog")}
      </NavLink>
      <NavLink to="/data/endpoints">{t("nav.endpoints")}</NavLink>
    </>
  );
}

export function Shell() {
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <Identity />
        <Nav />
      </nav>
      <main className="main">
        <Suspense fallback={<Skeleton w="8rem" h="1.5rem" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
