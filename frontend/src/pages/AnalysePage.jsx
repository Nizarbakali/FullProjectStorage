import { useState } from "react"
import ChartsPage from "./ChartsPage"
import HeatmapPage from "./HeatmapPage"
import MapPage from "./MapPage"
import "./StockPage.css"

const TABS = [
  { id: "graphiques", label: "Graphiques" },
  { id: "heatmap", label: "Heatmap" },
  { id: "carte", label: "Carte des sites" },
]

function AnalysePage() {
  const [tab, setTab] = useState("graphiques")

  return (
    <div className="stock-page">
      <div className="stock-tabs">
        {TABS.map(t => (
          <button
            type="button"
            key={t.id}
            className={`stock-tab ${tab === t.id ? "stock-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "graphiques" && <ChartsPage />}
      {tab === "heatmap" && <HeatmapPage />}
      {tab === "carte" && <MapPage />}
    </div>
  )
}

export default AnalysePage
