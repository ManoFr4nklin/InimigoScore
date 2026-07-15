import { useState, useEffect } from 'react'
import './App.css'
import { getToken, clearToken, apiFetch } from './api.js'
import Login from './pages/Login'
import Jogadores from './pages/Jogadores'
import Sorteio from './pages/Sorteio'
import Partida from './pages/Partida'
import Resultados from './pages/Resultados'

const PAGES = [
  { id: 'jogadores',  label: 'Jogadores' },
  { id: 'sorteio',   label: 'Sorteio' },
  { id: 'partida',   label: 'Partida' },
  { id: 'resultados', label: 'Resultados' },
]

const TIMES_KEY    = 'inis_times'
const GOLEIROS_KEY = 'inis_goleiros'

export default function App() {
  const [logado, setLogado]       = useState(() => !!getToken())
  const [page, setPage]           = useState('jogadores')
  const [times, setTimesState]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(TIMES_KEY)) } catch { return null }
  })
  const [goleiros, setGoleirosState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GOLEIROS_KEY)) || [] } catch { return [] }
  })
  const [testMode, setTestMode]   = useState(false)

  useEffect(() => {
    if (!logado) return
    apiFetch('/sorteio').then(r => r.json()).then(data => {
      if (data?.times) {
        setTimesState(data.times)
        localStorage.setItem(TIMES_KEY, JSON.stringify(data.times))
        setGoleirosState(data.goleiros || [])
        localStorage.setItem(GOLEIROS_KEY, JSON.stringify(data.goleiros || []))
      }
    }).catch(() => {})
  }, [logado])

  function setTimes(val) {
    setTimesState(val)
    if (val === null) {
      localStorage.removeItem(TIMES_KEY)
      apiFetch('/sorteio', { method: 'DELETE' }).catch(() => {})
    } else {
      localStorage.setItem(TIMES_KEY, JSON.stringify(val))
    }
  }

  function setGoleiros(val) {
    setGoleirosState(val)
    localStorage.setItem(GOLEIROS_KEY, JSON.stringify(val))
  }

  if (!logado) {
    return <Login onLogin={() => setLogado(true)} />
  }

  function sair() {
    clearToken()
    setLogado(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">INIMIGO<span>⚽</span>SCORE</div>
        <nav className="app-nav">
          {PAGES.map(p => (
            <button
              key={p.id}
              className={`nav-btn ${page === p.id ? 'active' : ''}`}
              onClick={() => setPage(p.id)}
            >
              {p.label}
            </button>
          ))}
          <button
            className={`nav-btn nav-teste${testMode ? ' nav-teste-on' : ''}`}
            onClick={() => setTestMode(m => !m)}
            title="Modo de teste — dados não afetam o ranking real"
          >
            TESTE
          </button>
          <button className="nav-btn nav-sair" onClick={sair} title="Sair">⏏</button>
        </nav>
      </header>
      {testMode && (
        <div className="teste-banner">
          MODO TESTE — partidas não afetam o ranking
        </div>
      )}
      <main className="app-main">
        {page === 'jogadores'  && <Jogadores />}
        {page === 'sorteio'   && <Sorteio setTimes={setTimes} setGoleiros={setGoleiros} setPage={setPage} />}
        {page === 'partida'   && <Partida times={times} setTimes={setTimes} goleiros={goleiros} testMode={testMode} />}
        {page === 'resultados' && <Resultados />}
      </main>
    </div>
  )
}
