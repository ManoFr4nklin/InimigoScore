import { Router } from 'express'
import { criarPartida, criarConfronto, addJogadoresConfronto } from '../controllers/partidasController.js'

const router = Router()

router.post('/', criarPartida)
router.post('/confrontos', criarConfronto)
router.post('/confrontos/:id/jogadores', addJogadoresConfronto)

export default router
