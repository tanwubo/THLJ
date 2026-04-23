# Docker Compose 服务器部署教程

这份教程按“照着复制命令执行”的方式写，适合在一台 Linux 服务器上部署本项目。

## 1. 部署前准备

### 1.1 服务器要求

- 操作系统：Ubuntu / Debian / CentOS 等常见 Linux 发行版。
- 已安装 Docker 和 Docker Compose v2。
- 开放端口：`80`。
- 项目数据目录：数据库在 `backend/data/wedding.db`，上传附件在 `backend/public/uploads/`。

如果服务器还没安装 Docker，可参考 Docker 官方安装文档；安装后确认命令可用：

```bash
docker --version
docker compose version
```

### 1.2 域名或 IP

下面用两个占位符，请替换成自己的真实值：

- `<repo-url>`：你的 Git 仓库地址。
- `<server-origin>`：浏览器访问地址，例如 `http://1.2.3.4` 或 `https://example.com`。

如果只用服务器 IP 且没有 HTTPS，`<server-origin>` 就写 `http://你的服务器IP`。

## 2. 首次部署

### 第 1 步：登录服务器

```bash
ssh root@你的服务器IP
```

### 第 2 步：安装或进入部署目录

推荐放在 `/opt`：

```bash
cd /opt
git clone <repo-url> wedding-manager
cd wedding-manager
```

如果代码已经在服务器上，直接进入项目目录：

```bash
cd /opt/wedding-manager
```

### 第 3 步：创建生产环境变量文件

```bash
cp .env.example .env
nano .env
```

把 `.env` 改成类似下面这样：

```env
JWT_SECRET=换成一串足够长的随机字符串
CORS_ORIGINS=<server-origin>
ADMIN_USERNAMES=
```

生成随机 `JWT_SECRET` 可以用：

```bash
openssl rand -hex 32
```

如果有多个访问地址，用英文逗号分隔：

```env
CORS_ORIGINS=http://1.2.3.4,https://example.com
```

### 第 4 步：创建持久化目录

```bash
mkdir -p backend/data backend/public/uploads
```

### 第 5 步：构建并启动

```bash
docker compose up -d --build
```

首次构建会下载 Node/Nginx 镜像并安装依赖，可能需要几分钟。

### 第 6 步：确认服务状态

```bash
docker compose ps
```

正常情况下应看到 `wedding-api` 和 `wedding-frontend` 都是 `running` 或 `healthy`。

查看日志：

```bash
docker compose logs -f
```

只看后端日志：

```bash
docker compose logs -f backend
```

只看前端 Nginx 日志：

```bash
docker compose logs -f frontend
```

### 第 7 步：访问系统

打开浏览器访问：

```text
<server-origin>
```

如果部署在服务器 IP 上，例如：

```text
http://1.2.3.4
```

## 3. 后续更新部署

每次代码更新后，在服务器项目目录执行：

```bash
cd /opt/wedding-manager
git pull
docker compose up -d --build
```

确认状态：

```bash
docker compose ps
docker compose logs -f
```

如果只想看最近日志：

```bash
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
```

更新部署不会删除数据库和上传附件，因为它们挂载在宿主机目录：

- `backend/data/`
- `backend/public/uploads/`

## 4. 常用运维命令

停止服务：

```bash
docker compose down
```

启动服务：

```bash
docker compose up -d
```

重启服务：

```bash
docker compose restart
```

重新构建并启动：

```bash
docker compose up -d --build
```

查看容器资源占用：

```bash
docker stats
```

进入后端容器：

```bash
docker compose exec backend sh
```

进入前端容器：

```bash
docker compose exec frontend sh
```

## 5. 数据备份与恢复

### 5.1 备份

建议先暂停写入或在访问低峰期执行：

```bash
cd /opt/wedding-manager
mkdir -p backups
tar -czf backups/wedding-backup-$(date +%F-%H%M%S).tar.gz backend/data backend/public/uploads .env
```

### 5.2 恢复

先停止服务：

```bash
cd /opt/wedding-manager
docker compose down
```

解压备份：

```bash
tar -xzf backups/你的备份文件.tar.gz
```

再启动：

```bash
docker compose up -d
```

## 6. 常见问题

### 6.1 提示 JWT_SECRET is required

说明还没有创建 `.env`，或 `.env` 里没有 `JWT_SECRET`。

执行：

```bash
cp .env.example .env
nano .env
```

填好 `JWT_SECRET` 后重新启动：

```bash
docker compose up -d
```

### 6.2 页面能打开，但登录或接口请求失败

先看后端日志：

```bash
docker compose logs --tail=100 backend
```

确认 `.env` 里的 `CORS_ORIGINS` 和浏览器地址一致。示例：

```env
CORS_ORIGINS=http://1.2.3.4
```

修改后重启：

```bash
docker compose up -d
```

### 6.3 80 端口被占用

查看占用：

```bash
sudo lsof -i :80
```

如果服务器已有 Nginx，占用 80 端口，可以把 `docker-compose.yml` 中前端端口改成：

```yaml
ports:
  - "8080:80"
```

然后访问：

```text
http://你的服务器IP:8080
```

同时 `.env` 里的 `CORS_ORIGINS` 也要写带端口的地址：

```env
CORS_ORIGINS=http://你的服务器IP:8080
```

### 6.4 上传的附件更新后不见了

检查宿主机目录是否存在：

```bash
ls -lah backend/public/uploads
```

本项目已经把附件目录挂载到宿主机。不要手动删除 `backend/public/uploads/`。

### 6.5 数据库更新后不见了

检查数据库文件：

```bash
ls -lah backend/data
```

不要删除 `backend/data/wedding.db`。更新部署使用 `docker compose up -d --build`，不要为了更新而删除 `backend/data/`。

## 7. 当前 Docker 配置说明

- `frontend` 容器对外暴露 `80` 端口，负责静态页面和 `/api`、`/socket.io` 反向代理。
- `backend` 容器只在 Docker 内部网络暴露 `3001`，不会直接暴露到公网。
- `backend/data` 挂载到 `/app/data`，保存 SQLite 数据库。
- `backend/public/uploads` 挂载到 `/app/public/uploads`，保存上传附件。
- `.env` 中的 `JWT_SECRET` 是必填项，生产环境必须改成随机长字符串。
- `.env` 中的 `CORS_ORIGINS` 应填写浏览器实际访问地址。
