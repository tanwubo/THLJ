import { Response } from 'express';
import { query, run } from '../db';
import { AuthRequest } from '../middleware/auth';

export const getMemo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const dataOwnerId = req.user?.dataOwnerId ?? userId;
    const { nodeId } = req.query;

    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    const node = query('SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?', [nodeId, dataOwnerId]);
    if (node.length === 0) {
      return res.status(404).json({ error: '节点不存在' });
    }

    const memo = query('SELECT * FROM memos WHERE node_id = ? ORDER BY updated_at DESC LIMIT 1', [nodeId]);
    res.json(memo.length > 0 ? memo[0] : null);
  } catch (error: any) {
    console.error('获取备忘录失败:', error);
    res.status(500).json({ error: '获取备忘录失败' });
  }
};

export const saveMemo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const dataOwnerId = req.user?.dataOwnerId ?? userId;
    const { nodeId, content } = req.body;

    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    const node = query('SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?', [nodeId, dataOwnerId]);
    if (node.length === 0) {
      return res.status(404).json({ error: '节点不存在' });
    }

    // 检查是否已存在备忘录
    const existing = query('SELECT * FROM memos WHERE node_id = ?', [nodeId]);

    let result;
    if (existing.length > 0) {
      // 更新现有备忘录
      await run('UPDATE memos SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [content, existing[0].id]);
      result = query('SELECT * FROM memos WHERE id = ?', [existing[0].id]);
    } else {
      // 创建新备忘录
      const runResult = await run('INSERT INTO memos (node_id, user_id, content) VALUES (?, ?, ?)', [nodeId, userId, content]);
      result = query('SELECT * FROM memos WHERE id = ?', [runResult.lastInsertRowid]);
    }

    res.json(result[0]);
  } catch (error: any) {
    console.error('保存备忘录失败:', error);
    res.status(500).json({ error: '保存备忘录失败' });
  }
};
