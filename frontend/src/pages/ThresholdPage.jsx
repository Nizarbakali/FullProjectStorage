import { useEffect, useState } from "react"
import {
  getArticleThresholds,
  updateArticleThresholds,
  getArticles
} from "../services/api"
import "./CrudPage.css"

const EMPTY_FORM = { seuilMinimum: "", seuilMaximum: "" }

function ThresholdPage() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingArticle, setEditingArticle] = useState(null)

  async function loadArticles() {
    try {
      setLoading(true)
      setError("")

      const [thresholdData, articleData] = await Promise.all([
        getArticleThresholds(),
        getArticles()
      ])

      const articlesWithStock = thresholdData.map(article => {
        const stockArticle = articleData.find(
          a => a.articleId === article.articleId
        )
        return {
          ...article,
          stockNet: stockArticle?.stockNet ?? 0
        }
      })
      setArticles(articlesWithStock)
    } catch (err) {
      setError(err.message || "Impossible de charger les seuils.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial API synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadArticles()
  }, [])

  function openEdit(article) {
    setEditId(article.articleId)
    setEditingArticle(article)
    setForm({
      seuilMinimum: article.seuilMinimum ?? "",
      seuilMaximum: article.seuilMaximum ?? ""
    })
    setShowForm(true)
    setError("")
  }

  function cancelForm() {
    setShowForm(false)
    setEditId(null)
    setEditingArticle(null)
    setForm(EMPTY_FORM)
  }

  function field(name) {
    return (e) => setForm(f => ({ ...f, [name]: e.target.value }))
  }

  function getStockColor(article) {
    const stock = Number(article.stockNet ?? 0)
    const minimum = article.seuilMinimum
    const maximum = article.seuilMaximum

    if (
      (minimum !== null && minimum !== "" && stock < Number(minimum)) ||
      (maximum !== null && maximum !== "" && stock > Number(maximum))
    ) {
      return "var(--danger-text)"
    }
    return "var(--badge-green-text)"
  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    const minimum = form.seuilMinimum === "" || form.seuilMinimum == null ? null : Number(form.seuilMinimum)
    const maximum = form.seuilMaximum === "" || form.seuilMaximum == null ? null : Number(form.seuilMaximum)

    if (minimum !== null && minimum < 0) {
      setError("Le seuil minimum doit être positif ou égal à zéro.")
      return
    }
    if (maximum !== null && maximum < 0) {
      setError("Le seuil maximum doit être positif ou égal à zéro.")
      return
    }
    if (minimum !== null && maximum !== null && minimum > maximum) {
      setError("Le seuil minimum ne peut pas dépasser le seuil maximum.")
      return
    }

    try {
      setSaving(true)
      setError("")

      await updateArticleThresholds(editId, {
        seuilMinimum: minimum,
        seuilMaximum: maximum
      })

      setSuccess(`Seuils de ${editingArticle.codeArticle} enregistrés.`)
      cancelForm()
      await loadArticles()

      setTimeout(() => {
        setSuccess("")
      }, 3000)
    } catch (err) {
      setError(err.message || "Erreur lors de l'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  if (loading && articles.length === 0) {
    return <div className="crud-loading">Chargement des seuils...</div>
  }

  return (
    <div className="crud-page">
      <div className="crud-header">
        <div>
          <h1>Seuils</h1>
          <p className="crud-subtitle">
            Seuils minimum et maximum de chaque article
          </p>
        </div>
      </div>

      {error && <div className="crud-banner crud-banner--error">{error}</div>}
      {success && <div className="crud-banner crud-banner--success">{success}</div>}

      {showForm && (
        <form className="crud-form" onSubmit={handleSubmit}>
          <h3 className="form-title">
            Modifier les seuils : {editingArticle?.codeArticle} - {editingArticle?.nomArticle}
          </h3>
          <div className="form-grid">
            <label className="form-field">
              <span>Seuil minimum <span style={{color:"#64748b",fontWeight:400}}>(optionnel)</span></span>
              <input type="number" min="0" placeholder="ex: 10" value={form.seuilMinimum} onChange={field("seuilMinimum")} />
            </label>
            <label className="form-field">
              <span>Seuil maximum <span style={{color:"#64748b",fontWeight:400}}>(optionnel)</span></span>
              <input type="number" min="0" placeholder="ex: 100" value={form.seuilMaximum} onChange={field("seuilMaximum")} />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary-sm" onClick={cancelForm}>Annuler</button>
            <button type="submit" className="btn-primary btn-submit" disabled={saving}>
              {saving ? "Enregistrement…" : "Mettre à jour"}
            </button>
          </div>
        </form>
      )}

      {articles.length === 0 && !loading ? (
        <p className="crud-empty">Aucun seuil à afficher.</p>
      ) : (
        <div className="table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Article</th>
                <th>Reste</th>
                <th>Seuil minimum</th>
                <th>Seuil maximum</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody style={{ opacity: loading ? 0.5 : 1 }}>
              {articles.map(article => (
                <tr key={article.articleId}>
                  <td className="td-bold">{article.codeArticle}</td>
                  <td>{article.nomArticle}</td>
                  <td
                    style={{
                      color: getStockColor(article),
                      fontWeight: 700,
                    }}
                  >
                    {article.stockNet ?? 0}
                  </td>
                  <td>{article.seuilMinimum ?? "—"}</td>
                  <td>{article.seuilMaximum ?? "—"}</td>
                  <td className="td-actions">
                    <button className="btn-edit" onClick={() => openEdit(article)}>
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ThresholdPage
