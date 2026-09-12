import { useEffect, useMemo, useState } from "react"
import Chart from "react-apexcharts"
import { useChartTheme } from "../theme/useChartTheme"
import { getMonthlyData, forecastNextYear } from "../services/api"
import "./ChartsPage.css"

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

function ForecastPage() {
  const chartColors = useChartTheme()
  const [articleNames, setArticleNames] = useState([])
  const [articleName, setArticleName] = useState("")
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    getMonthlyData().then(rows => {
      const names = [...new Set(rows.map(row => row.nomArticle).filter(Boolean))].sort()
      setArticleNames(names)
      if (names.length) setArticleName("general")
    }).catch(err => setError(err.message || "Impossible de charger les articles."))
  }, [])

  useEffect(() => {
    if (!articleName) return
    // Refresh forecast state when the selected Article changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError(""); setForecast(null)
    forecastNextYear(articleName).then(setForecast)
      .catch(err => setError(err.message || "Impossible de calculer la prévision."))
      .finally(() => setLoading(false))
  }, [articleName])

  const monthlyEntrer = forecast?.monthlyQuantiteEntrer || Array(12).fill(0)
  const monthlySortie = forecast?.monthlyQuantiteSortie || Array(12).fill(0)
  const annualTotalEntrer = useMemo(() => monthlyEntrer.reduce((total, value) => total + value, 0), [monthlyEntrer])
  const annualTotalSortie = useMemo(() => monthlySortie.reduce((total, value) => total + value, 0), [monthlySortie])
  const chartOptions = {
    chart: { type: "area", toolbar: { show: false }, zoom: { enabled: false }, background: "transparent", foreColor: chartColors.axis },
    dataLabels: { enabled: false }, stroke: { curve: "smooth", width: 3 }, colors: ["#38bdf8", "#f43f5e"],
    fill: { type: "gradient", gradient: { shade: chartColors.tooltip, type: "vertical", opacityFrom: 0.6, opacityTo: 0.1, stops: [0, 90, 100] } },
    legend: { show: false },
    xaxis: { categories: MONTHS, labels: { style: { colors: chartColors.axis, fontSize: "12px" } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { min: 0, labels: { style: { colors: chartColors.axis }, formatter: value => Math.round(value).toLocaleString() } },
    grid: { borderColor: chartColors.grid, strokeDashArray: 4 }, tooltip: { theme: chartColors.tooltip, y: { formatter: value => `${Math.round(value).toLocaleString()} unités` } }
  }

  return <div className="prediction-section" style={{ marginTop: '3rem' }}>
    <div className="charts-header"><div><h1>Prévision</h1><p className="charts-subtitle">Prévision des 12 prochains mois — aucune donnée existante n'est modifiée.</p></div>
      <div className="charts-filters"><div className="year-selector part-selector"><label htmlFor="prediction-article-select">Article :</label><select id="prediction-article-select" value={articleName} onChange={event => setArticleName(event.target.value)} disabled={!articleNames.length}><option value="general">Général (Tous)</option>{articleNames.map(name => <option key={name} value={name}>{name}</option>)}</select></div></div>
    </div>
    {error && <div className="charts-error">{error}</div>}
    {!articleNames.length && !error && <div className="chart-empty">Aucune donnée disponible.</div>}
    {articleName && <div className="charts-grid"><div className="chart-card chart-card--full"><div className="chart-card__header"><h4 className="chart-card__title">QuantiteEntrer et QuantiteSortie prévues — {forecast?.year || "…"}</h4><div className="chart-card__subtitle">Total annuel prévu : <strong style={{ color: "#38bdf8" }}>{annualTotalEntrer.toLocaleString()} entrées</strong> / <strong style={{ color: "#f43f5e" }}>{annualTotalSortie.toLocaleString()} sorties</strong></div></div><div className="chart-card__body">{loading ? <div className="chart-loading">Calcul de la prévision Python…</div> : <Chart options={chartOptions} series={[{ name: "QuantiteEntrer prévue", data: monthlyEntrer }, { name: "QuantiteSortie prévue", data: monthlySortie }]} type="area" height={380} />}</div></div></div>}
  </div>
}

export default ForecastPage
