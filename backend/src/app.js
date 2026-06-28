import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jogadoresRoutes from './routes/jogadores.js'
import partidasRoutes from './routes/partidas.js'
import diaRoutes from './routes/dia.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/jogadores', jogadoresRoutes)
app.use('/partidas', partidasRoutes)
app.use('/dia', diaRoutes)

export default app
