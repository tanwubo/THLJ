# 婚嫁管理系统部署指南

## 服务器要求

- Node.js >= 18
- 内存 >= 1GB
- 端口: 3001 (后端API), 5173 (前端)

## 部署步骤

### 1. 后端部署

```bash
# 进入后端目录
cd backend

# 安装生产依赖
npm install --production

# 构建
npm run build

# 设置环境变量
export JWT_SECRET="your-production-secret-key"
export NODE_ENV="production"
export PORT=3001

# 启动
npm start
```

### 2. 前端部署

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 构建生产版本
npm run build
```

构建产物在 `frontend/dist/`，可部署到 Nginx/Apache 或静态托管服务。

### 3. Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    # Socket.IO 代理
    location /socket.io {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

### 4. 使用 PM2 管理进程

```bash
# 全局安装 PM2
npm install -g pm2

# 启动后端
cd backend
pm2 start npm --name "wedding-api" -- start

# 查看状态
pm2 status

# 开机自启
pm2 save
pm2 startup
```

### 5. 数据备份

数据库文件位置: `backend/data/wedding.db`

建议定期备份，或使用 `Settings` 页面的导出功能。
