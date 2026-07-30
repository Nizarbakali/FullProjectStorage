import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import L from "leaflet"
import "leaflet/dist/leaflet.css"

import { getMagasins } from "../services/api"

import "./CrudPage.css"
import "./MagasinMapPage.css"

const WORLD_CENTER = [25, 0]

function hasCoordinates(magasin) {
  const latitude = Number(magasin.latitude)
  const longitude = Number(magasin.longitude)

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

function createWarehouseIcon(
  magasin,
  selected
) {
  const statusClass = magasin.actif
    ? "is-active"
    : "is-inactive"

  const selectedClass = selected
    ? "is-selected"
    : ""

  return L.divIcon({
    className: "warehouse-marker-wrapper",

    html: `
      <span class="warehouse-marker ${statusClass} ${selectedClass}">
        <span
          class="warehouse-marker__building"
          aria-hidden="true"
        >
          ▦
        </span>
      </span>
    `,

    iconSize: [46, 56],
    iconAnchor: [23, 52],
  })
}

function MapPage() {
  const [magasins, setMagasins] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  const [selectedId, setSelectedId] =
    useState(null)

  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markersLayerRef = useRef(null)
  const markerRefs = useRef(new Map())

  const selectedMagasin = useMemo(() => {
    return (
      magasins.find(
        (magasin) =>
          magasin.magasinId === selectedId
      ) ?? null
    )
  }, [magasins, selectedId])

  const locatedMagasins = useMemo(() => {
    return magasins.filter(hasCoordinates)
  }, [magasins])

  const unlocatedCount =
    magasins.length -
    locatedMagasins.length

  async function load() {
    try {
      setLoading(true)
      setError("")

      const data = await getMagasins()

      setMagasins(data)

      setSelectedId((currentId) => {
        const stillExists = data.some(
          (magasin) =>
            magasin.magasinId === currentId
        )

        return stillExists
          ? currentId
          : null
      })
    } catch (err) {
      setError(
        err.message ||
          "Impossible de charger la carte des magasins."
      )
    } finally {
      setLoading(false)
    }
  }

  // Load warehouses.
  useEffect(() => {
    const timer = window.setTimeout(
      () => load(),
      0
    )

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  // Initialize the map.
  useEffect(() => {
    if (
      !mapContainerRef.current ||
      mapRef.current
    ) {
      return
    }

    const map = L.map(
      mapContainerRef.current,
      {
        center: WORLD_CENTER,
        zoom: 2,
        minZoom: 2,
        maxZoom: 18,
        worldCopyJump: true,
        zoomControl: false,
      }
    )

    L.control
      .zoom({
        position: "bottomright",
      })
      .addTo(map)

    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,

        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">' +
          "OpenStreetMap</a> contributors",
      }
    ).addTo(map)

    markersLayerRef.current =
      L.layerGroup().addTo(map)

    map.on("click", () => {
      setSelectedId(null)
    })

    mapRef.current = map

    const resizeTimer =
      window.setTimeout(
        () => map.invalidateSize(),
        0
      )

    const markers = markerRefs.current

    return () => {
      window.clearTimeout(resizeTimer)

      markers.clear()
      map.remove()

      mapRef.current = null
      markersLayerRef.current = null
    }
  }, [])

  // Display warehouse markers.
  useEffect(() => {
    const map = mapRef.current
    const layer = markersLayerRef.current

    if (!map || !layer) {
      return
    }

    layer.clearLayers()
    markerRefs.current.clear()

    const coordinates = []

    locatedMagasins.forEach(
      (magasin) => {
        const position = [
          Number(magasin.latitude),
          Number(magasin.longitude),
        ]

        const marker = L.marker(
          position,
          {
            icon: createWarehouseIcon(
              magasin,
              false
            ),

            keyboard: true,

            title:
              `${magasin.nomMagasin} — ` +
              `${magasin.ville}, ` +
              `${magasin.pays}`,

            alt:
              `Magasin ${magasin.nomMagasin}`,

            riseOnHover: true,
          }
        )

        marker.on("click", () => {
          setSelectedId(
            magasin.magasinId
          )
        })

        marker.addTo(layer)

        markerRefs.current.set(
          magasin.magasinId,
          marker
        )

        coordinates.push(position)
      }
    )

    if (coordinates.length === 0) {
      map.setView(WORLD_CENTER, 2)
    } else if (
      coordinates.length === 1
    ) {
      map.setView(
        coordinates[0],
        8
      )
    } else {
      map.fitBounds(coordinates, {
        padding: [55, 55],
        maxZoom: 7,
      })
    }
  }, [locatedMagasins])

  // Highlight the selected warehouse.
  useEffect(() => {
    markerRefs.current.forEach(
      (marker, magasinId) => {
        const magasin = magasins.find(
          (item) =>
            item.magasinId === magasinId
        )

        if (!magasin) {
          return
        }

        const selected =
          magasinId === selectedId

        marker.setIcon(
          createWarehouseIcon(
            magasin,
            selected
          )
        )

        marker.setZIndexOffset(
          selected ? 1000 : 0
        )
      }
    )

    if (
      selectedMagasin &&
      hasCoordinates(selectedMagasin) &&
      mapRef.current
    ) {
      const position = [
        Number(
          selectedMagasin.latitude
        ),
        Number(
          selectedMagasin.longitude
        ),
      ]

      const targetZoom = Math.max(
        mapRef.current.getZoom(),
        6
      )

      mapRef.current.flyTo(
        position,
        targetZoom,
        {
          duration: 0.65,
        }
      )
    }
  }, [
    magasins,
    selectedId,
    selectedMagasin,
  ])

  function showAllMagasins() {
    const map = mapRef.current

    if (!map) {
      return
    }

    setSelectedId(null)

    const coordinates =
      locatedMagasins.map(
        (magasin) => [
          Number(magasin.latitude),
          Number(magasin.longitude),
        ]
      )

    if (coordinates.length === 0) {
      map.setView(WORLD_CENTER, 2)
    } else if (
      coordinates.length === 1
    ) {
      map.flyTo(
        coordinates[0],
        8,
        {
          duration: 0.65,
        }
      )
    } else {
      map.fitBounds(coordinates, {
        padding: [55, 55],
        maxZoom: 7,
      })
    }
  }

  return (
    <div className="crud-page magasin-map-page">
      <div className="crud-header">
        <div>
          <h1>Carte des magasins</h1>

          <p className="crud-subtitle">
            {magasins.length} magasin
            {magasins.length !== 1
              ? "s"
              : ""}{" "}
            dans le système · cliquez sur un
            marqueur pour l’inspecter
          </p>
        </div>

        <span className="badge badge--blue">
          Lecture seule
        </span>
      </div>

      {error && (
        <div className="crud-banner crud-banner--error">
          {error}
        </div>
      )}

      {unlocatedCount > 0 && (
        <div className="crud-banner crud-banner--error">
          {unlocatedCount} magasin
          {unlocatedCount > 1
            ? "s"
            : ""}{" "}
          ne{" "}
          {unlocatedCount > 1
            ? "peuvent"
            : "peut"}{" "}
          pas être affiché
          {unlocatedCount > 1
            ? "s"
            : ""}{" "}
          sur la carte.
        </div>
      )}

      <section className="magasin-map-workspace">
        <div className="magasin-map-shell">
          <div className="magasin-map-toolbar">
            <div className="magasin-map-legend">
              <span>
                <i className="legend-dot legend-dot--active" />
                Actif
              </span>

              <span>
                <i className="legend-dot legend-dot--inactive" />
                Inactif
              </span>
            </div>

            <button
              type="button"
              className="magasin-map-reset"
              onClick={showAllMagasins}
            >
              Voir tous
            </button>
          </div>

          <div
            ref={mapContainerRef}
            className="magasin-map"
            aria-label="Carte mondiale interactive des magasins"
          />

          {loading && (
            <div className="magasin-map-loading">
              Mise à jour de la carte…
            </div>
          )}
        </div>

        <aside className="magasin-inspector">
          {selectedMagasin ? (
            <>
              <div className="magasin-inspector__top">
                <div>
                  <span className="magasin-inspector__eyebrow">
                    Magasin sélectionné
                  </span>

                  <h2>
                    {
                      selectedMagasin.nomMagasin
                    }
                  </h2>
                </div>

                <button
                  type="button"
                  className="magasin-inspector__close"
                  aria-label="Fermer les détails"
                  onClick={() =>
                    setSelectedId(null)
                  }
                >
                  ×
                </button>
              </div>

              <div className="magasin-inspector__location">
                <span
                  className="magasin-inspector__pin"
                  aria-hidden="true"
                >
                  ●
                </span>

                <div>
                  <strong>
                    {selectedMagasin.ville}
                  </strong>

                  <span>
                    {selectedMagasin.pays}
                  </span>
                </div>
              </div>

              <dl className="magasin-inspector__facts">
                <div>
                  <dt>Code</dt>

                  <dd>
                    {
                      selectedMagasin.codeMagasin
                    }
                  </dd>
                </div>

                <div>
                  <dt>Rayons</dt>

                  <dd>
                    {
                      selectedMagasin.rayonsCount
                    }
                  </dd>
                </div>

                <div>
                  <dt>Statut</dt>

                  <dd>
                    <span
                      className={
                        `badge badge--${
                          selectedMagasin.actif
                            ? "green"
                            : "red"
                        }`
                      }
                    >
                      {selectedMagasin.actif
                        ? "Actif"
                        : "Inactif"}
                    </span>
                  </dd>
                </div>

                <div>
                  <dt>Coordonnées</dt>

                  <dd className="magasin-inspector__coordinates">
                    {hasCoordinates(
                      selectedMagasin
                    )
                      ? `${Number(
                          selectedMagasin.latitude
                        ).toFixed(4)}, ${Number(
                          selectedMagasin.longitude
                        ).toFixed(4)}`
                      : "Non localisé"}
                  </dd>
                </div>
              </dl>

              <p
                style={{
                  marginTop: "1.5rem",
                  color: "var(--text-muted)",
                  fontSize: "0.78rem",
                  lineHeight: 1.6,
                }}
              >
                Pour modifier ou supprimer ce
                magasin, utilisez l’onglet
                Magasins.
              </p>
            </>
          ) : (
            <div className="magasin-inspector__empty">
              <span
                className="magasin-inspector__empty-icon"
                aria-hidden="true"
              >
                ◎
              </span>

              <h2>Inspecter un magasin</h2>

              <p>
                Cliquez sur un marqueur pour
                consulter sa localisation, son
                statut et son nombre de rayons.
              </p>

              <div className="magasin-inspector__count">
                <strong>
                  {locatedMagasins.length}
                </strong>

                <span>
                  magasin
                  {locatedMagasins.length !== 1
                    ? "s"
                    : ""}{" "}
                  localisé
                  {locatedMagasins.length !== 1
                    ? "s"
                    : ""}
                </span>
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  )
}

export default MapPage