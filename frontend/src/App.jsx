import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"

import { setActivePage } from "./store/navigationSlice"
import { logout } from "./store/authSlice"

import LoginPage          from "./pages/LoginPage"
import DashboardPage      from "./pages/DashboardPage"
import StructurePage      from "./pages/StructurePage"
import StockPage          from "./pages/StockPage"
import AnalysePage        from "./pages/AnalysePage"
import UserManagementPage from "./pages/UserManagementPage"

import "./App.css"

// ── Section definitions ───────────────────────────────────────────────────────
// One entry per destination, ordered the way work actually flows: look at the
// numbers, set up the warehouse, feed it stock, analyse it, manage access.
const SECTIONS = [
  { id: "dashboard", label: "Tableau de bord", roles: ["admin", "user"] },
  { id: "structure", label: "Structure",       roles: ["admin"] },
  { id: "stock",     label: "Stock",           roles: ["admin"] },
  { id: "analyse",   label: "Analyse",         roles: ["admin", "user"] },
  { id: "admin",     label: "Utilisateurs",    roles: ["admin"] },
]

function App() {
  const dispatch   = useDispatch()
  const activePage = useSelector((state) => state.navigation.activePage)
  const { isAuthenticated, username, role } = useSelector((state) => state.auth)

  const sections = SECTIONS.filter(s => s.roles.includes(role))

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark")

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  // Switching section used to keep the previous scroll offset, which dropped
  // you halfway down the new page. Always start a section at the top.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [activePage])

  // When the role changes (e.g. after login), make sure the active page is valid
  useEffect(() => {
    const allowed = sections.map(s => s.id)
    if (!allowed.includes(activePage)) {
      dispatch(setActivePage(allowed[0] ?? "dashboard"))
    }
  }, [role]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth gate ───────────────────────────────────────────────────────────────
  if (!isAuthenticated) return <LoginPage />

  // ── Authenticated shell ─────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <nav className="app-nav">
        <span className="app-nav__brand">GMD Metal Tanger</span>

        <div className="app-nav__right">
          <span className={`nav-role-badge nav-role-badge--${role}`}>
            {username}
          </span>

          <button
            type="button"
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            aria-label="Changer le thème"
            className="nav-icon-btn"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          <button
            type="button"
            onClick={() => dispatch(logout())}
            className="nav-logout-btn"
          >
            Déconnexion
          </button>
        </div>
      </nav>

      <div className="app-body">
        <aside className="app-sidebar">
          <nav aria-label="Sections de l'application">
            <ul className="app-sidebar__list">
              {sections.map(section => (
                <li key={section.id}>
                  <button
                    type="button"
                    aria-current={activePage === section.id ? "page" : undefined}
                    className={`app-sidebar__item ${activePage === section.id ? "app-sidebar__item--active" : ""}`}
                    onClick={() => dispatch(setActivePage(section.id))}
                  >
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="app-main">
          {activePage === "dashboard" && <DashboardPage />}
          {activePage === "structure" && <StructurePage />}
          {activePage === "stock"     && <StockPage />}
          {activePage === "analyse"   && <AnalysePage />}
          {activePage === "admin"     && <UserManagementPage />}
        </main>
      </div>
    </div>
  )
}

export default App
