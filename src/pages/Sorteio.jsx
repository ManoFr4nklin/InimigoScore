import { useState, useEffect } from 'react'
import './Sorteio.css'

function calcNota(stats) {
  if (stats.partidas === 0) return 0
  const avg = (stats.gols + stats.assistencias) / stats.partidas
  return Math.min(10, avg * 5)
}

export default function Sorteio() {
  const [jogadores, setJogadores] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [times, setTimes] = useState(null)
  const [equilibrado, setEquilibrado] = useState(false)

  useEffect(() => {
    try {
      setJogadores(JSON.parse(localStorage.getItem('jogadores')) || [])
    } catch {
      setJogadores([])
    }
  }, [])

  function toggleSelecionado(id) {
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
    setTimes(null)
  }

  function sortear() {
    const jogs = jogadores.filter(j => selecionados.includes(j.id))
    let lista

    if (equilibrado) {
      lista = [...jogs].sort((a, b) => calcNota(b.stats) - calcNota(a.stats))
    } else {
      lista = [...jogs].sort(() => Math.random() - 0.5)
    }

    const timeA = []
    const timeB = []
    lista.forEach((j, i) => {
      if (i % 2 === 0) timeA.push(j)
      else timeB.push(j)
    })

    setTimes({ timeA, timeB })
  }

  return (
    <div className="sorteio-page">
      {jogadores.length === 0 ? (
        <div className="empty-state">
          Nenhum jogador cadastrado. Vá até a aba Jogadores e adicione primeiro.
        </div>
      ) : (
        <>
          <div className="step-header">
            <h2 className="step-title">Sortear Times</h2>
            <span className="step-count">{selecionados.length} selecionados</span>
          </div>

          <div className="select-list">
            {jogadores.map(j => {
              const sel = selecionados.includes(j.id)
              return (
                <div
                  key={j.id}
                  className={`select-card ${sel ? 'selected' : ''}`}
                  onClick={() => toggleSelecionado(j.id)}
                >
                  <div className={`chk ${sel ? 'chk-on' : ''}`}>{sel && '✓'}</div>
                  <span className="select-nome">{j.nome}</span>
                  <span className={`pos-badge pos-${j.posicao.toLowerCase()}`}>{j.posicao}</span>
                </div>
              )
            })}
          </div>

          <div className="sorteio-controls">
            <div className="toggle-row" onClick={() => { setEquilibrado(p => !p); setTimes(null) }}>
              <span className="toggle-label">Equilibrado por nota</span>
              <div className={`toggle-btn ${equilibrado ? 'on' : ''}`}>
                <span className="toggle-knob" />
              </div>
            </div>
            <button
              className="btn-sortear"
              disabled={selecionados.length < 2}
              onClick={sortear}
            >
              SORTEAR TIMES
            </button>
          </div>

          {times && (
            <div className="times-resultado">
              <div className="time-card">
                <h3 className="time-title time-a-title">TIME A</h3>
                {times.timeA.map(j => (
                  <div key={j.id} className="time-player">
                    <span className="time-player-nome">{j.nome}</span>
                    <span className={`pos-badge pos-${j.posicao.toLowerCase()}`}>{j.posicao}</span>
                  </div>
                ))}
              </div>
              <div className="vs-divider">VS</div>
              <div className="time-card">
                <h3 className="time-title time-b-title">TIME B</h3>
                {times.timeB.map(j => (
                  <div key={j.id} className="time-player">
                    <span className="time-player-nome">{j.nome}</span>
                    <span className={`pos-badge pos-${j.posicao.toLowerCase()}`}>{j.posicao}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
