import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { getUsers, createUser, updateUser, deleteUser } from "../services/api"
import Pagination from "../components/Pagination"
import "./UserManagementPage.css"

const EMPTY_CREATE = { username: "", password: "", role: "user" }
const EMPTY_EDIT   = { password: "", role: "user" }

function UserManagementPage() {
  const currentUsername = useSelector((s) => s.auth.username)

  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")
  const [success, setSuccess] = useState("")

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE)
  const [creating,   setCreating]   = useState(false)

  // Edit modal
  const [editTarget, setEditTarget] = useState(null) // user object
  const [editForm,   setEditForm]   = useState(EMPTY_EDIT)
  const [editing,    setEditing]    = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // ── Load ──────────────────────────────────────────────────────────────────
  async function load() {
    try {
      setLoading(true); setError("")
      setUsers(await getUsers())
    } catch (e) {
      setError(e.message || "Impossible de charger les utilisateurs.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault()
    if (!createForm.username.trim() || !createForm.password.trim()) {
      setError("Nom d'utilisateur et mot de passe requis."); return
    }
    try {
      setCreating(true); setError("")
      await createUser({
        username: createForm.username.trim(),
        password: createForm.password,
        role:     createForm.role,
      })
      setSuccess(`Compte "${createForm.username}" créé avec succès.`)
      setCreateForm(EMPTY_CREATE)
      setShowCreate(false)
      await load()
      setTimeout(() => setSuccess(""), 4000)
    } catch (e) {
      setError(e.message || "Échec de la création.")
    } finally {
      setCreating(false)
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function openEdit(user) {
    setEditTarget(user)
    setEditForm({ password: "", role: user.role })
    setError("")
  }

  async function handleEdit(e) {
    e.preventDefault()
    if (!editTarget) return
    const dto = {}
    if (editForm.password.trim()) dto.password = editForm.password
    if (editForm.role) dto.role = editForm.role
    try {
      setEditing(true); setError("")
      await updateUser(editTarget.userId, dto)
      setSuccess(`Compte "${editTarget.username}" mis à jour.`)
      setEditTarget(null)
      await load()
      setTimeout(() => setSuccess(""), 4000)
    } catch (e) {
      setError(e.message || "Échec de la modification.")
    } finally {
      setEditing(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(user) {
    if (!window.confirm(`Supprimer le compte "${user.username}" ?`)) return
    try {
      setError("")
      await deleteUser(user.userId)
      setSuccess(`Compte "${user.username}" supprimé.`)
      await load()
      setTimeout(() => setSuccess(""), 4000)
    } catch (e) {
      setError(e.message || "Échec de la suppression.")
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    })
  }

  const isSelf = (u) => u.username.toLowerCase() === currentUsername?.toLowerCase()

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="um-page">
      {/* ── Header ── */}
      <div className="um-header">
        <div>
          <h1 className="um-title">Gestion des utilisateurs</h1>
          <p className="um-subtitle">
            {users.length} compte{users.length !== 1 ? "s" : ""} dans le système
          </p>
        </div>
        <button
          className="um-btn um-btn--primary"
          onClick={() => { setShowCreate(!showCreate); setError("") }}
        >
          {showCreate ? "✕ Annuler" : "+ Créer un compte"}
        </button>
      </div>

      {/* ── Banners ── */}
      {error   && <div className="um-banner um-banner--error"  role="alert">{error}</div>}
      {success && <div className="um-banner um-banner--success">{success}</div>}

      {/* ── Create form ── */}
      {showCreate && (
        <form className="um-form" onSubmit={handleCreate}>
          <h3 className="um-form__title">Nouveau compte</h3>
          <div className="um-form__grid">
            <label className="um-field">
              <span>Nom d'utilisateur <span className="um-req">*</span></span>
              <input
                type="text"
                placeholder="ex: jean.dupont"
                value={createForm.username}
                onChange={(e) => setCreateForm(f => ({ ...f, username: e.target.value }))}
                disabled={creating}
                autoComplete="off"
              />
            </label>
            <label className="um-field">
              <span>Mot de passe <span className="um-req">*</span></span>
              <input
                type="password"
                placeholder="Minimum 6 caractères"
                value={createForm.password}
                onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))}
                disabled={creating}
                autoComplete="new-password"
              />
            </label>
            <label className="um-field">
              <span>Rôle</span>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm(f => ({ ...f, role: e.target.value }))}
                disabled={creating}
              >
                <option value="user">Utilisateur</option>
                <option value="admin">Administrateur</option>
              </select>
            </label>
          </div>
          <div className="um-form__actions">
            <button type="button" className="um-btn um-btn--ghost"
              onClick={() => { setShowCreate(false); setCreateForm(EMPTY_CREATE) }}>
              Annuler
            </button>
            <button type="submit" className="um-btn um-btn--primary" disabled={creating}>
              {creating ? "Création…" : "Créer le compte"}
            </button>
          </div>
        </form>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <div className="um-overlay" onClick={() => setEditTarget(null)}>
          <form className="um-modal" onSubmit={handleEdit}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="um-form__title">
              Modifier — <span className="um-modal__name">{editTarget.username}</span>
            </h3>
            <div className="um-form__grid">
              <label className="um-field">
                <span>Nouveau mot de passe <span className="um-opt">(optionnel)</span></span>
                <input
                  type="password"
                  placeholder="Laisser vide pour ne pas changer"
                  value={editForm.password}
                  onChange={(e) => setEditForm(f => ({ ...f, password: e.target.value }))}
                  disabled={editing}
                  autoComplete="new-password"
                />
              </label>
              <label className="um-field">
                <span>Rôle</span>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))}
                  disabled={editing}
                >
                  <option value="user">Utilisateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </label>
            </div>
            <div className="um-form__actions">
              <button type="button" className="um-btn um-btn--ghost"
                onClick={() => setEditTarget(null)}>
                Annuler
              </button>
              <button type="submit" className="um-btn um-btn--primary" disabled={editing}>
                {editing ? "Enregistrement…" : "Mettre à jour"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Users table ── */}
      {loading && users.length === 0 ? (
        <div className="um-loading">Chargement…</div>
      ) : users.length === 0 ? (
        <p className="um-empty">Aucun compte trouvé.</p>
      ) : (
        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nom d'utilisateur</th>
                <th>Rôle</th>
                <th>Créé le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody style={{ opacity: loading ? 0.5 : 1 }}>
              {users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((u) => {
                const self = isSelf(u)
                return (
                  <tr key={u.userId} className={self ? "um-row--self" : ""}>
                    <td className="um-td--id">{u.userId}</td>
                    <td className="um-td--name">
                      {u.username}
                      {self && <span className="um-self-badge">Vous</span>}
                    </td>
                    <td>
                      <span className={`um-role-badge um-role-badge--${u.role}`}>
                        {u.role === "admin" ? "Admin" : "Utilisateur"}
                      </span>
                    </td>
                    <td className="um-td--date">{fmtDate(u.createdAt)}</td>
                    <td className="um-td--actions">
                      <button
                        className="um-btn um-btn--edit"
                        onClick={() => openEdit(u)}
                      >
                        Modifier
                      </button>
                      <button
                        className="um-btn um-btn--delete"
                        onClick={() => handleDelete(u)}
                        disabled={self}
                        title={self ? "Vous ne pouvez pas supprimer votre propre compte" : ""}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={users.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}

export default UserManagementPage
