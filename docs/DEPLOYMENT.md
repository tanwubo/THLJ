# 婚嫁管理系统部署指南

## Docker 一键部署（推荐）

### 前置要求
- Docker >= 20.10
- Docker Compose >= 2.0

### 部署步骤

```bash
# 1. 克隆项目
git clone <repo-url>
cd wedding-manager

# 2. 配置环境变量（可选）
cp .env.example .env
# 编辑 .env 设置 JWT_SECRET

# 3. 一键启动
docker-compose up -d

# 4. 查看状态
docker-compose ps
```

访问 http://localhost 即可使用。

### 常用命令

```bash
# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 重新构建（代码更新后）
docker-compose up -d --build
```

---

## 手动部署

### 服务器要求
- Node.js >= 18
- 端口: 3001 (后端), 80 (前端)

### 后端部署

```bash
cd backend
npm install --production
npm run build

export JWT_SECRET="your-secret-key"
export NODE_ENV="production"
export PORT=3001

npm start
```

### 前端部署

```bash
cd frontend
npm install
npm run build
```

构建产物在 `frontend/dist/`，可部署到 Nginx/Apache。

### Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

---

## PM2 管理

```bash
npm install -g pm2

cd backend
pm2 start npm --name "wedding-api" -- start
pm2 save
pm2 startup
```

---

## 数据备份

- 数据库文件: `backend/data/wedding.db`
- 建议定期备份，或使用 Settings 页面的导出功能
