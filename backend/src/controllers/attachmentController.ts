import { Response } from 'express';
import { query, run } from '../db';
import { AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs/promises';

const UPLOAD_DIR = path.join(__dirname, '../../../public/uploads');

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
    const { nodeId } = req.query;

    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    const node = query('SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?', [nodeId, userId]);
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
    const { nodeId } = req.body;
    const file = (req as any).file;

    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const node = query('SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?', [nodeId, userId]);
    if (node.length === 0) {
      return res.status(404).json({ error: '节点不存在' });
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: '文件大小不能超过10MB' });
    }

    await ensureUploadDir();

    const fileName = `${Date.now()}-${file.originalname}`;
    const targetPath = path.join(UPLOAD_DIR, fileName);

    // 将临时文件移动到目标位置
    await fs.rename(file.path, targetPath);

    const filePath = `/uploads/${fileName}`;
    const result = await run(
      'INSERT INTO attachments (node_id, user_id, file_name, file_path, file_size, file_type) VALUES (?, ?, ?, ?, ?, ?)',
      [nodeId, userId, file.originalname, filePath, file.size, file.mimetype]
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
    const { id } = req.params;

    const attachment = query('SELECT * FROM attachments a JOIN timeline_nodes n ON a.node_id = n.id WHERE a.id = ? AND n.user_id = ?', [id, userId]);
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
