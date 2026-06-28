import { useState, useEffect } from 'react'
import './Sorteio.css'
import { API } from '../api.js'

const TIME_CORES = ['#00e676', '#ff4444', '#2979ff', '#ffd600']

const NOMES_ZUADOS = [
  'Barselombra FC', 'Manchester Sítio', 'Tottenhamburger', 'Inter de Milanesa',
  'Patético de Madrid', 'Lyão de Mentira', 'Fenerbaquê', 'Botafofo',
  'Atleticomido MG', 'América do Nunca', 'Zagueiro Burro FC', 'Universidad del Crack',
  'Real Vardrid', 'Flamerda', 'Meia Boca Juniors', 'Pathético Paranaense',
  'Jahia', 'Prantos', 'Merdavaí Futebosta Estrume', 'FlorminenC', 'Epstein FC',
]

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
    fetch(`${API}/jogadores`)
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
          const res = await fetch(`${API}/jogadores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

    const byFP = (a, b) => (b.firepower ?? 60) - (a.firepower ?? 60)

    const nomesZuados = sortearNomes()
    const newTimes = Array.from({ length: 4 }, (_, i) => ({
      id: i, nome: nomesZuados[i], cor: TIME_CORES[i], jogadores: []
    }))

    // Snake draft contínuo — primeiro 1 de cada posição, depois os restantes
    let snakeIdx = 0
    const usados = new Set()

    function nextIdx() {
      const round = Math.floor(snakeIdx / 4)
      const pos   = snakeIdx % 4
      snakeIdx++
      return round % 2 === 0 ? pos : 3 - pos
    }

    for (const pos of ['ATA', 'DEF', 'MEI']) {
      const grupo = linha.filter(j => j.posicao === pos).sort(byFP)
      grupo.slice(0, 4).forEach(j => {
        newTimes[nextIdx()].jogadores.push(j)
        usados.add(j.id)
      })
    }

    // Restantes de qualquer posição
    linha.filter(j => !usados.has(j.id)).sort(byFP).forEach(j => {
      newTimes[nextIdx()].jogadores.push(j)
    })

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
                  {time.nome} ✎
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
