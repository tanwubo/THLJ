import { Response } from 'express';
import { query, run } from '../db';
import { AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs/promises';

const UPLOAD_DIR = path.join(__dirname, '../../../public/uploads');

function parseTodoId(input: unknown): { todoId?: number; error?: string } {
  if (input === undefined || input === null || input === '') {
    return { error: 'todoId 为必填项' };
  }

  const todoId = Number(input);
  if (!Number.isInteger(todoId) || todoId <= 0) {
    return { error: 'todoId 必须是有效的正整数' };
  }

  return { todoId };
}

// 确保上传目录存在
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export const getAttachments = async (req: AuthRequest, res: Response) => {
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

    const attachments = query(
      'SELECT a.*, u.username as uploader_name FROM attachments a LEFT JOIN users u ON a.user_id = u.id WHERE a.node_id = ? ORDER BY a.created_at DESC',
      [nodeId]
    );

    res.json(attachments);
  } catch (error: any) {
    console.error('获取附件失败:', error);
    res.status(500).json({ error: '获取附件失败' });
  }
};

export const uploadAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const dataOwnerId = req.user?.dataOwnerId ?? userId;
    const body = req.body ?? {};
    const querySource = req.query ?? {};
    const todoCheck = parseTodoId(body.todoId ?? querySource.todoId);
    const file = (req as any).file;

    if (todoCheck.error) {
      return res.status(400).json({ error: todoCheck.error });
    }

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const todo = query(
      'SELECT t.* FROM todo_items t JOIN timeline_nodes n ON t.node_id = n.id WHERE t.id = ? AND n.user_id = ?',
      [todoCheck.todoId, dataOwnerId]
    );
    if (todo.length === 0) {
      return res.status(404).json({ error: '待办不存在' });
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: '文件大小不能超过10MB' });
    }

    await ensureUploadDir();

    const safeOriginalName = path.basename(file.originalname);
    const fileName = `${Date.now()}-${safeOriginalName}`;
    const targetPath = path.join(UPLOAD_DIR, fileName);

    // 将临时文件移动到目标位置
    await fs.rename(file.path, targetPath);

    const filePath = `/uploads/${fileName}`;
    const result = await run(
      'INSERT INTO attachments (node_id, todo_id, user_id, file_name, file_path, file_size, file_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [todo[0].node_id, todo[0].id, userId, file.originalname, filePath, file.size, file.mimetype]
    );

    const attachment = query('SELECT * FROM attachments WHERE id = ?', [result.lastInsertRowid]);
    res.json(attachment[0]);
  } catch (error: any) {
    console.error('上传附件失败:', error);
    res.status(500).json({ error: '上传附件失败' });
  }
};

export const deleteAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const dataOwnerId = req.user?.dataOwnerId ?? userId;
    const { id } = req.params;

    const attachment = query('SELECT * FROM attachments a JOIN timeline_nodes n ON a.node_id = n.id WHERE a.id = ? AND n.user_id = ?', [id, dataOwnerId]);
    if (attachment.length === 0) {
      return res.status(404).json({ error: '附件不存在' });
    }

    // 删除物理文件
    const fullPath = path.join(__dirname, '../../../public', attachment[0].file_path);
    try {
      await fs.unlink(fullPath);
    } catch (e) {
      // 文件可能已不存在，继续删除数据库记录
    }

    await run('DELETE FROM attachments WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('删除附件失败:', error);
    res.status(500).json({ error: '删除附件失败' });
  }
};
