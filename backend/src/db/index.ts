import initSqlJs, { Database } from 'sql.js';
import fs from 'fs/promises';
import path from 'path';

const dbPath = path.join(__dirname, '../../data/wedding.db');
let db: Database;

// 初始化数据库
export async function initDB(): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: file => `node_modules/sql.js/dist/${file}`
  });

  try {
    // 尝试读取现有数据库文件
    const fileBuffer = await fs.readFile(dbPath);
    db = new SQL.Database(fileBuffer);
  } catch (error) {
    // 文件不存在，创建新数据库
    db = new SQL.Database();
    await saveDB();
  }
}

// 保存数据库到磁盘
async function saveDB(): Promise<void> {
  const data = db.export();
  const buffer = Buffer.from(data);
  await fs.writeFile(dbPath, buffer);
}

// 查询操作
export function query(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// 执行写入操作
export async function run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  const lastInsertRowid = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
  const changes = db.getRowsModified();
  stmt.free();
  await saveDB(); // 写入后保存到磁盘
  return {
    lastInsertRowid,
    changes
  };
}

// 执行多条SQL语句（用于初始化）
export async function exec(sql: string): Promise<void> {
  db.exec(sql);
  await saveDB();
}

export { db };

// 别名导出，保持向后兼容
export const dbQuery = query;
export const dbRun = run;

