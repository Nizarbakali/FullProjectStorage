import { useEffect, useMemo, useState } from "react"
import {
  getCases,
  getArticles,
  getZones,
  getRayons,
  getMagasins
} from "../services/api"
import "./HeatmapPage.css"

function HeatmapPage() {
  const [cases, setCases] = useState([])
  const [articles, setArticles] = useState([])
  const [zones, setZones] = useState([])
  const [rayons, setRayons] = useState([])
  const [magasins, setMagasins] = useState([])

  const [selectedMagasinId, setSelectedMagasinId] =
    useState("")

  const [selectedRayonId, setSelectedRayonId] =
    useState("all")

  const [selectedCase, setSelectedCase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadHeatmap() {
      try {
        setLoading(true)
        setError("")

        const [
          caseData,
          articleData,
          zoneData,
          rayonData,
          magasinData
        ] = await Promise.all([
          getCases(),
          getArticles(),
          getZones(),
          getRayons(),
          getMagasins()
        ])

        const loadedCases = caseData || []
        const loadedArticles = articleData || []
        const loadedZones = zoneData || []
        const loadedRayons = rayonData || []
        const loadedMagasins = magasinData || []

        setCases(loadedCases)
        setArticles(loadedArticles)
        setZones(loadedZones)
        setRayons(loadedRayons)
        setMagasins(loadedMagasins)

        if (loadedMagasins.length > 0) {
          setSelectedMagasinId(currentValue => {
            if (currentValue) {
              return currentValue
            }

            return String(
              loadedMagasins[0].magasinId
            )
          })
        }
      } catch (err) {
        setError(
          err.message ||
          "Impossible de charger les données de la heatmap."
        )
      } finally {
        setLoading(false)
      }
    }

    loadHeatmap()
  }, [])

  /*
   * Connect every case to:
   * - its article
   * - its zone
   * - its rayon
   * - its magasin
   */
  const preparedCases = useMemo(() => {
    const zoneById = new Map(
      zones.map(zone => [
        Number(zone.zoneId),
        zone
      ])
    )

    const rayonById = new Map(
      rayons.map(rayon => [
        Number(rayon.rayonId),
        rayon
      ])
    )

    const magasinById = new Map(
      magasins.map(magasin => [
        Number(magasin.magasinId),
        magasin
      ])
    )

    return cases.map(currentCase => {
      const zone =
        zoneById.get(
          Number(currentCase.zoneId)
        ) || null

      const rayon = zone
        ? rayonById.get(
            Number(zone.rayonId)
          ) || null
        : null

      const magasin = rayon
        ? magasinById.get(
            Number(rayon.magasinId)
          ) || null
        : null

      return {
        ...currentCase,
        zone,
        rayon,
        magasin
      }
    })
  }, [
    cases,
    zones,
    rayons,
    magasins
  ])

  /*
   * The currently selected magasin.
   */
  const selectedMagasin = useMemo(() => {
    return (
      magasins.find(
        magasin =>
          Number(magasin.magasinId) ===
          Number(selectedMagasinId)
      ) || null
    )
  }, [
    magasins,
    selectedMagasinId
  ])

  /*
   * Rayons belonging to the selected magasin.
   */
  const availableRayons = useMemo(() => {
    if (!selectedMagasinId) {
      return []
    }

    return rayons.filter(
      rayon =>
        Number(rayon.magasinId) ===
        Number(selectedMagasinId)
    )
  }, [
    rayons,
    selectedMagasinId
  ])

  /*
   * Apply the rayon selection.
   */
  const displayedRayons = useMemo(() => {
    if (selectedRayonId === "all") {
      return availableRayons
    }

    return availableRayons.filter(
      rayon =>
        Number(rayon.rayonId) ===
        Number(selectedRayonId)
    )
  }, [
    availableRayons,
    selectedRayonId
  ])

  /*
   * Cases belonging to the selected magasin
   * and selected rayon.
   */
  const filteredCases = useMemo(() => {
    if (!selectedMagasinId) {
      return []
    }

    return preparedCases.filter(currentCase => {
      const matchesMagasin =
        Number(
          currentCase.magasin?.magasinId
        ) === Number(selectedMagasinId)

      const matchesRayon =
        selectedRayonId === "all" ||
        Number(
          currentCase.rayon?.rayonId
        ) === Number(selectedRayonId)

      return matchesMagasin && matchesRayon
    })
  }, [
    preparedCases,
    selectedMagasinId,
    selectedRayonId
  ])

  /*
   * Build the layout from all zones.
   *
   * This is important: we use the Zones list,
   * not only the cases list.
   *
   * Therefore, a zone appears even when it
   * contains no cases.
   */
  const groups = useMemo(() => {
    const casesByZoneId = new Map()

    filteredCases.forEach(currentCase => {
      const zoneId = Number(
        currentCase.zone?.zoneId ??
        currentCase.zoneId
      )

      if (!casesByZoneId.has(zoneId)) {
        casesByZoneId.set(zoneId, [])
      }

      casesByZoneId
        .get(zoneId)
        .push(currentCase)
    })

    return displayedRayons
      .map(rayon => {
        const rayonZones = zones
          .filter(
            zone =>
              Number(zone.rayonId) ===
              Number(rayon.rayonId)
          )
          .map(zone => {
            const zoneCases =
              casesByZoneId.get(
                Number(zone.zoneId)
              ) || []

            const sortedCases = [...zoneCases].sort(
              (a, b) => {
                const positionA =
                  a.positionCase ??
                  Number.MAX_SAFE_INTEGER

                const positionB =
                  b.positionCase ??
                  Number.MAX_SAFE_INTEGER

                return (
                  positionA - positionB ||
                  a.codeCase.localeCompare(
                    b.codeCase,
                    undefined,
                    {
                      numeric: true,
                      sensitivity: "base"
                    }
                  )
                )
              }
            )

            return {
              key: zone.zoneId,
              zoneId: zone.zoneId,
              zoneCode: zone.codeZone,
              numeroLigne: zone.numeroLigne,
              actif: zone.actif,
              cases: sortedCases
            }
          })
          .sort((a, b) => {
            const lineA =
              a.numeroLigne ??
              Number.MAX_SAFE_INTEGER

            const lineB =
              b.numeroLigne ??
              Number.MAX_SAFE_INTEGER

            return (
              lineA - lineB ||
              a.zoneCode.localeCompare(
                b.zoneCode,
                undefined,
                {
                  numeric: true,
                  sensitivity: "base"
                }
              )
            )
          })

        return {
          key: `${selectedMagasinId}-${rayon.rayonId}`,
          magasinCode:
            selectedMagasin?.codeMagasin ||
            "Sans magasin",
          rayonCode:
            rayon.codeRayon ||
            "Sans rayon",
          rayonName:
            rayon.nomRayon || "",
          zones: rayonZones
        }
      })
      .sort((a, b) =>
        a.rayonCode.localeCompare(
          b.rayonCode,
          undefined,
          {
            numeric: true,
            sensitivity: "base"
          }
        )
      )
  }, [
    filteredCases,
    displayedRayons,
    zones,
    selectedMagasin,
    selectedMagasinId
  ])

  function getStatus(currentCase) {
    if (currentCase.articlesCount === 0) {
      return "available"
    }

    const rate = currentCase.tauxOccupation ?? 0

    if (rate > 100 || currentCase.capaciteDepassee) {
      return "over"
    }

    if (rate >= 85) {
      return "critical"
    }

    if (rate >= 60) {
      return "warning"
    }

    return "normal"
  }

  function formatRate(rate) {
    if (
      rate === null ||
      rate === undefined
    ) {
      return "—"
    }

    return `${Number(rate).toFixed(1).replace(".0", "")}%`
  }

  function handleMagasinChange(event) {
    setSelectedMagasinId(
      event.target.value
    )

    setSelectedRayonId("all")
    setSelectedCase(null)
  }

  function handleRayonChange(event) {
    setSelectedRayonId(
      event.target.value
    )

    setSelectedCase(null)
  }

  const availableCount =
    filteredCases.filter(
      currentCase =>
        currentCase.articlesCount === 0
    ).length

  const overCapacityCasesCount =
    filteredCases.filter(
      currentCase => currentCase.capaciteDepassee
    ).length

  if (loading) {
    return (
      <div className="crud-loading">
        Chargement de la heatmap…
      </div>
    )
  }

  return (
    <div className="heatmap-page">
      {/* Header */}
      <div className="heatmap-header">
        <div>
          <h1>
            Heatmap du stockage
          </h1>

          <p>
            Visualisation de la pression
            du stock sur les capacités assignées
          </p>
        </div>

        <div className="heatmap-counters">
          <span>
            {filteredCases.length} cases
          </span>

          <span>
            {availableCount} disponibles
          </span>

          {overCapacityCasesCount > 0 && (
            <span className="heatmap-counter-danger">
              {overCapacityCasesCount} case
              {overCapacityCasesCount > 1
                ? "s"
                : ""}{" "}
              en dépassement
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="crud-banner crud-banner--error">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="heatmap-filters">
        <label>
          <span>Magasin</span>

          <select
            value={selectedMagasinId}
            onChange={handleMagasinChange}
            disabled={magasins.length === 0}
          >
            {magasins.map(magasin => (
              <option
                key={magasin.magasinId}
                value={magasin.magasinId}
              >
                {magasin.codeMagasin} —{" "}
                {magasin.nomMagasin}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Rayon</span>

          <select
            value={selectedRayonId}
            onChange={handleRayonChange}
            disabled={
              !selectedMagasinId ||
              availableRayons.length === 0
            }
          >
            <option value="all">
              Tous les rayons
            </option>

            {availableRayons.map(rayon => (
              <option
                key={rayon.rayonId}
                value={rayon.rayonId}
              >
                {rayon.codeRayon}
                {rayon.nomRayon
                  ? ` — ${rayon.nomRayon}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Legend */}
      <div className="heatmap-legend">
        <span>
          <i className="legend-color legend-available" />
          Disponible
        </span>

        <span>
          <i className="legend-color legend-normal" />
          0–59%
        </span>

        <span>
          <i className="legend-color legend-warning" />
          60–84%
        </span>

        <span>
          <i className="legend-color legend-critical" />
          85–100%
        </span>

        <span>
          <i className="legend-color legend-over" />
          Dépassement
        </span>
      </div>

      {/* Heatmap */}
      {groups.length === 0 ? (
        <div className="heatmap-empty">
          Aucun rayon ne correspond à la sélection.
        </div>
      ) : (
        <div className="heatmap-groups">
          {groups.map(group => (
            <section
              className="heatmap-group"
              key={group.key}
            >
              {/* Magasin and rayon */}
              <div className="heatmap-group-header">
                <strong>
                  {group.magasinCode} ›{" "}
                  {group.rayonCode}
                </strong>

                <span>
                  {group.zones.length} zone
                  {group.zones.length > 1
                    ? "s"
                    : ""}
                </span>
              </div>

              {group.zones.length === 0 ? (
                <div className="heatmap-zone-empty">
                  Aucune zone dans ce rayon.
                </div>
              ) : (
                <div className="heatmap-zone-rows">
                  {group.zones.map(zone => (
                    <div
                      className="heatmap-zone-row"
                      key={zone.key}
                    >
                      {/* Zone information */}
                      <div className="heatmap-zone-label">
                        <strong>
                          {zone.zoneCode}
                        </strong>

                        {zone.numeroLigne != null && (
                          <small>
                            Ligne{" "}
                            {zone.numeroLigne}
                          </small>
                        )}

                        {!zone.actif && (
                          <small className="heatmap-zone-inactive">
                            Inactive
                          </small>
                        )}
                      </div>

                      {/* Zone cases */}
                      <div className="heatmap-zone-grid">
                        {zone.cases.length === 0 ? (
                          <div className="heatmap-zone-empty">
                            Aucune case dans cette zone.
                          </div>
                        ) : (
                          zone.cases.map(
                            currentCase => {
                              const status =
                                getStatus(
                                  currentCase
                                )

                              return (
                                <button
                                  key={
                                    currentCase.caseId
                                  }
                                  type="button"
                                  className={
                                    `heatmap-cell ` +
                                    `heatmap-cell--${status}`
                                  }
                                  onClick={() =>
                                    setSelectedCase(
                                      currentCase
                                    )
                                  }
                                >
                                  <strong>
                                    {
                                      currentCase
                                        .codeCase
                                    }
                                  </strong>

                                  <span>
                                    {currentCase.articlesCount === 0
                                      ? "Disponible"
                                      : `${currentCase.articlesCount} article${currentCase.articlesCount > 1 ? "s" : ""}`}
                                  </span>

                                  {currentCase.articlesCount > 0 && (
                                    <small>
                                      {formatRate(
                                        currentCase.tauxOccupation
                                      )}
                                    </small>
                                  )}
                                </button>
                              )
                            }
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Selected case details */}
      {selectedCase && (
        <div className="heatmap-details">
          <div className="heatmap-details-header">
            <div>
              <h3>
                {selectedCase.codeCase}
              </h3>

              <p>
                {selectedCase.magasin
                  ?.codeMagasin ||
                  "Sans magasin"}{" "}
                ›{" "}
                {selectedCase.rayon
                  ?.codeRayon ||
                  "Sans rayon"}{" "}
                ›{" "}
                {selectedCase.zone
                  ?.codeZone ||
                  selectedCase.codeZone ||
                  "Sans zone"}
              </p>
            </div>

            <button
              type="button"
              className="heatmap-close"
              onClick={() =>
                setSelectedCase(null)
              }
              aria-label="Fermer les détails"
            >
              ✕
            </button>
          </div>

          {selectedCase.articlesCount === 0 ? (
            <p className="heatmap-available-message">
              Cette case est disponible.
              Capacité maximale :{" "}
              <strong>
                {selectedCase.capaciteMaximum}
              </strong>
            </p>
          ) : (
            <div className="heatmap-details-grid">
              <div>
                <span>Articles stockés</span>

                <strong>
                  {selectedCase.articlesCount}
                </strong>
              </div>

              <div>
                <span>Quantité actuelle</span>

                <strong>
                  {selectedCase.quantiteActuelle}
                </strong>
              </div>

              <div>
                <span>
                  Capacité maximale
                </span>

                <strong>
                  {
                    selectedCase
                      .capaciteMaximum
                  }
                </strong>
              </div>

              <div>
                <span>
                  Taux d'occupation
                </span>

                <strong>
                  {formatRate(
                    selectedCase.tauxOccupation
                  )}
                </strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default HeatmapPage