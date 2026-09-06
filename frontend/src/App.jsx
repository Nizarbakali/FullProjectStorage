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
// Each section groups what used to be flat, unrelated tabs under the task it
// actually serves, so the nav mirrors what a user is trying to do rather than
// the database tables underneath it.
const SECTIONS = [
  { id: "dashboard", label: "Tableau de bord", group: "Vue d'ensemble",         roles: ["admin", "user"] },
  { id: "structure", label: "Structure",       group: "Hiérarchie physique",   roles: ["admin"] },
  { id: "stock",     label: "Stock",           group: "Références & mouvements", roles: ["admin"] },
  { id: "analyse",   label: "Analyse",         group: "Pilotage",              roles: ["admin", "user"] },
  { id: "admin",     label: "Utilisateurs",    group: "Administration",        roles: ["admin"] },
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

  // When the role changes (e.g. after login), make sure the active page is valid
  useEffect(() => {
    const allowed = sections.map(s => s.id)
    if (!allowed.includes(activePage)) {
      dispatch(setActivePage(allowed[0] ?? "dashboard"))
    }
  }, [role]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth gate ───────────────────────────────────────────────────────────────
  if (!isAuthenticated) return <LoginPage />

  // Group sections by their sidebar group, preserving SECTIONS order.
  const groups = []
  for (const section of sections) {
    let group = groups.find(g => g.label === section.group)
    if (!group) {
      group = { label: section.group, items: [] }
      groups.push(group)
    }
    group.items.push(section)
  }

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
          {groups.map(group => (
            <div className="app-sidebar__group" key={group.label}>
              <span className="app-sidebar__eyebrow">{group.label}</span>
              {group.items.map(section => (
                <button
                  type="button"
                  key={section.id}
                  className={`app-sidebar__item ${activePage === section.id ? "app-sidebar__item--active" : ""}`}
                  onClick={() => dispatch(setActivePage(section.id))}
                >
                  {section.label}
                </button>
              ))}
            </div>
          ))}
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
