import { Response } from 'express';
import { query, run } from '../db';
import { AuthRequest } from '../middleware/auth';

// 预设费用分类
export const EXPENSE_CATEGORIES = {
  income: ['彩礼', '礼金', '嫁妆回礼', '其他收入'],
  expense: ['婚宴', '婚庆', '婚车', '婚纱摄影', '三金/五金', '酒店预订', '婚车车队', '蜜月旅行', '其他支出']
};

export const getExpenses = async (req: AuthRequest, res: Response) => {
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

    const expenses = query(
      'SELECT e.*, u.username as creator_name FROM expense_records e LEFT JOIN users u ON e.user_id = u.id WHERE e.node_id = ? ORDER BY e.created_at DESC',
      [nodeId]
    );

    // 计算统计
    const totalIncome = expenses.filter((e: any) => e.type === 'income').reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);
    const totalExpense = expenses.filter((e: any) => e.type === 'expense').reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);

    res.json({
      expenses,
      stats: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense
      },
      categories: EXPENSE_CATEGORIES
    });
  } catch (error: any) {
    console.error('获取费用失败:', error);
    res.status(500).json({ error: '获取费用失败' });
  }
};

export const createExpense = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { nodeId, type, amount, category, description } = req.body;

    if (!nodeId || !type || !amount || !category) {
      return res.status(400).json({ error: 'nodeId, type, amount, category are required' });
    }

    const node = query('SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?', [nodeId, userId]);
    if (node.length === 0) {
      return res.status(404).json({ error: '节点不存在' });
    }

    const result = await run(
      'INSERT INTO expense_records (node_id, user_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
      [nodeId, userId, type, amount, category, description || null]
    );

    const expense = query('SELECT * FROM expense_records WHERE id = ?', [result.lastInsertRowid]);
    res.json(expense[0]);
  } catch (error: any) {
    console.error('创建费用失败:', error);
    res.status(500).json({ error: '创建费用失败' });
  }
};

export const updateExpense = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { type, amount, category, description } = req.body;

    const expense = query('SELECT * FROM expense_records e JOIN timeline_nodes n ON e.node_id = n.id WHERE e.id = ? AND n.user_id = ?', [id, userId]);
    if (expense.length === 0) {
      return res.status(404).json({ error: '费用不存在' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (amount !== undefined) { updates.push('amount = ?'); values.push(amount); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      await run(`UPDATE expense_records SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const updated = query('SELECT * FROM expense_records WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error: any) {
    console.error('更新费用失败:', error);
    res.status(500).json({ error: '更新费用失败' });
  }
};

export const deleteExpense = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const expense = query('SELECT * FROM expense_records e JOIN timeline_nodes n ON e.node_id = n.id WHERE e.id = ? AND n.user_id = ?', [id, userId]);
    if (expense.length === 0) {
      return res.status(404).json({ error: '费用不存在' });
    }

    await run('DELETE FROM expense_records WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('删除费用失败:', error);
    res.status(500).json({ error: '删除费用失败' });
  }
};
