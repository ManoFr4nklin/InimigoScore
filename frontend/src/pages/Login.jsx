import { useState } from 'react'
import './Login.css'

const USUARIO = 'admin'
const SENHA   = 'admin'

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha]     = useState('')
  const [erro, setErro]       = useState(false)

  function entrar(e) {
    e.preventDefault()
    if (usuario === USUARIO && senha === SENHA) {
      localStorage.setItem('inis_auth', '1')
      onLogin()
    } else {
      setErro(true)
      setSenha('')
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
          />
          <input
            className="inp"
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={e => { setSenha(e.target.value); setErro(false) }}
            autoComplete="current-password"
          />
          {erro && <p className="login-erro">Usuário ou senha incorretos.</p>}
          <button className="btn-login" type="submit">ENTRAR</button>
        </form>
      </div>
    </div>
  )
}
