import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'wedding-manager-secret'

export interface AuthRequest extends Request {
  user?: {
    id: number
    username: string
    partnerId?: number
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    return res.status(401).json({ error: '未授权访问，请先登录' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    req.user = {
      id: decoded.id,
      username: decoded.username,
      partnerId: decoded.partnerId
    }
    next()
  } catch (error) {
    return res.status(401).json({ error: 'token无效或已过期，请重新登录' })
  }
}
