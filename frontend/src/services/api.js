const API_URL = import.meta.env.VITE_API_URL

// ── Auth header helper ────────────────────────────────────────────────────────
function authHeaders(extra = {}) {
  const token = localStorage.getItem('gmd_auth_token')
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// ── 401 interceptor: clear session and reload to show login page ──────────────
function handleUnauthorized() {
  localStorage.removeItem('gmd_auth_token')
  localStorage.removeItem('gmd_auth_user')
  // Reload the page so the Redux store is re-initialized from empty localStorage,
  // which triggers the auth gate and shows the login page.
  window.location.reload()
}

async function handleResponse(response) {
  // Token expired or invalid → force re-login
  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Session expirée. Veuillez vous reconnecter.')
  }

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
  return handleResponse(await fetch(`${API_URL}/api/Magasins`, {
    headers: authHeaders()
  }))
}
export async function createMagasin(dto) {
  return handleResponse(await fetch(`${API_URL}/api/Magasins`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}
export async function updateMagasin(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/Magasins/${id}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}
export async function deleteMagasin(id) {
  return handleResponse(await fetch(`${API_URL}/api/Magasins/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  }))
}

// ── Rayons ────────────────────────────────────────────────────────
export async function getRayons() {
  return handleResponse(await fetch(`${API_URL}/api/Rayons`, {
    headers: authHeaders()
  }))
}
export async function createRayon(dto) {
  return handleResponse(await fetch(`${API_URL}/api/Rayons`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}
export async function updateRayon(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/Rayons/${id}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}
export async function deleteRayon(id) {
  return handleResponse(await fetch(`${API_URL}/api/Rayons/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  }))
}

// ── Zones ─────────────────────────────────────────────────────────
export async function getZones() {
  return handleResponse(await fetch(`${API_URL}/api/Zones`, {
    headers: authHeaders()
  }))
}
export async function createZone(dto) {
  return handleResponse(await fetch(`${API_URL}/api/Zones`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}
export async function updateZone(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/Zones/${id}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}
export async function deleteZone(id) {
  return handleResponse(await fetch(`${API_URL}/api/Zones/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  }))
}

// ── Cases ─────────────────────────────────────────────────────────
export async function getCases() {
  return handleResponse(await fetch(`${API_URL}/api/Cases`, {
    headers: authHeaders()
  }))
}
export async function createCase(dto) {
  return handleResponse(await fetch(`${API_URL}/api/Cases`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}
export async function updateCase(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/Cases/${id}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}
export async function deleteCase(id) {
  return handleResponse(await fetch(`${API_URL}/api/Cases/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  }))
}

// ── Articles ──────────────────────────────────────────────────────
export async function getArticles() {
  return handleResponse(await fetch(`${API_URL}/api/Articles`, {
    headers: authHeaders()
  }))
}
export async function createArticle(dto) {
  return handleResponse(await fetch(`${API_URL}/api/Articles`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}
export async function updateArticle(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/Articles/${id}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}
export async function deleteArticle(id) {
  return handleResponse(await fetch(`${API_URL}/api/Articles/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  }))
}

export async function getArticleThresholds() {
  return handleResponse(
    await fetch(`${API_URL}/api/Articles/thresholds`, {
      headers: authHeaders()
    })
  )
}

export async function updateArticleThresholds(id, dto) {
  return handleResponse(
    await fetch(`${API_URL}/api/Articles/${id}/thresholds`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(dto)
    })
  )
}

// ── Données mensuelles ────────────────────────────────────────────
export async function getMonthlyData() {
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData`, {
    headers: authHeaders()
  }))
}
export async function getMonthlyDataById(id) {
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData/${id}`, {
    headers: authHeaders()
  }))
}
export async function createMonthlyData(dto) {
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}
export async function updateMonthlyData(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData/${id}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}
export async function deleteMonthlyData(id) {
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  }))
}
// Vide les données mensuelles et les articles. Magasins, rayons, zones,
// cases et comptes utilisateurs sont conservés.
export async function purgeAllData() {
  return handleResponse(await fetch(`${API_URL}/api/MonthlyData/purge`, {
    method: "DELETE",
    headers: authHeaders()
  }))
}

// replace=true : le serveur purge les mouvements et les articles avant
// d'écrire. L'infrastructure (magasins, rayons, zones, cases) est conservée.
export async function scanCsv(file, replace = false) {
  const formData = new FormData()
  formData.append("file", file)
  return handleResponse(await fetch(
    `${API_URL}/api/MonthlyData/scan?replace=${replace}`, {
      method: "POST",
      headers: authHeaders(),
      body: formData
    }))
}
export async function uploadCsv(file, replace = false) {
  const formData = new FormData()
  formData.append("file", file)
  return handleResponse(await fetch(
    `${API_URL}/api/MonthlyData/upload?replace=${replace}`, {
      method: "POST",
      headers: authHeaders(),
      body: formData
    }))
}

export async function forecastNextYear(articleName) {
  return handleResponse(await fetch(`${API_URL}/api/forecast`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ articleName })
  }))
}

// ── User Management (admin only) ──────────────────────────────────
export async function getUsers() {
  return handleResponse(await fetch(`${API_URL}/api/users`, {
    headers: authHeaders()
  }))
}

export async function createUser(dto) {
  return handleResponse(await fetch(`${API_URL}/api/users`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}

export async function updateUser(id, dto) {
  return handleResponse(await fetch(`${API_URL}/api/users/${id}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(dto)
  }))
}

export async function deleteUser(id) {
  return handleResponse(await fetch(`${API_URL}/api/users/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  }))
}

