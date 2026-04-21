import { Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { run, query, runInTransaction } from '../db'
import { AuthRequest } from '../middleware/auth'
import crypto from 'crypto'
import { getUserPartnershipState, replaceUserDataFromOwner, requireUserPartnershipState } from '../services/partnership'
import { isAdminUsername } from '../services/admin'

const JWT_SECRET = process.env.JWT_SECRET || 'wedding-manager-secret'
const SALT_ROUNDS = 10

// 生成6位数字邀请码
function generateInviteCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

// 注册
export async function register(req: AuthRequest, res: Response) {
  const { username, password, email } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' })
  }

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度必须在3-20位之间' })
  }

  if (password.length < 6 || password.length > 32) {
    return res.status(400).json({ error: '密码长度必须在6-32位之间' })
  }

  try {
    // 检查用户名是否已存在
    const existingUsers = query('SELECT id FROM users WHERE username = ?', [username])
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: '用户名已存在' })
    }

    // 生成密码哈希
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // 生成唯一邀请码
    let inviteCode: string
    let codeExists: any[]
    do {
      inviteCode = generateInviteCode()
      codeExists = query('SELECT id FROM users WHERE invite_code = ?', [inviteCode])
    } while (codeExists.length > 0)

    // 创建用户
    const result = await run(
      'INSERT INTO users (username, password_hash, email, invite_code) VALUES (?, ?, ?, ?)',
      [username, passwordHash, email || null, inviteCode]
    )

    const userId = result.lastInsertRowid
    await run('UPDATE users SET data_owner_id = ? WHERE id = ?', [userId, userId])

    // 生成JWT token
    const token = jwt.sign(
      { id: userId, username, partnerId: null },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({
      token,
      user: {
        id: userId,
        username,
        email,
        inviteCode,
        partnerId: null,
        isAdmin: isAdminUsername(username),
      }
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ error: '注册失败，请稍后重试' })
  }
}

// 登录
export async function login(req: AuthRequest, res: Response) {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' })
  }

  try {
    const users = query('SELECT * FROM users WHERE username = ?', [username])
    if (users.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    const user = users[0]
    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    // 更新最后登录时间
    await run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id])

    // 生成JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, partnerId: user.partner_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        inviteCode: user.invite_code,
        partnerId: user.partner_id,
        isAdmin: isAdminUsername(user.username),
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: '登录失败，请稍后重试' })
  }
}

// 绑定情侣账号
export async function bindPartner(req: AuthRequest, res: Response) {
  const { inviteCode } = req.body
  const userId = req.user?.id

  if (!userId || !inviteCode) {
    return res.status(400).json({ error: '参数错误' })
  }

  try {
    // 查询邀请码对应用户
    const partnerUsers = query('SELECT id, partner_id, username, data_owner_id FROM users WHERE invite_code = ?', [inviteCode])
    if (partnerUsers.length === 0) {
      return res.status(400).json({ error: '邀请码不存在' })
    }

    const partner = partnerUsers[0]

    // 不能绑定自己
    if (partner.id === userId) {
      return res.status(400).json({ error: '不能绑定自己的账号' })
    }

    // 对方已绑定其他账号
    if (partner.partner_id) {
      return res.status(400).json({ error: '该用户已绑定其他账号' })
    }

    // 自己已绑定其他账号
    const currentUser = requireUserPartnershipState(userId)
    if (currentUser.partnerId) {
      return res.status(400).json({ error: '您已绑定其他账号，请先解绑' })
    }

    const sharedOwnerId = partner.data_owner_id ?? partner.id

    await runInTransaction([
      { sql: 'UPDATE users SET partner_id = ?, data_owner_id = ? WHERE id = ?', params: [partner.id, sharedOwnerId, userId] },
      { sql: 'UPDATE users SET partner_id = ?, data_owner_id = ? WHERE id = ?', params: [userId, sharedOwnerId, partner.id] },
      {
        sql: 'INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, content) VALUES (?, ?, ?, ?, ?)',
        params: [userId, 'bind_partner', 'user', partner.id, `与用户${partner.username}绑定成功`],
      },
    ])

    res.json({
      success: true,
      message: '绑定成功',
      partner: {
        id: partner.id,
        username: partner.username
      }
    })
  } catch (error) {
    console.error('Bind partner error:', error)
    res.status(500).json({ error: '绑定失败，请稍后重试' })
  }
}

