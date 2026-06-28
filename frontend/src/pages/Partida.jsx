import { useState } from 'react'
import './Partida.css'

const API = 'http://localhost:3000'

function getStat(stats, jId, campo) {
  return (stats[jId] || {})[campo] || 0
}

function setStat(prev, jId, campo, val) {
  const curr = prev[jId] || { gols: 0, assists: 0, falhas: 0, desarmes: 0, faltas: 0, amarelos: 0, vermelhos: 0 }
  return { ...prev, [jId]: { ...curr, [campo]: Math.max(0, val) } }
}

export default function Partida({ times, setTimes, goleiros = [] }) {
  const [partidaId, setPartidaId]           = useState(null)
  const [sequencia, setSequencia]           = useState(1)
  const [jogando, setJogando]               = useState(null)
  const [fila, setFila]                     = useState([])
  const [stats, setStats]                   = useState({})
  const [goleirosAtivos, setGoleirosAtivos] = useState({ 0: null, 1: null })
  const [vitorias, setVitorias]             = useState([0, 0, 0, 0])
  const [totalVitorias, setTotalVitorias]   = useState([0, 0, 0, 0])
  const [fase, setFase]                     = useState('inicio')
  const [resultado, setResultado]           = useState(null)
  const [iniciando, setIniciando]           = useState([])

  if (!times) {
    return (
      <div className="partida-page">
        <div className="empty-state">Faça o sorteio de times na aba Sorteio primeiro.</div>
      </div>
    )
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function getTeamJogs(slot) {
    if (!jogando) return []
    const gol  = goleirosAtivos[slot]
    const time = times[jogando[slot]]
    return [...(gol ? [gol] : []), ...time.jogadores]
  }

  function teamGoals(slot, currentStats = stats) {
    return getTeamJogs(slot).reduce((sum, j) => sum + getStat(currentStats, j.id, 'gols'), 0)
  }

  function computePlacar(currentStats = stats) {
    return [teamGoals(0, currentStats), teamGoals(1, currentStats)]
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────
  function addGol(jId, slot) {
    if (teamGoals(slot) >= 2) return
    setStats(prev => setStat(prev, jId, 'gols', getStat(prev, jId, 'gols') + 1))
  }
  function removeGol(jId) {
    setStats(prev => setStat(prev, jId, 'gols', getStat(prev, jId, 'gols') - 1))
  }
  function addAssist(jId, slot) {
    const playerGoals = getStat(stats, jId, 'gols')
    const maxAssists  = teamGoals(slot) - playerGoals
    if (getStat(stats, jId, 'assists') >= maxAssists) return
    setStats(prev => setStat(prev, jId, 'assists', getStat(prev, jId, 'assists') + 1))
  }
  function removeAssist(jId) {
    setStats(prev => setStat(prev, jId, 'assists', getStat(prev, jId, 'assists') - 1))
  }
  function addFalha(jId)    { setStats(prev => setStat(prev, jId, 'falhas',   getStat(prev, jId, 'falhas')   + 1)) }
  function removeFalha(jId) { setStats(prev => setStat(prev, jId, 'falhas',   getStat(prev, jId, 'falhas')   - 1)) }
  function addDesarme(jId)    { setStats(prev => setStat(prev, jId, 'desarmes', getStat(prev, jId, 'desarmes') + 1)) }
  function removeDesarme(jId) { setStats(prev => setStat(prev, jId, 'desarmes', getStat(prev, jId, 'desarmes') - 1)) }
  function addFalta(jId)    { setStats(prev => setStat(prev, jId, 'faltas',   getStat(prev, jId, 'faltas')   + 1)) }
  function removeFalta(jId) { setStats(prev => setStat(prev, jId, 'faltas',   getStat(prev, jId, 'faltas')   - 1)) }
  function addAmarelo(jId)    { setStats(prev => setStat(prev, jId, 'amarelos', getStat(prev, jId, 'amarelos') + 1)) }
  function removeAmarelo(jId) { setStats(prev => setStat(prev, jId, 'amarelos', getStat(prev, jId, 'amarelos') - 1)) }
  function addVermelho(jId)    { setStats(prev => setStat(prev, jId, 'vermelhos', getStat(prev, jId, 'vermelhos') + 1)) }
  function removeVermelho(jId) { setStats(prev => setStat(prev, jId, 'vermelhos', getStat(prev, jId, 'vermelhos') - 1)) }

  // ─── Iniciar ───────────────────────────────────────────────────────────────
  async function iniciar() {
    if (iniciando.length !== 2) return
    let pId = partidaId
    if (!pId) {
      try {
        const res = await fetch(`${API}/partidas`, { method: 'POST' })
        const d   = await res.json()
        pId = d.id
        setPartidaId(pId)
      } catch (e) { console.error(e); return }
    }
    const fora = [0, 1, 2, 3].filter(i => !iniciando.includes(i))
    setJogando(iniciando)
    setFila(fora)
    setStats({})
    setGoleirosAtivos({ 0: null, 1: null })
    setFase(goleiros.length > 0 ? 'selecionandoGoleiros' : 'jogando')
  }

  // ─── Encerrar confronto ────────────────────────────────────────────────────
  function encerrar(vencedorSlot) {
    const placarFinal     = computePlacar()
    const currentStats    = { ...stats }
    const currentGoleiros = { ...goleirosAtivos }
    const [iA, iB]        = jogando
    const novasVit        = [...vitorias]
    let novoJogando, novaFila, msg, sairIdxs, entrarIdxs, resDB

    if (vencedorSlot === null) {
      resDB       = 'EMPATE'
      novoJogando = [fila[0], fila[1]]
      novaFila    = [iA, iB]
      novasVit[iA] = 0; novasVit[iB] = 0
      sairIdxs    = [iA, iB]
      entrarIdxs  = [fila[0], fila[1]]
      msg         = 'Empate! Ambos os times saem.'
    } else {
      const vIdx = vencedorSlot === 0 ? iA : iB
      const pIdx = vencedorSlot === 0 ? iB : iA
      resDB      = vencedorSlot === 0 ? 'A' : 'B'
      novasVit[vIdx] += 1
      novasVit[pIdx]  = 0
      setTotalVitorias(prev => { const n = [...prev]; n[vIdx]++; return n })

      if (novasVit[vIdx] >= 2) {
        novasVit[vIdx] = 0
        novoJogando    = [fila[0], fila[1]]
        novaFila       = [pIdx, vIdx]
        sairIdxs       = [vIdx, pIdx]
        entrarIdxs     = [fila[0], fila[1]]
        msg            = `${times[vIdx].nome} ganhou 2 seguidas! Ambos saem.`
      } else {
        novoJogando = [vIdx, fila[0]]
        novaFila    = [fila[1], pIdx]
        sairIdxs    = [pIdx]
        entrarIdxs  = [fila[0]]
        msg         = `${times[vIdx].nome} venceu!`
      }
    }

    setResultado({ msg, sairIdxs, entrarIdxs, novoJogando, novaFila, novasVit, placarFinal })
    setFase('resultado')
    salvar(placarFinal, resDB, currentStats, currentGoleiros)
  }

  // ─── Salvar no DB ──────────────────────────────────────────────────────────
  async function salvar(placarFinal, resDB, currentStats, currentGoleiros) {
    try {
      const [iA, iB] = jogando
      const rc = await fetch(`${API}/partidas/confrontos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fk_partida:  partidaId,
          sequencia,
          placar_a:    placarFinal[0],
          placar_b:    placarFinal[1],
          resultado:   resDB,
          nome_time_a: times[iA].nome,
          nome_time_b: times[iB].nome
        })
      })
      const confronto = await rc.json()

      const payload = []
      const addTime = (time, slot, letra) => {
        const gol  = currentGoleiros[slot]
        const todos = [...(gol ? [gol] : []), ...time.jogadores]
        todos.forEach(j => {
          const s = currentStats[j.id] || {}
          payload.push({
            fk_jogador:   j.id,
            time:         letra,
            gols:         s.gols      || 0,
            assistencias: s.assists   || 0,
            falhas:       s.falhas    || 0,
            desarmes:     s.desarmes  || 0,
            faltas:       s.faltas    || 0,
            amarelos:     s.amarelos  || 0,
            vermelhos:    s.vermelhos || 0
          })
        })
      }
      addTime(times[iA], 0, 'A')
      addTime(times[iB], 1, 'B')

      await fetch(`${API}/partidas/confrontos/${confronto.id}/jogadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch (e) { console.error('Erro ao salvar:', e) }
  }

  // ─── Próximo confronto ─────────────────────────────────────────────────────
  function proximo() {
    const { novoJogando, novaFila, novasVit } = resultado
    setJogando(novoJogando)
    setFila(novaFila)
    setVitorias(novasVit)
    setStats({})
    setGoleirosAtivos({ 0: null, 1: null })
    setResultado(null)
    setSequencia(s => s + 1)
    setFase(goleiros.length > 0 ? 'selecionandoGoleiros' : 'jogando')
  }

  function resetar() {
    setTimes(null)
    setPartidaId(null); setSequencia(1); setJogando(null); setFila([])
    setStats({}); setGoleirosAtivos({ 0: null, 1: null })
    setVitorias([0, 0, 0, 0]); setTotalVitorias([0, 0, 0, 0])
    setFase('inicio'); setIniciando([])
  }

  // ─── TELA: Selecionar goleiros ─────────────────────────────────────────────
  if (fase === 'selecionandoGoleiros' && jogando) {
    const [iA, iB] = jogando
    return (
      <div className="partida-page">
        <div className="step-header">
          <h2 className="step-title">Escolher Goleiros</h2>
          <span className="step-count">Confronto #{sequencia}</span>
        </div>

        <div className="goleiros-selecao">
          {[0, 1].map(slot => {
            const time = times[jogando[slot]]
            return (
              <div key={slot} className="gol-sel-card" style={{ borderColor: time.cor + '55' }}>
                <div className="gol-sel-title" style={{ color: time.cor }}>{time.nome}</div>
                <select
                  className="inp sel-gol"
                  value={goleirosAtivos[slot]?.id || ''}
                  onChange={e => {
                    const gol = goleiros.find(g => g.id === parseInt(e.target.value)) || null
                    setGoleirosAtivos(prev => ({ ...prev, [slot]: gol }))
                  }}
                >
                  <option value="">🚫 Sem goleiro</option>
                  {goleiros.map(g => (
                    <option key={g.id} value={g.id}>🥅 {g.nome}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>

        <button className="btn-sortear" onClick={() => setFase('jogando')}>
          INICIAR CONFRONTO
        </button>
      </div>
    )
  }

  // ─── TELA: Resultado ───────────────────────────────────────────────────────
  if (fase === 'resultado' && resultado) {
    const { msg, sairIdxs, entrarIdxs, placarFinal } = resultado
    const [iA, iB] = jogando
    return (
      <div className="partida-page">
        <div className="resultado-card">
          <div className="res-placar">
            <span className="res-time-nome" style={{ color: times[iA].cor }}>{times[iA].nome}</span>
            <span className="res-nums">{placarFinal[0]} × {placarFinal[1]}</span>
            <span className="res-time-nome" style={{ color: times[iB].cor }}>{times[iB].nome}</span>
          </div>
          <p className="res-msg">{msg}</p>

          <div className="placar-geral">
            {times.map((t, i) => (
              <div key={i} className="pg-item">
                <span className="pg-nome" style={{ color: t.cor }}>{t.nome}</span>
                <span className="pg-num">{totalVitorias[i]}</span>
                <span className="pg-label">V</span>
              </div>
            ))}
          </div>

          <div className="rotacao">
            <div className="rot-grupo">
              <span className="rot-label">Saem</span>
              <div className="rot-times">
                {sairIdxs.map(i => (
                  <span key={i} className="rot-badge" style={{ color: times[i].cor, borderColor: times[i].cor + '55' }}>
                    {times[i].nome}
                  </span>
                ))}
              </div>
            </div>
            <div className="rot-seta">→</div>
            <div className="rot-grupo">
              <span className="rot-label">Entram</span>
              <div className="rot-times">
                {entrarIdxs.map(i => (
                  <span key={i} className="rot-badge" style={{ color: times[i].cor, borderColor: times[i].cor + '55' }}>
                    {times[i].nome}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button className="btn-proximo" onClick={proximo}>PRÓXIMO CONFRONTO →</button>
          <button className="btn-reset" onClick={resetar}>Encerrar Pelada</button>
        </div>
      </div>
    )
  }

  // ─── TELA: Confronto em andamento ──────────────────────────────────────────
  if (fase === 'jogando' && jogando) {
    const [iA, iB] = jogando
    const timeA    = times[iA]
    const timeB    = times[iB]
    const placar   = computePlacar()

    const renderTime = (time, slot) => {
      const jogs   = getTeamJogs(slot)
      const tGoals = teamGoals(slot)
      return (
        <div className="time-jogo-card" style={{ '--cor': time.cor }}>
          <h4 className="time-jogo-title" style={{ color: time.cor }}>{time.nome}</h4>
          {jogs.map(j => {
            const g   = getStat(stats, j.id, 'gols')
            const a   = getStat(stats, j.id, 'assists')
            const f   = getStat(stats, j.id, 'falhas')
            const d   = getStat(stats, j.id, 'desarmes')
            const ft  = getStat(stats, j.id, 'faltas')
            const am  = getStat(stats, j.id, 'amarelos')
            const ve  = getStat(stats, j.id, 'vermelhos')
            const maxA = tGoals - g
            return (
              <div key={j.id} className="player-stat-row">
                <span className={`pos-badge pos-${j.posicao.toLowerCase()}`}>{j.posicao}</span>
                <span className="psr-nome">{j.nome}</span>
                <div className="psr-counters">
                  <div className="counter-group">
                    <button className="ctr-btn" onClick={() => removeGol(j.id)} disabled={g <= 0}>−</button>
                    <span className="ctr-val">⚽{g}</span>
                    <button className="ctr-btn" onClick={() => addGol(j.id, slot)} disabled={placar[slot] >= 2}>+</button>
                  </div>
                  <div className="counter-group">
                    <button className="ctr-btn" onClick={() => removeAssist(j.id)} disabled={a <= 0}>−</button>
                    <span className="ctr-val">🤝{a}</span>
                    <button className="ctr-btn" onClick={() => addAssist(j.id, slot)} disabled={a >= maxA}>+</button>
                  </div>
                  <div className="counter-group">
                    <button className="ctr-btn" onClick={() => removeFalha(j.id)} disabled={f <= 0}>−</button>
                    <span className="ctr-val">⚠{f}</span>
                    <button className="ctr-btn" onClick={() => addFalha(j.id)}>+</button>
                  </div>
                  {(j.posicao === 'DEF' || j.posicao === 'MEI') && (
                    <div className="counter-group">
                      <button className="ctr-btn" onClick={() => removeDesarme(j.id)} disabled={d <= 0}>−</button>
                      <span className="ctr-val">⚔{d}</span>
                      <button className="ctr-btn" onClick={() => addDesarme(j.id)}>+</button>
                    </div>
                  )}
                  <div className="counter-group">
                    <button className="ctr-btn" onClick={() => removeFalta(j.id)} disabled={ft <= 0}>−</button>
                    <span className="ctr-val">🦵{ft}</span>
                    <button className="ctr-btn" onClick={() => addFalta(j.id)}>+</button>
                  </div>
                  <div className="counter-group">
                    <button className="ctr-btn" onClick={() => removeAmarelo(j.id)} disabled={am <= 0}>−</button>
                    <span className="ctr-val">🟨{am}</span>
                    <button className="ctr-btn" onClick={() => addAmarelo(j.id)}>+</button>
                  </div>
                  <div className="counter-group">
                    <button className="ctr-btn" onClick={() => removeVermelho(j.id)} disabled={ve <= 0}>−</button>
                    <span className="ctr-val">🟥{ve}</span>
                    <button className="ctr-btn" onClick={() => addVermelho(j.id)}>+</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <div className="partida-page">
        <div className="confronto-header">
          <span className="seq-badge">Confronto #{sequencia}</span>
          <div className="fila-chips">
            <span className="fila-label">Na fila:</span>
            {fila.map(i => (
              <span key={i} className="fila-chip" style={{ color: times[i].cor, borderColor: times[i].cor + '55' }}>
                {times[i].nome}{totalVitorias[i] > 0 ? ` · ${totalVitorias[i]}V` : ''}
              </span>
            ))}
          </div>
        </div>

        <div className="placar-row">
          <div className="pl-time">
            <span className="pl-nome" style={{ color: timeA.cor }}>{timeA.nome}</span>
            {totalVitorias[iA] > 0 && <span className="pl-vits">{totalVitorias[iA]}V</span>}
          </div>
          <div className="pl-display">
            <span className="pl-num" style={placar[0] >= 2 ? { color: timeA.cor } : {}}>{placar[0]}</span>
            <span className="pl-x">×</span>
            <span className="pl-num" style={placar[1] >= 2 ? { color: timeB.cor } : {}}>{placar[1]}</span>
          </div>
          <div className="pl-time pl-time-right">
            <span className="pl-nome" style={{ color: timeB.cor }}>{timeB.nome}</span>
            {totalVitorias[iB] > 0 && <span className="pl-vits">{totalVitorias[iB]}V</span>}
          </div>
        </div>

        <div className="times-jogando">
          {renderTime(timeA, 0)}
          {renderTime(timeB, 1)}
        </div>

        <div className="action-btns">
          <button className="btn-vitoria" style={{ '--vcor': timeA.cor }} onClick={() => encerrar(0)}>
            ← {timeA.nome}
          </button>
          <button className="btn-empate" onClick={() => encerrar(null)}>EMPATE</button>
          <button className="btn-vitoria" style={{ '--vcor': timeB.cor }} onClick={() => encerrar(1)}>
            {timeB.nome} →
          </button>
        </div>
      </div>
    )
  }

  // ─── TELA: Início ──────────────────────────────────────────────────────────
  return (
    <div className="partida-page">
      <div className="step-header">
        <h2 className="step-title">Nova Pelada</h2>
        <span className="step-count">Selecione 2 times para começar</span>
      </div>

      <div className="inicio-grid">
        {times.map((time, idx) => {
          const sel = iniciando.includes(idx)
          return (
            <div
              key={idx}
              className={`inicio-card${sel ? ' selecionado' : ''}`}
              style={{ borderColor: sel ? time.cor : undefined }}
              onClick={() => setIniciando(prev =>
                prev.includes(idx) ? prev.filter(i => i !== idx) : prev.length < 2 ? [...prev, idx] : prev
              )}
            >
              <div className="inicio-card-header">
                <h3 className="inicio-time-nome" style={{ color: time.cor }}>{time.nome}</h3>
                {totalVitorias[idx] > 0 && (
                  <span className="inicio-vits" style={{ color: time.cor }}>{totalVitorias[idx]}V</span>
                )}
              </div>
              <div className="inicio-players">
                {time.jogadores.map(j => <span key={j.id} className="inicio-player">{j.nome}</span>)}
              </div>
            </div>
          )
        })}
      </div>

      <button className="btn-sortear" disabled={iniciando.length !== 2} onClick={iniciar}>
        INICIAR CONFRONTO
      </button>

      <button className="btn-reset" onClick={resetar}>
        Refazer Sorteio
      </button>
    </div>
  )
}
