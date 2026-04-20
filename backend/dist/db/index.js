"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.initDB = initDB;
exports.query = query;
exports.run = run;
exports.exec = exec;
const sql_js_1 = __importDefault(require("sql.js"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const dbPath = path_1.default.join(__dirname, '../../data/wedding.db');
let db;
// 初始化数据库
async function initDB() {
    const SQL = await (0, sql_js_1.default)({
        locateFile: file => `node_modules/sql.js/dist/${file}`
    });
    try {
        // 尝试读取现有数据库文件
        const fileBuffer = await promises_1.default.readFile(dbPath);
        exports.db = db = new SQL.Database(fileBuffer);
    }
    catch (error) {
        // 文件不存在，创建新数据库
        exports.db = db = new SQL.Database();
        await saveDB();
    }
}
// 保存数据库到磁盘
async function saveDB() {
    const data = db.export();
    const buffer = Buffer.from(data);
    await promises_1.default.writeFile(dbPath, buffer);
}
// 查询操作
function query(sql, params = []) {
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
async function run(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    const lastInsertRowid = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    const changes = db.getRowsModified();
    stmt.free();
    await saveDB(); // 写入后保存到磁盘
    return {
        lastInsertRowid,
        changes
    };
}
// 执行多条SQL语句（用于初始化）
async function exec(sql) {
    db.exec(sql);
    await saveDB();
}
