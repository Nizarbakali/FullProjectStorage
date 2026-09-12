import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import {
  createCase,
  deleteCase,
  getCases,
  getZones,
  updateCase,
} from "../services/api"
import Pagination from "../components/Pagination"
import "./CrudPage.css"

const EMPTY_FORM = {
  zoneId: "",
  codeCase: "",
  positionCase: "",
  capaciteMaximum: "",
}

function CasePage({ filterZoneId } = {}) {
  const role = useSelector((state) => state.auth.role)
  const isAdmin = role === "admin"
  const [cases, setCases] = useState([])
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  async function load() {
    try {
      setLoading(true)
      setError("")
      const [caseRows, zoneRows] = await Promise.all([
        getCases(),
        getZones(),
      ])
      setCases(caseRows)
      setZones(zoneRows)
    } catch (err) {
      setError(err.message || "Impossible de charger les Cases.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial API synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  function openAdd() {
    setEditId(null)
    setForm({
      ...EMPTY_FORM,
      zoneId: filterZoneId ?? zones[0]?.zoneId ?? "",
    })
    setShowForm(true)
    setError("")
  }

  const visibleCases = filterZoneId
    ? cases.filter(c => Number(c.zoneId) === Number(filterZoneId))
    : cases

  // Zone imposée : uniquement à la création, et seulement si on navigue dans
  // une zone précise. En modification le select reste disponible pour pouvoir
  // déplacer une Case d'une zone à l'autre.
  const lockedZone = filterZoneId && editId === null
    ? zones.find(z => Number(z.zoneId) === Number(filterZoneId)) ?? { codeZone: "Zone courante" }
    : null

  function openEdit(storageCase) {
    setEditId(storageCase.caseId)
    setForm({
      zoneId: storageCase.zoneId,
      codeCase: storageCase.codeCase,
      positionCase: storageCase.positionCase ?? "",
      capaciteMaximum: storageCase.capaciteMaximum,
    })
    setShowForm(true)
    setError("")
  }

  function cancelForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
  }

  function field(name) {
    return event => {
      setForm(current => ({
        ...current,
        [name]: event.target.value,
      }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (
      !form.zoneId ||
      !form.codeCase.trim() ||
      !form.capaciteMaximum ||
      Number(form.capaciteMaximum) <= 0
    ) {
      setError("La Zone, le code Case et la capacité maximale sont obligatoires.")
      return
    }

    const dto = {
      zoneId: Number(form.zoneId),
      codeCase: form.codeCase.trim(),
      positionCase: form.positionCase === ""
        ? null
        : Number(form.positionCase),
      capaciteMaximum: Number(form.capaciteMaximum),
    }

    try {
      setSaving(true)
      setError("")

      if (editId === null) {
        await createCase(dto)
        setSuccess("Case créée avec succès.")
      } else {
        await updateCase(editId, dto)
        setSuccess("Case modifiée avec succès.")
      }

      cancelForm()
      await load()
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(err.message || "Opération échouée.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(
      "Supprimer cette Case ? Si elle contient un historique de mouvements, ceux-ci seront automatiquement archivés (avec la date du jour) plutôt que perdus."
    )) {
      return
    }

    try {
      setError("")
      const result = await deleteCase(id)
      setSuccess(result?.message || "Case supprimée.")
      await load()
      setTimeout(() => setSuccess(""), 6000)
    } catch (err) {
      setError(err.message || "Échec de la suppression.")
    }
  }

  function statusColor(storageCase) {
    if (storageCase.capaciteDepassee) return "red"
    if (storageCase.statut === "Plein") return "orange"
    return "green"
  }

  if (loading && cases.length === 0) {
    return <div className="crud-loading">Chargement des Cases…</div>
  }

  const paginatedCases = visibleCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="crud-page">
      <div className="crud-header">
        <div>
          <h1>Cases</h1>
          <p className="crud-subtitle">
            {visibleCases.length} Case{visibleCases.length !== 1 ? "s" : ""} dans le système
          </p>
        </div>
        {isAdmin && (
          <button
            className="btn-primary"
            onClick={showForm ? cancelForm : openAdd}
          >
            {showForm ? "✕ Annuler" : "+ Ajouter"}
          </button>
        )}
      </div>

      {error && <div className="crud-banner crud-banner--error">{error}</div>}
      {success && <div className="crud-banner crud-banner--success">{success}</div>}

      {showForm && (
        <form className="crud-form" onSubmit={handleSubmit}>
          <h3 className="form-title">
            {editId === null ? "Nouvelle Case" : "Modifier la Case"}
          </h3>

          <div className="form-grid">
            {lockedZone ? (
              // On crée depuis une zone précise : elle est imposée par le fil
              // d'Ariane, pas choisie. Proposer un select ici permettrait de
              // créer une Case qui disparaîtrait aussitôt de la liste filtrée.
              <div className="form-field">
                <span>Zone</span>
                <p className="form-static">
                  {lockedZone.codeZone}
                  {lockedZone.codeRayon ? ` (${lockedZone.codeRayon})` : ""}
                </p>
              </div>
            ) : (
              <label className="form-field">
                <span>
                  Zone <span className="required">*</span>
                  {editId !== null && filterZoneId && (
                    <span className="optional"> — changer pour déplacer la Case</span>
                  )}
                </span>
                <select value={form.zoneId} onChange={field("zoneId")}>
                  <option value="">— Sélectionner —</option>
                  {zones.map(zone => (
                    <option key={zone.zoneId} value={zone.zoneId}>
                      {zone.codeZone} ({zone.codeRayon})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="form-field">
              <span>Code Case <span className="required">*</span></span>
              <input
                placeholder="ex: C6"
                value={form.codeCase}
                onChange={field("codeCase")}
              />
            </label>

            <label className="form-field">
              <span>Position <span className="optional">(optionnel)</span></span>
              <input
                type="number"
                min="1"
                placeholder="ex: 6"
                value={form.positionCase}
                onChange={field("positionCase")}
              />
            </label>

            <label className="form-field">
              <span>Capacité maximale <span className="required">*</span></span>
              <input
                type="number"
                min="1"
                placeholder="ex: 1000"
                value={form.capaciteMaximum}
                onChange={field("capaciteMaximum")}
              />
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary-sm" onClick={cancelForm}>
              Annuler
            </button>
            <button type="submit" className="btn-primary btn-submit" disabled={saving}>
              {saving ? "Enregistrement…" : editId === null ? "Créer" : "Mettre à jour"}
            </button>
          </div>
        </form>
      )}

      {visibleCases.length === 0 && !loading ? (
        <p className="crud-empty">
          Aucune Case. Cliquez sur <strong>+ Ajouter</strong> pour commencer.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Emplacement complet</th>
                <th>Position</th>
                <th>Articles</th>
                <th>Quantité / Capacité</th>
                <th>Restante</th>
                <th>Occupation</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody style={{ opacity: loading ? 0.5 : 1 }}>
              {paginatedCases.map(storageCase => {
                const visualRate = Math.min(
                  100,
                  Math.max(0, Number(storageCase.tauxOccupation ?? 0))
                )
                const color = storageCase.capaciteDepassee
                  ? "var(--danger-text)"
                  : visualRate >= 90
                    ? "#fb923c"
                    : "var(--badge-green-text)"

                return (
                  <tr
                    key={storageCase.caseId}
                    className={storageCase.capaciteDepassee ? "tr-warning" : ""}
                  >
                    <td className="td-bold">{storageCase.codeCase}</td>
                    <td className="location-cell">{storageCase.fullLocation}</td>
                    <td>{storageCase.positionCase ?? <span className="td-muted">—</span>}</td>
                    <td>{storageCase.articlesCount}</td>
                    <td>
                      <div className="stock-bar-cell">
                        <div className="stock-bar-labels">
                          <span style={{ color, fontWeight: 700 }}>
                            {storageCase.quantiteActuelle}
                          </span>
                          <span className="stock-bar-cap">
                            / {storageCase.capaciteMaximum}
                          </span>
                          {storageCase.capaciteDepassee && (
                            <span className="inline-warning">
                              +{storageCase.quantiteDepassee}
                            </span>
                          )}
                        </div>
                        <div className="stock-bar-track">
                          <div
                            className="stock-bar-fill"
                            style={{ width: `${visualRate}%`, background: color }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>{storageCase.capaciteRestante}</td>
                    <td>{storageCase.tauxOccupation}%</td>
                    <td>
                      <span className={`badge badge--${statusColor(storageCase)}`}>
                        {storageCase.statut}
                      </span>
                    </td>
                    <td className="td-actions">
                      {isAdmin && (
                        <>
                          <button className="btn-edit" onClick={() => openEdit(storageCase)}>
                            Modifier
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(storageCase.caseId)}
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={visibleCases.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}

export default CasePage
