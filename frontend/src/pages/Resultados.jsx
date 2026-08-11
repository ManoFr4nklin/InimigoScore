import { useState, useEffect } from 'react'
import { apiFetch } from '../api.js'
import { QUEUE_KEY } from '../sync.js'
import './Resultados.css'

function dataHoje() {
  return new Date().toISOString().split('T')[0]
}

function getLabel(fp) {
  if (fp >= 90) return { text: 'CRAQUE',  cls: 'craque' }
  if (fp >= 70) return { text: 'BOM',     cls: 'bom' }
  if (fp >= 60) return { text: 'MEDIANO', cls: 'medio' }
  if (fp >= 55) return { text: 'BAGRE',   cls: 'bagre' }
  return { text: 'INIMIGO', cls: 'inimigo' }
}

// Reconstructs today's rankings from the offline sync queue + jogadores cache
function buildFromQueue(data) {
  try {
    const queue   = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    const players = JSON.parse(localStorage.getItem('inis_jogadores_cache') || '[]')
    const items   = queue.filter(item => (item.type ?? 'confronto') === 'confronto' && item.data === data)
    if (!items.length) return null

    const playerMap = {}
    players.forEach(p => { playerMap[p.id] = p })

    const confrontos = items.map(item => ({
      sequencia:   item.confronto.sequencia,
      placar_a:    item.confronto.placar_a,
      placar_b:    item.confronto.placar_b,
      resultado:   item.confronto.resultado,
      nome_time_a: item.confronto.nome_time_a,
      nome_time_b: item.confronto.nome_time_b,
      timeA: item.jogadores.filter(j => j.time === 'A').map(j => ({
        nome: playerMap[j.fk_jogador]?.nome ?? `#${j.fk_jogador}`,
        gols: j.gols, assistencias: j.assistencias, falhas: j.falhas,
        desarmes: j.desarmes, faltas: j.faltas, amarelos: j.amarelos,
        vermelhos: j.vermelhos
      })),
      timeB: item.jogadores.filter(j => j.time === 'B').map(j => ({
        nome: playerMap[j.fk_jogador]?.nome ?? `#${j.fk_jogador}`,
        gols: j.gols, assistencias: j.assistencias, falhas: j.falhas,
        desarmes: j.desarmes, faltas: j.faltas, amarelos: j.amarelos,
        vermelhos: j.vermelhos
      })),
    }))

    const statsMap = {}
    items.forEach(item => {
      item.jogadores.forEach(j => {
        if (!statsMap[j.fk_jogador]) {
          statsMap[j.fk_jogador] = { gols: 0, assistencias: 0, falhas: 0, desarmes: 0, dribles: 0, faltas: 0, amarelos: 0, vermelhos: 0, partidas: 0 }
        }
        const s = statsMap[j.fk_jogador]
        s.gols         += j.gols         || 0
        s.assistencias += j.assistencias || 0
        s.falhas       += j.falhas       || 0
        s.desarmes     += j.desarmes     || 0
        s.dribles      += j.dribles      || 0
        s.faltas       += j.faltas       || 0
        s.amarelos     += j.amarelos     || 0
        s.vermelhos    += j.vermelhos    || 0
        s.partidas     += 1
      })
    })

    const ranking = Object.entries(statsMap).map(([idStr, s]) => {
      const id = parseInt(idStr)
      const p  = playerMap[id]
      const { gols, assistencias, falhas, desarmes, faltas, amarelos, vermelhos, partidas } = s
      const pos = p?.posicao
      const notaBruta = 6 + (
        gols * 2 + assistencias +
        desarmes * (pos === 'DEF' ? 0.5 : pos === 'MEI' ? 0.4 : pos === 'ATA' ? 0.3 : 0) +
        (s.dribles || 0) * (pos === 'DEF' ? 0.3 : pos === 'MEI' ? 0.5 : pos === 'ATA' ? 0.5 : 0) -
        falhas * 0.3 - faltas * 0.5 - amarelos - vermelhos * 2
      ) / partidas
      return {
        id,
        nome:      p?.nome     ?? `#${id}`,
        posicao:   p?.posicao  ?? 'ATA',
        firepower: p?.firepower ?? 60,
        gols, assistencias, partidas,
        nota: parseFloat(Math.min(10, Math.max(0, notaBruta)).toFixed(1))
      }
    }).sort((a, b) => b.nota - a.nota)

    const timesMap = {}
    confrontos.forEach(c => {
      const add = (nome, gPro, gCon, res) => {
        if (!timesMap[nome]) timesMap[nome] = { nome_time: nome, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, gols_pro: 0, gols_contra: 0 }
        timesMap[nome].jogos      += 1
        timesMap[nome].gols_pro   += gPro
        timesMap[nome].gols_contra += gCon
        if (res === 'EMPATE') timesMap[nome].empates++
        else if (res === 'win') timesMap[nome].vitorias++
        else timesMap[nome].derrotas++
      }
      add(c.nome_time_a, c.placar_a, c.placar_b, c.resultado === 'A' ? 'win' : c.resultado === 'EMPATE' ? 'EMPATE' : 'loss')
      add(c.nome_time_b, c.placar_b, c.placar_a, c.resultado === 'B' ? 'win' : c.resultado === 'EMPATE' ? 'EMPATE' : 'loss')
    })

    const rankTimes = Object.values(timesMap)
      .map(t => ({ ...t, saldo_gols: t.gols_pro - t.gols_contra }))
      .sort((a, b) => b.vitorias - a.vitorias || b.saldo_gols - a.saldo_gols)

    return { ranking, confrontos, rankTimes }
  } catch {
    return null
  }
}