// 解绑情侣账号
export async function unbindPartner(req: AuthRequest, res: Response) {
  const userId = req.user?.id

  if (!userId) {
    return res.status(401).json({ error: '未授权访问' })
  }

  try {
    const currentUser = requireUserPartnershipState(userId)
    if (!currentUser.partnerId) {
      return res.status(400).json({ error: '您尚未绑定任何账号' })
    }

    const partner = requireUserPartnershipState(currentUser.partnerId)

    const usersToRestore = [currentUser, partner]
    for (const member of usersToRestore) {
      if (member.dataOwnerId !== member.id) {
        await replaceUserDataFromOwner(member.dataOwnerId, member.id)
      }
    }

    await runInTransaction([
      { sql: 'UPDATE users SET partner_id = NULL, data_owner_id = id WHERE id = ?', params: [currentUser.id] },
      { sql: 'UPDATE users SET partner_id = NULL, data_owner_id = id WHERE id = ?', params: [partner.id] },
      {
        sql: 'INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, content) VALUES (?, ?, ?, ?, ?)',
        params: [userId, 'unbind_partner', 'user', partner.id, '与伴侣解绑成功'],
      },
    ])

    res.json({ success: true, message: '解绑成功' })
  } catch (error) {
    console.error('Unbind partner error:', error)
    res.status(500).json({ error: '解绑失败，请稍后重试' })
  }
}

// 导出所有用户数据备份
export async function exportBackup(req: AuthRequest, res: Response) {
  const userId = req.user?.id
  const dataOwnerId = req.user?.dataOwnerId ?? userId
  if (!userId) {
    return res.status(401).json({ error: '未授权访问' })
  }

  try {
    // 获取用户信息
    const users = query('SELECT id, username, email, invite_code, partner_id, created_at, last_login FROM users WHERE id = ?', [userId])
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' })
    }

    // 获取时间线节点
    const nodes = query('SELECT * FROM timeline_nodes WHERE user_id = ? ORDER BY "order"', [dataOwnerId])

    // 获取所有节点的待办
    const nodeIds = nodes.map((n: any) => n.id)
    const todos = nodeIds.length > 0
      ? query(`SELECT * FROM todo_items WHERE node_id IN (${nodeIds.map(() => '?').join(',')})`, nodeIds)
      : []

    // 获取所有节点的费用记录
    const expenses = nodeIds.length > 0
      ? query(`SELECT * FROM expense_records WHERE node_id IN (${nodeIds.map(() => '?').join(',')})`, nodeIds)
      : []

    // 获取所有节点的备忘录
    const memos = nodeIds.length > 0
      ? query(`SELECT * FROM memos WHERE node_id IN (${nodeIds.map(() => '?').join(',')})`, nodeIds)
      : []

    // 获取所有节点的附件信息
    const attachments = nodeIds.length > 0
      ? query(`SELECT * FROM attachments WHERE node_id IN (${nodeIds.map(() => '?').join(',')})`, nodeIds)
      : []

    const user = users[0]

    // 如果有伴侣，获取伴侣信息
    let partner = null
    if (user.partner_id) {
      const partnerInfo = query('SELECT id, username, email FROM users WHERE id = ?', [user.partner_id])
      if (partnerInfo.length > 0) {
        partner = {
          id: partnerInfo[0].id,
          username: partnerInfo[0].username,
          email: partnerInfo[0].email
        }
      }
    }

    res.json({
      exportTime: new Date().toISOString(),
      version: '1.0',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        inviteCode: user.invite_code,
        partnerId: user.partner_id,
        partner,
        createdAt: user.created_at,
        lastLogin: user.last_login
      },
      nodes,
      todos,
      expenses,
      memos,
      attachments
    })
  } catch (error) {
    console.error('Export backup error:', error)
    res.status(500).json({ error: '导出备份失败' })
  }
}

// 获取用户信息
export async function getProfile(req: AuthRequest, res: Response) {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: '未授权访问' })
  }

  try {
    const users = query('SELECT id, username, email, invite_code, partner_id, created_at, last_login FROM users WHERE id = ?', [userId])
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' })
    }

    const user = users[0]

    // 如果有伴侣，获取伴侣信息
    let partner = null
    if (user.partner_id) {
      const partnerInfo = query('SELECT id, username, email FROM users WHERE id = ?', [user.partner_id])
      if (partnerInfo.length > 0) {
        partner = {
          id: partnerInfo[0].id,
          username: partnerInfo[0].username,
          email: partnerInfo[0].email
        }
      }
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      inviteCode: user.invite_code,
      partnerId: user.partner_id,
      partner,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      isAdmin: isAdminUsername(user.username),
    })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ error: '获取用户信息失败' })
  }
}
