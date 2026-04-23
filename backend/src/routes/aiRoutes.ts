import express from 'express'
import { parseAiCommand } from '../controllers/aiController'
import { authMiddleware } from '../middleware/auth'

const router = express.Router()

router.use(authMiddleware)

router.post('/parse-command', parseAiCommand)

export default router
