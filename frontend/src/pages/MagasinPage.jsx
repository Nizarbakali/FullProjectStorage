import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import {
  getMagasins,
  createMagasin,
  updateMagasin,
  deleteMagasin,
} from "../services/api"
import Pagination from "../components/Pagination"
import "./CrudPage.css"

const EMPTY_FORM = {
  codeMagasin: "",
  nomMagasin: "",
  ville: "",
  pays: "",
  actif: true,
}

function MagasinPage({ onDrill } = {}) {
  const role = useSelector((state) => state.auth.role)
  const isAdmin = role === "admin"
  const [magasins, setMagasins] = useState([])
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

      const data = await getMagasins()
      setMagasins(data)
    } catch (err) {
      setError(
        err.message ||
          "Impossible de charger les magasins."
      )
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
    setForm(EMPTY_FORM)
    setShowForm(true)
    setError("")
  }

  function openEdit(magasin) {
    setEditId(magasin.magasinId)

    setForm({
      codeMagasin: magasin.codeMagasin,
      nomMagasin: magasin.nomMagasin,
      ville: magasin.ville,
      pays: magasin.pays,
      actif: magasin.actif,
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
    return (event) => {
      const value =
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value

      setForm((current) => ({
        ...current,
        [name]: value,
      }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (
      !form.codeMagasin.trim() ||
      !form.nomMagasin.trim() ||
      !form.ville.trim() ||
      !form.pays.trim()
    ) {
      setError(
        "Tous les champs obligatoires doivent être remplis."
      )
      return
    }

    try {
      setSaving(true)
      setError("")

      if (editId) {
        await updateMagasin(editId, form)
        setSuccess("Magasin modifié avec succès.")
      } else {
        await createMagasin(form)
        setSuccess("Magasin créé avec succès.")
      }

      cancelForm()
      await load()

      window.setTimeout(
        () => setSuccess(""),
        4000
      )
    } catch (err) {
      setError(
        err.message ||
          "Opération échouée."
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      "Supprimer ce magasin ? Tous ses rayons, " +
        "zones et cases seront également supprimés."
    )

    if (!confirmed) {
      return
    }

    try {
      setError("")

      await deleteMagasin(id)

      setSuccess("Magasin supprimé.")

      await load()

      window.setTimeout(
        () => setSuccess(""),
        3000
      )
    } catch (err) {
      setError(
        err.message ||
          "Échec de la suppression."
      )
    }
  }

  if (
    loading &&
    magasins.length === 0
  ) {
    return (
      <div className="crud-loading">
        Chargement des magasins…
      </div>
    )
  }

  const paginatedMagasins = magasins.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="crud-page">
      <div className="crud-header">
        <div>
          <h1>Magasins</h1>

          <p className="crud-subtitle">
            {magasins.length} magasin
            {magasins.length !== 1 ? "s" : ""}{" "}
            dans le système
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            className="btn-primary"
            onClick={
              showForm
                ? cancelForm
                : openAdd
            }
          >
            {showForm
              ? "✕ Annuler"
              : "+ Ajouter"}
          </button>
        )}
      </div>

      {error && (
        <div className="crud-banner crud-banner--error">
          {error}
        </div>
      )}

      {success && (
        <div className="crud-banner crud-banner--success">
          {success}
        </div>
      )}

      {showForm && (
        <form
          className="crud-form"
          onSubmit={handleSubmit}
        >
          <h3 className="form-title">
            {editId
              ? "Modifier le magasin"
              : "Nouveau magasin"}
          </h3>

          <div className="form-grid">
            <label className="form-field">
              <span>
                Code Magasin{" "}
                <span className="required">*</span>
              </span>

              <input
                placeholder="ex: MAG-001"
                value={form.codeMagasin}
                onChange={
                  field("codeMagasin")
                }
                disabled={Boolean(editId)}
              />
            </label>

            <label className="form-field">
              <span>
                Nom Magasin{" "}
                <span className="required">*</span>
              </span>

              <input
                placeholder="ex: GMD Metal Tanger"
                value={form.nomMagasin}
                onChange={
                  field("nomMagasin")
                }
              />
            </label>

            <label className="form-field">
              <span>
                Ville{" "}
                <span className="required">*</span>
              </span>

              <input
                placeholder="ex: Tanger"
                value={form.ville}
                onChange={field("ville")}
              />
            </label>

            <label className="form-field">
              <span>
                Pays{" "}
                <span className="required">*</span>
              </span>

              <input
                placeholder="ex: Maroc"
                value={form.pays}
                onChange={field("pays")}
              />
            </label>

            <label className="form-field form-field--checkbox">
              <input
                type="checkbox"
                checked={form.actif}
                onChange={field("actif")}
              />

              <span>Actif</span>
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={cancelForm}
            >
              Annuler
            </button>

            <button
              type="submit"
              className="btn-primary btn-submit"
              disabled={saving}
            >
              {saving
                ? "Enregistrement…"
                : editId
                  ? "Mettre à jour"
                  : "Créer"}
            </button>
          </div>
        </form>
      )}

      {magasins.length === 0 && !loading ? (
        <p className="crud-empty">
          Aucun magasin. Cliquez sur{" "}
          <strong>+ Ajouter</strong> pour commencer.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th>Ville</th>
                <th>Pays</th>
                <th>Rayons</th>
                <th>Statut</th>
                <th>Actions</th>
                {onDrill && <th></th>}
              </tr>
            </thead>

            <tbody
              style={{
                opacity: loading ? 0.5 : 1,
              }}
            >
              {paginatedMagasins.map((magasin) => (
                <tr key={magasin.magasinId}>
                  <td className="td-bold">
                    {magasin.codeMagasin}
                  </td>

                  <td>
                    {magasin.nomMagasin}
                  </td>

                  <td>
                    {magasin.ville}
                  </td>

                  <td>
                    {magasin.pays}
                  </td>

                  <td>
                    {magasin.rayonsCount}
                  </td>

                  <td>
                    <span
                      className={
                        `badge badge--${
                          magasin.actif
                            ? "green"
                            : "red"
                        }`
                      }
                    >
                      {magasin.actif
                        ? "Actif"
                        : "Inactif"}
                    </span>
                  </td>

                  <td className="td-actions">
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          className="btn-edit"
                          onClick={() =>
                            openEdit(magasin)
                          }
                        >
                          Modifier
                        </button>

                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() =>
                            handleDelete(
                              magasin.magasinId
                            )
                          }
                        >
                          Supprimer
                        </button>
                      </>
                    )}
                  </td>
                  {onDrill && (
                    <td className="td-actions">
                      <button
                        type="button"
                        className="btn-edit"
                        onClick={() => onDrill(magasin)}
                      >
                        Rayons →
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={magasins.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}

export default MagasinPage
