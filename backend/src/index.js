import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jogadoresRoutes from './routes/jogadores.js'
import partidasRoutes from './routes/partidas.js'
import diaRoutes from './routes/dia.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.use('/jogadores', jogadoresRoutes)
app.use('/partidas', partidasRoutes)
app.use('/dia', diaRoutes)

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
})
