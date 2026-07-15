import express from 'express'
import cors from 'cors'
import pg from 'pg'
import jwt from 'jsonwebtoken'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 5000,
})

const app = express()

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim())
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error('CORS não permitido'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())

// ── Auth (público — antes do middleware JWT) ───────────────
app.post('/auth/login', async (req, res) => {
  const { usuario, senha } = req.body ?? {}
  if (!usuario || !senha) return res.status(400).json({ error: 'Usuário e senha obrigatórios' })
  const validUser  = process.env.LOGIN_USER
  const validSenha = process.env.LOGIN_SENHA
  const secret     = process.env.JWT_SECRET
  if (!validUser || !validSenha || !secret)
    return res.status(500).json({ error: 'Servidor não configurado corretamente' })
  if (usuario !== validUser || senha !== validSenha) {
    await new Promise(r => setTimeout(r, 400))
    return res.status(401).json({ error: 'Usuário ou senha incorretos' })
  }
  const token = jwt.sign({ usuario }, secret, { expiresIn: '12h' })
  res.json({ token })
})

// ── JWT middleware ─────────────────────────────────────────
app.use((req, res, next) => {
  const secret = process.env.JWT_SECRET
  if (!secret) return next()
  const header = req.headers['authorization']
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autorizado' })
  try { jwt.verify(header.slice(7), secret); next() }
  catch { res.status(401).json({ error: 'Token inválido ou expirado' }) }
})

