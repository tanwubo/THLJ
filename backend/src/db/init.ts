import { initDB, exec, db } from './index';

type SchemaAdapter = {
  exec: (sql: string) => any[];
  run: (sql: string) => unknown | Promise<unknown>;
};

const ensureColumn = async (adapter: SchemaAdapter, table: string, column: string, ddl: string) => {
  const columns = adapter.exec(`PRAGMA table_info(${table})`);
  const hasColumn = columns[0]?.values.some((row: any[]) => row[1] === column);
  if (!hasColumn) {
    await adapter.run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
};

const expenseRecordsTableSql = `
    CREATE TABLE IF NOT EXISTS expense_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id INTEGER NOT NULL,
      todo_id INTEGER,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (node_id) REFERENCES timeline_nodes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;

const attachmentsTableSql = `
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id INTEGER NOT NULL,
      todo_id INTEGER,
      user_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (node_id) REFERENCES timeline_nodes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;

const expenseRecordsTodoIndexSql = 'CREATE INDEX IF NOT EXISTS idx_expense_records_todo_id ON expense_records(todo_id)';
const attachmentsTodoIndexSql = 'CREATE INDEX IF NOT EXISTS idx_attachments_todo_id ON attachments(todo_id)';

export async function applyWorkbenchSchema(adapter: SchemaAdapter) {
  // 用户表
  await adapter.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      invite_code TEXT UNIQUE NOT NULL,
      partner_id INTEGER,
      is_activated BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      FOREIGN KEY (partner_id) REFERENCES users(id)
    )
  `);

  // 时间线节点表
  await adapter.run(`
    CREATE TABLE IF NOT EXISTS timeline_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      "order" INTEGER NOT NULL,
      deadline DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 待办事项表
  await adapter.run(`
    CREATE TABLE IF NOT EXISTS todo_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      assignee_id INTEGER,
      deadline DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (node_id) REFERENCES timeline_nodes(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (assignee_id) REFERENCES users(id)
    )
  `);

  // 费用记录表
  await adapter.run(expenseRecordsTableSql);

  // 备忘录表
  await adapter.run(`
    CREATE TABLE IF NOT EXISTS memos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (node_id) REFERENCES timeline_nodes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 附件表
  await adapter.run(attachmentsTableSql);

  await ensureColumn(adapter, 'expense_records', 'todo_id', 'todo_id INTEGER');
  await ensureColumn(adapter, 'attachments', 'todo_id', 'todo_id INTEGER');
  await ensureColumn(adapter, 'users', 'data_owner_id', 'data_owner_id INTEGER');
  await adapter.run('UPDATE users SET data_owner_id = id WHERE data_owner_id IS NULL');
  await adapter.run(expenseRecordsTodoIndexSql);
  await adapter.run(attachmentsTodoIndexSql);

  // 操作日志表
  await adapter.run(`
    CREATE TABLE IF NOT EXISTS timeline_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await adapter.run(`
    CREATE TABLE IF NOT EXISTS timeline_template_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      "order" INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES timeline_templates(id)
    )
  `);

  await adapter.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      operation_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

async function initDatabase() {
  await initDB();
  await applyWorkbenchSchema({
    exec: sql => db.exec(sql),
    run: sql => exec(sql),
  });

  console.log('Database initialized successfully');
  process.exit(0);
}

if (require.main === module) {
  initDatabase().catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
}

