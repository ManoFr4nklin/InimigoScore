import { useState, useEffect } from 'react'
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

export default function Resultados() {
  const [ranking,    setRanking]    = useState([])
  const [confrontos, setConfrontos] = useState([])
  const [rankTimes,  setRankTimes]  = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]             = useState(null)
  const data = dataHoje()

  useEffect(() => {
    setCarregando(true)
    Promise.all([
      fetch(`http://localhost:3000/dia/${data}`).then(r => r.json()),
      fetch(`http://localhost:3000/dia/${data}/confrontos`).then(r => r.json()),
      fetch(`http://localhost:3000/dia/${data}/times`).then(r => r.json())
    ])
      .then(([rank, confs, times]) => {
        setRanking(Array.isArray(rank)  ? rank  : [])
        setConfrontos(Array.isArray(confs) ? confs : [])
        setRankTimes(Array.isArray(times)  ? times : [])
      })
      .catch(() => setErro('Não foi possível carregar os resultados.'))
      .finally(() => setCarregando(false))
  }, [data])

  const top5 = ranking.slice(0, 5)
  const bot5 = ranking.length > 5 ? [...ranking].reverse().slice(0, 5) : []

  if (carregando) return <div className="resultados-page"><div className="empty-state">Carregando...</div></div>

  return (
    <div className="resultados-page">
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
