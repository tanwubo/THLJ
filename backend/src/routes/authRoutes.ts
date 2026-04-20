import express from 'express'
import { register, login, bindPartner, unbindPartner, getProfile, exportBackup } from '../controllers/authController'
import { authMiddleware } from '../middleware/auth'

const router = express.Router()

// 公开接口
router.post('/register', register)
router.post('/login', login)

// 需要认证的接口
router.post('/bind-partner', authMiddleware, bindPartner)
router.post('/unbind-partner', authMiddleware, unbindPartner)
router.get('/profile', authMiddleware, getProfile)
router.get('/backup', authMiddleware, exportBackup)

export default router
