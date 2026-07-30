import {
  useEffect,
  useMemo,
  useState
} from "react"
import {
  useSelector,
  useDispatch
} from "react-redux"
import Chart from "react-apexcharts"
import {
  fetchMonthlyData,
  setSelectedYear,
  setSelectedArticleName
} from "../store/chartsSlice"
import { getArticles } from "../services/api"
import ForecastPage from "./ForecastPage"
import "./ChartsPage.css"

const MONTHS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Jun",
  "Jul",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc"
]

function ChartsPage() {
  const dispatch = useDispatch()

  const {
    rawData,
    availableYears,
    selectedYear,
    availableArticleNames,
    selectedArticleName,
    loading,
    error
  } = useSelector(state => state.charts)

  const [articles, setArticles] = useState([])
  const [articlesLoading, setArticlesLoading] =
    useState(true)
  const [articlesError, setArticlesError] =
    useState("")

  /*
   * Load monthly data.
   */
  useEffect(() => {
    dispatch(fetchMonthlyData())
  }, [dispatch])

  /*
   * Load articles with:
   * - StockNet
   * - TotalCaseCapacity
   * - Seuil
   */
  useEffect(() => {
    async function loadArticles() {
      try {
        setArticlesLoading(true)
        setArticlesError("")

        const data = await getArticles()
        setArticles(data || [])
      } catch (err) {
        setArticlesError(
          err.message ||
          "Impossible de charger les articles."
        )
      } finally {
        setArticlesLoading(false)
      }
    }

    loadArticles()
  }, [])

  /*
   * All monthly data for the selected year.
   */
  const allYearData = useMemo(() => {
    return rawData.filter(row =>
      row.mois?.startsWith(selectedYear)
    )
  }, [
    rawData,
    selectedYear
  ])

  /*
   * Monthly data filtered by the selected article.
   */
  const selectedYearData = useMemo(() => {
    return allYearData.filter(row =>
      selectedArticleName === "general" ||
      row.nomArticle === selectedArticleName
    )
  }, [
    allYearData,
    selectedArticleName
  ])

  /*
   * Aggregate entries and outputs by month.
   */
  const monthlyData = useMemo(() => {
    const entrerData = Array(12).fill(0)
    const sortieData = Array(12).fill(0)

    selectedYearData.forEach(row => {
      const monthText =
        row.mois?.substring(5, 7)

      if (!monthText) {
        return
      }

      const monthIndex =
        parseInt(monthText, 10) - 1

      if (
        monthIndex >= 0 &&
        monthIndex <= 11
      ) {
        entrerData[monthIndex] +=
          Number(row.quantiteEntrer || 0)

        sortieData[monthIndex] +=
          Number(row.quantiteSortie || 0)
      }
    })

    return {
      entrerData,
      sortieData
    }
  }, [selectedYearData])

  const {
    entrerData,
    sortieData
  } = monthlyData

  const annualEntrerTotal =
    entrerData.reduce(
      (total, value) => total + value,
      0
    )

  const annualSortieTotal =
    sortieData.reduce(
      (total, value) => total + value,
      0
    )

  /*
   * Prepare article fullness.
   *
   * If Général is selected:
   * display every article.
   *
   * If one article is selected:
   * display only that article.
   */
  const fullnessRows = useMemo(() => {
    return articles
      .filter(article =>
        selectedArticleName === "general" ||
        article.nomArticle ===
          selectedArticleName
      )
      .map(article => {
        const stockNet = Math.max(
          0,
          Number(article.stockNet || 0)
        )

        const capacity = Math.max(
          0,
          Number(
            article.totalCaseCapacity || 0
          )
        )

        /*
         * Stock inside the available capacity.
         */
        const occupied =
          capacity > 0
            ? Math.min(stockNet, capacity)
            : 0

        /*
         * Capacity that is still available.
         */
        const remaining =
          Math.max(
            capacity - stockNet,
            0
          )

        /*
         * Stock that exceeds capacity.
         */
        const overflow =
          Math.max(
            stockNet - capacity,
            0
          )

        /*
         * Percentage of fullness.
         * Null means there is no assigned capacity.
         */
        const rate =
          capacity > 0
            ? (stockNet / capacity) * 100
            : null

        return {
          articleId: article.articleId,
          codeArticle: article.codeArticle,
          nomArticle: article.nomArticle,
          stockNet,
          capacity,
          occupied,
          remaining,
          overflow,
          rate
        }
      })
      .sort((a, b) => {
        /*
         * Articles exceeding capacity appear first.
         * Articles without capacity but with stock
         * also appear at the beginning.
         */
        const scoreA =
          a.capacity > 0
            ? a.stockNet / a.capacity
            : a.stockNet > 0
              ? Number.POSITIVE_INFINITY
              : -1

        const scoreB =
          b.capacity > 0
            ? b.stockNet / b.capacity
            : b.stockNet > 0
              ? Number.POSITIVE_INFINITY
              : -1

        return (
          scoreB - scoreA ||
          a.codeArticle.localeCompare(
            b.codeArticle,
            undefined,
            {
              numeric: true,
              sensitivity: "base"
            }
          )
        )
      })
  }, [
    articles,
    selectedArticleName
  ])

  /*
   * Calculate the Top 10 articles with
   * the most outputs during the selected year.
   */
  const topMovementRows = useMemo(() => {
    const articleTotals = new Map()

    allYearData.forEach(row => {
      const key =
        row.codeArticle ||
        row.nomArticle ||
        `article-${row.articleId}`

      if (!articleTotals.has(key)) {
        articleTotals.set(key, {
          codeArticle:
            row.codeArticle ||
            row.nomArticle ||
            "Article",

          nomArticle:
            row.nomArticle || "",

          entrer: 0,
          sortie: 0
        })
      }

      const current =
        articleTotals.get(key)

      current.entrer += Number(
        row.quantiteEntrer || 0
      )

      current.sortie += Number(
        row.quantiteSortie || 0
      )
    })

    return Array.from(
      articleTotals.values()
    )
      .sort(
        (a, b) =>
          b.sortie - a.sortie
      )
      .slice(0, 10)
  }, [allYearData])

  /*
   * Historical entries and outputs graph.
   */
  const comparisonOptions = {
    chart: {
      type: "area",
      toolbar: {
        show: false
      },
      zoom: {
        enabled: false
      },
      background: "transparent",
      foreColor: "#94a3b8"
    },

    dataLabels: {
      enabled: false
    },

    stroke: {
      curve: "smooth",
      width: 3
    },

    fill: {
      type: "gradient",
      gradient: {
        shade: "dark",
        type: "vertical",
        shadeIntensity: 0.4,
        opacityFrom: 0.6,
        opacityTo: 0.1,
        stops: [0, 90, 100]
      }
    },

    colors: [
      "#38bdf8",
      "#f43f5e"
    ],

    xaxis: {
      categories: MONTHS,

      labels: {
        style: {
          colors: "#94a3b8",
          fontSize: "12px"
        }
      },

      axisBorder: {
        show: false
      },

      axisTicks: {
        show: false
      }
    },

    yaxis: {
      min: 0,

      labels: {
        style: {
          colors: "#94a3b8",
          fontSize: "12px"
        },

        formatter: value =>
          Math.round(value)
            .toLocaleString()
      }
    },

    grid: {
      borderColor: "#1e293b",
      strokeDashArray: 4
    },

    tooltip: {
      theme: "dark",

      y: {
        formatter: value =>
          `${Math.round(value)
            .toLocaleString()} unités`
      }
    },

    markers: {
      size: 0,

      hover: {
        sizeOffset: 4
      }
    },

    legend: {
      position: "bottom"
    },

    noData: {
      text: "Aucune donnée disponible",

      style: {
        color: "#94a3b8"
      }
    }
  }

  /*
   * Fullness chart.
   *
   * Stacked columns:
   * - occupied
   * - remaining
   * - overflow
   */
  const fullnessOptions = {
    chart: {
      type: "bar",
      stacked: true,
      toolbar: {
        show: false
      },
      zoom: {
        enabled: false
      },
      background: "transparent",
      foreColor: "#94a3b8"
    },

    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "58%",
        borderRadius: 4,
        borderRadiusApplication: "end",
        borderRadiusWhenStacked: "last"
      }
    },

    colors: [
      "#38bdf8",
      "#475569",
      "#ef4444"
    ],

    dataLabels: {
      enabled: false
    },

    xaxis: {
      categories:
        fullnessRows.map(
          row => row.codeArticle
        ),

      labels: {
        rotate: -35,
        rotateAlways:
          fullnessRows.length > 8,

        trim: false,

        style: {
          colors: "#94a3b8",
          fontSize: "11px"
        }
      },

      axisBorder: {
        show: false
      },

      axisTicks: {
        show: false
      }
    },

    yaxis: {
      min: 0,

      title: {
        text: "Quantité",
        style: {
          color: "#94a3b8"
        }
      },

      labels: {
        style: {
          colors: "#94a3b8",
          fontSize: "11px"
        },

        formatter: value =>
          Math.round(value)
            .toLocaleString()
      }
    },

    grid: {
      borderColor: "#1e293b",
      strokeDashArray: 4
    },

    legend: {
      position: "bottom",
      horizontalAlign: "center",

      markers: {
        radius: 12
      }
    },

    tooltip: {
      theme: "dark",

      custom: function ({
        dataPointIndex
      }) {
        const row =
          fullnessRows[dataPointIndex]

        if (!row) {
          return ""
        }

        const rateText =
          row.rate === null
            ? "Aucune capacité assignée"
            : `${row.rate.toFixed(1)}%`

        return `
          <div class="apex-tooltip-custom">
            <strong>${row.codeArticle}</strong>
            <span>${row.nomArticle}</span>
            <span>Stock net : ${row.stockNet.toLocaleString()}</span>
            <span>Capacité : ${row.capacity.toLocaleString()}</span>
            <span>Espace libre : ${row.remaining.toLocaleString()}</span>
            <span>Dépassement : ${row.overflow.toLocaleString()}</span>
            <span>Remplissage : ${rateText}</span>
          </div>
        `
      }
    },

    noData: {
      text: "Aucun article disponible",

      style: {
        color: "#94a3b8"
      }
    }
  }

  /*
   * Top 10 movements graph.
   */
  const movementOptions = {
    chart: {
      type: "bar",
      toolbar: {
        show: false
      },
      background: "transparent",
      foreColor: "#94a3b8"
    },

    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 3,
        barHeight: "70%"
      }
    },

    colors: [
      "#38bdf8",
      "#f43f5e"
    ],

    dataLabels: {
      enabled: false
    },

    xaxis: {
      categories:
        topMovementRows.map(
          row => row.codeArticle
        ),

      labels: {
        formatter: value =>
          Math.round(value)
            .toLocaleString(),

        style: {
          colors: "#94a3b8",
          fontSize: "11px"
        }
      }
    },

    yaxis: {
      labels: {
        style: {
          colors: "#94a3b8",
          fontSize: "11px"
        }
      }
    },

    grid: {
      borderColor: "#1e293b",
      strokeDashArray: 4
    },

    tooltip: {
      theme: "dark",

      y: {
        formatter: value =>
          `${Math.round(value)
            .toLocaleString()} unités`
      }
    },

    legend: {
      position: "bottom"
    },

    noData: {
      text: "Aucun mouvement disponible",

      style: {
        color: "#94a3b8"
      }
    }
  }

  const totalStock =
    fullnessRows.reduce(
      (total, row) =>
        total + row.stockNet,
      0
    )

  const totalCapacity =
    fullnessRows.reduce(
      (total, row) =>
        total + row.capacity,
      0
    )

  const totalOverflow =
    fullnessRows.reduce(
      (total, row) =>
        total + row.overflow,
      0
    )

  return (
    <div className="charts-page">
      {/* Header */}
      <div className="charts-header">
        <div>
          <h1>
            Tableau de Bord Mensuel
          </h1>

          <p className="charts-subtitle">
            Analyse des entrées, sorties,
            stocks et capacités
          </p>
        </div>

        <div className="charts-filters">
          {availableYears.length > 0 && (
            <div className="year-selector">
              <label htmlFor="year-select">
                Année :
              </label>

              <select
                id="year-select"
                value={selectedYear}
                onChange={event =>
                  dispatch(
                    setSelectedYear(
                      event.target.value
                    )
                  )
                }
              >
                {availableYears.map(year => (
                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>
                ))}
              </select>
            </div>
          )}

          {availableArticleNames.length > 0 && (
            <div className="year-selector part-selector">
              <label htmlFor="article-select">
                Article :
              </label>

              <select
                id="article-select"
                value={selectedArticleName}
                onChange={event =>
                  dispatch(
                    setSelectedArticleName(
                      event.target.value
                    )
                  )
                }
              >
                <option value="general">
                  Général (Tous)
                </option>

                {availableArticleNames.map(
                  name => (
                    <option
                      key={name}
                      value={name}
                    >
                      {name}
                    </option>
                  )
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="charts-error">
          {error}
        </div>
      )}

      {articlesError && (
        <div className="charts-error">
          {articlesError}
        </div>
      )}

      <div className="charts-grid">
        {/* Historical entries and outputs */}
        <div className="chart-card chart-card--full">
          <div className="chart-card__header">
            <h4 className="chart-card__title">
              Quantité entrée vs quantité sortie
            </h4>

            <div className="chart-card__subtitle">
              Total annuel :

              <strong
                style={{
                  color: "#38bdf8"
                }}
              >
                {annualEntrerTotal
                  .toLocaleString()}{" "}
                entrées
              </strong>

              <span>/</span>

              <strong
                style={{
                  color: "#f43f5e"
                }}
              >
                {annualSortieTotal
                  .toLocaleString()}{" "}
                sorties
              </strong>
            </div>
          </div>

          <div className="chart-card__body">
            {loading ? (
              <div className="chart-loading">
                Chargement…
              </div>
            ) : (
              <Chart
                options={comparisonOptions}
                series={[
                  {
                    name: "Quantité entrée",
                    data: entrerData
                  },
                  {
                    name: "Quantité sortie",
                    data: sortieData
                  }
                ]}
                type="area"
                height={380}
              />
            )}
          </div>
        </div>

        {/* Article fullness */}
        <div className="chart-card chart-card--full">
          <div className="chart-card__header">
            <h4 className="chart-card__title">
              Remplissage du stockage par article
            </h4>

            <div className="chart-card__subtitle">
              <span>
                Stock total :
              </span>

              <strong>
                {totalStock.toLocaleString()}
              </strong>

              <span>·</span>

              <span>
                Capacité totale :
              </span>

              <strong>
                {totalCapacity.toLocaleString()}
              </strong>

              {totalOverflow > 0 && (
                <>
                  <span>·</span>

                  <span>
                    Dépassement :
                  </span>

                  <strong
                    style={{
                      color: "#ef4444"
                    }}
                  >
                    {totalOverflow
                      .toLocaleString()}
                  </strong>
                </>
              )}
            </div>
          </div>

          <div className="chart-card__body">
            {articlesLoading ? (
              <div className="chart-loading">
                Chargement…
              </div>
            ) : fullnessRows.length === 0 ? (
              <div className="chart-empty">
                Aucun article disponible.
              </div>
            ) : (
              <Chart
                options={fullnessOptions}
                series={[
                  {
                    name: "Stock occupé",
                    data:
                      fullnessRows.map(
                        row => row.occupied
                      )
                  },
                  {
                    name: "Capacité libre",
                    data:
                      fullnessRows.map(
                        row => row.remaining
                      )
                  },
                  {
                    name: "Dépassement",
                    data:
                      fullnessRows.map(
                        row => row.overflow
                      )
                  }
                ]}
                type="bar"
                height={440}
              />
            )}
          </div>
        </div>

        {/* Top movements */}
        <div className="chart-card chart-card--full">
          <div className="chart-card__header">
            <h4 className="chart-card__title">
              Top 10 des mouvements
            </h4>

            <div className="chart-card__subtitle">
              Articles ayant le plus de sorties
              pendant l'année {selectedYear}
            </div>
          </div>

          <div className="chart-card__body">
            {loading ? (
              <div className="chart-loading">
                Chargement…
              </div>
            ) : topMovementRows.length === 0 ? (
              <div className="chart-empty">
                Aucun mouvement disponible.
              </div>
            ) : (
              <Chart
                options={movementOptions}
                series={[
                  {
                    name: "Quantité entrée",
                    data:
                      topMovementRows.map(
                        row => row.entrer
                      )
                  },
                  {
                    name: "Quantité sortie",
                    data:
                      topMovementRows.map(
                        row => row.sortie
                      )
                  }
                ]}
                type="bar"
                height={420}
              />
            )}
          </div>
        </div>
      </div>

      {/* Existing prediction */}
      <ForecastPage />
    </div>
  )
}

export default ChartsPage