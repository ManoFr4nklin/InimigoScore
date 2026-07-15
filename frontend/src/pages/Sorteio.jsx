import { useState, useEffect } from 'react'
import { apiFetch } from '../api.js'
import './Sorteio.css'

const TIME_CORES = ['#00e676', '#ff4444', '#2979ff', '#ffd600']

const NOMES_ZUADOS = [
  'Barselombra FC', 'Manchester Sítio', 'Tottenhamburger', 'Inter de Milanesa',
  'Patético de Madrid', 'Lyão de Mentira', 'Fenerbaquê', 'Botafofo',
  'Atleticomido MG', 'América do Nunca', 'Zagueiro Burro FC', 'Universidad del Crack',
  'Real Vardrid', 'Flamerda', 'Meia Boca Juniors', 'Pathético Paranaense',
  'Jahia', 'Prantos', 'Merdavaí Futebosta Estrume', 'FlorminenC', 'Epstein FC',
]

function calcOverall(jogadores) {
  if (!jogadores.length) return '–'
  return Math.round(jogadores.reduce((s, j) => s + (j.firepower ?? 60), 0) / jogadores.length)
}

function sortearNomes() {
  return [...NOMES_ZUADOS].sort(() => Math.random() - 0.5).slice(0, 4)
}

function parseLista(texto) {
  const resultado = []
  texto.split('\n').forEach(linha => {
    const ehGoleiro = linha.includes('🧤')
    const match = linha.match(/^\s*\d+[🧤\s]*[-–]\s*(.+)$/)
    if (match) {
      const nome = match[1].trim()
      if (nome) resultado.push({ nome, goleiro: ehGoleiro })
    }
  })
  return resultado
}

function matchNome(nomeLista, nomeJogador) {
  const norm = s => s.toLowerCase().trim()
  const a = norm(nomeLista)
  const b = norm(nomeJogador)
  return a === b || b.includes(a) || a.includes(b)
}

