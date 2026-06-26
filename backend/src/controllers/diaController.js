import db from '../database/db.js'

async function statsDodia(data) {
  const { rows } = await db.query(`
    SELECT j.id, j.nome, j.posicao, j.firepower,
           COUNT(jc.id)::int                           AS partidas,
           COALESCE(SUM(jc.gols), 0)::int              AS gols,
           COALESCE(SUM(jc.assistencias), 0)::int      AS assistencias,
           COALESCE(SUM(jc.falhas), 0)::int            AS falhas,
           COALESCE(SUM(jc.desarmes), 0)::int          AS desarmes,
           COALESCE(SUM(jc.faltas), 0)::int            AS faltas,
           COALESCE(SUM(jc.amarelos), 0)::int          AS amarelos,
           COALESCE(SUM(jc.vermelhos), 0)::int         AS vermelhos,
           ROUND(AVG(
             6.0
             + jc.gols         * 2.0
             + jc.assistencias * 1.0
             + CASE WHEN j.posicao IN ('DEF', 'MEI') THEN jc.desarmes * 0.5 ELSE 0 END
             - jc.falhas       * 0.3
             - jc.faltas       * 0.5
             - jc.amarelos     * 1.0
             - jc.vermelhos    * 2.0
           )::numeric, 1)::float AS nota_raw
    FROM partidas p
    JOIN confrontos c           ON c.fk_partida  = p.id
    JOIN jogadores_confronto jc ON jc.fk_confronto = c.id
    JOIN jogadores j            ON j.id           = jc.fk_jogador
    WHERE p.data = $1
    GROUP BY j.id, j.nome, j.posicao, j.firepower
  `, [data])

  return rows.map(p => ({
    ...p,
    firepower: p.firepower ?? 60,
    nota: Math.min(10, Math.max(0, parseFloat(p.nota_raw) || 6))
  }))
}

export async function rankingDia(req, res) {
  try {
    const players = await statsDodia(req.params.data)
    res.json(players.sort((a, b) => b.nota - a.nota))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function encerrarDia(req, res) {
  try {
    const { data } = req.params
    const players = await statsDodia(data)

    if (players.length === 0) {
      return res.status(400).json({ error: 'Nenhuma partida encontrada nessa data.' })
    }

    const updates = await Promise.all(
      players.map(async p => {
        const delta = Math.round((p.nota - 6) * 2)
        const novoFirepower = Math.max(0, Math.min(100, p.firepower + delta))
        await db.query('UPDATE jogadores SET firepower = $1 WHERE id = $2', [novoFirepower, p.id])
        return { id: p.id, nome: p.nome, nota: p.nota, delta, firepowerAntes: p.firepower, firepowerDepois: novoFirepower }
      })
    )

    res.json({ data, jogadores: updates })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function confrontosDia(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT c.id, c.sequencia, c.placar_a, c.placar_b, c.resultado,
             c.nome_time_a, c.nome_time_b,
             jc.time, jc.gols, jc.assistencias, jc.falhas,
             jc.desarmes, jc.faltas, jc.amarelos, jc.vermelhos,
             j.nome, j.posicao
      FROM partidas p
      JOIN confrontos c           ON c.fk_partida   = p.id
      JOIN jogadores_confronto jc ON jc.fk_confronto = c.id
      JOIN jogadores j            ON j.id            = jc.fk_jogador
      WHERE p.data = $1
      ORDER BY c.sequencia, jc.time
    `, [req.params.data])

    const confrontosMap = {}
    rows.forEach(r => {
      if (!confrontosMap[r.id]) {
        confrontosMap[r.id] = {
          sequencia:   r.sequencia,
          placar_a:    r.placar_a,
          placar_b:    r.placar_b,
          resultado:   r.resultado,
          nome_time_a: r.nome_time_a,
          nome_time_b: r.nome_time_b,
          timeA: [],
          timeB: []
        }
      }
      const jogador = {
        nome:         r.nome,
        posicao:      r.posicao,
        gols:         r.gols         || 0,
        assistencias: r.assistencias || 0,
        falhas:       r.falhas       || 0,
        desarmes:     r.desarmes     || 0,
        faltas:       r.faltas       || 0,
        amarelos:     r.amarelos     || 0,
        vermelhos:    r.vermelhos    || 0
      }
      if (r.time === 'A') confrontosMap[r.id].timeA.push(jogador)
      else confrontosMap[r.id].timeB.push(jogador)
    })

    res.json(Object.values(confrontosMap))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function rankingTimes(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT nome_time,
             SUM(jogos)::int    AS jogos,
             SUM(vitorias)::int AS vitorias,
             SUM(empates)::int  AS empates,
             SUM(derrotas)::int AS derrotas,
             SUM(saldo)::int    AS saldo_gols
      FROM (
        SELECT nome_time_a AS nome_time,
               COUNT(*) AS jogos,
               SUM(CASE WHEN resultado = 'A'      THEN 1 ELSE 0 END) AS vitorias,
               SUM(CASE WHEN resultado = 'EMPATE' THEN 1 ELSE 0 END) AS empates,
               SUM(CASE WHEN resultado = 'B'      THEN 1 ELSE 0 END) AS derrotas,
               SUM(placar_a - placar_b) AS saldo
        FROM confrontos c
        JOIN partidas p ON p.id = c.fk_partida
        WHERE p.data = $1 AND nome_time_a IS NOT NULL
        GROUP BY nome_time_a
        UNION ALL
        SELECT nome_time_b,
               COUNT(*),
               SUM(CASE WHEN resultado = 'B'      THEN 1 ELSE 0 END),
               SUM(CASE WHEN resultado = 'EMPATE' THEN 1 ELSE 0 END),
               SUM(CASE WHEN resultado = 'A'      THEN 1 ELSE 0 END),
               SUM(placar_b - placar_a)
        FROM confrontos c
        JOIN partidas p ON p.id = c.fk_partida
        WHERE p.data = $1 AND nome_time_b IS NOT NULL
        GROUP BY nome_time_b
      ) t
      GROUP BY nome_time
      ORDER BY vitorias DESC, saldo_gols DESC
    `, [req.params.data])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
