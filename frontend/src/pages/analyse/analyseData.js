import { useCallback, useEffect, useState } from "react"
import {
  getArticles,
  getCases,
  getMagasins,
  getMonthlyData,
  getRayons,
  getZones,
} from "../../services/api"

/*
 * Shared, read-only data layer for the "Analyse" visualization suite.
 *
 * The Occupation view reads from the same six
 * existing GET endpoints and the same derived model, so a colour, a rate or a
 * reconstructed stock level always means the same thing across tabs.
 *
 * Nothing here writes, and nothing here touches storage or forecast logic — the
 * monthly time series is rebuilt on the client from the raw movement rows that
 * /api/MonthlyData already returns.
 */

// ── Occupancy buckets ────────────────────────────────────────────────────────
// Same thresholds and colours the legacy heatmap legend used, kept identical so
// the whole section stays visually consistent.
export const OCC_COLORS = {
  empty: "#64748b",
  normal: "#22c55e",
  warning: "#eab308",
  critical: "#f97316",
  over: "#ef4444",
}

export const OCC_LABELS = {
  empty: "Vide",
  normal: "0–59 %",
  warning: "60–84 %",
  critical: "85–100 %",
  over: "Dépassement",
}

function occupancyBucket(rate, hasStock = true) {
  if (!hasStock || rate == null || rate <= 0) return "empty"
  if (rate > 100) return "over"
  if (rate >= 85) return "critical"
  if (rate >= 60) return "warning"
  return "normal"
}

export function occColor(rate, hasStock = true) {
  return OCC_COLORS[occupancyBucket(rate, hasStock)]
}

// ── Month helpers ────────────────────────────────────────────────────────────
// API `mois` is an ISO date whose day component is always 01 (e.g. 2024-03-01).
function monthKey(mois) {
  return typeof mois === "string" ? mois.slice(0, 7) : ""
}

// ── Number helpers ──────────────────────────────────────────────────────────
function pct(part, whole) {
  if (!whole || whole <= 0) return 0
  return Math.round((part / whole) * 1000) / 10
}

export function fmt(value) {
  return Math.round(Number(value) || 0).toLocaleString("fr-FR")
}