export default function Sorteio({ setTimes, setGoleiros, setPage }) {
  const [jogadores, setJogadores]     = useState([])
  const [presentes, setPresentes]     = useState([])
  const [timesLocal, setTimesLocal]   = useState(null)
  const [goleirosList, setGoleirosList] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [step, setStep]               = useState('selecao')
  const [bench, setBench]             = useState(null) // null=auto, array=manual
  const [editingTimeIdx, setEditingTimeIdx] = useState(null)
  const [editingNome, setEditingNome] = useState('')
  const [listaTexto, setListaTexto]   = useState('')
  const [mostrarImport, setMostrarImport] = useState(false)
  const [importInfo, setImportInfo]   = useState(null)
  const [importando, setImportando]   = useState(false)

  useEffect(() => {
    apiFetch('/jogadores')
      .then(res => res.json())
      .then(setJogadores)
      .catch(() => setJogadores([]))
  }, [])

  const goleirosPresentes = jogadores.filter(j => presentes.includes(j.id) && j.posicao === 'GOL').length
  const linhaPresentes    = presentes.length - goleirosPresentes
  const podeSortear       = linhaPresentes >= 4

  function togglePresente(id) {
    setPresentes(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  async function importarLista() {
    const nomes = parseLista(listaTexto)
    if (nomes.length === 0) return

    setImportando(true)
    let listaAtual = [...jogadores]
    const encontradosSet = new Set()
    const criados = []

    for (const { nome, goleiro } of nomes) {
      const encontrado = listaAtual.find(j => matchNome(nome, j.nome))
      if (encontrado) {
        encontradosSet.add(encontrado.id)
      } else {
        try {
          const res = await apiFetch('/jogadores', {
            method: 'POST',
            body: JSON.stringify({ nome, posicao: goleiro ? 'GOL' : 'ATA' })
          })
          const novo = await res.json()
          listaAtual.push(novo)
          encontradosSet.add(novo.id)
          criados.push(nome)
        } catch { /* ignora falha individual */ }
      }
    }

    setJogadores(listaAtual)
    setPresentes([...encontradosSet])
    setImportInfo({ total: nomes.length, encontrados: encontradosSet.size, criados })
    setMostrarImport(false)
    setImportando(false)
  }

  function sortear() {
    const jogs  = jogadores.filter(j => presentes.includes(j.id))
    const gols  = jogs.filter(j => j.posicao === 'GOL')
    const linha = jogs.filter(j => j.posicao !== 'GOL')

    const nomesZuados = sortearNomes()
    const newTimes = Array.from({ length: 4 }, (_, i) => ({
      id: i, nome: nomesZuados[i], cor: TIME_CORES[i], jogadores: []
    }))

    const fp = j => j.firepower ?? 60
    const byFP = (a, b) => fp(b) - fp(a)
    const totais = [0, 0, 0, 0]
    const usados = new Set()

    // Fase 1 — seed 1 jogador de cada posição por time (greedy dentro de cada posição)
    for (const pos of ['ATA', 'DEF', 'MEI']) {
      const grupo = linha.filter(j => j.posicao === pos).sort(byFP)
      grupo.slice(0, 4).forEach(j => {
        const idx = totais.indexOf(Math.min(...totais))
        newTimes[idx].jogadores.push(j)
        totais[idx] += fp(j)
        usados.add(j.id)
      })
    }

    // Fase 2 — restantes (excesso de posição ou posições extra), greedy
    linha.filter(j => !usados.has(j.id)).sort(byFP).forEach(j => {
      const idx = totais.indexOf(Math.min(...totais))
      newTimes[idx].jogadores.push(j)
      totais[idx] += fp(j)
    })

    // Fase 3 — ajuste de gap: tenta trocas para manter diferença de overall ≤ 5
    const GAP_MAX = 5
    const ovr = t => t.jogadores.length
      ? t.jogadores.reduce((s, j) => s + fp(j), 0) / t.jogadores.length
      : 0

    let improved = true
    while (improved) {
      improved = false
      const ovrs = newTimes.map(ovr)
      const maxOvr = Math.max(...ovrs)
      const minOvr = Math.min(...ovrs)
      if (maxOvr - minOvr <= GAP_MAX) break

      const mi = ovrs.indexOf(maxOvr) // time mais forte
      const ni = ovrs.indexOf(minOvr) // time mais fraco

      let bestGain = 0, bestSwap = null
      for (const a of newTimes[mi].jogadores) {
        for (const b of newTimes[ni].jogadores) {
          if (fp(a) === fp(b)) continue
          // Respeitar posição: não remove o único jogador de uma posição
          // a menos que o que entra seja da mesma posição
          const aUnico = newTimes[mi].jogadores.filter(j => j.posicao === a.posicao).length === 1
          const bUnico = newTimes[ni].jogadores.filter(j => j.posicao === b.posicao).length === 1
          if (aUnico && a.posicao !== b.posicao) continue
          if (bUnico && a.posicao !== b.posicao) continue

          const newMaxOvr = (totais[mi] - fp(a) + fp(b)) / newTimes[mi].jogadores.length
          const newMinOvr = (totais[ni] - fp(b) + fp(a)) / newTimes[ni].jogadores.length
          const newGap = Math.max(newMaxOvr, newMinOvr) - Math.min(newMaxOvr, newMinOvr)
          const gain = (maxOvr - minOvr) - newGap
          if (gain > bestGain) { bestGain = gain; bestSwap = { a, b, mi, ni } }
        }
      }

      if (bestSwap) {
        const { a, b, mi: mIdx, ni: nIdx } = bestSwap
        newTimes[mIdx].jogadores = newTimes[mIdx].jogadores.map(j => j.id === a.id ? b : j)
        newTimes[nIdx].jogadores = newTimes[nIdx].jogadores.map(j => j.id === b.id ? a : j)
        totais[mIdx] = totais[mIdx] - fp(a) + fp(b)
        totais[nIdx] = totais[nIdx] - fp(b) + fp(a)
        improved = true
      }
    }

    setGoleirosList(gols)
    setBench(null)
    setTimesLocal(newTimes)
    setSelecionado(null)
    setStep('times')
  }

  function sortearManual() {
    const jogs  = jogadores.filter(j => presentes.includes(j.id))
    const gols  = jogs.filter(j => j.posicao === 'GOL')
    const linha = jogs.filter(j => j.posicao !== 'GOL')
    const nomesZuados = sortearNomes()
    const newTimes = Array.from({ length: 4 }, (_, i) => ({
      id: i, nome: nomesZuados[i], cor: TIME_CORES[i], jogadores: []
    }))
    setGoleirosList(gols)
    setBench(linha)
    setTimesLocal(newTimes)
    setSelecionado(null)
    setStep('times')
  }

  function handleClickPlayer(jogador, timeIdx, e) {
    e.stopPropagation()
    // timeIdx: 0-3 = time, -1 = banco
    if (!selecionado) {
      setSelecionado({ jogador, timeIdx })
      return
    }
    if (selecionado.jogador.id === jogador.id) {
      setSelecionado(null)
      return
    }

    const fromIdx = selecionado.timeIdx
    const toIdx   = timeIdx
    const fromJog = selecionado.jogador
    const toJog   = jogador

    if (bench === null) {
      // Modo automático: troca por índice preservando posição
      setTimesLocal(prev => {
        const next = prev.map(t => ({ ...t, jogadores: [...t.jogadores] }))
        const fi = next[fromIdx].jogadores.findIndex(j => j.id === fromJog.id)
        const ti = next[toIdx].jogadores.findIndex(j => j.id === toJog.id)
        if (fi === -1 || ti === -1) return prev
        const tmp = next[fromIdx].jogadores[fi]
        next[fromIdx].jogadores[fi] = next[toIdx].jogadores[ti]
        next[toIdx].jogadores[ti] = tmp
        return next
      })
    } else {
      // Modo manual: swap entre qualquer origem/destino incluindo banco
      const newTimes = timesLocal.map(t => ({ ...t, jogadores: [...t.jogadores] }))
      let newBench   = [...bench]

      if (fromIdx === -1) newBench = newBench.filter(j => j.id !== fromJog.id)
      else newTimes[fromIdx].jogadores = newTimes[fromIdx].jogadores.filter(j => j.id !== fromJog.id)

      if (toIdx === -1) newBench = newBench.filter(j => j.id !== toJog.id)
      else newTimes[toIdx].jogadores = newTimes[toIdx].jogadores.filter(j => j.id !== toJog.id)

      if (toIdx === -1) newBench.push(fromJog); else newTimes[toIdx].jogadores.push(fromJog)
      if (fromIdx === -1) newBench.push(toJog); else newTimes[fromIdx].jogadores.push(toJog)

      setTimesLocal(newTimes)
      setBench(newBench)
    }

    setSelecionado(null)
  }

  function handleClickTime(timeIdx) {
    if (!selecionado) return
    if (selecionado.timeIdx === timeIdx) { setSelecionado(null); return }

    const fromIdx = selecionado.timeIdx
    const fromJog = selecionado.jogador
    const newTimes = timesLocal.map(t => ({ ...t, jogadores: [...t.jogadores] }))
    let newBench = bench !== null ? [...bench] : null

    if (fromIdx === -1) newBench = newBench.filter(j => j.id !== fromJog.id)
    else newTimes[fromIdx].jogadores = newTimes[fromIdx].jogadores.filter(j => j.id !== fromJog.id)

    newTimes[timeIdx].jogadores.push(fromJog)

    setTimesLocal(newTimes)
    if (newBench !== null) setBench(newBench)
    setSelecionado(null)
  }

  function handleClickBench() {
    if (!selecionado || selecionado.timeIdx === -1) { setSelecionado(null); return }

    const fromIdx = selecionado.timeIdx
    const fromJog = selecionado.jogador
    const newTimes = timesLocal.map(t => ({ ...t, jogadores: [...t.jogadores] }))
    const newBench = [...bench]

    newTimes[fromIdx].jogadores = newTimes[fromIdx].jogadores.filter(j => j.id !== fromJog.id)
    newBench.push(fromJog)

    setTimesLocal(newTimes)
    setBench(newBench)
    setSelecionado(null)
  }

  function confirmar() {
    setTimes(timesLocal)
    setGoleiros(goleirosList)
    apiFetch('/sorteio', {
      method: 'POST',
      body: JSON.stringify({ times: timesLocal, goleiros: goleirosList })
    }).catch(() => {})
    setPage('partida')
  }

  // ─── Step: times ──────────────────────────────────────────────────────────
  if (step === 'times' && timesLocal) {
    return (
      <div className="sorteio-page">
        <div className="step-header">
          <button className="btn-back" onClick={() => { setStep('selecao'); setSelecionado(null); setBench(null) }}>← VOLTAR</button>
          <h2 className="step-title">Times</h2>
          {selecionado
            ? <span className="step-count movendo">↔ {selecionado.jogador.nome}</span>
            : <span className="step-count">clique para trocar</span>
          }
        </div>

        {goleirosList.length > 0 && (
          <div className="goleiros-aviso">
            🥅 {goleirosList.map(g => g.nome).join(', ')} — goleiro{goleirosList.length !== 1 ? 's' : ''} escolhido{goleirosList.length !== 1 ? 's' : ''} antes de cada confronto
          </div>
        )}

        <div className="times-grid">
          {timesLocal.map((time, timeIdx) => (
            <div
              key={time.id}
              className={`time-card${selecionado && selecionado.timeIdx !== timeIdx ? ' pode-receber' : ''}`}
              style={{ '--cor': time.cor }}
              onClick={() => handleClickTime(timeIdx)}
            >
              {editingTimeIdx === timeIdx ? (
                <input
                  className="time-title-input"
                  style={{ color: time.cor, borderColor: time.cor }}
                  value={editingNome}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  onChange={e => setEditingNome(e.target.value)}
                  onBlur={() => {
                    const nome = editingNome.trim() || time.nome
                    setTimesLocal(prev => prev.map((t, i) => i === timeIdx ? { ...t, nome } : t))
                    setEditingTimeIdx(null)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.target.blur()
                    if (e.key === 'Escape') { setEditingNome(time.nome); setEditingTimeIdx(null) }
                  }}
                />
              ) : (
                <h3
                  className="time-title"
                  style={{ color: time.cor }}
                  title="Clique para renomear"
                  onClick={e => { e.stopPropagation(); setEditingTimeIdx(timeIdx); setEditingNome(time.nome) }}
                >
                  {time.nome}
                  <span className="time-overall">{calcOverall(time.jogadores)}</span>
                  {' ✎'}
                </h3>
              )}
              {time.jogadores.map(j => (
                <div
                  key={j.id}
                  className={`time-player${selecionado?.jogador.id === j.id ? ' selecionado' : ''}`}
                  onClick={e => handleClickPlayer(j, timeIdx, e)}
                >
                  <span className={`pos-badge pos-${j.posicao.toLowerCase()}`}>{j.posicao}</span>
                  <span className="time-player-nome">{j.nome}</span>
                </div>
              ))}
              {time.jogadores.length === 0 && selecionado && selecionado.timeIdx !== timeIdx && (
                <span className="bench-empty">soltar aqui</span>
              )}
            </div>
          ))}
        </div>

        {bench !== null && (
          <div
            className={`bench-section${selecionado && selecionado.timeIdx !== -1 ? ' pode-receber' : ''}`}
            onClick={() => handleClickBench()}
          >
            <div className="grupo-label">
              BANCO {bench.length > 0 ? `(${bench.length} restante${bench.length !== 1 ? 's' : ''})` : '✓ todos distribuídos'}
            </div>
            <div className="bench-players">
              {bench.map(j => (
                <div
                  key={j.id}
                  className={`time-player${selecionado?.jogador.id === j.id ? ' selecionado' : ''}`}
                  onClick={e => handleClickPlayer(j, -1, e)}
                >
                  <span className={`pos-badge pos-${j.posicao.toLowerCase()}`}>{j.posicao}</span>
                  <span className="time-player-nome">{j.nome}</span>
                </div>
              ))}
              {bench.length === 0 && <span className="bench-empty">—</span>}
            </div>
          </div>
        )}

        <button
          className="btn-sortear"
          onClick={confirmar}
          disabled={bench !== null && bench.length > 0}
        >
          CONFIRMAR TIMES → PARTIDA
        </button>
      </div>
    )
  }

  // ─── Step: seleção ────────────────────────────────────────────────────────
  const grupos = [
    { label: 'Goleiros',   players: jogadores.filter(j => j.posicao === 'GOL') },
    { label: 'Atacantes',  players: jogadores.filter(j => j.posicao === 'ATA') },
    { label: 'Meias',      players: jogadores.filter(j => j.posicao === 'MEI') },
    { label: 'Defensores', players: jogadores.filter(j => j.posicao === 'DEF') },
  ]

  return (
    <div className="sorteio-page">
      <div className="step-header">
        <h2 className="step-title">Quem veio hoje?</h2>
        <span className="step-count">{presentes.length} presentes</span>
        <button
          className="btn-sel-todos"
          onClick={() => {
            if (presentes.length === jogadores.length) setPresentes([])
            else setPresentes(jogadores.map(j => j.id))
          }}
        >
          {presentes.length === jogadores.length ? 'DESMARCAR TODOS' : 'SELECIONAR TODOS'}
        </button>
      </div>

      <div className="import-section">
        <button
          className="btn-import-toggle"
          onClick={() => { setMostrarImport(p => !p); setImportInfo(null) }}
        >
          {mostrarImport ? '✕ Fechar' : '📋 Colar lista'}
        </button>

        {mostrarImport && (
          <div className="import-body">
            <textarea
              className="import-textarea"
              value={listaTexto}
              onChange={e => setListaTexto(e.target.value)}
              placeholder={'Cole a lista aqui...\n\nEx:\n01 - João\n02 - Pedro\n21🧤 - Carlos\n\nJogadores novos serão criados automaticamente.'}
              rows={8}
            />
            <button className="btn-importar" onClick={importarLista} disabled={importando}>
              {importando ? 'IMPORTANDO...' : 'IMPORTAR'}
            </button>
          </div>
        )}

        {importInfo && (
          <div className="import-info">
            <span className="import-ok">✓ {importInfo.encontrados} de {importInfo.total} marcados</span>
            {importInfo.criados.length > 0 && (
              <span className="import-new">
                +{importInfo.criados.length} criado{importInfo.criados.length !== 1 ? 's' : ''}: {importInfo.criados.join(', ')}
              </span>
            )}
          </div>
        )}
      </div>

      {presentes.length > 0 && (
        <div className="presenca-info">
          <span>🥅 {goleirosPresentes} goleiro{goleirosPresentes !== 1 ? 's' : ''}</span>
          <span className="sep">·</span>
          <span>⚽ {linhaPresentes} de linha</span>
        </div>
      )}

      {grupos.map(g => g.players.length > 0 && (
        <div key={g.label}>
          <div className="grupo-label">{g.label}</div>
          <div className="select-list">
            {g.players.map(j => {
              const sel = presentes.includes(j.id)
              return (
                <div
                  key={j.id}
                  className={`select-card${sel ? ' selected' : ''}`}
                  onClick={() => togglePresente(j.id)}
                >
                  <div className={`chk${sel ? ' chk-on' : ''}`}>{sel && '✓'}</div>
                  <span className="select-nome">{j.nome}</span>
                  <span className={`pos-badge pos-${j.posicao.toLowerCase()}`}>{j.posicao}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="sortear-btns">
        <button className="btn-sortear" disabled={!podeSortear} onClick={sortear}>
          SORTEAR AUTOMÁTICO
        </button>
        <button className="btn-sortear btn-manual" disabled={!podeSortear} onClick={sortearManual}>
          MONTAR MANUALMENTE
        </button>
      </div>

      {!podeSortear && presentes.length > 0 && (
        <p className="aviso-sortear">Mínimo: 4 jogadores de linha (ATA/MEI/DEF)</p>
      )}
    </div>
  )
}
