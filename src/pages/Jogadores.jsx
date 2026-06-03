import { useState, useEffect } from 'react'
console.log('Página carregou')
import './Jogadores.css'

const POSICOES = ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA']

function calcNota(stats) {
  if (stats.partidas === 0) return 0
  const avg = (stats.gols + stats.assistencias) / stats.partidas
  return Math.min(10, Math.round(avg * 5 * 10) / 10)
}

function getLabel(nota) {
  if (nota >= 8) return { text: 'CRAQUE', cls: 'craque' }
  if (nota >= 6) return { text: 'BOM', cls: 'bom' }
  if (nota >= 4) return { text: 'MÉDIO', cls: 'medio' }
  if (nota >= 2) return { text: 'FRACO', cls: 'fraco' }
  return { text: 'BAGRE', cls: 'bagre' }
}

export default function Jogadores() {
const [jogadores, setJogadores] = useState([])
  const [nome, setNome] = useState('')
  const [posicao, setPosicao] = useState('ATA')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null)

  useEffect(() => {
    fetch('http://localhost:3000/jogadores')
        .then(res => res.json())
        .then(data => setJogadores(data))
        .catch(err => console.error(err))
}, [])

async function addJogador() {
  if (!nome.trim()) return

  try {
    await fetch('http://localhost:3000/jogadores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nome: nome.trim(),
        posicao
      })
    })

    const resposta = await fetch('http://localhost:3000/jogadores')
    const dados = await resposta.json()

    setJogadores(dados)
    setNome('')

  } catch (err) {
    console.error(err)
  }
}

async function removeJogador(id) {
  try {
    await fetch(`http://localhost:3000/jogadores/${id}`, {
      method: 'DELETE'
    })

    const resposta = await fetch('http://localhost:3000/jogadores')
    const dados = await resposta.json()

    setJogadores(dados)

  } catch (err) {
    console.error(err)
  }
}

 async function salvarEdicao() {
  try {

    await fetch(`http://localhost:3000/jogadores/${editando.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nome: editando.nome,
        posicao: editando.posicao
      })
    })

    const resposta = await fetch('http://localhost:3000/jogadores')
    const dados = await resposta.json()

    setJogadores(dados)
    setEditando(null)

  } catch (err) {
    console.error(err)
  }
}

  const rankingCompleto = jogadores
    .map(j => ({ ...j, nota: calcNota(j.stats) }))
    .sort((a, b) => b.nota - a.nota)

  const filtrados = rankingCompleto.filter(j =>
    j.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="jogadores-page">
      <div className="form-card">
        <h2 className="section-title">Novo Jogador</h2>
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
      </div>

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
        {filtrados.length === 0 ? (
          <div className="empty-state">
            {busca ? 'Nenhum jogador encontrado.' : 'Cadastre o primeiro jogador acima.'}
          </div>
        ) : (
          filtrados.map(j => {
            const label = getLabel(j.nota)
            const rankPos = rankingCompleto.findIndex(r => r.id === j.id) + 1
            return (
              <div key={j.id} className="player-card">
                <span className="rank">#{rankPos}</span>
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
                <div className="player-score">
                  <span className="nota-num">{j.nota.toFixed(1)}</span>
                  <span className={`label-badge label-${label.cls}`}>{label.text}</span>
                </div>
                <div className="player-actions">
                  <button
                    className="btn-icon btn-edit"
                    onClick={() => setEditando({ ...j })}
                    title="Editar"
                  >✏</button>
                  <button
                    className="btn-icon btn-del"
                    onClick={() => removeJogador(j.id)}
                    title="Remover"
                  >✕</button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Editar Jogador</h3>
            <input
              className="inp"
              value={editando.nome}
              onChange={e => setEditando(p => ({ ...p, nome: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && salvarEdicao()}
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
