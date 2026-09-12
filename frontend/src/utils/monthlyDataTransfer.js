// Round-trip contract for "Données Mensuelles".
//
// The backend accepts EXACTLY these six headers, in any order and any case
// (DonneeService.RequiredHeaders / HasExpectedHeaders). A file with a
// different column count is rejected outright, so this list is the single
// source of truth for both the re-importable export and the .xlsx import.
export const IMPORT_COLUMNS = [
  "codeArticle",
  "nomArticle",
  "fullLocation",
  "mois",
  "QuantiteEntrer",
  "QuantiteSortie",
]

// Header aliases: the import also accepts the French display labels, so a
// sheet whose headers were retyped in Excel — or an older export kept on
// disk — is still recognised without having to rename the columns by hand.
const HEADER_ALIASES = {
  "code article": "codeArticle",
  "nom article": "nomArticle",
  "emplacement": "fullLocation",
  "mois": "mois",
  "quantité entrée": "QuantiteEntrer",
  "quantite entree": "QuantiteEntrer",
  "quantité sortie": "QuantiteSortie",
  "quantite sortie": "QuantiteSortie",
}

function canonicalHeader(raw) {
  const text = String(raw ?? "").trim()
  if (!text) return null
  const exact = IMPORT_COLUMNS.find(
    c => c.toLowerCase() === text.toLowerCase()
  )
  if (exact) return exact
  return HEADER_ALIASES[text.toLowerCase()] ?? null
}

function formatMois(dateOnly) {
  return typeof dateOnly === "string" ? dateOnly.slice(0, 7) : ""
}

/**
 * Keeps only the movements the backend can actually re-import.
 *
 * A movement is exportable when it still points at a live Case: `fullLocation`
 * is what the import resolves the emplacement from. Legacy rows (never
 * attached to a Case) and rows whose Case was deleted only carry
 * `ancienEmplacement`, which is not a resolvable location — the import would
 * reject them line by line.
 */
export function toImportRows(movements) {
  const rows = []
  let skippedLegacy = 0

  for (const m of movements) {
    if (!m.fullLocation) {
      skippedLegacy += 1
      continue
    }
    rows.push({
      codeArticle: m.codeArticle ?? "",
      nomArticle: m.nomArticle ?? "",
      fullLocation: m.fullLocation,
      mois: formatMois(m.mois),
      QuantiteEntrer: Number(m.quantiteEntrer ?? 0),
      QuantiteSortie: Number(m.quantiteSortie ?? 0),
    })
  }
  return { rows, skippedLegacy }
}

