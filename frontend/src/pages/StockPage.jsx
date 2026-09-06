import { useState } from "react"
import ArticlePage from "./ArticlePage"
import CsvUploadPage from "./CsvUploadPage"
import "./CrudPage.css"
import "./StockPage.css"

const TABS = [
  { id: "articles", label: "Articles" },
  { id: "mouvements", label: "Mouvements & import CSV" },
]

function StockPage() {
  const [tab, setTab] = useState("articles")

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

      {tab === "articles" && <ArticlePage />}
      {tab === "mouvements" && <CsvUploadPage />}
    </div>
  )
}

export default StockPage
