import { Router } from 'express'
import { listar, criar, atualizar, remover } from '../controllers/jogadoresController.js'

const router = Router()

router.get('/', listar)
router.post('/', criar)
router.put('/:id', atualizar)
router.delete('/:id', remover)

export default router
