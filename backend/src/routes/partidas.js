import { Router } from 'express'
import { criarPartida, criarConfronto, addJogadoresConfronto } from '../controllers/partidasController.js'
import db from '../database/db.js'

const router = Router()

router.post('/', criarPartida)
router.post('/confrontos', criarConfronto)
router.post('/confrontos/:id/jogadores', addJogadoresConfronto)

router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    await db.query('DELETE FROM jogadores_confronto WHERE fk_confronto IN (SELECT id FROM confrontos WHERE fk_partida = $1)', [id])
    await db.query('DELETE FROM confrontos WHERE fk_partida = $1', [id])
    await db.query('DELETE FROM partidas WHERE id = $1', [id])
    res.status(204).send()
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router
