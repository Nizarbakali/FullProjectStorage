import { useMemo, useState } from "react"
import { OCC_COLORS, OCC_LABELS, fmt, occColor, useAnalyseData } from "./analyseData"
import "./analyse.css"
import "./plan.css"

/*
 * Plan d'entrepôt — a schematic floor plan rather than an abstract chart.
 *
 * The hierarchy is drawn the way the warehouse is actually walked: a magasin is
 * a floor, each rayon an aisle, each zone a labelled section of that aisle, and
 * each case a rack bin. A bin is filled bottom-up in proportion to its real
 * occupancy, so the level is read directly instead of being decoded from a
 * colour — the colour only carries the threshold band on top of that.
 *
 * Bin widths are proportional to capacity (flexGrow), so a wide bin really does
 * hold more than a narrow one and an aisle's visual mass matches its storage
 * mass.
 */

const MIN_BIN_FLEX = 0.35   // keeps a very small case clickable next to a big one

function ratePct(node) {
  return Math.max(0, Math.min(100, Number(node.rate ?? 0)))
}

/* ── One rack bin = one Case ────────────────────────────────────────── */
function Bin({ node, selected, onSelect }) {
  const fill = ratePct(node)
  const over = node.overflowCount > 0
  const color = occColor(node.rate, node.stock > 0)

  return (
    <button
      type="button"
      className={
        "plan-bin" +
        (over ? " plan-bin--over" : "") +
        (selected ? " is-selected" : "") +
        (node.stock <= 0 ? " plan-bin--empty" : "")
      }
      style={{ flexGrow: Math.max(node.capacity, MIN_BIN_FLEX), flexBasis: 0 }}
      onClick={() => onSelect(node)}
      title={
        `Case ${node.code} — ${fmt(node.stock)}/${fmt(node.capacity)} ` +
        `(${node.rate}%)` + (over ? " · dépassement" : "")
      }
    >
      <span className="plan-bin__level" style={{ height: `${fill}%`, background: color }} />
      {over && <span className="plan-bin__spill" />}
      <span className="plan-bin__code">{node.code}</span>
    </button>
  )
}

