import { Response } from 'express';
import { query, run } from '../db';
import { AuthRequest } from '../middleware/auth';

// 预设费用分类
export const EXPENSE_CATEGORIES = {
  income: ['彩礼', '礼金', '嫁妆回礼', '其他收入'],
  expense: ['婚宴', '婚庆', '婚车', '婚纱摄影', '三金/五金', '酒店预订', '婚车车队', '蜜月旅行', '其他支出']
};

function parseExpenseType(input: unknown): { value?: 'income' | 'expense'; error?: string } {
  if (input !== 'income' && input !== 'expense') {
    return { error: 'type 必须是 income 或 expense' };
  }

  return { value: input };
}

function parseExpenseAmount(input: unknown): { value?: number; error?: string } {
  if (input === undefined || input === null || input === '') {
    return { error: 'amount 必须是大于 0 的数字' };
  }

  let value: number;
  if (typeof input === 'number') {
    value = input;
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
      return { error: 'amount 必须是大于 0 的数字' };
    }
    value = Number(trimmed);
  } else {
    return { error: 'amount 必须是大于 0 的数字' };
  }

  if (!Number.isFinite(value) || value <= 0) {
    return { error: 'amount 必须是大于 0 的数字' };
  }

  return { value };
}

function parseExpenseCategory(input: unknown, type: 'income' | 'expense'): { value?: string; error?: string } {
  if (input === undefined) {
    return { value: type === 'income' ? '其他收入' : '其他支出' };
  }

  if (typeof input !== 'string' || !input.trim()) {
    return { error: 'category 不能为空' };
  }

  return { value: input.trim() };
}

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

export const getExpenses = async (req: AuthRequest, res: Response) => {
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
    const dataOwnerId = req.user?.dataOwnerId ?? userId;
    const body = req.body ?? {};
    const querySource = req.query ?? {};
    const todoCheck = parseTodoId(body.todoId ?? querySource.todoId);
    const { type, amount, category, description } = body;

    if (todoCheck.error) {
      return res.status(400).json({ error: todoCheck.error });
    }

    const typeCheck = parseExpenseType(type);
    if (typeCheck.error) {
      return res.status(400).json({ error: typeCheck.error });
    }

    const amountCheck = parseExpenseAmount(amount);
    if (amountCheck.error) {
      return res.status(400).json({ error: amountCheck.error });
    }

    const categoryCheck = parseExpenseCategory(category, typeCheck.value!);
    if (categoryCheck.error) {
      return res.status(400).json({ error: categoryCheck.error });
    }

    const todo = query(
      'SELECT t.* FROM todo_items t JOIN timeline_nodes n ON t.node_id = n.id WHERE t.id = ? AND n.user_id = ?',
      [todoCheck.todoId, dataOwnerId]
    );
    if (todo.length === 0) {
      return res.status(404).json({ error: '待办不存在' });
    }

    const result = await run(
      'INSERT INTO expense_records (node_id, todo_id, user_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [todo[0].node_id, todo[0].id, userId, typeCheck.value, amountCheck.value, categoryCheck.value, description || null]
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
    const dataOwnerId = req.user?.dataOwnerId ?? userId;
    const { id } = req.params;
    const { type, amount, category, description } = req.body;

    const expense = query('SELECT * FROM expense_records e JOIN timeline_nodes n ON e.node_id = n.id WHERE e.id = ? AND n.user_id = ?', [id, dataOwnerId]);
    if (expense.length === 0) {
      return res.status(404).json({ error: '费用不存在' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (type !== undefined) {
      const typeCheck = parseExpenseType(type);
      if (typeCheck.error) {
        return res.status(400).json({ error: typeCheck.error });
      }
      updates.push('type = ?');
      values.push(typeCheck.value);
    }
    if (amount !== undefined) {
      const amountCheck = parseExpenseAmount(amount);
      if (amountCheck.error) {
        return res.status(400).json({ error: amountCheck.error });
      }
      updates.push('amount = ?');
      values.push(amountCheck.value);
    }
    if (category !== undefined) {
      const categoryCheck = parseExpenseCategory(category, (type as 'income' | 'expense') || expense[0].type);
      if (categoryCheck.error) {
        return res.status(400).json({ error: categoryCheck.error });
      }
      updates.push('category = ?');
      values.push(categoryCheck.value);
    }
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
    const dataOwnerId = req.user?.dataOwnerId ?? userId;
    const { id } = req.params;

    const expense = query('SELECT * FROM expense_records e JOIN timeline_nodes n ON e.node_id = n.id WHERE e.id = ? AND n.user_id = ?', [id, dataOwnerId]);
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