export default function Resultados() {
  const [ranking,     setRanking]     = useState([])
  const [confrontos,  setConfrontos]  = useState([])
  const [rankTimes,   setRankTimes]   = useState([])
  const [carregando,  setCarregando]  = useState(true)
  const [erro,        setErro]        = useState(null)
  const [offlineMode, setOfflineMode] = useState(null) // null | 'cache' | 'queue'
  const data = dataHoje()
  const CACHE_KEY = `inis_resultados_${data}`

  useEffect(() => {
    setCarregando(true)
    setOfflineMode(null)
    Promise.all([
      apiFetch(`/dia/${data}`).then(r => r.json()),
      apiFetch(`/dia/${data}/confrontos`).then(r => r.json()),
      apiFetch(`/dia/${data}/times`).then(r => r.json())
    ])
      .then(([rank, confs, times]) => {
        const ranking    = Array.isArray(rank)  ? rank  : []
        const confrontos = Array.isArray(confs) ? confs : []
        const rankTimes  = Array.isArray(times) ? times : []
        setRanking(ranking); setConfrontos(confrontos); setRankTimes(rankTimes)
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ranking, confrontos, rankTimes }))
      })
      .catch(() => {
        // 1. Try cached server response
        try {
          const cached = JSON.parse(localStorage.getItem(CACHE_KEY))
          if (cached?.ranking) {
            setRanking(cached.ranking); setConfrontos(cached.confrontos); setRankTimes(cached.rankTimes)
            setOfflineMode('cache')
            return
          }
        } catch { /* fall through */ }
        // 2. Reconstruct from sync queue
        const built = buildFromQueue(data)
        if (built) {
          setRanking(built.ranking); setConfrontos(built.confrontos); setRankTimes(built.rankTimes)
          setOfflineMode('queue')
        } else {
          setErro('Sem conexão e sem dados salvos para hoje.')
        }
      })
      .finally(() => setCarregando(false))
  }, [data])

  const top5 = ranking.slice(0, 5)
  const bot5 = ranking.length > 5 ? [...ranking].reverse().slice(0, 5) : []

  if (carregando) return <div className="resultados-page"><div className="empty-state">Carregando...</div></div>

  return (
    <div className="resultados-page">
      {offlineMode === 'cache' && (
        <div className="offline-banner">📦 Exibindo último acesso salvo — sem conexão</div>
      )}
      {offlineMode === 'queue' && (
        <div className="offline-banner">📱 Dados locais desta sessão — sincronize quando online</div>
      )}
      {erro && <div className="erro-banner"><span>{erro}</span><button onClick={() => setErro(null)}>✕</button></div>}

      <div className="res-section-title">{data}</div>

      {ranking.length === 0 ? (
        <div className="empty-state">Nenhuma partida registrada hoje.</div>
      ) : (
        <>
          {/* Ranking de times */}
          {rankTimes.length > 0 && (
            <>
              <div className="res-section-title">Ranking dos Times</div>
              <div className="times-rank-table">
                <div className="times-rank-header">
                  <span></span>
                  <span>Time</span>
                  <span>J</span>
                  <span>V</span>
                  <span>E</span>
                  <span>D</span>
                  <span>Saldo</span>
                </div>
                {rankTimes.map((t, i) => (
                  <div key={i} className="times-rank-row">
                    <span className="tr-pos">#{i + 1}</span>
                    <span className="tr-nome">{t.nome_time}</span>
                    <span className="tr-jog">{t.jogos}</span>
                    <span className="tr-vit">{t.vitorias}</span>
                    <span className="tr-emp">{t.empates}</span>
                    <span className="tr-der">{t.derrotas}</span>
                    <span className={`tr-saldo${t.saldo_gols > 0 ? ' pos' : t.saldo_gols < 0 ? ' neg' : ''}`}>
                      {t.saldo_gols > 0 ? '+' : ''}{t.saldo_gols}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Ranking de jogadores */}
          <div className="rank-grid">
            <div className="rank-col">
              <div className="rank-col-header top">🏆 TOP 5 DO DIA</div>
              {top5.map((p, i) => {
                const label = getLabel(p.firepower ?? 60)
                return (
                  <div key={p.id} className="rank-row">
                    <span className="rank-pos">#{i + 1}</span>
                    <div className="rank-info">
                      <span className="rank-nome">{p.nome}</span>
                      <span className={`pos-badge pos-${p.posicao.toLowerCase()}`}>{p.posicao}</span>
                    </div>
                    <div className="rank-score">
                      <span className="rank-nota">{p.nota.toFixed(1)}</span>
                      <span className={`label-badge label-${label.cls}`}>{label.text}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {bot5.length > 0 && (
              <div className="rank-col">
                <div className="rank-col-header bot">💀 PIORES 5</div>
                {bot5.map((p, i) => {
                  const label = getLabel(p.firepower ?? 60)
                  const pos   = ranking.length - i
                  return (
                    <div key={p.id} className="rank-row">
                      <span className="rank-pos dim">#{pos}</span>
                      <div className="rank-info">
                        <span className="rank-nome">{p.nome}</span>
                        <span className={`pos-badge pos-${p.posicao.toLowerCase()}`}>{p.posicao}</span>
                      </div>
                      <div className="rank-score">
                        <span className="rank-nota dim">{p.nota.toFixed(1)}</span>
                        <span className={`label-badge label-${label.cls}`}>{label.text}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Confrontos */}
          {confrontos.length > 0 && (
            <>
              <div className="res-section-title">Confrontos</div>
              <div className="confrontos-list">
                {confrontos.map((c, i) => (
                  <div key={i} className="confronto-card">
                    <div className="conf-header">
                      <div className="conf-placar">
                        <span className={`conf-num${c.resultado === 'A' ? ' winner' : ''}`}>{c.placar_a}</span>
                        <span className="conf-x">×</span>
                        <span className={`conf-num${c.resultado === 'B' ? ' winner' : ''}`}>{c.placar_b}</span>
                      </div>
                      {c.resultado === 'EMPATE' && <span className="conf-empate">EMPATE</span>}
                      <span className="conf-seq">#{c.sequencia}</span>
                    </div>

                    {(c.nome_time_a || c.nome_time_b) && (
                      <div className="conf-nomes-times">
                        <span>{c.nome_time_a}</span>
                        <span className="conf-vs">vs</span>
                        <span>{c.nome_time_b}</span>
                      </div>
                    )}

                    <div className="conf-times">
                      <div className="conf-time">
                        {c.timeA.map((j, idx) => (
                          <span key={idx} className="conf-player">
                            {j.nome}
                            {j.gols         > 0 && <span className="ev-gol">  ⚽×{j.gols}</span>}
                            {j.assistencias > 0 && <span className="ev-ass">  🤝×{j.assistencias}</span>}
                            {j.falhas       > 0 && <span className="ev-falha"> ⚠×{j.falhas}</span>}
                            {j.desarmes     > 0 && <span className="ev-desarme"> ⚔×{j.desarmes}</span>}
                            {j.faltas       > 0 && <span className="ev-falta"> 🦵×{j.faltas}</span>}
                            {j.amarelos     > 0 && <span className="ev-amarelo"> 🟨×{j.amarelos}</span>}
                            {j.vermelhos    > 0 && <span className="ev-vermelho"> 🟥×{j.vermelhos}</span>}
                          </span>
                        ))}
                      </div>
                      <div className="conf-time">
                        {c.timeB.map((j, idx) => (
                          <span key={idx} className="conf-player">
                            {j.nome}
                            {j.gols         > 0 && <span className="ev-gol">  ⚽×{j.gols}</span>}
                            {j.assistencias > 0 && <span className="ev-ass">  🤝×{j.assistencias}</span>}
                            {j.falhas       > 0 && <span className="ev-falha"> ⚠×{j.falhas}</span>}
                            {j.desarmes     > 0 && <span className="ev-desarme"> ⚔×{j.desarmes}</span>}
                            {j.faltas       > 0 && <span className="ev-falta"> 🦵×{j.faltas}</span>}
                            {j.amarelos     > 0 && <span className="ev-amarelo"> 🟨×{j.amarelos}</span>}
                            {j.vermelhos    > 0 && <span className="ev-vermelho"> 🟥×{j.vermelhos}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