// ── Model builder ───────────────────────────────────────────────────────────
function buildModel(raw) {
  const { cases, articles, zones, rayons, magasins, movements } = raw

  const magasinById = new Map(magasins.map(m => [Number(m.magasinId), m]))
  const rayonById = new Map(rayons.map(r => [Number(r.rayonId), r]))
  const zoneById = new Map(zones.map(z => [Number(z.zoneId), z]))
  const caseById = new Map(cases.map(c => [Number(c.caseId), c]))

  // Every case, wired up to its zone / rayon / magasin and its occupancy bucket.
  const casesEnriched = cases.map(c => {
    const zone = zoneById.get(Number(c.zoneId)) ?? null
    const rayon = zone ? rayonById.get(Number(zone.rayonId)) ?? null : null
    const magasin = rayon ? magasinById.get(Number(rayon.magasinId)) ?? null : null
    const rate = Number(c.tauxOccupation ?? 0)
    return {
      ...c,
      caseId: Number(c.caseId),
      zone,
      rayon,
      magasin,
      rate,
      bucket: occupancyBucket(rate, Number(c.quantiteActuelle ?? 0) > 0),
      overflow: Boolean(c.capaciteDepassee),
    }
  })

  // ── Sorted distinct months across all movements ──
  const monthSet = new Set()
  movements.forEach(mv => {
    const key = monthKey(mv.mois)
    if (key) monthSet.add(key)
  })
  const months = [...monthSet].sort()

  // ── Movements grouped by case (spatial) and by article (totals) ──
  const movementsByCase = new Map()
  const movementsByArticle = new Map()
  let legacyMovementCount = 0
  movements.forEach(mv => {
    const key = monthKey(mv.mois)
    if (!key) return
    const delta = Number(mv.quantiteEntrer || 0) - Number(mv.quantiteSortie || 0)
    const row = { key, delta, articleId: Number(mv.articleId), caseId: mv.caseId == null ? null : Number(mv.caseId) }

    if (!movementsByArticle.has(row.articleId)) movementsByArticle.set(row.articleId, [])
    movementsByArticle.get(row.articleId).push(row)

    if (row.caseId == null || !caseById.has(row.caseId)) {
      legacyMovementCount += 1
      return
    }
    if (!movementsByCase.has(row.caseId)) movementsByCase.set(row.caseId, [])
    movementsByCase.get(row.caseId).push(row)
  })

  // Running cumulative Σ(entrées − sorties) per month for an arbitrary set of
  // case ids. Returns a value for every month in `months` (carried forward).
  function stockSeriesForCases(caseIds) {
    const wanted = caseIds instanceof Set ? caseIds : new Set(caseIds.map(Number))
    const perMonth = new Map(months.map(m => [m, 0]))
    wanted.forEach(id => {
      const rows = movementsByCase.get(Number(id))
      if (!rows) return
      rows.forEach(r => perMonth.set(r.key, (perMonth.get(r.key) ?? 0) + r.delta))
    })
    let running = 0
    return months.map(m => {
      running += perMonth.get(m) ?? 0
      return Math.max(0, Math.round(running))
    })
  }

  function stockSeriesForArticle(articleId) {
    const rows = movementsByArticle.get(Number(articleId)) ?? []
    const perMonth = new Map(months.map(m => [m, 0]))
    rows.forEach(r => perMonth.set(r.key, (perMonth.get(r.key) ?? 0) + r.delta))
    let running = 0
    return months.map(m => {
      running += perMonth.get(m) ?? 0
      return Math.max(0, Math.round(running))
    })
  }

  // ── Hierarchy: magasin → rayon → zone → case, aggregated bottom-up ──
  function aggregate(node) {
    if (node.kind === "case") {
      node.capacity = Number(node.raw.capaciteMaximum ?? 0)
      node.stock = Number(node.raw.quantiteActuelle ?? 0)
      node.overflowCount = node.raw.overflow ? 1 : 0
      node.emptyCount = node.stock > 0 ? 0 : 1
      node.caseCount = 1
    } else {
      node.capacity = 0
      node.stock = 0
      node.overflowCount = 0
      node.emptyCount = 0
      node.caseCount = 0
      node.children.forEach(child => {
        aggregate(child)
        node.capacity += child.capacity
        node.stock += child.stock
        node.overflowCount += child.overflowCount
        node.emptyCount += child.emptyCount
        node.caseCount += child.caseCount
      })
    }
    node.rate = pct(node.stock, node.capacity)
    node.free = Math.max(0, node.capacity - node.stock)
    node.bucket = occupancyBucket(node.rate, node.stock > 0)
    return node
  }

  const casesByZone = new Map()
  casesEnriched.forEach(c => {
    const zid = Number(c.zoneId)
    if (!casesByZone.has(zid)) casesByZone.set(zid, [])
    casesByZone.get(zid).push(c)
  })

  const hierarchy = magasins.map(m => {
    const magasinNode = {
      kind: "magasin",
      id: Number(m.magasinId),
      code: m.codeMagasin,
      name: m.nomMagasin,
      actif: m.actif,
      raw: m,
      children: rayons
        .filter(r => Number(r.magasinId) === Number(m.magasinId))
        .map(r => ({
          kind: "rayon",
          id: Number(r.rayonId),
          code: r.codeRayon,
          name: r.nomRayon ?? "",
          actif: r.actif,
          raw: r,
          children: zones
            .filter(z => Number(z.rayonId) === Number(r.rayonId))
            .map(z => ({
              kind: "zone",
              id: Number(z.zoneId),
              code: z.codeZone,
              name: z.nomRayon ?? "",
              actif: z.actif,
              raw: z,
              children: (casesByZone.get(Number(z.zoneId)) ?? [])
                .slice()
                .sort((a, b) =>
                  (a.positionCase ?? 1e9) - (b.positionCase ?? 1e9) ||
                  String(a.codeCase).localeCompare(String(b.codeCase), undefined, { numeric: true }))
                .map(c => ({
                  kind: "case",
                  id: c.caseId,
                  code: c.codeCase,
                  name: c.fullLocation ?? "",
                  actif: true,
                  raw: c,
                  children: [],
                })),
            })),
        })),
    }
    return aggregate(magasinNode)
  })

  const totals = aggregate({
    kind: "root",
    id: 0,
    code: "Tous",
    name: "Tous les sites",
    children: hierarchy,
    raw: null,
  })

  // ── Article distribution (latest cumulative stock) ──
  // article id → { zoneId → stock, caseId → stock, zones:Set, cases:Set }
  const distribution = new Map()
  articles.forEach(a => {
    distribution.set(Number(a.articleId), {
      article: a,
      byZone: new Map(),
      byCase: new Map(),
      cases: new Set(),
      zones: new Set(),
      rayons: new Set(),
    })
  })

  movementsByCase.forEach((rows, caseId) => {
    const c = caseById.get(Number(caseId))
    if (!c) return
    const zone = zoneById.get(Number(c.zoneId))
    const zoneId = zone ? Number(zone.zoneId) : null
    const rayonId = zone ? Number(zone.rayonId) : null
    // stock per article in this case
    const perArticle = new Map()
    rows.forEach(r => perArticle.set(r.articleId, (perArticle.get(r.articleId) ?? 0) + r.delta))
    perArticle.forEach((stock, articleId) => {
      const bucket = distribution.get(Number(articleId))
      if (!bucket) return
      const value = Math.max(0, Math.round(stock))
      bucket.byCase.set(Number(caseId), value)
      if (value > 0) bucket.cases.add(Number(caseId))
      if (zoneId != null) {
        bucket.byZone.set(zoneId, (bucket.byZone.get(zoneId) ?? 0) + value)
        if (value > 0) bucket.zones.add(zoneId)
      }
      if (rayonId != null && value > 0) bucket.rayons.add(rayonId)
    })
  })

  // case id → Set(article ids with non-zero stock) — "bin diversity"
  const caseArticleCount = new Map()
  movementsByCase.forEach((rows, caseId) => {
    const perArticle = new Map()
    rows.forEach(r => perArticle.set(r.articleId, (perArticle.get(r.articleId) ?? 0) + r.delta))
    const distinct = new Set()
    perArticle.forEach((stock, articleId) => {
      if (Math.round(stock) > 0) distinct.add(articleId)
    })
    caseArticleCount.set(Number(caseId), distinct)
  })

  return {
    raw,
    magasins,
    rayons,
    zones,
    cases: casesEnriched,
    articles,
    magasinById,
    rayonById,
    zoneById,
    caseById,
    months,
    hierarchy,
    totals,
    legacyMovementCount,
    stockSeriesForCases,
    stockSeriesForArticle,
    distribution,
    caseArticleCount,
  }
}

