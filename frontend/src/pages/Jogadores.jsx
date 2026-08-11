import { useState, useEffect, useCallback } from 'react'
import './Jogadores.css'
import { apiFetch } from '../api.js'
import { enqueue, flushQueue, getQueueLength } from '../sync.js'

const JOGADORES_CACHE = 'inis_jogadores_cache'

function updateCache(updater) {
  try {
    const cached = JSON.parse(localStorage.getItem(JOGADORES_CACHE) || '[]')
    localStorage.setItem(JOGADORES_CACHE, JSON.stringify(updater(cached)))
  } catch { /* ignore */ }
}

const POSICOES = ['GOL', 'ATA', 'MEI', 'DEF']

function calcNota(j) {
  const { partidas, gols, assistencias, falhas, desarmes, dribles, faltas, amarelos, vermelhos } = j.stats
  if (partidas === 0) return 6
  const delta = (
    gols * 2 +
    assistencias * 1 +
    (['DEF', 'MEI'].includes(j.posicao) ? (desarmes || 0) * 0.5 : 0) +
    (['ATA', 'MEI'].includes(j.posicao) ? (dribles  || 0) * 0.3 : 0) -
    (falhas  || 0) * 0.3 -
    (faltas  || 0) * 0.5 -
    (amarelos || 0) * 1 -
    (vermelhos || 0) * 2
  ) / partidas
  return Math.min(10, Math.max(0, Math.round((6 + delta) * 10) / 10))
}

function getLabel(fp) {
  if (fp >= 90) return { text: 'CRAQUE',  cls: 'craque' }
  if (fp >= 70) return { text: 'BOM',     cls: 'bom' }
  if (fp >= 60) return { text: 'MEDIANO', cls: 'medio' }
  if (fp >= 55) return { text: 'BAGRE',   cls: 'bagre' }
  return { text: 'INIMIGO', cls: 'inimigo' }
}

function dataHoje() {
  return new Date().toISOString().split('T')[0]
}

function parseLoteNomes(texto) {
  const result = []
  texto.split('\n').forEach(linha => {
    const ehGoleiro = linha.includes('🧤')
    const match = linha.match(/^\s*\d+[🧤\s]*[-–]\s*(.+)$/)
    if (match) {
      const nome = match[1].trim()
      if (nome) result.push({ nome, posicao: ehGoleiro ? 'GOL' : 'ATA' })
    }
  })
  return result
}

