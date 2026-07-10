import { useState } from 'react'
import './Login.css'
import { API, setToken } from '../api.js'

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha]     = useState('')
  const [erro, setErro]       = useState(false)
  const [loading, setLoading] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setLoading(true)
    setErro(false)
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha })
      })
      if (!res.ok) {
        setErro(true)
        setSenha('')
        return
      }
      const { token } = await res.json()
      setToken(token)
      onLogin()
    } catch {
      setErro(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-logo">INIMIGO<span>⚽</span>SCORE</div>
        <p className="login-sub">Área restrita</p>
        <form className="login-form" onSubmit={entrar}>
          <input
            className="inp"
            type="text"
            placeholder="Usuário"
            value={usuario}
            onChange={e => { setUsuario(e.target.value); setErro(false) }}
            autoComplete="username"
            disabled={loading}
          />
          <input
            className="inp"
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={e => { setSenha(e.target.value); setErro(false) }}
            autoComplete="current-password"
            disabled={loading}
          />
          {erro && <p className="login-erro">Usuário ou senha incorretos.</p>}
          <button className="btn-login" type="submit" disabled={loading}>
            {loading ? 'ENTRANDO...' : 'ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  )
}
