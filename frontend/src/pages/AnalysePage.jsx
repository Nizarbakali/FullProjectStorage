import { useState } from "react"
import PageTabs from "../components/PageTabs"
import ChartsPage from "./ChartsPage"
import MapPage from "./MapPage"
import PlanView from "./analyse/PlanView"
import "./StockPage.css"

const TABS = [
  { id: "graphiques", label: "Graphiques", render: () => <ChartsPage /> },
  { id: "occupation", label: "Occupation", render: () => <PlanView /> },
  { id: "carte", label: "Carte des sites", render: () => <MapPage /> },
]

function AnalysePage() {
  const [tab, setTab] = useState("graphiques")
  const active = TABS.find(t => t.id === tab) ?? TABS[0]

  return (
    <div className="stock-page">
      <PageTabs tabs={TABS} value={active.id} onChange={setTab} label="Vues d'analyse" />

      <div role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`}>
        {active.render()}
      </div>
    </div>
  )
}

export default AnalysePage
