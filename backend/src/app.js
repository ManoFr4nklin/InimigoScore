import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import authRoutes    from './routes/auth.js'
import jogadoresRoutes from './routes/jogadores.js'
import partidasRoutes  from './routes/partidas.js'
import diaRoutes       from './routes/dia.js'

const app = express()

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error('CORS não permitido'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json())

// Rota pública — deve ficar ANTES do middleware de auth
app.use('/auth', authRoutes)

// Middleware JWT — protege todas as rotas abaixo
app.use((req, res, next) => {
  const secret = process.env.JWT_SECRET
  if (!secret) return next() // dev local sem JWT_SECRET = sem proteção (intencional)

  const header = req.headers['authorization']
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado' })
  }

  try {
    jwt.verify(header.slice(7), secret)
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
  }
})

app.use('/jogadores', jogadoresRoutes)
app.use('/partidas',  partidasRoutes)
app.use('/dia',       diaRoutes)

export default app
