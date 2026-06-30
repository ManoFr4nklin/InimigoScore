import db from '../database/db.js'

export async function criarPartida(req, res) {
  const data = req.body?.data || new Date().toISOString().split('T')[0]
  try {
    const { rows } = await db.query(
      'INSERT INTO partidas (data) VALUES ($1) RETURNING *',
      [data]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function criarConfronto(req, res) {
  const { fk_partida, sequencia, placar_a, placar_b, resultado, nome_time_a, nome_time_b } = req.body
  try {
    const { rows } = await db.query(
      `INSERT INTO confrontos (fk_partida, sequencia, placar_a, placar_b, resultado, nome_time_a, nome_time_b)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [fk_partida, sequencia, placar_a, placar_b, resultado, nome_time_a || null, nome_time_b || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function addJogadoresConfronto(req, res) {
  const { id } = req.params
  const confrontoId = parseInt(id)

  if (isNaN(confrontoId)) return res.status(400).json({ error: 'ID de confronto inválido' })
  if (!Array.isArray(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Body deve ser um array de jogadores' })

  const values = []
  const placeholders = req.body.map((j, idx) => {
    const base = idx * 10
    values.push(
      confrontoId,
      j.fk_jogador,
      j.time,
      j.gols        || 0,
      j.assistencias || 0,
      j.falhas      || 0,
      j.desarmes    || 0,
      j.faltas      || 0,
      j.amarelos    || 0,
      j.vermelhos   || 0
    )
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10})`
  })

  try {
    const { rows } = await db.query(
      `INSERT INTO jogadores_confronto
         (fk_confronto, fk_jogador, time, gols, assistencias, falhas, desarmes, faltas, amarelos, vermelhos)
       VALUES ${placeholders.join(',')} RETURNING *`,
      values
    )
    res.status(201).json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
