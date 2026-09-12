import { useEffect, useMemo, useRef, useState } from "react"
import { useSelector } from "react-redux"
import {
  createMonthlyData,
  deleteMonthlyData,
  getArticles,
  getCases,
  getMonthlyData,
  updateMonthlyData,
  purgeAllData,
  scanCsv,
  uploadCsv,
} from "../services/api"
import Pagination from "../components/Pagination"
import {
  exportImportableCsv,
  exportImportableXlsx,
  xlsxFileToImportCsv,
} from "../utils/monthlyDataTransfer"
import "./CsvUploadPage.css"
import "./CrudPage.css"

const EMPTY_MOVEMENT = {
  articleId: "",
  caseId: "",
  mois: "",
  quantiteEntrer: "",
  quantiteSortie: "",
}

function CsvUploadPage() {
  const role = useSelector((state) => state.auth.role)
  const isAdmin = role === "admin"
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [movements, setMovements] = useState([])
  const [articles, setArticles] = useState([])
  const [cases, setCases] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [warning, setWarning] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT)
  const [search, setSearch] = useState("")
  const [exporting, setExporting] = useState(false)
  const [exportMenu, setExportMenu] = useState(false)
  const [preview, setPreview] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [replaceAll, setReplaceAll] = useState(false)
  // null | "replace" | "purge" — les deux actions destructives partagent le
  // même garde-fou : une confirmation tapée à la main.
  const [confirmMode, setConfirmMode] = useState(null)
  const [confirmWord, setConfirmWord] = useState("")
  const [purging, setPurging] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  const inputRef = useRef()

  async function loadData(showLoader = true) {
    try {
      if (showLoader) setLoadingData(true)
      setError("")

      const [movementRows, articleRows, caseRows] = await Promise.all([
        getMonthlyData(),
        getArticles(),
        getCases(),
      ])

      setMovements(movementRows)
      setArticles(articleRows)
      setCases(caseRows)
    } catch (err) {
      setError(err.message || "Impossible de charger les données mensuelles.")
    } finally {
      if (showLoader) setLoadingData(false)
    }
  }

  useEffect(() => {
    // Initial API synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [])

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return movements

    return movements.filter(movement => (
      movement.codeArticle?.toLowerCase().includes(term) ||
      movement.nomArticle?.toLowerCase().includes(term) ||
      movement.fullLocation?.toLowerCase().includes(term) ||
      movement.source?.toLowerCase().includes(term) ||
      formatMois(movement.mois).includes(term)
    ))
  }, [movements, search])

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const paginatedMovements = useMemo(() => {
    return filteredMovements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  }, [filteredMovements, currentPage])

  function pickFile(selectedFile) {
    if (!selectedFile) return

    if (!/\.(csv|xlsx)$/i.test(selectedFile.name)) {
      setError("Seuls les fichiers .csv et .xlsx sont acceptés.")
      return
    }

    setError("")
    setResult(null)
    setPreview(null)
    setFile(selectedFile)
  }

  function onDrop(event) {
    event.preventDefault()
    setDragging(false)
    pickFile(event.dataTransfer.files[0])
  }

  // L'API n'accepte que le .csv (DonneeController filtre sur l'extension).
  // Un .xlsx est donc normalisé ici, côté navigateur, vers les six colonnes
  // attendues — pas de dépendance tableur ajoutée au backend.
  async function prepareFile() {
    if (!/\.xlsx$/i.test(file.name)) return file

    const converted = await xlsxFileToImportCsv(file)
    if (converted.skippedLegacy > 0) {
      setWarning(
        `${converted.skippedLegacy} ligne(s) ignorée(s) à la conversion : ` +
        "emplacement Legacy ou Case supprimée."
      )
    }
    return converted.file
  }

  // Simulation : le serveur applique tout le traitement puis annule. Rien
  // n'est écrit tant que l'utilisateur n'a pas confirmé.
  async function handleScan() {
    if (!file) return

    try {
      setScanning(true)
      setError("")
      setSuccess("")
      setWarning("")
      setResult(null)

      setPreview(await scanCsv(await prepareFile(), replaceAll))
    } catch (err) {
      setError(err.message || "Échec de l'analyse du fichier.")
    } finally {
      setScanning(false)
    }
  }

  // Le mode « remplacer » détruit des données que le fichier ne suffit pas
  // toujours à reconstituer : il passe donc par une confirmation explicite,
  // jamais par le simple clic qui suffit à un import normal.
  function handleUpload() {
    if (!file) return

    if (replaceAll) {
      openConfirm("replace")
      return
    }

    runUpload()
  }

  function openConfirm(mode) {
    setConfirmWord("")
    setConfirmMode(mode)
  }

  async function runUpload() {
    if (!file) return

    try {
      setUploading(true)
      setError("")
      setSuccess("")
      setWarning("")

      const toSend = await prepareFile()
      const uploadResult = await uploadCsv(toSend, replaceAll)
      setResult(uploadResult)
      setPreview(null)
      setFile(null)
      setConfirmMode(null)
      setConfirmWord("")

      if (inputRef.current) {
        inputRef.current.value = ""
      }

      await loadData(false)
    } catch (err) {
      setError(err.message || "Échec de l'import.")
      setConfirmMode(null)
    } finally {
      setUploading(false)
    }
  }

  // Purge autonome : aucun fichier, aucune réécriture. Sert à repartir d'une
  // base vide avant un premier import.
  async function runPurge() {
    try {
      setPurging(true)
      setError("")
      setSuccess("")
      setWarning("")
      setResult(null)
      setPreview(null)

      const purged = await purgeAllData()

      setSuccess(
        `Base vidée : ${purged.donneesSupprimees ?? 0} mouvement(s) et ` +
        `${purged.articlesSupprimes ?? 0} article(s) supprimés. ` +
        "Magasins, rayons, zones et cases conservés."
      )

      setConfirmMode(null)
      setConfirmWord("")
      await loadData(false)
    } catch (err) {
      setError(err.message || "Échec de la suppression.")
      setConfirmMode(null)
    } finally {
      setPurging(false)
    }
  }

  // Le rapport d'analyse dépend du mode : celui obtenu avant le basculement
  // ne décrit plus ce qui sera écrit.
  function toggleReplaceAll(next) {
    setReplaceAll(next)
    setPreview(null)
    setResult(null)
  }

  function openAddMovement() {
    setEditId(null)
    setMovementForm({
      ...EMPTY_MOVEMENT,
      articleId: articles[0]?.articleId ?? "",
      caseId: cases[0]?.caseId ?? "",
    })
    setShowForm(true)
    setError("")
    setSuccess("")
    setWarning("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function openEditMovement(movement) {
    setEditId(movement.donneeId)
    setMovementForm({
      articleId: movement.articleId,
      caseId: movement.caseId ?? "",
      mois: formatMois(movement.mois),
      quantiteEntrer: movement.quantiteEntrer,
      quantiteSortie: movement.quantiteSortie,
    })
    setShowForm(true)
    setError("")
    setSuccess("")
    setWarning("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function cancelMovementForm() {
    setShowForm(false)
    setEditId(null)
    setMovementForm(EMPTY_MOVEMENT)
  }

  function movementField(name) {
    return event => {
      setMovementForm(current => ({
        ...current,
        [name]: event.target.value,
      }))
    }
  }

  function validateMovement() {
    if (!movementForm.articleId) return "Sélectionnez un Article."
    if (!movementForm.caseId) return "Sélectionnez une Case précise."
    if (!movementForm.mois) return "Le mois est obligatoire."

    if (
      movementForm.quantiteEntrer === "" ||
      Number(movementForm.quantiteEntrer) < 0
    ) {
      return "La quantité d'entrée doit être supérieure ou égale à 0."
    }

    if (
      movementForm.quantiteSortie === "" ||
      Number(movementForm.quantiteSortie) < 0
    ) {
      return "La quantité de sortie doit être supérieure ou égale à 0."
    }

    return null
  }

  async function handleMovementSubmit(event) {
    event.preventDefault()
    const validationError = validateMovement()

    if (validationError) {
      setError(validationError)
      return
    }

    const dto = {
      articleId: Number(movementForm.articleId),
      caseId: Number(movementForm.caseId),
      mois: movementForm.mois,
      quantiteEntrer: Number(movementForm.quantiteEntrer),
      quantiteSortie: Number(movementForm.quantiteSortie),
    }

    try {
      setSaving(true)
      setError("")
      setSuccess("")
      setWarning("")

      const saved = editId === null
        ? await createMonthlyData(dto)
        : await updateMonthlyData(editId, dto)

      setSuccess(
        editId === null
          ? "Mouvement créé avec succès."
          : "Mouvement modifié avec succès."
      )
      setWarning(saved.warning || "")
      cancelMovementForm()
      await loadData(false)
    } catch (err) {
      setError(err.message || "Opération échouée.")
    } finally {
      setSaving(false)
    }
  }

  async function handleMovementDelete(id) {
    if (!window.confirm("Supprimer ce mouvement ? Les stocks de la Case seront recalculés.")) {
      return
    }

    try {
      setError("")
      setSuccess("")
      setWarning("")
      await deleteMonthlyData(id)
      setSuccess("Mouvement supprimé et stocks recalculés.")
      await loadData(false)
    } catch (err) {
      setError(err.message || "Échec de la suppression.")
    }
  }

  // kind: "csv" | "xlsx" — les deux produisent un fichier réimportable
  async function handleExport(kind) {
    if (!filteredMovements.length) return

    setExportMenu(false)
    try {
      setExporting(true)
      setError("")
      setSuccess("")
      setWarning("")

      const run = kind === "csv" ? exportImportableCsv : exportImportableXlsx
      const { fileName, exported, skippedLegacy } = await run(filteredMovements)

      setSuccess(`Export réimportable généré : ${fileName} (${exported} ligne(s)).`)
      if (skippedLegacy > 0) {
        setWarning(
          `${skippedLegacy} mouvement(s) exclu(s) : Legacy ou rattaché(s) à une ` +
          "Case supprimée, sans emplacement que l'import puisse résoudre."
        )
      }
    } catch (err) {
      setError(err.message || "Échec de l'export.")
    } finally {
      setExporting(false)
    }
  }

  function formatMois(dateOnly) {
    return dateOnly?.slice(0, 7) ?? ""
  }

  function formatDateFr(dateOnly) {
    if (!dateOnly) return ""
    const [year, month, day] = dateOnly.split("-")
    return `${day}/${month}/${year}`
  }

  function formatNumber(value) {
    return Number(value ?? 0).toLocaleString("fr-FR")
  }

  return (
    <div className="csv-page csv-page--wide">
      <div className="crud-header">
        <div className="csv-header">
          <h1>Données Mensuelles</h1>
          <p className="csv-subtitle">
            Chaque mouvement appartient à un Article, une Case précise et un mois.
          </p>
        </div>
      {isAdmin && (
        <button
          className="btn-primary"
          onClick={showForm ? cancelMovementForm : openAddMovement}
        >
          {showForm ? "✕ Annuler" : "+ Ajouter un mouvement"}
        </button>
      )}
      </div>

      {error && <div className="csv-banner csv-banner--error">{error}</div>}
      {success && <div className="crud-banner crud-banner--success">{success}</div>}
      {warning && <div className="crud-banner crud-banner--warning">{warning}</div>}

      {isAdmin && showForm && (
        <form className="crud-form" onSubmit={handleMovementSubmit}>
          <h3 className="form-title">
            {editId === null ? "Nouveau mouvement" : `Modifier le mouvement ${editId}`}
          </h3>

          <div className="form-grid">
            <label className="form-field">
              <span>Article <span className="required">*</span></span>
              <select
                value={movementForm.articleId}
                onChange={movementField("articleId")}
              >
                <option value="">— Sélectionner —</option>
                {articles.map(article => (
                  <option key={article.articleId} value={article.articleId}>
                    {article.codeArticle} — {article.nomArticle}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Case et emplacement <span className="required">*</span></span>
              <select
                value={movementForm.caseId}
                onChange={movementField("caseId")}
              >
                <option value="">— Sélectionner —</option>
                {cases.map(storageCase => (
                  <option key={storageCase.caseId} value={storageCase.caseId}>
                    {storageCase.fullLocation} — {storageCase.quantiteActuelle}/
                    {storageCase.capaciteMaximum}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Mois <span className="required">*</span></span>
              <input
                type="month"
                value={movementForm.mois}
                onChange={movementField("mois")}
              />
            </label>

            <label className="form-field">
              <span>Quantité entrée <span className="required">*</span></span>
              <input
                type="number"
                min="0"
                value={movementForm.quantiteEntrer}
                onChange={movementField("quantiteEntrer")}
              />
            </label>

            <label className="form-field">
              <span>Quantité sortie <span className="required">*</span></span>
              <input
                type="number"
                min="0"
                value={movementForm.quantiteSortie}
                onChange={movementField("quantiteSortie")}
              />
            </label>
          </div>

          {editId !== null && !movementForm.caseId && (
            <p className="form-note form-note--warning">
              Ce mouvement est Legacy. Sélectionnez une Case pour lui attribuer un emplacement.
            </p>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={cancelMovementForm}
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary btn-submit" disabled={saving}>
              {saving ? "Enregistrement…" : editId === null ? "Créer" : "Mettre à jour"}
            </button>
          </div>
        </form>
      )}

      {isAdmin && (
        <section className="csv-import-panel">
        <h2>Importer un fichier CSV ou Excel</h2>
        <p className="csv-subtitle">
          Colonnes exactes :{" "}
          <code>
            codeArticle,nomArticle,fullLocation,mois,QuantiteEntrer,QuantiteSortie
          </code>
        </p>
        <p className="csv-subtitle">
          Un article dont le code n’existe pas encore est créé automatiquement
          à partir du nom porté par le fichier.
        </p>

        <div
          className={`drop-zone ${dragging ? "drop-zone--active" : ""} ${file ? "drop-zone--ready" : ""}`}
          onDragOver={event => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            className="drop-zone__input"
            onChange={event => pickFile(event.target.files[0])}
          />

          {file ? (
            <div className="drop-zone__file">
              <span className="drop-zone__icon">📄</span>
              <span className="drop-zone__name">{file.name}</span>
              <span className="drop-zone__size">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          ) : (
            <div className="drop-zone__placeholder">
              <span className="drop-zone__icon">📂</span>
              <span>
                Glissez-déposez un fichier CSV ou Excel ici, ou <u>cliquez pour parcourir</u>
              </span>
            </div>
          )}
        </div>

        <div className="csv-format-hint">
          <span className="hint-label">Exemple</span>
          <code className="hint-example">
            ART-001,Cylindre moteur,GMD metal Tanger &gt; R1 &gt; Z1 &gt;
            C1,2024-01,500,480
          </code>
        </div>

        <label className="replace-toggle">
          <input
            type="checkbox"
            checked={replaceAll}
            onChange={event => toggleReplaceAll(event.target.checked)}
          />
          <span className="replace-toggle__text">
            <strong>Remplacer toutes les données existantes</strong>
            <em>
              Supprime la totalité des mouvements et des articles, puis recrée
              les articles à partir du fichier. Les magasins, rayons, zones et
              cases — capacités comprises — sont conservés.
            </em>
          </span>
        </label>

        <div className="csv-actions">
          <button
            className="btn-scan"
            onClick={handleScan}
            disabled={!file || scanning || uploading}
          >
            {scanning ? "Analyse…" : "Analyser d’abord"}
          </button>
          <button
            className={replaceAll ? "btn-upload btn-upload--danger" : "btn-upload"}
            onClick={handleUpload}
            disabled={!file || uploading || scanning}
          >
            {uploading
              ? "Import en cours…"
              : replaceAll
                ? "Remplacer et importer"
                : "Importer le fichier"}
          </button>
        </div>

        {preview && (
          <section className="scan-panel">
            <div className="scan-panel__head">
              <h3>Aperçu — rien n’a encore été enregistré</h3>
              <button className="btn-secondary-sm" onClick={() => setPreview(null)}>
                Fermer
              </button>
            </div>

            <div className="result-summary">
              <span className="result-badge result-badge--success">
                À insérer : {preview.lignesReellementInserees ?? 0}
              </span>
              <span className="result-badge result-badge--info">
                Corrigées : {preview.lignesCorrigees ?? 0}
              </span>
              <span className="result-badge result-badge--info">
                Doublons additionnés : {preview.doublonsFusionnes ?? 0}
              </span>
              <span className="result-badge result-badge--info">
                Déjà existantes : {preview.lignesDejaExistantes ?? 0}
              </span>
              <span className="result-badge result-badge--warn">
                Rejetées : {preview.lignesInvalides ?? 0}
              </span>
              {preview.remplacement && (
                <span className="result-badge result-badge--danger">
                  À supprimer : {preview.donneesSupprimees ?? 0} mouvement(s),{" "}
                  {preview.articlesSupprimes ?? 0} article(s)
                </span>
              )}
              {(preview.remplacement ||
                (preview.nouveauxArticlesCrees ?? 0) > 0) && (
                <span className="result-badge result-badge--info">
                  {preview.remplacement
                    ? "Articles recréés"
                    : "Articles à créer"}{" "}
                  : {preview.nouveauxArticlesCrees ?? 0}
                </span>
              )}
            </div>

            {preview.notesFichier?.length > 0 && (
              <ul className="scan-notes">
                {preview.notesFichier.map((note, i) => <li key={i}>{note}</li>)}
              </ul>
            )}

            {preview.corrections?.length > 0 && (
              <>
                <h4 className="result-table-title">
                  Corrections automatiques ({preview.corrections.length})
                </h4>
                <div className="table-scroll">
                  <table className="csv-table">
                    <thead>
                      <tr>
                        <th>Ligne</th><th>Champ</th><th>Avant</th><th>Après</th><th>Raison</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.corrections.slice(0, 60).map((c, i) => (
                        <tr key={i}>
                          <td>{c.numeroLigne}</td>
                          <td>{c.champ}</td>
                          <td className="cell-before">{c.valeurOriginale || "—"}</td>
                          <td className="cell-after">{c.valeurCorrigee || "—"}</td>
                          <td>{c.raison}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {preview.erreurs?.length > 0 && (
              <>
                <h4 className="result-table-title">
                  Impossibles à corriger ({preview.erreurs.length})
                </h4>
                <div className="table-scroll">
                  <table className="csv-table">
                    <thead>
                      <tr><th>Ligne</th><th>Code</th><th>Champ</th><th>Raison</th></tr>
                    </thead>
                    <tbody>
                      {preview.erreurs.slice(0, 60).map((e, i) => (
                        <tr key={i}>
                          <td>{e.numeroLigne}</td>
                          <td>{e.codeArticle || "—"}</td>
                          <td>{e.champ || "—"}</td>
                          <td>{e.raison}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {preview.warnings?.length > 0 && (
              <ul className="result-warnings">
                {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}

            <button
              className={replaceAll ? "btn-upload btn-upload--danger" : "btn-upload"}
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading
                ? "Import en cours…"
                : replaceAll
                  ? "Confirmer le remplacement"
                  : "Confirmer et importer"}
            </button>
          </section>
        )}
      </section>
      )}

      {isAdmin && (
        <section className="danger-zone">
          <div className="danger-zone__text">
            <h3>Vider la base</h3>
            <p>
              Supprime <strong>toutes</strong> les données mensuelles et{" "}
              <strong>tous</strong> les articles
              {movements.length > 0 || articles.length > 0 ? (
                <> — actuellement {movements.length} mouvement(s) et{" "}
                {articles.length} article(s)</>
              ) : null}
              . Les magasins, rayons, zones et cases sont conservés, ainsi que
              les comptes utilisateurs. Irréversible.
            </p>
          </div>
          <button
            className="btn-danger-zone"
            onClick={() => openConfirm("purge")}
            disabled={
              purging ||
              uploading ||
              (movements.length === 0 && articles.length === 0)
            }
          >
            {purging ? "Suppression…" : "Tout supprimer"}
          </button>
        </section>
      )}

      {result && (
        <section className="result-card">
          <div className="result-summary">
            <span className="result-badge result-badge--success">
              Insérées : {result.lignesReellementInserees ?? 0}
            </span>
            <span className="result-badge result-badge--info">
              Legacy converties : {result.lignesLegacyConverties ?? 0}
            </span>
            <span className="result-badge result-badge--warn">
              Invalides : {result.lignesInvalides ?? 0}
            </span>
            <span className="result-badge result-badge--warn">
              Conflits : {result.groupesEnConflit ?? 0}
            </span>
            <span className="result-badge result-badge--info">
              Déjà existantes : {result.lignesDejaExistantes ?? 0}
            </span>
            {(result.lignesCapaciteDepassee ?? 0) > 0 && (
              <span className="result-badge result-badge--danger">
                Capacité dépassée : {result.lignesCapaciteDepassee}
              </span>
            )}
            {result.remplacement && (
              <span className="result-badge result-badge--danger">
                Supprimées : {result.donneesSupprimees ?? 0} mouvement(s),{" "}
                {result.articlesSupprimes ?? 0} article(s)
              </span>
            )}
            {(result.remplacement ||
              (result.nouveauxArticlesCrees ?? 0) > 0) && (
              <span className="result-badge result-badge--success">
                {result.remplacement ? "Articles recréés" : "Articles créés"} :{" "}
                {result.nouveauxArticlesCrees ?? 0}
              </span>
            )}
          </div>

          {result.erreurs?.length > 0 && (
            <div className="table-scroll">
              <table className="csv-table">
                <thead>
                  <tr>
                    <th>Ligne</th>
                    <th>Code</th>
                    <th>Champ</th>
                    <th>Valeur</th>
                    <th>Raison</th>
                  </tr>
                </thead>
                <tbody>
                  {result.erreurs.slice(0, 50).map((item, index) => (
                    <tr key={`${item.numeroLigne}-${index}`}>
                      <td>{item.numeroLigne}</td>
                      <td>{item.codeArticle || "—"}</td>
                      <td>{item.champ || "—"}</td>
                      <td>{item.valeur || "—"}</td>
                      <td>{item.raison}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.erreurs.length > 50 && (
                <p className="no-data">
                  Affichage des 50 premières erreurs sur {result.erreurs.length}.
                </p>
              )}
            </div>
          )}

          {result.warnings?.length > 0 && (
            <ul className="result-warnings">
              {result.warnings.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}

          {result.apercuInserts?.length > 0 && (
            <>
              <h3 className="result-table-title">Aperçu des mouvements enregistrés</h3>
              <MovementTable
                rows={result.apercuInserts}
                formatMois={formatMois}
                formatNumber={formatNumber}
              />
            </>
          )}
        </section>
      )}

      <section className="movement-section">
        <div className="movement-toolbar">
          <div>
            <h2>Mouvements enregistrés</h2>
            <p className="csv-subtitle">
              {filteredMovements.length} affiché{filteredMovements.length !== 1 ? "s" : ""} sur{" "}
              {movements.length}
            </p>
          </div>
          <div className="movement-actions">
            <input
              className="movement-search"
              type="search"
              placeholder="Article, mois, emplacement ou source…"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <div className="export-menu">
              <button
                className="btn-export"
                onClick={() => setExportMenu(open => !open)}
                disabled={exporting || loadingData || filteredMovements.length === 0}
                aria-expanded={exportMenu}
                aria-haspopup="menu"
                title={
                  filteredMovements.length === 0
                    ? "Aucun mouvement à exporter"
                    : `Exporter ${filteredMovements.length} mouvement(s)`
                }
              >
                {exporting ? "Export en cours…" : "⤓ Exporter ▾"}
              </button>

              {exportMenu && (
                <>
                  <div
                    className="export-menu__backdrop"
                    onClick={() => setExportMenu(false)}
                  />
                  <div className="export-menu__list" role="menu">
                    <button role="menuitem" onClick={() => handleExport("csv")}>
                      <strong>Réimportable (.csv)</strong>
                      <span>Les 6 colonnes attendues par l’import</span>
                    </button>
                    <button role="menuitem" onClick={() => handleExport("xlsx")}>
                      <strong>Réimportable (.xlsx)</strong>
                      <span>Mêmes colonnes, au format Excel</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          {isAdmin && (
            <button
              className="btn-primary"
              onClick={showForm ? cancelMovementForm : openAddMovement}
              style={{ whiteSpace: "nowrap" }}
            >
              {showForm ? "✕ Annuler" : "+ Ajouter une ligne"}
            </button>
          )}
          </div>
        </div>

        {loadingData ? (
          <p className="no-data">Chargement des mouvements…</p>
        ) : filteredMovements.length === 0 ? (
          <p className="no-data">Aucun mouvement correspondant.</p>
        ) : (
          <div className="table-scroll movement-table-wrap">
            <table className="csv-table movement-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Emplacement</th>
                  <th>Mois</th>
                  <th>Entrée</th>
                  <th>Sortie</th>
                  <th>Source</th>
                  <th>Stock Article / Case</th>
                  <th>Quantité Case / Max</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedMovements.map(movement => (
                  <tr
                    key={movement.donneeId}
                    className={movement.capaciteDepassee ? "tr-warning" : ""}
                  >
                    <td>
                      <strong>{movement.codeArticle}</strong>
                      <span className="cell-secondary">{movement.nomArticle}</span>
                    </td>
                    <td className="location-cell">
                      {movement.fullLocation ? (
                        movement.fullLocation
                      ) : movement.ancienEmplacement ? (
                        <>
                          <span className="badge badge--orange">Case supprimée</span>
                          <span className="cell-secondary">
                            {movement.ancienEmplacement} · archivé le {formatDateFr(movement.detacheLe)}
                          </span>
                        </>
                      ) : (
                        <span className="badge badge--orange">Legacy non attribué</span>
                      )}
                    </td>
                    <td>{formatMois(movement.mois)}</td>
                    <td className="quantity-in">{formatNumber(movement.quantiteEntrer)}</td>
                    <td className="quantity-out">{formatNumber(movement.quantiteSortie)}</td>
                    <td>
                      <span className={`badge badge--${movement.source === "Legacy" ? "orange" : "blue"}`}>
                        {movement.source}
                      </span>
                    </td>
                    <td>{formatNumber(movement.stockArticleCase)}</td>
                    <td>
                      {movement.caseId
                        ? `${formatNumber(movement.quantiteTotaleCase)} / ${formatNumber(movement.capaciteMaximumCase)}`
                        : "—"}
                      {movement.capaciteDepassee && (
                        <span className="cell-warning">
                          +{formatNumber(movement.quantiteDepassee)}
                        </span>
                      )}
                    </td>
                    <td className="td-actions">
                      {isAdmin && (
                        <>
                          <button
                            className="btn-edit"
                            onClick={() => openEditMovement(movement)}
                          >
                            Modifier
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleMovementDelete(movement.donneeId)}
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {filteredMovements.length > 0 && !loadingData && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredMovements.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </section>

      {confirmMode && (() => {
        const isPurge = confirmMode === "purge"
        const word = isPurge ? "SUPPRIMER" : "REMPLACER"
        const busy = isPurge ? purging : uploading

        return (
          <div className="modal-overlay" onClick={() => !busy && setConfirmMode(null)}>
            <div className="modal-box" onClick={event => event.stopPropagation()}>
              <h3 className="modal-title">
                {isPurge
                  ? "Supprimer toutes les données ?"
                  : "Remplacer toutes les données ?"}
              </h3>

              <p className="modal-desc">
                Les <strong>{movements.length}</strong> mouvement(s) et les{" "}
                <strong>{articles.length}</strong> article(s) actuellement en
                base vont être supprimés
                {isPurge
                  ? ". Rien ne les remplace : la base repart vide"
                  : <>, puis reconstruits à partir de <strong>{file?.name}</strong></>}
                . Les magasins, rayons, zones et cases — capacités comprises —
                sont conservés, ainsi que les comptes utilisateurs.{" "}
                <strong>Cette action est irréversible.</strong>
              </p>

              <label className="modal-field">
                Tapez <code>{word}</code> pour confirmer
                <input
                  autoFocus
                  value={confirmWord}
                  onChange={event => setConfirmWord(event.target.value)}
                  placeholder={word}
                />
              </label>

              <div className="modal-actions">
                <button
                  className="btn-primary btn-submit"
                  onClick={isPurge ? runPurge : runUpload}
                  disabled={confirmWord.trim() !== word || busy}
                >
                  {busy
                    ? "Suppression en cours…"
                    : isPurge
                      ? "Supprimer définitivement"
                      : "Remplacer définitivement"}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setConfirmMode(null)}
                  disabled={busy}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function MovementTable({ rows, formatMois, formatNumber }) {
  return (
    <div className="table-scroll">
      <table className="csv-table">
        <thead>
          <tr>
            <th>Article</th>
            <th>Emplacement</th>
            <th>Mois</th>
            <th>Entrée</th>
            <th>Sortie</th>
            <th>Source</th>
            <th>Case / Capacité</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.donneeId}>
              <td>{row.codeArticle} — {row.nomArticle}</td>
              <td className="location-cell">{row.fullLocation || "—"}</td>
              <td>{formatMois(row.mois)}</td>
              <td>{formatNumber(row.quantiteEntrer)}</td>
              <td>{formatNumber(row.quantiteSortie)}</td>
              <td>{row.source}</td>
              <td>
                {formatNumber(row.quantiteTotaleCase)} /{" "}
                {formatNumber(row.capaciteMaximumCase)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CsvUploadPage
