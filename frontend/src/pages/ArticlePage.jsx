import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import {
  createArticle,
  deleteArticle,
  getArticles,
  getCases,
  updateArticle,
  createMonthlyData,
} from "../services/api"
import Pagination from "../components/Pagination"
import "./CrudPage.css"

const EMPTY_FORM = {
  codeArticle: "",
  nomArticle: "",
  caseIds: [],
  seuil: "",
  actif: true,
  mois: "",
  quantiteEntrer: "",
  caseId: "",
}

function formatDateFr(dateOnly) {
  if (!dateOnly) return ""
  const [year, month, day] = dateOnly.split("-")
  return `${day}/${month}/${year}`
}

function formatLocationString(locationStr) {
  if (!locationStr) return locationStr;
  const parts = locationStr.split(" | ");
  if (parts.length <= 1) return locationStr;

  const groups = {};
  for (const part of parts) {
    const lastArrowIndex = part.lastIndexOf(" > ");
    if (lastArrowIndex !== -1) {
      const prefix = part.substring(0, lastArrowIndex).trim();
      const suffix = part.substring(lastArrowIndex + 3).trim();
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(suffix);
    } else {
      if (!groups[""]) groups[""] = [];
      groups[""].push(part.trim());
    }
  }

  const result = [];
  for (const prefix in groups) {
    if (prefix) {
      result.push(`${prefix} > ${groups[prefix].join("|")}`);
    } else {
      result.push(groups[prefix].join(" | "));
    }
  }
  return result.join(" | ");
}

