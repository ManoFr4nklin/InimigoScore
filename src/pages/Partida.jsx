import { useState, useEffect } from 'react'
import './Partida.css'

export default function Partida() {
  const [jogadores, setJogadores] = useState([])
  const [step, setStep] = useState(1)
  const [selecionados, setSelecionados] = useState([])
  const [statsPartida, setStatsPartida] = useState({})

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
  }

  function irParaStats() {
    if (selecionados.length < 2) return
    const inicial = {}
    selecionados.forEach(id => { inicial[id] = { gols: 0, assistencias: 0 } })
    setStatsPartida(inicial)
    setStep(2)
  }

  function ajustar(id, campo, delta) {
    setStatsPartida(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [campo]: Math.max(0, (prev[id][campo] || 0) + delta),
      },
    }))
  }

  function confirmarPartida() {
    const atualizados = jogadores.map(j => {
      if (!selecionados.includes(j.id)) return j
      const s = statsPartida[j.id]
      return {
        ...j,
        stats: {
          partidas: j.stats.partidas + 1,
          gols: j.stats.gols + (s.gols || 0),
          assistencias: j.stats.assistencias + (s.assistencias || 0),
        },
      }
    })
    localStorage.setItem('jogadores', JSON.stringify(atualizados))
    setStep(3)
  }

  function novaPartida() {
    try {
      setJogadores(JSON.parse(localStorage.getItem('jogadores')) || [])
    } catch {
      setJogadores([])
    }
    setSelecionados([])
    setStatsPartida({})
    setStep(1)
  }

  if (step === 3) {
    return (
      <div className="partida-page">
        <div className="confirmado-card">
          <div className="check-icon">✓</div>
          <h2 className="confirmado-title">Partida Registrada!</h2>
          <p className="confirmado-sub">As estatísticas foram atualizadas.</p>
          <button className="btn-nova" onClick={novaPartida}>NOVA PARTIDA</button>
        </div>
      </div>
    )
  }

  if (step === 2) {
    const jogsSelecionados = jogadores.filter(j => selecionados.includes(j.id))
    return (
      <div className="partida-page">
        <div className="step-header">
          <button className="btn-back" onClick={() => setStep(1)}>← VOLTAR</button>
          <h2 className="step-title">Estatísticas</h2>
          <span className="step-count">{selecionados.length} jogadores</span>
        </div>

        <div className="stats-list">
          {jogsSelecionados.map(j => (
            <div key={j.id} className="stat-card">
              <div className="stat-player-info">
                <span className="stat-nome">{j.nome}</span>
                <span className={`pos-badge pos-${j.posicao.toLowerCase()}`}>{j.posicao}</span>
              </div>
              <div className="stat-inputs">
                <div className="stat-group">
                  <label className="stat-label">GOLS</label>
                  <div className="stepper">
                    <button className="step-btn" onClick={() => ajustar(j.id, 'gols', -1)}>−</button>
                    <span className="step-val">{statsPartida[j.id]?.gols || 0}</span>
                    <button className="step-btn" onClick={() => ajustar(j.id, 'gols', 1)}>+</button>
                  </div>
                </div>
                <div className="stat-group">
                  <label className="stat-label">ASSISTS</label>
                  <div className="stepper">
                    <button className="step-btn" onClick={() => ajustar(j.id, 'assistencias', -1)}>−</button>
                    <span className="step-val">{statsPartida[j.id]?.assistencias || 0}</span>
                    <button className="step-btn" onClick={() => ajustar(j.id, 'assistencias', 1)}>+</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="btn-confirmar" onClick={confirmarPartida}>
          CONFIRMAR PARTIDA ✓
        </button>
      </div>
    )
  }

  return (
    <div className="partida-page">
      {jogadores.length === 0 ? (
        <div className="empty-state">
          Nenhum jogador cadastrado. Vá até a aba Jogadores e adicione primeiro.
        </div>
      ) : (
        <>
          <div className="step-header">
            <h2 className="step-title">Quem Jogou?</h2>
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
          <button
            className="btn-continuar"
            disabled={selecionados.length < 2}
            onClick={irParaStats}
          >
            CONTINUAR → {selecionados.length > 0 && `(${selecionados.length})`}
          </button>
        </>
      )}
    </div>
  )
}
