import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useApi, useAuth } from "../hooks";

const LINKS = [
  ["/dashboard", "Dashboard"],
  ["/insights", "Year in Review"],
  ["/water-quality", "Water Quality"],
  ["/rainfall", "Rainfall"],
  ["/comparison", "Ganga vs Yamuna"],
  ["/relationship", "Rainfall & Quality"],
  ["/incidents", "Incidents"],
  ["/map", "Map"],
  ["/river-explorer", "River Explorer"],
  ["/timeline", "Timeline"],
  ["/sources", "Data & Methods"],
  ["/reports", "Reports"],
];

function HealthBanner() {
  const q = useApi("/api/health");
  if (q.loading) return null;
  if (q.error)
    return (
      <div className="banner banner-error" role="alert">
        {q.error.message}{" "}
        <button className="btn btn-small" onClick={q.reload}>
          Retry
        </button>
      </div>
    );
  if (q.data.status !== "ok")
    return <div className="banner banner-error">The API is running but the database is unreachable.</div>;
  if (!q.data.auth_configured)
    return <div className="banner banner-warn">{q.data.auth_message}. Public pages work normally.</div>;
  return null;
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { isAdmin, logout } = useAuth();
  const loc = useLocation();
  const storyMode = loc.pathname === "/" || loc.pathname === "/story";
  const riverExplorerMode = loc.pathname === "/river-explorer";
  return (
    <div className="app">
      <header className="nav">
        <div className="nav-inner">
          <Link to="/" className="brand" onClick={() => setOpen(false)}>
            <span className="brand-mark" aria-hidden>≈</span> RiverMemory
          </Link>
          {storyMode ? (
            <span className="story-nav-label">An introduction to the rivers of Prayagraj</span>
          ) : (
            <>
              <button className="burger" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>
                ☰
              </button>
              <nav className={open ? "links open" : "links"} aria-label="Main">
                <NavLink to="/" onClick={() => setOpen(false)}>The Story</NavLink>
                {LINKS.map(([to, label]) => (
                  <NavLink key={to} to={to} onClick={() => setOpen(false)}>
                    {label}
                  </NavLink>
                ))}
                <NavLink to="/admin" onClick={() => setOpen(false)} className="admin-link">
                  {isAdmin ? "Admin" : "Admin login"}
                </NavLink>
                {isAdmin && (
                  <button className="linkbtn" onClick={logout}>
                    Log out
                  </button>
                )}
              </nav>
            </>
          )}
        </div>
      </header>
      {!storyMode && <HealthBanner />}
      <main className={`${storyMode ? "main main-story" : "main"}${riverExplorerMode ? " main-river-explorer" : ""}`}>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <div>
            <strong>RiverMemory</strong>
            <p className="muted small">
              {storyMode
                ? "A story of the rivers, the people and the living landscape of Prayagraj."
                : "Historical river water quality and environmental intelligence for the Triveni Sangam, Prayagraj. Analytical indications only; not an official assessment."}
            </p>
          </div>
          {!storyMode && <div className="small">
            <strong>Official sources</strong>
            <ul>
              <li><a href="https://cpcb.nic.in/" target="_blank" rel="noreferrer">CPCB</a></li>
              <li><a href="https://indiawris.gov.in/" target="_blank" rel="noreferrer">India-WRIS</a></li>
              <li><a href="https://www.imd.gov.in/" target="_blank" rel="noreferrer">IMD</a></li>
              <li><a href="https://www.uppcb.com/" target="_blank" rel="noreferrer">UPPCB</a></li>
            </ul>
          </div>}
          {storyMode ? <div className="small story-footer-link"><Link to="/dashboard">Continue to the environmental data →</Link></div> : <div className="small">
            <strong>Platform</strong>
            <ul>
              <li><Link to="/about">About RiverMemory</Link></li>
              <li><Link to="/sources">Data &amp; methodology</Link></li>
              <li><Link to="/reports">Reports</Link></li>
              <li><a href="/docs" target="_blank" rel="noreferrer">API docs</a></li>
            </ul>
          </div>}
        </div>
      </footer>
    </div>
  );
}