function ArticlePage() {
  const role = useSelector((state) => state.auth.role)
  const isAdmin = role === "admin"
  const [articles, setArticles] = useState([])
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  async function load() {
    try {
      setLoading(true)
      setError("")
      const [articleRows, caseRows] = await Promise.all([
        getArticles(),
        getCases(),
      ])
      setArticles(articleRows)
      setCases(caseRows)
    } catch (err) {
      setError(err.message || "Impossible de charger les articles.")
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
    setForm({ ...EMPTY_FORM, caseIds: [] })
    setShowForm(true)
    setError("")
  }

  function openEdit(article) {
    setEditId(article.articleId)
    setForm({
      codeArticle: article.codeArticle,
      nomArticle: article.nomArticle,
      caseIds: (article.caseIds ?? []).map(Number),
      seuil: article.seuil ?? "",
      actif: article.actif,
      mois: "",
      quantiteEntrer: "",
      caseId: "",
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
      const value = event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value

      setForm(current => ({ ...current, [name]: value }))
    }
  }

  function toggleCase(caseId) {
    const id = Number(caseId)
    setForm(current => ({
      ...current,
      caseIds: current.caseIds.includes(id)
        ? current.caseIds.filter(value => value !== id)
        : [...current.caseIds, id],
    }))
  }

  function validate() {
    const code = form.codeArticle.trim().toUpperCase()

    if (!/^ART-\d{3}$/.test(code)) {
      return "Le code doit respecter le format ART-001."
    }

    if (!form.nomArticle.trim()) {
      return "Le nom de l'article est obligatoire."
    }

    if (form.seuil !== "" && Number(form.seuil) < 0) {
      return "Le seuil doit être supérieur ou égal à 0."
    }

    if (form.caseIds.length === 0) {
      return "Veuillez assigner au moins une Case à cet article."
    }

    // When creating a new article, the initial stock movement is mandatory
    if (editId === null) {
      if (!form.mois) return "Le mois du premier mouvement est obligatoire."
      if (!form.quantiteEntrer || Number(form.quantiteEntrer) <= 0)
        return "La quantité entrée du premier mouvement est obligatoire et doit être > 0."
      if (!form.caseId)
        return "Veuillez sélectionner la Case pour le premier mouvement."
      if (!form.caseIds.includes(Number(form.caseId)))
        return "La case du mouvement doit faire partie des cases assignées à l'article."
    } else if (form.quantiteEntrer || form.mois || form.caseId) {
      // During edit: if any movement field is filled, all must be filled
      if (!form.mois) return "Le mois est obligatoire pour ajouter un mouvement."
      if (!form.quantiteEntrer || Number(form.quantiteEntrer) <= 0)
        return "La quantité entrée doit être > 0."
      if (!form.caseId)
        return "Veuillez sélectionner une Case pour ce mouvement."
      if (!form.caseIds.includes(Number(form.caseId)))
        return "La case du mouvement doit faire partie des cases assignées à l'article."
    }

    return null
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const validationError = validate()

    if (validationError) {
      setError(validationError)
      return
    }

    const dto = {
      codeArticle: form.codeArticle.trim().toUpperCase(),
      nomArticle: form.nomArticle.trim(),
      caseIds: form.caseIds.map(Number),
      actif: form.actif,
      seuil: form.seuil === "" ? null : Number(form.seuil),
    }

    try {
      setSaving(true)
      setError("")

      let articleId = editId;

      if (editId === null) {
        const created = await createArticle(dto)
        articleId = created.articleId
        setSuccess("Article créé avec succès.")
      } else {
        await updateArticle(editId, dto)
        setSuccess("Article modifié avec succès.")
      }

      if (form.quantiteEntrer && form.mois && form.caseId) {
        const movementDto = {
          articleId: Number(articleId),
          caseId: Number(form.caseId),
          mois: form.mois,
          quantiteEntrer: Number(form.quantiteEntrer),
          quantiteSortie: 0
        }
        try {
          await createMonthlyData(movementDto)
          setSuccess("Article et mouvement enregistrés avec succès.")
        } catch (movErr) {
          setError(`Article enregistré, mais échec du mouvement : ${movErr.message}`)
          setSaving(false)
          await load()
          return
        }
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
      "Supprimer cet article ? S'il possède un historique de mouvements, il sera désactivé au lieu d'être supprimé, afin de conserver cet historique."
    )) {
      return
    }

    try {
      setError("")
      const result = await deleteArticle(id)
      setSuccess(result?.message || "Article supprimé.")
      await load()
      setTimeout(() => setSuccess(""), 7000)
    } catch (err) {
      setError(err.message || "Échec de la suppression.")
    }
  }

  if (loading && articles.length === 0) {
    return <div className="crud-loading">Chargement des articles…</div>
  }

  const paginatedArticles = articles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="crud-page">
      <div className="crud-header">
        <div>
          <h1>Articles</h1>
          <p className="crud-subtitle">
            {articles.length} article{articles.length !== 1 ? "s" : ""} dans le système
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
            {editId === null ? "Nouvel article" : "Modifier l'article"}
          </h3>

          <div className="form-grid">
            <label className="form-field">
              <span>Code Article <span className="required">*</span></span>
              <input
                placeholder="ex: ART-007"
                value={form.codeArticle}
                onChange={field("codeArticle")}
              />
            </label>

            <label className="form-field">
              <span>Nom Article <span className="required">*</span></span>
              <input
                placeholder="ex: Roulement"
                value={form.nomArticle}
                onChange={field("nomArticle")}
              />
            </label>

            <label className="form-field">
              <span>Seuil <span className="optional">(optionnel)</span></span>
              <input
                type="number"
                min="0"
                placeholder="ex: 100"
                value={form.seuil}
                onChange={field("seuil")}
              />
            </label>

            <label className="form-field form-field--checkbox">
              <input
                type="checkbox"
                checked={form.actif}
                onChange={field("actif")}
              />
              <span>Article actif</span>
            </label>

            <div className="form-field form-field--wide">
              <span>
                Cases <span className="optional">(plusieurs Articles peuvent partager une Case)</span>
              </span>
              <div className="case-selector">
                {cases.map(storageCase => (
                  <label className="case-selector__item" key={storageCase.caseId}>
                    <input
                      type="checkbox"
                      checked={form.caseIds.includes(Number(storageCase.caseId))}
                      onChange={() => toggleCase(storageCase.caseId)}
                    />
                    <span>
                      <strong>{storageCase.codeCase}</strong>
                      {" — "}
                      {storageCase.fullLocation}
                      {" — "}
                      {storageCase.quantiteActuelle}/{storageCase.capaciteMaximum}
                    </span>
                  </label>
                ))}
                {cases.length === 0 && (
                  <span className="td-muted">Aucune Case disponible.</span>
                )}
              </div>
            </div>
          </div>

          <hr style={{ margin: "2rem 0", borderColor: "var(--border)", opacity: 0.5 }} />

          <h4 className="form-title" style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            {editId === null
              ? <>Сtock initial <span className="required">*</span></>
              : "Ajouter un mouvement (optionnel)"}
          </h4>
          <p className="form-note" style={{ marginTop: 0, marginBottom: "1.5rem" }}>
            {editId === null
              ? "Tout article doit avoir un premier mouvement (entrée de stock). Ces données seront enregistrées dans Données Mensuelles."
              : "Renseignez les 3 champs pour ajouter un nouveau mouvement dans Données Mensuelles."}
          </p>

          <div className="form-grid">
            <label className="form-field">
              <span>Mois{editId === null && <span className="required"> *</span>}</span>
              <input
                type="month"
                value={form.mois}
                onChange={field("mois")}
                required={editId === null}
              />
            </label>

            <label className="form-field">
              <span>Quantité Entrée{editId === null && <span className="required"> *</span>}</span>
              <input
                type="number"
                min="1"
                placeholder="ex: 100"
                value={form.quantiteEntrer}
                onChange={field("quantiteEntrer")}
                required={editId === null}
              />
            </label>

            <label className="form-field">
              <span>Case d'affectation{editId === null && <span className="required"> *</span>}</span>
              <select value={form.caseId} onChange={field("caseId")} required={editId === null}>
                <option value="">— Sélectionner une Case —</option>
                {form.caseIds.length === 0 ? (
                  <option disabled>Assignéz d'abord une Case ci-dessus</option>
                ) : (
                  form.caseIds.map(id => {
                    const c = cases.find(x => Number(x.caseId) === id)
                    return c ? (
                      <option key={id} value={id}>
                        {c.codeCase} — {c.fullLocation}
                      </option>
                    ) : null
                  })
                )}
              </select>
            </label>
          </div>

          <p className="form-note">
            Pour voir ou modifier tous les mouvements historiques, rendez-vous dans Données Mensuelles.
          </p>

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

      {articles.length === 0 && !loading ? (
        <p className="crud-empty">
          Aucun article. Cliquez sur <strong>+ Ajouter</strong> pour commencer.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th>Entrées</th>
                <th>Sorties</th>
                <th>Stock net / Capacité</th>
                <th>Cases</th>
                <th>Emplacements complets</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody style={{ opacity: loading ? 0.5 : 1 }}>
              {paginatedArticles.map(article => {
                const net = article.stockNet ?? 0
                const capacity = article.totalCaseCapacity ?? 0
                const threshold = article.seuil
                const belowThreshold = threshold !== null &&
                  threshold !== undefined &&
                  net < threshold
                const ratio = capacity > 0
                  ? Math.min(100, Math.max(0, (net / capacity) * 100))
                  : 0
                const overCapacity = capacity > 0 && net > capacity
                const color = belowThreshold || overCapacity || ratio >= 90
                  ? "var(--danger-text)"
                  : ratio >= 60
                    ? "#fb923c"
                    : "var(--badge-green-text)"

                return (
                  <tr key={article.articleId}>
                    <td className="td-bold">{article.codeArticle}</td>
                    <td>{article.nomArticle}</td>
                    <td className="quantity-in">{article.totalQuantiteEntrer ?? 0}</td>
                    <td className="quantity-out">{article.totalQuantiteSortie ?? 0}</td>
                    <td>
                      <div className="stock-bar-cell">
                        <div className="stock-bar-labels">
                          <span style={{ color, fontWeight: 700 }}>{net}</span>
                          <span className="stock-bar-cap">/ {capacity}</span>
                          {belowThreshold && (
                            <span className="inline-warning" title={`Seuil : ${threshold}`}>
                              &lt;{threshold}
                            </span>
                          )}
                          {overCapacity && (
                            <span className="inline-warning">
                              +{net - capacity}
                            </span>
                          )}
                        </div>
                        <div className="stock-bar-track">
                          <div
                            className="stock-bar-fill"
                            style={{ width: `${ratio}%`, background: color }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>{article.codeCase || <span className="td-muted">—</span>}</td>
                    <td className="location-cell">
                      {formatLocationString(article.fullLocation) || <span className="td-muted">—</span>}
                    </td>
                    <td>
                      <span
                        className={`badge badge--${article.actif ? "green" : "red"}`}
                        title={
                          !article.actif && article.desactiveLe
                            ? `Désactivé automatiquement le ${formatDateFr(article.desactiveLe)} (historique de mouvements conservé)`
                            : undefined
                        }
                      >
                        {article.actif ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="td-actions">
                      {isAdmin && (
                        <>
                          <button className="btn-edit" onClick={() => openEdit(article)}>
                            Modifier
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(article.articleId)}
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
            totalItems={articles.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}

export default ArticlePage