// ── Sorteio (sync entre dispositivos) ─────────────────────
app.get('/sorteio', async (req, res) => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS sorteio_atual (
      id SMALLINT PRIMARY KEY DEFAULT 1,
      times JSONB,
      goleiros JSONB,
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    )`)
    const { rows } = await pool.query('SELECT times, goleiros FROM sorteio_atual WHERE id=1')
    const row = rows[0]
    res.json(row?.times ? { times: row.times, goleiros: row.goleiros || [] } : null)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/sorteio', async (req, res) => {
  try {
    const { times, goleiros } = req.body
    await pool.query(`
      INSERT INTO sorteio_atual (id, times, goleiros, atualizado_em) VALUES (1, $1, $2, NOW())
      ON CONFLICT (id) DO UPDATE SET times=$1, goleiros=$2, atualizado_em=NOW()
    `, [JSON.stringify(times), JSON.stringify(goleiros || [])])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/sorteio', async (req, res) => {
  try {
    await pool.query('UPDATE sorteio_atual SET times=NULL, goleiros=NULL WHERE id=1')
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Jogadores ──────────────────────────────────────────────
app.get('/jogadores', async (req, res) => {
  try {
    const { rows } = await pool.query(`
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
    res.json(rows.map(j => ({
      id: j.id, nome: j.nome, posicao: j.posicao, firepower: j.firepower ?? 60,
      stats: {
        partidas: j.partidas, gols: j.gols, assistencias: j.assistencias,
        falhas: j.falhas, desarmes: j.desarmes, faltas: j.faltas,
        amarelos: j.amarelos, vermelhos: j.vermelhos,
      },
    })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/jogadores', async (req, res) => {
  const { nome, posicao } = req.body
  if (!nome || !posicao) return res.status(400).json({ error: 'Nome e posição são obrigatórios' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO jogadores (nome, posicao) VALUES ($1, $2) RETURNING *',
      [nome, posicao]
    )
    const j = rows[0]
    res.status(201).json({
      id: j.id, nome: j.nome, posicao: j.posicao, firepower: j.firepower ?? 60,
      stats: { partidas: 0, gols: 0, assistencias: 0, falhas: 0, desarmes: 0, faltas: 0, amarelos: 0, vermelhos: 0 },
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/jogadores/:id', async (req, res) => {
  const { id } = req.params
  const { nome, posicao, firepower } = req.body
  const sets = [], values = []
  let i = 1
  if (nome !== undefined)      { sets.push(`nome = $${i++}`);      values.push(nome) }
  if (posicao !== undefined)   { sets.push(`posicao = $${i++}`);   values.push(posicao) }
  if (firepower !== undefined) { sets.push(`firepower = $${i++}`); values.push(Math.max(0, Math.min(100, parseInt(firepower) || 0))) }
  if (sets.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' })
  values.push(id)
  try {
    const { rows } = await pool.query(`UPDATE jogadores SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values)
    if (rows.length === 0) return res.status(404).json({ error: 'Jogador não encontrado' })
    const j = rows[0]
    res.json({ id: j.id, nome: j.nome, posicao: j.posicao, firepower: j.firepower ?? 60 })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/jogadores/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM jogadores WHERE id = $1', [req.params.id])
    res.status(204).send()
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Partidas ───────────────────────────────────────────────
app.post('/partidas', async (req, res) => {
  const hoje   = new Date().toISOString().split('T')[0]
  const isTest = req.body?.is_test === true
  try {
    const { rows } = await pool.query(
      'INSERT INTO partidas (data, is_test) VALUES ($1, $2) RETURNING *',
      [hoje, isTest]
    )
    res.status(201).json(rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// reset-test ANTES de /:id para não colidir
app.delete('/partidas/reset-test', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM partidas WHERE is_test = true')
    res.json({ ok: true, partidas_removidas: rowCount })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/partidas/:id', async (req, res) => {
  const { id } = req.params
  try {
    await pool.query('DELETE FROM jogadores_confronto WHERE fk_confronto IN (SELECT id FROM confrontos WHERE fk_partida = $1)', [id])
    await pool.query('DELETE FROM confrontos WHERE fk_partida = $1', [id])
    await pool.query('DELETE FROM partidas WHERE id = $1', [id])
    res.status(204).send()
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/partidas/confrontos', async (req, res) => {
  const { fk_partida, sequencia, placar_a, placar_b, resultado, nome_time_a, nome_time_b } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO confrontos (fk_partida, sequencia, placar_a, placar_b, resultado, nome_time_a, nome_time_b)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [fk_partida, sequencia, placar_a, placar_b, resultado, nome_time_a || null, nome_time_b || null]
    )
    res.status(201).json(rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/partidas/confrontos/:id/jogadores', async (req, res) => {
  const confrontoId = parseInt(req.params.id)
  if (isNaN(confrontoId)) return res.status(400).json({ error: 'ID de confronto inválido' })
  if (!Array.isArray(req.body) || req.body.length === 0)
    return res.status(400).json({ error: 'Body deve ser um array de jogadores' })
  const values = []
  const placeholders = req.body.map((j, idx) => {
    const b = idx * 11
    values.push(
      confrontoId, j.fk_jogador, j.time,
      j.gols || 0, j.assistencias || 0, j.falhas || 0,
      j.desarmes || 0, j.faltas || 0, j.amarelos || 0, j.vermelhos || 0,
      j.dribles || 0
    )
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11})`
  })
  try {
    const { rows } = await pool.query(
      `INSERT INTO jogadores_confronto
         (fk_confronto, fk_jogador, time, gols, assistencias, falhas, desarmes, faltas, amarelos, vermelhos, dribles)
       VALUES ${placeholders.join(',')} RETURNING *`,
      values
    )
    res.status(201).json(rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Dia ───────────────────────────────────────────────────
const SHRINKAGE_C = 3

function notaAjustada(notaBruta, nPartidas) {
  return (SHRINKAGE_C * 6.0 + nPartidas * notaBruta) / (SHRINKAGE_C + nPartidas)
}

async function statsDodia(data) {
  const { rows } = await pool.query(`
    SELECT j.id, j.nome, j.posicao, j.firepower,
           COUNT(jc.id)::int                           AS partidas,
           COALESCE(SUM(jc.gols), 0)::int              AS gols,
           COALESCE(SUM(jc.assistencias), 0)::int      AS assistencias,
           COALESCE(SUM(jc.falhas), 0)::int            AS falhas,
           COALESCE(SUM(jc.desarmes), 0)::int          AS desarmes,
           COALESCE(SUM(jc.faltas), 0)::int            AS faltas,
           COALESCE(SUM(jc.amarelos), 0)::int          AS amarelos,
           COALESCE(SUM(jc.vermelhos), 0)::int         AS vermelhos,
           COALESCE(SUM(jc.dribles), 0)::int           AS dribles,
           ROUND(AVG(
             6.0
             + jc.gols         * 2.0
             + jc.assistencias * 1.0
             + CASE WHEN j.posicao IN ('DEF', 'MEI') THEN jc.desarmes * 0.5 ELSE 0 END
             + CASE WHEN j.posicao IN ('ATA', 'MEI') THEN jc.dribles  * 0.3 ELSE 0 END
             - jc.falhas       * 0.3
             - jc.faltas       * 0.5
             - jc.amarelos     * 1.0
             - jc.vermelhos    * 2.0
           )::numeric, 1)::float AS nota_raw
    FROM partidas p
    JOIN confrontos c           ON c.fk_partida  = p.id
    JOIN jogadores_confronto jc ON jc.fk_confronto = c.id
    JOIN jogadores j            ON j.id           = jc.fk_jogador
    WHERE p.data = $1 AND p.is_test IS NOT TRUE
    GROUP BY j.id, j.nome, j.posicao, j.firepower
  `, [data])
  return rows.map(p => ({
    ...p,
    firepower: p.firepower ?? 60,
    nota: Math.min(10, Math.max(0, parseFloat(p.nota_raw) || 6)),
  }))
}

app.get('/dia/:data', async (req, res) => {
  try {
    const players = await statsDodia(req.params.data)
    res.json(players.sort((a, b) => b.nota - a.nota))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/dia/:data/confrontos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.sequencia, c.placar_a, c.placar_b, c.resultado,
             c.nome_time_a, c.nome_time_b,
             jc.time, jc.gols, jc.assistencias, jc.falhas,
             jc.desarmes, jc.faltas, jc.amarelos, jc.vermelhos, jc.dribles,
             j.nome, j.posicao
      FROM partidas p
      JOIN confrontos c           ON c.fk_partida   = p.id
      JOIN jogadores_confronto jc ON jc.fk_confronto = c.id
      JOIN jogadores j            ON j.id            = jc.fk_jogador
      WHERE p.data = $1 AND p.is_test IS NOT TRUE
      ORDER BY c.sequencia, jc.time
    `, [req.params.data])
    const map = {}
    rows.forEach(r => {
      if (!map[r.id]) map[r.id] = {
        sequencia: r.sequencia, placar_a: r.placar_a, placar_b: r.placar_b,
        resultado: r.resultado, nome_time_a: r.nome_time_a, nome_time_b: r.nome_time_b,
        timeA: [], timeB: [],
      }
      const j = {
        nome: r.nome, posicao: r.posicao,
        gols: r.gols || 0, assistencias: r.assistencias || 0, falhas: r.falhas || 0,
        desarmes: r.desarmes || 0, faltas: r.faltas || 0,
        amarelos: r.amarelos || 0, vermelhos: r.vermelhos || 0,
        dribles: r.dribles || 0,
      }
      if (r.time === 'A') map[r.id].timeA.push(j)
      else map[r.id].timeB.push(j)
    })
    res.json(Object.values(map))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/dia/:data/times', async (req, res) => {
  try {
    const { rows } = await pool.query(`
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
        FROM confrontos c JOIN partidas p ON p.id = c.fk_partida
        WHERE p.data = $1 AND p.is_test IS NOT TRUE AND nome_time_a IS NOT NULL
        GROUP BY nome_time_a
        UNION ALL
        SELECT nome_time_b,
               COUNT(*),
               SUM(CASE WHEN resultado = 'B'      THEN 1 ELSE 0 END),
               SUM(CASE WHEN resultado = 'EMPATE' THEN 1 ELSE 0 END),
               SUM(CASE WHEN resultado = 'A'      THEN 1 ELSE 0 END),
               SUM(placar_b - placar_a)
        FROM confrontos c JOIN partidas p ON p.id = c.fk_partida
        WHERE p.data = $1 AND p.is_test IS NOT TRUE AND nome_time_b IS NOT NULL
        GROUP BY nome_time_b
      ) t
      GROUP BY nome_time
      ORDER BY vitorias DESC, saldo_gols DESC
    `, [req.params.data])
    res.json(rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/dia/:data/encerrar', async (req, res) => {
  try {
    const { data } = req.params
    const players = await statsDodia(data)
    if (players.length === 0)
      return res.status(400).json({ error: 'Nenhuma partida encontrada nessa data.' })
    const updates = await Promise.all(players.map(async p => {
      const delta    = Math.round((notaAjustada(p.nota, p.partidas) - 6) * 2)
      const novoFp   = Math.max(0, Math.min(100, p.firepower + delta))
      await pool.query('UPDATE jogadores SET firepower = $1 WHERE id = $2', [novoFp, p.id])
      return { id: p.id, nome: p.nome, nota: p.nota, delta, firepowerAntes: p.firepower, firepowerDepois: novoFp }
    }))
    res.json({ data, jogadores: updates })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default function handler(req, res) {
  req.url = req.url.replace(/^\/api/, '') || '/'
  app(req, res)
}