export default function Jogadores() {
  const [jogadores, setJogadores]       = useState([])
  const [nome, setNome]                 = useState('')
  const [posicao, setPosicao]           = useState('ATA')
  const [busca, setBusca]               = useState('')
  const [editando, setEditando]         = useState(null)
  const [carregando, setCarregando]     = useState(true)
  const [erro, setErro]                 = useState(null)
  const [mostrarLote, setMostrarLote]   = useState(false)
  const [textoLote, setTextoLote]       = useState('')
  const [importandoLote, setImportandoLote] = useState(false)
  const [resultadoLote, setResultadoLote]   = useState(null)

  const [syncPendente, setSyncPendente] = useState(() => getQueueLength() > 0)

  const [view, setView]                   = useState('geral')
  const [rankDia, setRankDia]             = useState([])
  const [carregandoDia, setCarregandoDia] = useState(false)
  const [encerrando, setEncerrando]       = useState(false)
  const [encerradoInfo, setEncerradoInfo] = useState(null)

  useEffect(() => {
    apiFetch('/jogadores')
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json()
      })
      .then(data => {
        const arr = Array.isArray(data) ? data : []
        setJogadores(arr)
        localStorage.setItem(JOGADORES_CACHE, JSON.stringify(arr))
      })
      .catch(() => {
        const cached = localStorage.getItem(JOGADORES_CACHE)
        if (cached) {
          try { setJogadores(JSON.parse(cached)) } catch { /* ignore */ }
          setErro('Offline — exibindo dados salvos')
        } else {
          setErro('Sem conexão com o servidor')
        }
      })
      .finally(() => setCarregando(false))

    async function handleOnline() {
      const remaining = await flushQueue()
      setSyncPendente(remaining > 0)
      if (remaining === 0) {
        apiFetch('/jogadores').then(r => r.json()).then(data => {
          setJogadores(Array.isArray(data) ? data : [])
          localStorage.setItem(JOGADORES_CACHE, JSON.stringify(Array.isArray(data) ? data : []))
        }).catch(() => {})
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const carregarRankDia = useCallback(() => {
    setCarregandoDia(true)
    setEncerradoInfo(null)
    apiFetch(`/dia/${dataHoje()}`)
      .then(res => res.json())
      .then(data => setRankDia(Array.isArray(data) ? data : []))
      .catch(() => setErro('Erro ao carregar ranking do dia.'))
      .finally(() => setCarregandoDia(false))
  }, [])

  function mudarView(v) {
    setView(v)
    if (v === 'dia') carregarRankDia()
    else setEncerradoInfo(null)
  }

  async function encerrarDia() {
    if (!confirm(`Encerrar o dia ${dataHoje()} e atualizar o Firepower de todos?`)) return
    setEncerrando(true)
    try {
      const res = await apiFetch(`/dia/${dataHoje()}/encerrar`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) return setErro(json.error || 'Erro ao encerrar o dia.')
      setEncerradoInfo(json)
      const novo = await apiFetch('/jogadores').then(r => r.json())
      setJogadores(novo)
      carregarRankDia()
    } catch {
      setErro('Erro ao encerrar o dia.')
    } finally {
      setEncerrando(false)
    }
  }

  async function importarLote() {
    const parsed = parseLoteNomes(textoLote)
    if (parsed.length === 0) return

    setImportandoLote(true)
    setResultadoLote(null)

    const normNome = s => s.toLowerCase().trim()
    const existentes = new Set(jogadores.map(j => normNome(j.nome)))

    const novos = parsed.filter(p => !existentes.has(normNome(p.nome)))
    const duplicados = parsed.length - novos.length

    let criados = 0
    const novaLista = [...jogadores]

    for (const p of novos) {
      try {
        const res = await apiFetch('/jogadores', {
          method: 'POST',
          body: JSON.stringify({ nome: p.nome, posicao: p.posicao })
        })
        const novo = await res.json()
        novaLista.push(novo)
        criados++
      } catch { /* ignora erros individuais */ }
    }

    setJogadores(novaLista)
    setResultadoLote({ criados, duplicados, total: parsed.length })
    setTextoLote('')
    setImportandoLote(false)
  }

  async function addJogador() {
    if (!nome.trim()) return
    try {
      const res = await apiFetch('/jogadores', {
        method: 'POST',
        body: JSON.stringify({ nome: nome.trim(), posicao })
      })
      if (!res.ok) throw new Error()
      const novo = await res.json()
      setJogadores(prev => {
        const next = [...prev, novo]
        updateCache(() => next)
        return next
      })
      setNome('')
    } catch {
      setErro('Sem conexão — adicione jogadores quando estiver online.')
    }
  }

  async function removeJogador(id) {
    // Optimistic remove
    setJogadores(prev => prev.filter(j => j.id !== id))
    updateCache(cached => cached.filter(j => j.id !== id))
    try {
      await apiFetch(`/jogadores/${id}`, { method: 'DELETE' })
    } catch {
      enqueue({ type: 'jogador_delete', id })
      setSyncPendente(true)
    }
  }

  async function salvarEdicao() {
    const { id, nome, posicao, firepower } = editando
    // Optimistic update
    setJogadores(prev => prev.map(j =>
      j.id === id ? { ...j, nome, posicao, firepower } : j
    ))
    updateCache(cached => cached.map(j =>
      j.id === id ? { ...j, nome, posicao, firepower } : j
    ))
    setEditando(null)
    try {
      const res = await apiFetch(`/jogadores/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ nome, posicao, firepower })
      })
      if (!res.ok) throw new Error()
    } catch {
      enqueue({ type: 'jogador_update', id, data: { nome, posicao, firepower } })
      setSyncPendente(true)
    }
  }

  const rankingGeral = [...jogadores]
    .sort((a, b) => (b.firepower ?? 60) - (a.firepower ?? 60))
    .filter(j => j.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="jogadores-page">
      {syncPendente && (
        <div className="sync-banner">⏳ Alterações pendentes — serão sincronizadas ao voltar a internet</div>
      )}
      {erro && (
        <div className="erro-banner">
          <span>{erro}</span>
          <button onClick={() => setErro(null)}>✕</button>
        </div>
      )}

      <div className="form-card">
        <div className="form-card-header">
          <h2 className="section-title">Novo Jogador</h2>
          <button
            className="btn-lote-toggle"
            onClick={() => { setMostrarLote(p => !p); setResultadoLote(null) }}
          >
            {mostrarLote ? '✕ Fechar' : '📋 Importar lista'}
          </button>
        </div>

        {mostrarLote ? (
          <div className="lote-body">
            <textarea
              className="inp lote-textarea"
              value={textoLote}
              onChange={e => setTextoLote(e.target.value)}
              placeholder={'Cole a lista de presença aqui...\n\n01 - João\n02 - Pedro\n21🧤 - Carlos\n\nGoleiros (🧤) são importados como GOL.\nO restante é importado como ATA — edite depois se precisar.'}
              rows={9}
            />
            {resultadoLote && (
              <div className="lote-resultado">
                <span className="lote-ok">✓ {resultadoLote.criados} criado{resultadoLote.criados !== 1 ? 's' : ''}</span>
                {resultadoLote.duplicados > 0 && (
                  <span className="lote-dup">{resultadoLote.duplicados} já existia{resultadoLote.duplicados !== 1 ? 'm' : ''}</span>
                )}
              </div>
            )}
            <button
              className="btn-add"
              onClick={importarLote}
              disabled={importandoLote || !textoLote.trim()}
            >
              {importandoLote ? 'IMPORTANDO...' : 'IMPORTAR TUDO'}
            </button>
          </div>
        ) : (
          <div className="form-row">
            <input
              className="inp inp-nome"
              value={nome}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addJogador()}
              placeholder="Nome do jogador"
            />
            <select
              className="inp sel-pos"
              value={posicao}
              onChange={e => setPosicao(e.target.value)}
            >
              {POSICOES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button className="btn-add" onClick={addJogador}>+ ADD</button>
          </div>
        )}
      </div>

      <div className="view-toggle">
        <button
          className={`toggle-tab${view === 'geral' ? ' active' : ''}`}
          onClick={() => mudarView('geral')}
        >⚡ FIREPOWER</button>
        <button
          className={`toggle-tab${view === 'dia' ? ' active' : ''}`}
          onClick={() => mudarView('dia')}
        >📋 HOJE</button>
      </div>

      {view === 'geral' && (
        <>
          <div className="search-row">
            <input
              className="inp inp-busca"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar jogador..."
            />
            <span className="contagem">
              {jogadores.length} jogador{jogadores.length !== 1 ? 'es' : ''}
            </span>
          </div>

          <div className="ranking-list">
            {carregando ? (
              <div className="empty-state">Carregando...</div>
            ) : rankingGeral.length === 0 ? (
              <div className="empty-state">
                {busca ? 'Nenhum jogador encontrado.' : 'Cadastre o primeiro jogador acima.'}
              </div>
            ) : (
              rankingGeral.map((j, idx) => {
                const label = getLabel(j.firepower ?? 60)
                return (
                  <div key={j.id} className="player-card">
                    <span className="rank">#{idx + 1}</span>
                    <div className="player-main">
                      <div className="player-top">
                        <span className="player-nome">{j.nome}</span>
                        <span className={`pos-badge pos-${j.posicao.toLowerCase()}`}>{j.posicao}</span>
                      </div>
                      <div className="player-stats">
                        <span><strong>{j.stats.partidas}</strong> partidas</span>
                        <span><strong>{j.stats.gols}</strong> gols</span>
                        <span><strong>{j.stats.assistencias}</strong> assists</span>
                      </div>
                    </div>
                    <div className="player-fp">
                      <span className="fp-icon">⚡</span>
                      <span className="fp-num">{j.firepower ?? 60}</span>
                    </div>
                    <div className="player-score">
                      <span className={`label-badge label-${label.cls}`}>{label.text}</span>
                    </div>
                    <div className="player-actions">
                      <button className="btn-icon btn-edit" onClick={() => setEditando({ ...j })} title="Editar">✏</button>
                      <button className="btn-icon btn-del" onClick={() => removeJogador(j.id)} title="Remover">✕</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {view === 'dia' && (
        <div className="dia-section">
          <div className="dia-header">
            <span className="dia-data">{dataHoje()}</span>
            <button
              className="btn-encerrar-dia"
              onClick={encerrarDia}
              disabled={encerrando || rankDia.length === 0}
            >
              {encerrando ? 'ATUALIZANDO...' : '⚡ ENCERRAR DIA'}
            </button>
          </div>

          {encerradoInfo && (
            <div className="encerrado-banner">
              <span>Firepower atualizado para {encerradoInfo.jogadores.length} jogadores</span>
            </div>
          )}

          {carregandoDia ? (
            <div className="empty-state">Carregando...</div>
          ) : rankDia.length === 0 ? (
            <div className="empty-state">Nenhuma partida registrada hoje.</div>
          ) : (
            <div className="ranking-list">
              {rankDia.map((p, idx) => {
                const label = getLabel(p.firepower ?? 60)
                const delta = encerradoInfo?.jogadores.find(j => j.id === p.id)?.delta
                return (
                  <div key={p.id} className="player-card">
                    <span className="rank">#{idx + 1}</span>
                    <div className="player-main">
                      <div className="player-top">
                        <span className="player-nome">{p.nome}</span>
                        <span className={`pos-badge pos-${p.posicao.toLowerCase()}`}>{p.posicao}</span>
                      </div>
                      <div className="player-stats">
                        <span><strong>{p.partidas}</strong> jogos</span>
                        <span><strong>{p.gols}</strong> gols</span>
                        <span><strong>{p.assistencias}</strong> assists</span>
                      </div>
                    </div>
                    <div className="player-fp">
                      <span className="fp-icon">⚡</span>
                      <span className="fp-num">{p.firepower ?? 60}</span>
                      {delta !== undefined && (
                        <span className={`fp-delta${delta >= 0 ? ' pos' : ' neg'}`}>
                          {delta >= 0 ? '+' : ''}{delta}
                        </span>
                      )}
                    </div>
                    <div className="player-score">
                      <span className="nota-num">{p.nota.toFixed(1)}</span>
                      <span className={`label-badge label-${label.cls}`}>{label.text}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Editar Jogador</h3>
            <input
              className="inp"
              value={editando.nome}
              onChange={e => setEditando(p => ({ ...p, nome: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && salvarEdicao()}
              placeholder="Nome"
            />
            <select
              className="inp"
              value={editando.posicao}
              onChange={e => setEditando(p => ({ ...p, posicao: e.target.value }))}
            >
              {POSICOES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="fp-edit-row">
              <label className="fp-edit-label">⚡ Firepower</label>
              <input
                className="inp fp-edit-inp"
                type="number"
                min="0"
                max="100"
                value={editando.firepower ?? 60}
                onChange={e => {
                  const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                  setEditando(p => ({ ...p, firepower: v }))
                }}
              />
              <span className="fp-edit-range">0 – 100</span>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditando(null)}>CANCELAR</button>
              <button className="btn-primary" onClick={salvarEdicao}>SALVAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