// ── Hook with a small shared cache ──────────────────────────────────────────
let cache = null
let cacheAt = 0

export function useAnalyseData({ maxAgeMs = 60000 } = {}) {
  // `cache` is a plain object ref, so reading it here stays pure; staleness is
  // re-checked inside run() (a callback, not the render path).
  const [state, setState] = useState(
    cache
      ? { loading: false, error: "", data: cache }
      : { loading: true, error: "", data: null },
  )

  const run = useCallback(async (force) => {
    if (!force && cache && Date.now() - cacheAt < maxAgeMs) {
      setState({ loading: false, error: "", data: cache })
      return
    }
    setState(prev => ({ ...prev, loading: true, error: "" }))
    try {
      const [cases, articles, zones, rayons, magasins, movements] = await Promise.all([
        getCases(), getArticles(), getZones(), getRayons(), getMagasins(), getMonthlyData(),
      ])
      const model = buildModel({
        cases: cases || [],
        articles: articles || [],
        zones: zones || [],
        rayons: rayons || [],
        magasins: magasins || [],
        movements: movements || [],
      })
      cache = model
      cacheAt = Date.now()
      setState({ loading: false, error: "", data: model })
    } catch (err) {
      setState({
        loading: false,
        error: err.message || "Impossible de charger les données d'analyse.",
        data: null,
      })
    }
  }, [maxAgeMs])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    run(false)
  }, [run])

  return { ...state, refresh: () => run(true) }
}
