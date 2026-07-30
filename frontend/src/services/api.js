const API_URL = import.meta.env.VITE_API_URL

async function handleResponse(response) {
  const responseText = await response.text()
  let payload = null

  if (responseText) {
    try {
      payload = JSON.parse(responseText)
    } catch {
      payload = responseText
    }
  }

  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : payload?.message || payload?.title || `Erreur ${response.status}`

    throw new Error(message)
  }

  if (response.status === 204) return null
  return payload
}

// ── Magasins ──────────────────────────────────────────────────────
export async function getMagasins() {
  return handleResponse(await fetch(`${API_URL}/api/Magasins`))
}
export async function createMagasin(dto) {
  return handleResponse(await fetch(`${API_URL}/api/Magasins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  }))
}
export async function updateMagasin(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/Magasins/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  }))
}
export async function deleteMagasin(id) {
  return handleResponse(await fetch(`${API_URL}/api/Magasins/${id}`, { method: "DELETE" }))
}

// ── Rayons ────────────────────────────────────────────────────────
export async function getRayons() {
  return handleResponse(await fetch(`${API_URL}/api/Rayons`))
}
export async function createRayon(dto) {
  return handleResponse(await fetch(`${API_URL}/api/Rayons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  }))
}
export async function updateRayon(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/Rayons/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  }))
}
export async function deleteRayon(id) {
  return handleResponse(await fetch(`${API_URL}/api/Rayons/${id}`, { method: "DELETE" }))
}

// ── Zones ─────────────────────────────────────────────────────────
export async function getZones() {
  return handleResponse(await fetch(`${API_URL}/api/Zones`))
}
export async function createZone(dto) {
  return handleResponse(await fetch(`${API_URL}/api/Zones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  }))
}
export async function updateZone(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/Zones/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  }))
}
export async function deleteZone(id) {
  return handleResponse(await fetch(`${API_URL}/api/Zones/${id}`, { method: "DELETE" }))
}

// ── Cases ─────────────────────────────────────────────────────────
export async function getCases() {
  return handleResponse(await fetch(`${API_URL}/api/Cases`))
}
export async function createCase(dto) {
  return handleResponse(await fetch(`${API_URL}/api/Cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  }))
}
export async function updateCase(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/Cases/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  }))
}
export async function deleteCase(id) {
  return handleResponse(await fetch(`${API_URL}/api/Cases/${id}`, { method: "DELETE" }))
}

// ── Articles ──────────────────────────────────────────────────────
export async function getArticles() {
  return handleResponse(await fetch(`${API_URL}/api/Articles`))
}
export async function createArticle(dto) {
  return handleResponse(await fetch(`${API_URL}/api/Articles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  }))
}
export async function updateArticle(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/Articles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  }))
}
export async function deleteArticle(id) {
  return handleResponse(await fetch(`${API_URL}/api/Articles/${id}`, { method: "DELETE" }))
}

export async function getArticleThresholds() {
  return handleResponse(
    await fetch(`${API_URL}/api/Articles/thresholds`)
  )
}

export async function updateArticleThresholds(id, dto) {
  return handleResponse(
    await fetch(`${API_URL}/api/Articles/${id}/thresholds`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dto)
    })
  )
}

// ── Données mensuelles ────────────────────────────────────────────
export async function getMonthlyData() {
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData`))
}
export async function getMonthlyDataById(id) {
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData/${id}`))
}
export async function createMonthlyData(dto) {
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  }))
}
export async function updateMonthlyData(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  }))
}
export async function deleteMonthlyData(id) {
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData/${id}`, {
    method: "DELETE"
  }))
}
export async function scanCsv(file) {
  const formData = new FormData()
  formData.append("file", file)
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData/scan`, {
    method: "POST",
    body: formData
  }))
}
export async function uploadCsv(file) {
  const formData = new FormData()
  formData.append("file", file)
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData/upload`, {
    method: "POST",
    body: formData
  }))
}

export async function forecastNextYear(articleName) {
  return handleResponse(await fetch(`${API_URL}/api/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ articleName })
  }))
}
