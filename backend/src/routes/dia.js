import { Router } from 'express'
import { rankingDia, encerrarDia, confrontosDia, rankingTimes } from '../controllers/diaController.js'

const router = Router()

router.get('/:data/confrontos', confrontosDia)
router.get('/:data/times',     rankingTimes)
router.get('/:data',           rankingDia)
router.post('/:data/encerrar', encerrarDia)

export default router
