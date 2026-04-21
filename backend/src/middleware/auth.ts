import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getUserPartnershipState } from '../services/partnership'

const JWT_SECRET = process.env.JWT_SECRET || 'wedding-manager-secret'

export interface AuthRequest extends Request {
  user?: {
    id: number
    username: string
    partnerId?: number
    dataOwnerId?: number
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    return res.status(401).json({ error: '未授权访问，请先登录' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const currentUser = getUserPartnershipState(decoded.id)
    if (!currentUser) {
      return res.status(401).json({ error: '用户不存在，请重新登录' })
    }
    req.user = {
      id: currentUser.id,
      username: currentUser.username,
      partnerId: currentUser.partnerId ?? undefined,
      dataOwnerId: currentUser.dataOwnerId,
    }
    next()
  } catch (error) {
    return res.status(401).json({ error: 'token无效或已过期，请重新登录' })
  }
}
