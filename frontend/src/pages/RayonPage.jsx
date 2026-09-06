import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { getRayons, getMagasins, createRayon, updateRayon, deleteRayon } from "../services/api"
import Pagination from "../components/Pagination"
import "./CrudPage.css"

const EMPTY_FORM = { magasinId: "", codeRayon: "", nomRayon: "", actif: true }

function RayonPage({ filterMagasinId, onDrill } = {}) {
  const role = useSelector((state) => state.auth.role)
  const isAdmin = role === "admin"
  const [rayons,   setRayons]   = useState([])
  const [magasins, setMagasins] = useState([])
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
      const [r, m] = await Promise.all([getRayons(), getMagasins()])
      setRayons(r)
      setMagasins(m)
    } catch (err) {
      setError(err.message || "Impossible de charger les rayons.")
    } finally { setLoading(false) }
  }

  useEffect(() => {
    // Initial API synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  function openAdd() {
    setEditId(null)
    setForm({ ...EMPTY_FORM, magasinId: filterMagasinId ?? magasins[0]?.magasinId ?? "" })
    setShowForm(true); setError("")
  }

  const visibleRayons = filterMagasinId
    ? rayons.filter(r => Number(r.magasinId) === Number(filterMagasinId))
    : rayons

  function openEdit(r) {
    setEditId(r.rayonId)
    setForm({ magasinId: r.magasinId, codeRayon: r.codeRayon, nomRayon: r.nomRayon ?? "", actif: r.actif })
    setShowForm(true); setError("")
  }

  function cancelForm() { setShowForm(false); setEditId(null); setForm(EMPTY_FORM) }

  function field(name) {
    return (e) => setForm(f => ({ ...f, [name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.magasinId || !form.codeRayon.trim()) {
      setError("Le magasin et le code rayon sont obligatoires."); return
    }
    try {
      setSaving(true); setError("")
      const dto = { ...form, magasinId: parseInt(form.magasinId) }
      if (editId) {
        await updateRayon(editId, dto)
        setSuccess("Rayon modifié avec succès.")
      } else {
        await createRayon(dto)
        setSuccess("Rayon créé avec succès.")
      }
      cancelForm(); await load()
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(err.message || "Opération échouée.")
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm("Supprimer ce rayon ? Toutes ses zones et cases seront supprimées.")) return
    try {
      setError("")
      await deleteRayon(id)
      setSuccess("Rayon supprimé.")
      await load()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) { setError(err.message || "Échec de la suppression.") }
  }

  if (loading && rayons.length === 0) return <div className="crud-loading">Chargement des rayons…</div>

  const paginatedRayons = visibleRayons.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="crud-page">
      <div className="crud-header">
        <div>
          <h1>Rayons</h1>
          <p className="crud-subtitle">{visibleRayons.length} rayon{visibleRayons.length !== 1 ? "s" : ""} dans le système</p>
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
          <h3 className="form-title">{editId ? "Modifier le rayon" : "Nouveau rayon"}</h3>
          <div className="form-grid">
            <label className="form-field">
              <span>Magasin <span className="required">*</span></span>
              <select value={form.magasinId} onChange={field("magasinId")}>
                <option value="">— Sélectionner —</option>
                {magasins.map(m => <option key={m.magasinId} value={m.magasinId}>{m.codeMagasin} — {m.nomMagasin}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Code Rayon <span className="required">*</span></span>
              <input placeholder="ex: R-001" value={form.codeRayon} onChange={field("codeRayon")} />
            </label>
            <label className="form-field">
              <span>Nom Rayon <span style={{color:"#64748b",fontWeight:400}}>(optionnel)</span></span>
              <input placeholder="ex: Rayon Électronique" value={form.nomRayon} onChange={field("nomRayon")} />
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

      {visibleRayons.length === 0 && !loading ? (
        <p className="crud-empty">Aucun rayon. Cliquez sur <strong>+ Ajouter</strong> pour commencer.</p>
      ) : (
        <div className="table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                {!filterMagasinId && <th>Magasin</th>}
                <th>Zones</th>
                <th>Statut</th>
                <th></th>
                {onDrill && <th></th>}
              </tr>
            </thead>
            <tbody style={{ opacity: loading ? 0.5 : 1 }}>
              {paginatedRayons.map(r => (
                <tr key={r.rayonId}>
                  <td className="td-bold">{r.codeRayon}</td>
                  <td>{r.nomRayon || <span className="td-muted">—</span>}</td>
                  {!filterMagasinId && <td><span className="badge badge--blue">{r.codeMagasin}</span></td>}
                  <td>{r.zonesCount}</td>
                  <td>
                    <span className={`badge badge--${r.actif ? "green" : "red"}`}>
                      {r.actif ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="td-actions">
                    {isAdmin && (
                      <>
                        <button className="btn-edit" onClick={() => openEdit(r)}>Modifier</button>
                        <button className="btn-delete" onClick={() => handleDelete(r.rayonId)}>Supprimer</button>
                      </>
                    )}
                  </td>
                  {onDrill && (
                    <td className="td-actions">
                      <button type="button" className="btn-edit" onClick={() => onDrill(r)}>Zones →</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={visibleRayons.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}

export default RayonPage
