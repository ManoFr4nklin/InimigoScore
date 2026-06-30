import { useState } from 'react'
import './App.css'
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

export default function App() {
  const [logado, setLogado]     = useState(() => localStorage.getItem('inis_auth') === '1')
  const [page, setPage]         = useState('jogadores')
  const [times, setTimes]       = useState(null)
  const [goleiros, setGoleiros] = useState([])

  if (!logado) {
    return <Login onLogin={() => setLogado(true)} />
  }

  function sair() {
    localStorage.removeItem('inis_auth')
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
          <button className="nav-btn nav-sair" onClick={sair} title="Sair">⏏</button>
        </nav>
      </header>
      <main className="app-main">
        {page === 'jogadores'  && <Jogadores />}
        {page === 'sorteio'   && <Sorteio setTimes={setTimes} setGoleiros={setGoleiros} setPage={setPage} />}
        <div style={{ display: page === 'partida' ? 'block' : 'none' }}>
          <Partida times={times} setTimes={setTimes} goleiros={goleiros} />
        </div>
        {page === 'resultados' && <Resultados />}
      </main>
    </div>
  )
}
