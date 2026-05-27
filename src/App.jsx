import { useState } from 'react'
import './App.css'
import Jogadores from './pages/Jogadores'
import Sorteio from './pages/Sorteio'
import Partida from './pages/Partida'

const PAGES = [
  { id: 'jogadores', label: 'Jogadores' },
  { id: 'sorteio', label: 'Sorteio' },
  { id: 'partida', label: 'Partida' },
]

export default function App() {
  const [page, setPage] = useState('jogadores')

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
        </nav>
      </header>
      <main className="app-main">
        {page === 'jogadores' && <Jogadores />}
        {page === 'sorteio' && <Sorteio />}
        {page === 'partida' && <Partida />}
      </main>
    </div>
  )
}
