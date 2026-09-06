import { useEffect, useState } from "react"
import { useDispatch } from "react-redux"
import { getMagasins, getArticles, getCases, getMonthlyData } from "../services/api"
import { setActivePage } from "../store/navigationSlice"
import "./CrudPage.css"
import "./DashboardPage.css"

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

function formatMonth(yyyyMm) {
  if (!yyyyMm) return "—"
  const [year, month] = yyyyMm.split("-")
  return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`
}

function average(values) {
  if (values.length === 0) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function DashboardPage() {
  const dispatch = useDispatch()
  const [magasins, setMagasins] = useState([])
  const [articles, setArticles] = useState([])
  const [cases, setCases] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError("")
        const [magasinRows, articleRows, caseRows, movementRows] = await Promise.all([
          getMagasins(), getArticles(), getCases(), getMonthlyData(),
        ])
        setMagasins(magasinRows)
        setArticles(articleRows)
        setCases(caseRows)
        setMovements(movementRows)
      } catch (err) {
        setError(err.message || "Impossible de charger le tableau de bord.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function goTo(page) {
    dispatch(setActivePage(page))
  }

  if (loading) {
    return <div className="crud-loading">Chargement du tableau de bord…</div>
  }

  const activeMagasins = magasins.filter(m => m.actif)
  const occupationMoyenne = average(cases.map(c => Number(c.tauxOccupation ?? 0)))
  const casesEnDepassement = cases.filter(c => c.capaciteDepassee)

  const articlesSousSeuil = articles
    .filter(a => a.seuil !== null && a.seuil !== undefined && (a.stockNet ?? 0) < a.seuil)
    .map(a => ({ ...a, pct: a.seuil > 0 ? Math.round((a.stockNet / a.seuil) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct)

  const monthsPresent = [...new Set(movements.map(m => m.mois?.slice(0, 7)))]
    .filter(Boolean)
    .sort()
  const latestMonth = monthsPresent[monthsPresent.length - 1] ?? null
  const currentMonth = new Date().toISOString().slice(0, 7)
  const isUpToDate = latestMonth === currentMonth

  const recentMovements = [...movements]
    .sort((a, b) => (b.mois ?? "").localeCompare(a.mois ?? "") || b.donneeId - a.donneeId)
    .slice(0, 5)

  const steps = [
    {
      title: "Créer vos magasins",
      done: magasins.length > 0,
      status: magasins.length > 0 ? "Terminé" : "À faire",
      page: "structure",
    },
    {
      title: "Structurer rayons → zones → cases",
      done: cases.length > 0,
      status: cases.length > 0 ? "Terminé" : "À faire",
      page: "structure",
    },
    {
      title: "Enregistrer vos articles",
      done: articles.length > 0,
      status: articles.length > 0 ? "Terminé" : "À faire",
      page: "stock",
    },
    {
      title: `Importer les données de ${formatMonth(currentMonth)}`,
      done: isUpToDate,
      status: isUpToDate ? "Terminé" : "À faire",
      page: "stock",
    },
    {
      title: "Suivre analyses & prévisions",
      done: false,
      status: "Disponible",
      page: "analyse",
    },
  ]

  return (
    <div className="crud-page dashboard-page">
      <div className="crud-header">
        <div>
          <h1>Tableau de bord</h1>
          <p className="crud-subtitle">
            Vue d'ensemble de tous les sites — occupation, alertes de stock et suivi des imports.
          </p>
        </div>
      </div>

      {error && <div className="crud-banner crud-banner--error">{error}</div>}

      <div className="dash-kpi-row">
        <div className="dash-kpi">
          <span className="dash-kpi__label">Magasins actifs</span>
          <span className="dash-kpi__value">{activeMagasins.length} <small>/ {magasins.length}</small></span>
          <span className="dash-kpi__delta">
            {magasins.length - activeMagasins.length > 0
              ? `${magasins.length - activeMagasins.length} en pause`
              : "Tous actifs"}
          </span>
        </div>

        <div className="dash-kpi">
          <span className="dash-kpi__label">Occupation moyenne</span>
          <span className="dash-kpi__value">{occupationMoyenne}%</span>
          <span className={`dash-kpi__delta ${occupationMoyenne > 85 ? "dash-kpi__delta--danger" : occupationMoyenne >= 60 ? "dash-kpi__delta--warn" : "dash-kpi__delta--good"}`}>
            {casesEnDepassement.length > 0
              ? `${casesEnDepassement.length} case${casesEnDepassement.length > 1 ? "s" : ""} en dépassement`
              : occupationMoyenne >= 60 ? "À surveiller" : "Marge confortable"}
          </span>
        </div>

        <div className="dash-kpi">
          <span className="dash-kpi__label">Articles sous seuil</span>
          <span className="dash-kpi__value">{articlesSousSeuil.length}</span>
          <span className={`dash-kpi__delta ${articlesSousSeuil.length > 0 ? "dash-kpi__delta--danger" : "dash-kpi__delta--good"}`}>
            {articlesSousSeuil.length > 0 ? "Réapprovisionnement à prévoir" : "Aucune alerte"}
          </span>
        </div>

        <div className="dash-kpi">
          <span className="dash-kpi__label">Dernier mois importé</span>
          <span className="dash-kpi__value dash-kpi__value--text">{latestMonth ? formatMonth(latestMonth) : "—"}</span>
          <span className={`dash-kpi__delta ${isUpToDate ? "dash-kpi__delta--good" : "dash-kpi__delta--warn"}`}>
            {isUpToDate ? "À jour" : `${formatMonth(currentMonth)} manquant`}
          </span>
        </div>
      </div>

      <div className="dash-stepper">
        <div className="dash-stepper__head">
          <h2>Parcours recommandé</h2>
          <span className="dash-stepper__hint">cliquez une étape pour y aller</span>
        </div>
        <div className="dash-steps">
          {steps.map((step, index) => (
            <button
              type="button"
              key={step.title}
              className={`dash-step ${step.done ? "dash-step--done" : ""}`}
              onClick={() => goTo(step.page)}
            >
              <span className="dash-step__n">{step.done ? "✓" : index + 1}</span>
              <span className="dash-step__title">{step.title}</span>
              <span className="dash-step__status">{step.status}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dash-two-col">
        <div className="table-wrap dash-panel">
          <div className="dash-panel__head">
            <h2>Alertes stock</h2>
            <p className="crud-subtitle">Articles dont le stock est passé sous leur seuil de réapprovisionnement.</p>
          </div>
          {articlesSousSeuil.length === 0 ? (
            <p className="crud-empty">Aucune alerte de stock pour le moment.</p>
          ) : (
            <table className="crud-table">
              <tbody>
                {articlesSousSeuil.map(a => (
                  <tr key={a.articleId}>
                    <td className="td-bold">{a.codeArticle}</td>
                    <td>{a.nomArticle}</td>
                    <td>
                      <span className={`badge badge--${a.pct < 50 ? "red" : "orange"}`}>
                        {a.stockNet}/{a.seuil} · {a.pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="table-wrap dash-panel">
          <div className="dash-panel__head">
            <h2>Derniers mouvements</h2>
            <p className="crud-subtitle">Mouvements de stock les plus récemment enregistrés.</p>
          </div>
          {recentMovements.length === 0 ? (
            <p className="crud-empty">Aucun mouvement enregistré.</p>
          ) : (
            <table className="crud-table">
              <tbody>
                {recentMovements.map(m => (
                  <tr key={m.donneeId}>
                    <td className="td-bold">{m.codeArticle}</td>
                    <td>{formatMonth(m.mois?.slice(0, 7))}</td>
                    <td className="quantity-in">+{m.quantiteEntrer}</td>
                    <td className="quantity-out">-{m.quantiteSortie}</td>
                    <td><span className={`badge badge--${m.source === "Legacy" ? "orange" : "blue"}`}>{m.source}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
