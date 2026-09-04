import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { login, registerUser, clearAuthError } from "../store/authSlice"
import "./LoginPage.css"

function LoginPage() {
  const dispatch = useDispatch()
  const { loading, error } = useSelector((state) => state.auth)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isRegister, setIsRegister] = useState(false)

  useEffect(() => {
    dispatch(clearAuthError())
  }, [dispatch])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    
    if (isRegister) {
      dispatch(registerUser({ username: username.trim(), password }))
    } else {
      dispatch(login({ username: username.trim(), password }))
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        {/* Logo / Brand */}
        <div className="login-brand">
          <div className="login-brand__icon">🏭</div>
          <h1 className="login-brand__name">GMD Metal Tanger</h1>
          <p className="login-brand__sub">Système de gestion des stocks</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="login-username" className="login-label">
              Nom d'utilisateur
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon">👤</span>
              <input
                id="login-username"
                type="text"
                className="login-input"
                placeholder={isRegister ? "Nouveau nom d'utilisateur" : "admin ou user"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-password" className="login-label">
              Mot de passe
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon">🔒</span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="login-input login-input--password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label="Afficher / masquer le mot de passe"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error">
              <span>!</span> {error}
            </div>
          )}

          <button
            type="submit"
            className="login-btn"
            disabled={loading || !username.trim() || !password.trim()}
          >
            {loading ? (
              <span className="login-btn__spinner" />
            ) : (
              isRegister ? "Créer mon compte" : "Se connecter"
            )}
          </button>
        </form>

        <p className="login-hint">
          {isRegister ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
          <button 
            type="button" 
            className="login-toggle-btn"
            onClick={() => {
              setIsRegister(!isRegister)
              dispatch(clearAuthError())
            }}
          >
            {isRegister ? "Se connecter" : "S'inscrire"}
          </button>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
