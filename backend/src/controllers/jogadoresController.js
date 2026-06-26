import db from '../database/db.js'

export async function listar(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT j.id, j.nome, j.posicao, j.firepower,
             COUNT(jc.id)::int                        AS partidas,
             COALESCE(SUM(jc.gols), 0)::int           AS gols,
             COALESCE(SUM(jc.assistencias), 0)::int   AS assistencias,
             COALESCE(SUM(jc.falhas), 0)::int         AS falhas,
             COALESCE(SUM(jc.desarmes), 0)::int       AS desarmes,
             COALESCE(SUM(jc.faltas), 0)::int         AS faltas,
             COALESCE(SUM(jc.amarelos), 0)::int       AS amarelos,
             COALESCE(SUM(jc.vermelhos), 0)::int      AS vermelhos
      FROM jogadores j
      LEFT JOIN jogadores_confronto jc ON jc.fk_jogador = j.id
      GROUP BY j.id
      ORDER BY j.id ASC
    `)

    const jogadores = rows.map(j => ({
      id: j.id,
      nome: j.nome,
      posicao: j.posicao,
      firepower: j.firepower ?? 60,
      stats: {
        partidas:     j.partidas,
        gols:         j.gols,
        assistencias: j.assistencias,
        falhas:       j.falhas,
        desarmes:     j.desarmes,
        faltas:       j.faltas,
        amarelos:     j.amarelos,
        vermelhos:    j.vermelhos
      }
    }))

    res.json(jogadores)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function criar(req, res) {
  const { nome, posicao } = req.body

  if (!nome || !posicao) {
    return res.status(400).json({ error: 'Nome e posição são obrigatórios' })
  }

  try {
    const { rows } = await db.query(
      'INSERT INTO jogadores (nome, posicao) VALUES ($1, $2) RETURNING *',
      [nome, posicao]
    )
    const j = rows[0]
    res.status(201).json({
      id: j.id,
      nome: j.nome,
      posicao: j.posicao,
      firepower: j.firepower ?? 60,
      stats: { partidas: 0, gols: 0, assistencias: 0, falhas: 0, desarmes: 0, faltas: 0, amarelos: 0, vermelhos: 0 }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function atualizar(req, res) {
  const { id } = req.params
  const { nome, posicao, firepower } = req.body

  const sets = []
  const values = []
  let i = 1

  if (nome !== undefined) { sets.push(`nome = $${i++}`); values.push(nome) }
  if (posicao !== undefined) { sets.push(`posicao = $${i++}`); values.push(posicao) }
  if (firepower !== undefined) { sets.push(`firepower = $${i++}`); values.push(Math.max(0, Math.min(100, parseInt(firepower) || 0))) }

  if (sets.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' })

  values.push(id)
  try {
    const { rows } = await db.query(
      `UPDATE jogadores SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Jogador não encontrado' })
    const j = rows[0]
    res.json({ id: j.id, nome: j.nome, posicao: j.posicao, firepower: j.firepower ?? 60 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function remover(req, res) {
  const { id } = req.params
  try {
    await db.query('DELETE FROM jogadores WHERE id = $1', [id])
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
