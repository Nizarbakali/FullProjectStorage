import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"

import { setActivePage } from "./store/navigationSlice"
import { logout } from "./store/authSlice"

import LoginPage          from "./pages/LoginPage"
import MagasinPage        from "./pages/MagasinPage"
import RayonPage          from "./pages/RayonPage"
import ZonePage           from "./pages/ZonePage"
import CasePage           from "./pages/CasePage"
import HeatmapPage        from "./pages/HeatmapPage"
import ArticlePage        from "./pages/ArticlePage"
import CsvUploadPage      from "./pages/CsvUploadPage"
import ChartsPage         from "./pages/ChartsPage"
import MapPage            from "./pages/MapPage"
import UserManagementPage from "./pages/UserManagementPage"

import "./App.css"

// ── Tab definitions ───────────────────────────────────────────────────────────
const ADMIN_TABS = [
  { id: "donnees",       label: "Données Mensuelles" },
  { id: "magasins",      label: "Magasins"           },
  { id: "rayons",        label: "Rayons"              },
  { id: "zones",         label: "Zones"               },
  { id: "cases",         label: "Cases"               },
  { id: "articles",      label: "Articles"            },
    { id: "heatmap",       label: "Heatmap"             },
  { id: "graphiques",    label: "Graphiques"          },
  { id: "carte",         label: "Carte"               },
  { id: "utilisateurs",  label: "Utilisateurs"     },
]

// User role: read-only visualisation tabs only
const USER_TABS = [
  { id: "heatmap",    label: "Heatmap"    },
  { id: "graphiques", label: "Graphiques" },
  { id: "carte",      label: "Carte"      },
]

function App() {
  const dispatch   = useDispatch()
  const activePage = useSelector((state) => state.navigation.activePage)
  const { isAuthenticated, username, role } = useSelector((state) => state.auth)

  const isAdmin = role === "admin"
  const tabs    = isAdmin ? ADMIN_TABS : USER_TABS

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark")

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  // When the role changes (e.g. after login), make sure the active page is valid
  useEffect(() => {
    const allowed = tabs.map(t => t.id)
    if (!allowed.includes(activePage)) {
      dispatch(setActivePage(tabs[0].id))
    }
  }, [role]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth gate ───────────────────────────────────────────────────────────────
  if (!isAuthenticated) return <LoginPage />

  // ── Authenticated shell ─────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <nav className="app-nav">
        <span className="app-nav__brand">GMD Metal Tanger</span>

        <div className="app-nav__tabs">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={`app-nav__tab ${activePage === tab.id ? "app-nav__tab--active" : ""}`}
              onClick={() => dispatch(setActivePage(tab.id))}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="app-nav__right">
          <span className={`nav-role-badge nav-role-badge--${role}`}>
            {role === "admin" ? "" : ""} {username}
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

      <main className="app-main">
        {activePage === "donnees"      && <CsvUploadPage />}
        {activePage === "magasins"     && <MagasinPage />}
        {activePage === "rayons"       && <RayonPage />}
        {activePage === "zones"        && <ZonePage />}
        {activePage === "cases"        && <CasePage />}
        {activePage === "heatmap"      && <HeatmapPage />}
        {activePage === "articles"     && <ArticlePage />}
        {activePage === "graphiques"   && <ChartsPage />}
        {activePage === "carte"        && <MapPage />}
        {activePage === "utilisateurs" && <UserManagementPage />}
      </main>
    </div>
  )
}

export default App