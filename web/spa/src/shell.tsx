import { NavLink, Outlet } from "react-router";

// The shell is a placeholder for the real sidebar and topbar (base.templ). It
// fixes the responsive contract now: a column from 768px up, a bar below it.
export function Shell() {
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <strong className="brand">Brevis</strong>
        <NavLink to="/" end>
          Overview
        </NavLink>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