/* ── One aisle = one Rayon, its zones laid out along it ─────────────── */
function Aisle({ rayon, index, selectedId, onSelect }) {
  const zones = rayon.children.filter(z => z.capacity > 0 || z.children.length > 0)

  return (
    <section className="plan-aisle">
      <header className="plan-aisle__head">
        <span className="plan-aisle__tag">Allée {index + 1}</span>
        <b>{rayon.code}</b>
        {rayon.name && <small>{rayon.name}</small>}
        <span className="plan-aisle__stat">
          {fmt(rayon.stock)} / {fmt(rayon.capacity)}
          <i style={{ color: occColor(rayon.rate, rayon.stock > 0) }}>{rayon.rate}%</i>
        </span>
      </header>

      {zones.length === 0 ? (
        <p className="plan-aisle__empty">Aucune zone dans cette allée.</p>
      ) : (
        <div className="plan-aisle__zones">
          {zones.map(zone => (
            <div className="plan-zone" key={zone.id}>
              <div className="plan-zone__label">
                <b>{zone.code}</b>
                <small>{zone.caseCount} case{zone.caseCount > 1 ? "s" : ""}</small>
              </div>
              <div className="plan-zone__bins">
                {zone.children.length === 0 ? (
                  <span className="plan-zone__empty">vide</span>
                ) : (
                  zone.children.map(c => (
                    <Bin
                      key={c.id}
                      node={c}
                      selected={selectedId === c.id}
                      onSelect={onSelect}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function PlanView() {
  const { loading, error, data, refresh } = useAnalyseData()
  const [magasinId, setMagasinId] = useState(null)
  const [selected, setSelected] = useState(null)

  const sites = useMemo(() => data?.hierarchy ?? [], [data])

  // Default to the first site that actually has capacity to draw.
  const site = useMemo(() => {
    if (!sites.length) return null
    if (magasinId != null) {
      return sites.find(s => s.id === magasinId) ?? sites[0]
    }
    return sites.find(s => s.capacity > 0) ?? sites[0]
  }, [sites, magasinId])

  const aisles = useMemo(
    () => (site?.children ?? []).filter(r => r.caseCount > 0 || r.children.length > 0),
    [site]
  )

  // Split the aisles in two banks so the plan reads as a floor with a central
  // corridor rather than one long list.
  const [left, right] = useMemo(() => {
    const half = Math.ceil(aisles.length / 2)
    return [aisles.slice(0, half), aisles.slice(half)]
  }, [aisles])

  const articleCount = selected
    ? (data?.caseArticleCount?.get(selected.id)?.size ?? 0)
    : 0

  if (error) {
    return (
      <div className="vz">
        <div className="vz-error">{error}</div>
        <button type="button" className="vz-btn" onClick={refresh}>Réessayer</button>
      </div>
    )
  }

  if (loading && !data) {
    return <div className="vz"><div className="vz-empty">Chargement du plan…</div></div>
  }

  const totals = data?.totals
  const full = data?.cases?.filter(c => c.rate >= 100).length ?? 0

  return (
    <div className="vz">
      <div className="vz-head">
        <div>
          <h1>Plan d’entrepôt</h1>
          <p className="vz-note">
            Chaque allée est un rayon, chaque bloc une zone, chaque casier une Case.
            La hauteur remplie correspond au taux d’occupation réel.
          </p>
        </div>
        <div className="vz-head__actions">
          <button type="button" className="vz-btn" onClick={refresh}>↻ Rafraîchir</button>
        </div>
      </div>

      <div className="vz-rail">
        <div className="vz-stat">
          <span className="vz-stat__label">Occupation globale</span>
          <span className="vz-stat__value">{totals?.rate ?? 0}%</span>
        </div>
        <div className="vz-stat">
          <span className="vz-stat__label">Stock / capacité</span>
          <span className="vz-stat__value">{fmt(totals?.stock)}</span>
          <span className="vz-stat__hint">sur {fmt(totals?.capacity)}</span>
        </div>
        <div className="vz-stat">
          <span className="vz-stat__label">Place libre</span>
          <span className="vz-stat__value">{fmt(totals?.free)}</span>
        </div>
        <div className="vz-stat">
          <span className="vz-stat__label">Cases pleines</span>
          <span className="vz-stat__value">{full}</span>
          <span className="vz-stat__hint">sur {totals?.caseCount ?? 0}</span>
        </div>
        <div className="vz-stat">
          <span className="vz-stat__label">Dépassements</span>
          <span className="vz-stat__value">{totals?.overflowCount ?? 0}</span>
          {(totals?.overflowCount ?? 0) > 0 && (
            <span className="vz-stat__hint vz-stat__hint--danger">à traiter</span>
          )}
        </div>
      </div>

      {sites.length > 1 && (
        <div className="plan-sites">
          {sites.map(s => (
            <button
              key={s.id}
              type="button"
              className={"plan-site" + (site?.id === s.id ? " is-active" : "")}
              onClick={() => { setMagasinId(s.id); setSelected(null) }}
            >
              <b>{s.code}</b>
              <small>{s.caseCount} cases · {s.rate}%</small>
            </button>
          ))}
        </div>
      )}

      <div className="plan-legend">
        {Object.entries(OCC_LABELS).map(([key, label]) => (
          <span className="plan-legend__item" key={key}>
            <i style={{ background: OCC_COLORS[key] }} />
            {label}
          </span>
        ))}
      </div>

      {aisles.length === 0 ? (
        <div className="vz-empty">Ce site ne contient aucune allée à afficher.</div>
      ) : (
        <div className="plan-floor">
          <div className="plan-bank">
            {left.map((r, i) => (
              <Aisle
                key={r.id}
                rayon={r}
                index={i}
                selectedId={selected?.id}
                onSelect={setSelected}
              />
            ))}
          </div>

          {right.length > 0 && (
            <div className="plan-corridor" aria-hidden="true">
              <span>couloir</span>
            </div>
          )}

          <div className="plan-bank">
            {right.map((r, i) => (
              <Aisle
                key={r.id}
                rayon={r}
                index={left.length + i}
                selectedId={selected?.id}
                onSelect={setSelected}
              />
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="vz-card plan-detail">
          <div className="vz-card__head">
            <h3>Case {selected.code}</h3>
            <button type="button" className="vz-btn" onClick={() => setSelected(null)}>
              Fermer
            </button>
          </div>
          <div className="vz-card__body">
            <p className="vz-note">{selected.name}</p>
            <div className="vz-detail">
              <div>
                <span>Occupation</span>
                <strong style={{ color: occColor(selected.rate, selected.stock > 0) }}>
                  {selected.rate}%
                </strong>
              </div>
              <div><span>Stock</span><strong>{fmt(selected.stock)}</strong></div>
              <div><span>Capacité</span><strong>{fmt(selected.capacity)}</strong></div>
              <div><span>Restant</span><strong>{fmt(selected.free)}</strong></div>
              <div><span>Articles</span><strong>{articleCount}</strong></div>
              <div>
                <span>État</span>
                <strong>{OCC_LABELS[selected.bucket]}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlanView
