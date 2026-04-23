/**
 * 用户数据清理脚本
 * 用法: npx ts-node scripts/cleanUserData.ts <username>
 * 示例: npx ts-node scripts/cleanUserData.ts zhangsan
 */

import { query, run, db } from '../src/db';

async function cleanUserData(username: string) {
  console.log(`正在清理用户 "${username}" 的数据...\n`);

  // 查询用户
  const users = query('SELECT * FROM users WHERE username = ?', [username]);
  if (users.length === 0) {
    console.error(`错误: 用户 "${username}" 不存在`);
    process.exit(1);
  }

  const user = users[0];
  console.log(`找到用户: ID=${user.id}, username=${user.username}, partner_id=${user.partner_id}`);

  // 如果用户有伴侣，先解绑
  if (user.partner_id) {
    console.log(`\n解绑伴侣关系 (partner_id=${user.partner_id})...`);
    await run('UPDATE users SET partner_id = NULL WHERE id = ?', [user.id]);
    await run('UPDATE users SET partner_id = NULL WHERE id = ?', [user.partner_id]);
    console.log('伴侣已解绑');
  }

  // 获取该用户的所有节点
  const nodes = query('SELECT id FROM timeline_nodes WHERE user_id = ?', [user.id]);
  const nodeIds = nodes.map((n: any) => n.id);
  console.log(`\n找到 ${nodes.length} 个节点`);

  // 清理顺序: 先删子表，再删父表
  console.log('\n开始清理数据...');

  // 1. 清理操作日志
  const logResult = await run('DELETE FROM operation_logs WHERE user_id = ?', [user.id]);
  console.log(`  - operation_logs: 删除 ${logResult.changes} 条记录`);

  // 2. 清理附件 (依赖 node_id, user_id, todo_id)
  if (nodeIds.length > 0) {
    const attResult = await run(
      `DELETE FROM attachments WHERE node_id IN (${nodeIds.map(() => '?').join(',')}) OR user_id = ?`,
      [...nodeIds, user.id]
    );
    console.log(`  - attachments: 删除 ${attResult.changes} 条记录`);
  } else {
    const attResult = await run('DELETE FROM attachments WHERE user_id = ?', [user.id]);
    console.log(`  - attachments: 删除 ${attResult.changes} 条记录`);
  }

  // 3. 清理费用记录 (依赖 node_id, user_id, todo_id)
  if (nodeIds.length > 0) {
    const expResult = await run(
      `DELETE FROM expense_records WHERE node_id IN (${nodeIds.map(() => '?').join(',')}) OR user_id = ?`,
      [...nodeIds, user.id]
    );
    console.log(`  - expense_records: 删除 ${expResult.changes} 条记录`);
  } else {
    const expResult = await run('DELETE FROM expense_records WHERE user_id = ?', [user.id]);
    console.log(`  - expense_records: 删除 ${expResult.changes} 条记录`);
  }

  // 4. 清理备忘录
  if (nodeIds.length > 0) {
    const memoResult = await run(
      `DELETE FROM memos WHERE node_id IN (${nodeIds.map(() => '?').join(',')}) OR user_id = ?`,
      [...nodeIds, user.id]
    );
    console.log(`  - memos: 删除 ${memoResult.changes} 条记录`);
  } else {
    const memoResult = await run('DELETE FROM memos WHERE user_id = ?', [user.id]);
    console.log(`  - memos: 删除 ${memoResult.changes} 条记录`);
  }

  // 5. 清理待办事项 (依赖 node_id, user_id, assignee_id)
  const todoResult = await run('DELETE FROM todo_items WHERE user_id = ?', [user.id]);
  console.log(`  - todo_items: 删除 ${todoResult.changes} 条记录`);

  // 6. 清理时间线节点 (依赖 user_id)
  const nodeResult = await run('DELETE FROM timeline_nodes WHERE user_id = ?', [user.id]);
  console.log(`  - timeline_nodes: 删除 ${nodeResult.changes} 条记录`);

  // 7. 清理用户
  const userResult = await run('DELETE FROM users WHERE id = ?', [user.id]);
  console.log(`  - users: 删除 ${userResult.changes} 条记录`);

  console.log('\n========================================');
  console.log('清理完成!');
  console.log(`用户 "${username}" (ID: ${user.id}) 的全部数据已删除`);
  console.log('========================================');
}

// 主入口
const username = process.argv[2];
if (!username) {
  console.error('用法: npx ts-node scripts/cleanUserData.ts <username>');
  console.error('示例: npx ts-node scripts/cleanUserData.ts zhangsan');
  process.exit(1);
}

cleanUserData(username)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('清理失败:', err);
    process.exit(1);
  });
