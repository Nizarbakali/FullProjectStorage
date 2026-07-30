import { useEffect, useState } from "react"

import MagasinPage from "./pages/MagasinPage"
import RayonPage from "./pages/RayonPage"
import ZonePage from "./pages/ZonePage"
import CasePage from "./pages/CasePage"
import HeatmapPage from "./pages/HeatmapPage"
import ArticlePage from "./pages/ArticlePage"
import CsvUploadPage from "./pages/CsvUploadPage"
import ChartsPage from "./pages/ChartsPage"
import MapPage from "./pages/MapPage"

import "./App.css"

const TABS = [
  {
    id: "donnees",
    label: "Données Mensuelles",
  },
  {
    id: "magasins",
    label: "Magasins",
  },
  {
    id: "rayons",
    label: "Rayons",
  },
  {
    id: "zones",
    label: "Zones",
  },
  {
    id: "cases",
    label: "Cases",
  },
  {
    id: "heatmap",
    label: "Heatmap",
  },
  {
    id: "articles",
    label: "Articles",
  },
  {
    id: "graphiques",
    label: "Graphiques",
  },
  {
    id: "carte",
    label: "Carte",
  },
]

function App() {
  const [activeTab, setActiveTab] =
    useState("donnees")

  const [theme, setTheme] = useState(() => {
    return (
      localStorage.getItem("theme") ||
      "dark"
    )
  })

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme
    )

    localStorage.setItem(
      "theme",
      theme
    )
  }, [theme])

  function toggleTheme() {
    setTheme((currentTheme) =>
      currentTheme === "dark"
        ? "light"
        : "dark"
    )
  }

  function getBackgroundImage() {
    switch (activeTab) {
      case "donnees":
        return ""

      case "magasins":
        return ""

      case "rayons":
        return ""

      case "zones":
        return ""

      case "cases":
        return ""

      case "heatmap":
        return ""

      case "articles":
        return ""

      case "graphiques":
        return ""

      case "carte":
        return ""

      default:
        return ""
    }
  }

  const backgroundImage =
    getBackgroundImage()

  return (
    <div
      className="app-shell"
      style={{
        backgroundImage: backgroundImage
          ? `url("${backgroundImage}")`
          : "none",

        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <nav className="app-nav">
        <span className="app-nav__brand">
          GMD Metal Tanger
        </span>

        <div className="app-nav__tabs">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={
                `app-nav__tab ${
                  activeTab === tab.id
                    ? "app-nav__tab--active"
                    : ""
                }`
              }
              onClick={() =>
                setActiveTab(tab.id)
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          style={{
            marginLeft: "auto",
          }}
        >
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Changer le thème"
            style={{
              background: "transparent",
              border:
                "1px solid var(--border)",
              color: "var(--text)",
              padding: "0.4rem 0.8rem",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {theme === "dark"
              ? "☀️"
              : "🌙"}
          </button>
        </div>
      </nav>

      <main className="app-main">
        {activeTab === "donnees" && (
          <CsvUploadPage />
        )}

        {activeTab === "magasins" && (
          <MagasinPage />
        )}

        {activeTab === "rayons" && (
          <RayonPage />
        )}

        {activeTab === "zones" && (
          <ZonePage />
        )}

        {activeTab === "cases" && (
          <CasePage />
        )}

        {activeTab === "heatmap" && (
          <HeatmapPage />
        )}

        {activeTab === "articles" && (
          <ArticlePage />
        )}

        {activeTab === "graphiques" && (
          <ChartsPage />
        )}

        {activeTab === "carte" && (
          <MapPage />
        )}
      </main>
    </div>
  )
}

export default App