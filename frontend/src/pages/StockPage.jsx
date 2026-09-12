import { useState } from "react"
import PageTabs from "../components/PageTabs"
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
      <PageTabs tabs={TABS} value={tab} onChange={setTab} label="Sections du stock" />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "articles" && <ArticlePage />}
        {tab === "mouvements" && <CsvUploadPage />}
      </div>
    </div>
  )
}

export default StockPage
