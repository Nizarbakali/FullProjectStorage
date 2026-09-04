import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

const TOKEN_KEY = 'gmd_auth_token'
const USER_KEY  = 'gmd_auth_user'

// ── Thunk: login ─────────────────────────────────────────────────────────────
export const login = createAsyncThunk(
  'auth/login',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const text = await response.text()
      let data = null
      try { data = JSON.parse(text) } catch { data = text }

      if (!response.ok) {
        const msg = typeof data === 'string'
          ? data
          : data?.message || `Erreur ${response.status}`
        return rejectWithValue(msg)
      }

      // Persist to localStorage
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username, role: data.role }))

      return data
    } catch (err) {
      return rejectWithValue(err.message || 'Erreur réseau')
    }
  }
)

// ── Thunk: register ──────────────────────────────────────────────────────────
export const registerUser = createAsyncThunk(
  'auth/register',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const text = await response.text()
      let data = null
      try { data = JSON.parse(text) } catch { data = text }

      if (!response.ok) {
        const msg = typeof data === 'string'
          ? data
          : data?.message || `Erreur ${response.status}`
        return rejectWithValue(msg)
      }

      // Persist to localStorage
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username, role: data.role }))

      return data
    } catch (err) {
      return rejectWithValue(err.message || 'Erreur réseau')
    }
  }
)

// ── Rehydrate from localStorage ───────────────────────────────────────────────
function loadFromStorage() {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const user  = JSON.parse(localStorage.getItem(USER_KEY) || 'null')
    if (token && user) {
      return { token, username: user.username, role: user.role, isAuthenticated: true }
    }
  } catch { /* ignore */ }
  return { token: null, username: null, role: null, isAuthenticated: false }
}

// ── Slice ──────────────────────────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    ...loadFromStorage(),
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.token           = null
      state.username        = null
      state.role            = null
      state.isAuthenticated = false
      state.error           = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    },
    clearAuthError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error   = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading         = false
        state.token           = action.payload.token
        state.username        = action.payload.username
        state.role            = action.payload.role
        state.isAuthenticated = true
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error   = action.payload || 'Identifiants incorrects.'
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true
        state.error   = null
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading         = false
        state.token           = action.payload.token
        state.username        = action.payload.username
        state.role            = action.payload.role
        state.isAuthenticated = true
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false
        state.error   = action.payload || 'Erreur lors de la création du compte.'
      })
  },
})

export const { logout, clearAuthError } = authSlice.actions
export default authSlice.reducer
