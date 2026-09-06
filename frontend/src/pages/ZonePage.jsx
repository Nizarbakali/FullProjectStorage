import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { getZones, getRayons, createZone, updateZone, deleteZone } from "../services/api"
import Pagination from "../components/Pagination"
import "./CrudPage.css"

const EMPTY_FORM = { rayonId: "", codeZone: "", numeroLigne: "", actif: true }

function ZonePage({ filterRayonId, onDrill } = {}) {
  const role = useSelector((state) => state.auth.role)
  const isAdmin = role === "admin"
  const [zones,    setZones]    = useState([])
  const [rayons,   setRayons]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState("")
  const [success,  setSuccess]  = useState("")
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [form,     setForm]     = useState(EMPTY_FORM)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  async function load() {
    try {
      setLoading(true); setError("")
      const [z, r] = await Promise.all([getZones(), getRayons()])
      setZones(z)
      setRayons(r)
    } catch (err) {
      setError(err.message || "Impossible de charger les zones.")
    } finally { setLoading(false) }
  }

  useEffect(() => {
    // Initial API synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  function openAdd() {
    setEditId(null)
    setForm({ ...EMPTY_FORM, rayonId: filterRayonId ?? rayons[0]?.rayonId ?? "" })
    setShowForm(true); setError("")
  }

  const visibleZones = filterRayonId
    ? zones.filter(z => Number(z.rayonId) === Number(filterRayonId))
    : zones

  function openEdit(z) {
    setEditId(z.zoneId)
    setForm({ rayonId: z.rayonId, codeZone: z.codeZone, numeroLigne: z.numeroLigne ?? "", actif: z.actif })
    setShowForm(true); setError("")
  }

  function cancelForm() { setShowForm(false); setEditId(null); setForm(EMPTY_FORM) }

  function field(name) {
    return (e) => setForm(f => ({ ...f, [name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.rayonId || !form.codeZone.trim()) {
      setError("Le rayon et le code zone sont obligatoires."); return
    }
    try {
      setSaving(true); setError("")
      const dto = {
        rayonId:     parseInt(form.rayonId),
        codeZone:    form.codeZone,
        numeroLigne: form.numeroLigne ? parseInt(form.numeroLigne) : null,
        actif:       form.actif
      }
      if (editId) {
        await updateZone(editId, dto)
        setSuccess("Zone modifiée avec succès.")
      } else {
        await createZone(dto)
        setSuccess("Zone créée avec succès.")
      }
      cancelForm(); await load()
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(err.message || "Opération échouée.")
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm("Supprimer cette zone ? Toutes ses cases seront supprimées.")) return
    try {
      setError("")
      await deleteZone(id)
      setSuccess("Zone supprimée.")
      await load()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) { setError(err.message || "Échec de la suppression.") }
  }

  if (loading && zones.length === 0) return <div className="crud-loading">Chargement des zones…</div>

  const paginatedZones = visibleZones.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="crud-page">
      <div className="crud-header">
        <div>
          <h1>Zones</h1>
          <p className="crud-subtitle">{visibleZones.length} zone{visibleZones.length !== 1 ? "s" : ""} dans le système</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={showForm ? cancelForm : openAdd}>
            {showForm ? "✕  Annuler" : "+ Ajouter"}
          </button>
        )}
      </div>

      {error   && <div className="crud-banner crud-banner--error">{error}</div>}
      {success && <div className="crud-banner crud-banner--success">{success}</div>}

      {showForm && (
        <form className="crud-form" onSubmit={handleSubmit}>
          <h3 className="form-title">{editId ? "Modifier la zone" : "Nouvelle zone"}</h3>
          <div className="form-grid">
            <label className="form-field">
              <span>Rayon <span className="required">*</span></span>
              <select value={form.rayonId} onChange={field("rayonId")}>
                <option value="">— Sélectionner —</option>
                {rayons.map(r => <option key={r.rayonId} value={r.rayonId}>{r.codeRayon}{r.nomRayon ? ` — ${r.nomRayon}` : ""} ({r.codeMagasin})</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Code Zone <span className="required">*</span></span>
              <input placeholder="ex: Z-001" value={form.codeZone} onChange={field("codeZone")} />
            </label>
            <label className="form-field">
              <span>Numéro de ligne <span style={{color:"#64748b",fontWeight:400}}>(optionnel)</span></span>
              <input type="number" min="1" placeholder="ex: 3" value={form.numeroLigne} onChange={field("numeroLigne")} />
            </label>
            <label className="form-field form-field--checkbox">
              <input type="checkbox" checked={form.actif} onChange={field("actif")} />
              <span>Actif</span>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary-sm" onClick={cancelForm}>Annuler</button>
            <button type="submit" className="btn-primary btn-submit" disabled={saving}>
              {saving ? "Enregistrement…" : editId ? "Mettre à jour" : "Créer"}
            </button>
          </div>
        </form>
      )}

      {visibleZones.length === 0 && !loading ? (
        <p className="crud-empty">Aucune zone. Cliquez sur <strong>+ Ajouter</strong> pour commencer.</p>
      ) : (
        <div className="table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Code Zone</th>
                {!filterRayonId && <th>Rayon</th>}
                <th>N° Ligne</th>
                <th>Cases</th>
                <th>Statut</th>
                <th></th>
                {onDrill && <th></th>}
              </tr>
            </thead>
            <tbody style={{ opacity: loading ? 0.5 : 1 }}>
              {paginatedZones.map(z => (
                <tr key={z.zoneId}>
                  <td className="td-bold">{z.codeZone}</td>
                  {!filterRayonId && <td><span className="badge badge--blue">{z.codeRayon}</span></td>}
                  <td>{z.numeroLigne ?? <span className="td-muted">—</span>}</td>
                  <td>{z.casesCount}</td>
                  <td>
                    <span className={`badge badge--${z.actif ? "green" : "red"}`}>
                      {z.actif ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="td-actions">
                    {isAdmin && (
                      <>
                        <button className="btn-edit" onClick={() => openEdit(z)}>Modifier</button>
                        <button className="btn-delete" onClick={() => handleDelete(z.zoneId)}>Supprimer</button>
                      </>
                    )}
                  </td>
                  {onDrill && (
                    <td className="td-actions">
                      <button type="button" className="btn-edit" onClick={() => onDrill(z)}>Cases →</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={visibleZones.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}

export default ZonePage