function csvCell(value) {
  const text = String(value ?? "")
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Excel n'interprète correctement les accents d'un CSV que s'il commence
// par un BOM UTF-8. StreamReader le retire côté serveur.
const BOM = String.fromCharCode(0xFEFF)
const CRLF = String.fromCharCode(13, 10)

// CsvHelper runs on InvariantCulture, so the separator must be a comma — not
// the semicolon a French Excel would default to.
function buildCsv(rows) {
  const lines = [IMPORT_COLUMNS.join(",")]
  for (const row of rows) {
    lines.push(IMPORT_COLUMNS.map(c => csvCell(row[c])).join(","))
  }
  // BOM so Excel opens the accents correctly; StreamReader strips it server-side.
  return BOM + lines.join(CRLF) + CRLF
}

function timestampSuffix(date) {
  const pad = v => String(v).padStart(2, "0")
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}`
  )
}

function download(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function assertRows(rows, skippedLegacy) {
  if (rows.length) return
  throw new Error(
    skippedLegacy > 0
      ? `Aucune ligne réimportable : les ${skippedLegacy} mouvement(s) affiché(s) ` +
        "sont Legacy ou rattachés à une Case supprimée."
      : "Aucun mouvement à exporter."
  )
}

/**
 * Re-importable .csv — exactly the six columns the import expects.
 * @returns {Promise<{fileName: string, exported: number, skippedLegacy: number}>}
 */
export async function exportImportableCsv(movements) {
  const { rows, skippedLegacy } = toImportRows(movements ?? [])
  assertRows(rows, skippedLegacy)

  const fileName = `donnees-mensuelles_reimport_${timestampSuffix(new Date())}.csv`
  download(new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" }), fileName)
  return { fileName, exported: rows.length, skippedLegacy }
}

/**
 * Re-importable .xlsx — same six columns, header on row 1.
 * @returns {Promise<{fileName: string, exported: number, skippedLegacy: number}>}
 */
export async function exportImportableXlsx(movements) {
  const { rows, skippedLegacy } = toImportRows(movements ?? [])
  assertRows(rows, skippedLegacy)

  const { default: ExcelJS } = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "GMD Metal — Gestion de stock"
  const sheet = workbook.addWorksheet("Données mensuelles")

  sheet.columns = IMPORT_COLUMNS.map(key => ({
    key,
    width: key === "fullLocation" ? 44 : key === "nomArticle" ? 30 : 16,
  }))

  const header = sheet.addRow(IMPORT_COLUMNS)
  header.font = { bold: true }
  header.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } }
  })
  // `mois` must stay the literal text YYYY-MM: Excel would otherwise turn it
  // into a date and the import would no longer recognise the format.
  sheet.getColumn(IMPORT_COLUMNS.indexOf("mois") + 1).numFmt = "@"
  for (const row of rows) sheet.addRow(row)
  sheet.views = [{ state: "frozen", ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  const fileName = `donnees-mensuelles_reimport_${timestampSuffix(new Date())}.xlsx`
  download(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    fileName
  )
  return { fileName, exported: rows.length, skippedLegacy }
}

/**
 * Converts a spreadsheet into the .csv the API accepts.
 *
 * The endpoint only takes .csv (DonneeController rejects anything else on the
 * file name), so .xlsx is normalised here rather than adding a spreadsheet
 * dependency to the backend. Extra columns are dropped and the header row is
 * located anywhere in the first rows, so both exports of this app work.
 *
 * @returns {Promise<{file: File, rows: number, skippedLegacy: number}>}
 */
export async function xlsxFileToImportCsv(file) {
  const { default: ExcelJS } = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())

  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error("Le classeur ne contient aucune feuille.")

  // Locate the header row: the analysis export puts a title and a context
  // line above it, so it is not necessarily row 1.
  let headerRow = null
  let mapping = null
  const limit = Math.min(sheet.rowCount, 20)
  for (let r = 1; r <= limit; r += 1) {
    const found = {}
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      const canonical = canonicalHeader(cell.text)
      if (canonical && !(canonical in found)) found[canonical] = col
    })
    if (IMPORT_COLUMNS.every(c => c in found)) {
      headerRow = r
      mapping = found
      break
    }
  }

  if (!headerRow) {
    throw new Error(
      "Colonnes introuvables dans le fichier Excel. Attendu : " +
      IMPORT_COLUMNS.join(", ") + "."
    )
  }

  const rows = []
  let skippedLegacy = 0
  for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
    const sheetRow = sheet.getRow(r)
    const value = key => {
      const cell = sheetRow.getCell(mapping[key])
      return cell.text == null ? "" : String(cell.text).trim()
    }

    // Dès qu'on retape le mois dans Excel, la cellule devient une vraie date
    // et `cell.text` renvoie « Mon Jan 01 2024 00:00:00 GMT+0100 » — dont un
    // slice(0,7) ferait « Mon Jan ». On lit donc la valeur typée en premier.
    const monthValue = () => {
      const cell = sheetRow.getCell(mapping.mois)
      const raw = cell.value instanceof Date
        ? cell.value
        : cell.value?.result instanceof Date
          ? cell.value.result
          : null

      if (raw) {
        return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, "0")}`
      }
      return value("mois").slice(0, 7)
    }

    const codeArticle = value("codeArticle")
    const fullLocation = value("fullLocation")
    if (!codeArticle && !fullLocation) continue      // ligne vide

    // Même règle qu'à l'export : sans emplacement résolvable, l'import
    // rejetterait la ligne — on la retire ici plutôt que de la faire échouer.
    if (!fullLocation || /supprimée|non attribué/i.test(fullLocation)) {
      skippedLegacy += 1
      continue
    }

    rows.push({
      codeArticle,
      nomArticle: value("nomArticle"),
      fullLocation,
      mois: monthValue(),
      QuantiteEntrer: value("QuantiteEntrer"),
      QuantiteSortie: value("QuantiteSortie"),
    })
  }

  if (!rows.length) {
    throw new Error("Aucune ligne exploitable dans le fichier Excel.")
  }

  const csvName = file.name.replace(/\.xlsx?$/i, "") + ".csv"
  const csvFile = new File([buildCsv(rows)], csvName, {
    type: "text/csv;charset=utf-8",
  })
  return { file: csvFile, rows: rows.length, skippedLegacy }
}
