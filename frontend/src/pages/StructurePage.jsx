import { useState } from "react"
import MagasinPage from "./MagasinPage"
import RayonPage from "./RayonPage"
import ZonePage from "./ZonePage"
import CasePage from "./CasePage"
import "./CrudPage.css"
import "./StructurePage.css"

const ROOT = { level: 0, magasin: null, rayon: null, zone: null }

function StructurePage() {
  const [nav, setNav] = useState(ROOT)

  function goToLevel(level) {
    setNav(current => ({
      level,
      magasin: level >= 1 ? current.magasin : null,
      rayon: level >= 2 ? current.rayon : null,
      zone: level >= 3 ? current.zone : null,
    }))
  }

  return (
    <div className="structure-page">
      <div className="structure-header">
        <div>
          <h1>Structure des entrepôts</h1>
          <p className="crud-subtitle">
            Parcourez la hiérarchie physique — magasin › rayon › zone › case — au lieu de quatre écrans séparés.
          </p>
        </div>
      </div>

      <div className="structure-crumbs">
        <button
          type="button"
          className={nav.level === 0 ? "structure-crumb structure-crumb--current" : "structure-crumb"}
          onClick={() => goToLevel(0)}
        >
          Tous les magasins
        </button>
        {nav.magasin && (
          <>
            <span className="structure-crumb-sep">›</span>
            <button
              type="button"
              className={nav.level === 1 ? "structure-crumb structure-crumb--current" : "structure-crumb"}
              onClick={() => goToLevel(1)}
            >
              {nav.magasin.nomMagasin}
            </button>
          </>
        )}
        {nav.rayon && (
          <>
            <span className="structure-crumb-sep">›</span>
            <button
              type="button"
              className={nav.level === 2 ? "structure-crumb structure-crumb--current" : "structure-crumb"}
              onClick={() => goToLevel(2)}
            >
              {nav.rayon.nomRayon || nav.rayon.codeRayon}
            </button>
          </>
        )}
        {nav.zone && (
          <>
            <span className="structure-crumb-sep">›</span>
            <span className="structure-crumb structure-crumb--current">
              Ligne {nav.zone.numeroLigne ?? "—"} · {nav.zone.codeZone}
            </span>
          </>
        )}
      </div>

      {nav.level === 0 && (
        <MagasinPage onDrill={magasin => setNav({ level: 1, magasin, rayon: null, zone: null })} />
      )}
      {nav.level === 1 && (
        <RayonPage
          filterMagasinId={nav.magasin.magasinId}
          onDrill={rayon => setNav({ level: 2, magasin: nav.magasin, rayon, zone: null })}
        />
      )}
      {nav.level === 2 && (
        <ZonePage
          filterRayonId={nav.rayon.rayonId}
          onDrill={zone => setNav({ level: 3, magasin: nav.magasin, rayon: nav.rayon, zone })}
        />
      )}
      {nav.level === 3 && (
        <CasePage filterZoneId={nav.zone.zoneId} />
      )}
    </div>
  )
}

export default StructurePage
