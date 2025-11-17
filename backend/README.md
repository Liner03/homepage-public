# 个人主页后端服务

这是一个轻量级的 Node.js 后端服务，用于替代 Cloudflare KV，支持独立部署。

## ✨ 特性

- 🚀 **轻量级** - 基于 Express.js，简单高效
- 💾 **灵活存储** - 支持三种访问统计存储方式：
  - **JSON** (默认) - 零依赖，适合小规模部署
  - **SQLite** - 更高性能，支持并发
  - **Cloudflare KV** - 兼容原有方案
- 🎨 **完整功能** - 支持主题色、签到、访问统计、GitHub 贡献日历
- 🐳 **Docker 支持** - 一键部署，开箱即用
- 🔒 **IP 去重** - 每日访问自动按 IP 去重

## 📦 快速开始

> ⚠️ **前置条件**：必须先在项目根目录创建 `config.js`（从 `config.example.js` 复制），否则前端页面会报错 `CONFIG is not defined`。

### 方式一：直接运行

```bash
# 第一步：在项目根目录创建前端配置（如果还没有）
cd /path/to/homepage-public
cp config.example.js config.js
# 编辑 config.js，修改你的 GitHub 用户名等个人信息

# 第二步：配置并启动后端
cd backend

# 安装依赖
npm install

# 复制并配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置 GITHUB_TOKEN 等配置

# 启动服务
npm start

# 开发模式（自动重启）
npm run dev
```

### 方式二：Docker 部署

```bash
# 在项目根目录执行
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 停止服务
docker-compose down
```

### 方式三：Docker + Nginx（生产环境）

```bash
# 使用 Nginx 反向代理
docker-compose --profile production up -d

# 访问 http://localhost
```

## ⚙️ 配置说明

编辑 `backend/.env` 文件：

```bash
# 服务器端口
PORT=3000

# 访问统计存储方式: json | sqlite | cloudflare
VISIT_STORAGE=json

# GitHub Token（用于精确贡献日历，可选）
# 获取地址：https://github.com/settings/tokens
# 创建 Fine-grained token，选择"只读公共仓库"权限即可
GITHUB_TOKEN=your_github_token_here

# 数据存储目录
DATA_DIR=./data
```

### 如何获取 GitHub Token

1. 访问 **https://github.com/settings/tokens**
2. 点击 "Generate new token" → 选择 "Fine-grained token"（或 Classic token）
3. 设置权限：
   - **Public repositories (read-only)** - 只读公共仓库（推荐）
   - 如需包含私有贡献，需在 GitHub 个人设置中勾选 "Include private contributions"
4. 复制生成的 Token（格式：`ghp_xxxxx`）
5. 粘贴到 `backend/.env` 文件的 `GITHUB_TOKEN=` 后
6. **重要**：切勿将 `.env` 文件提交到 Git（已在 `.gitignore` 中排除）

### 存储方式选择

| 存储方式 | 适用场景 | 优点 | 缺点 |
|---------|---------|------|------|
| **JSON** | 个人网站、小流量 | 零依赖、易调试 | 大流量下性能较低 |
| **SQLite** | 中等流量、需要持久化 | 高性能、支持并发 | 需要 better-sqlite3 依赖 |
| **Cloudflare KV** | 已有 Cloudflare 部署 | 全球分布、高可用 | 需要 Cloudflare 账号 |

**推荐配置：**
- 个人主页：`VISIT_STORAGE=json`（默认）
- 中等流量：`VISIT_STORAGE=sqlite`
- Cloudflare Pages：`VISIT_STORAGE=cloudflare`（或直接使用 Functions）

## 📡 API 端点

### 1. GitHub 贡献日历
```
GET /api/github/contributions?login=username&from=2024-01-01T00:00:00Z&to=2025-01-01T00:00:00Z
```

### 2. 访问统计
```
# 查询
GET /api/daily-visit?date=2025-01-01

# 记录
POST /api/daily-visit
Body: { "date": "2025-01-01", "timestamp": 1234567890 }
```

### 3. 签到
```
# 查询
GET /api/checkin?uid=user-id

# 保存
POST /api/checkin?uid=user-id
Body: { "day": "2025-01-01" }
```

### 4. 主题色
```
# 查询
GET /api/theme

# 保存
POST /api/theme
Body: { "r": 100, "g": 150, "b": 200, "angle": 210, "saturation": 70, "lightness": 60 }

# 删除
DELETE /api/theme
```

### 5. 健康检查
```
GET /health
```

## 📁 目录结构

```
backend/
├── server.js                 # 主服务器
├── config.js                 # 配置管理
├── package.json              # 依赖管理
├── .env.example              # 环境变量示例
├── Dockerfile                # Docker 镜像
├── storage/                  # 存储适配器
│   ├── json-adapter.js       # JSON 文件存储
│   ├── sqlite-adapter.js     # SQLite 存储
│   ├── cloudflare-adapter.js # Cloudflare KV 存储
│   └── data-storage.js       # 通用数据存储
└── data/                     # 数据目录（持久化）
    ├── data.json             # 主题、签到数据
    ├── visit-stats.json      # 访问统计（JSON 模式）
    └── visit-stats.db        # 访问统计（SQLite 模式）
```

## 🔄 数据持久化

- **Docker 部署**：数据自动挂载到 `./backend/data` 目录
- **直接运行**：数据保存在 `backend/data` 目录
- **迁移数据**：复制 `data` 目录即可

## 🚀 部署到生产环境

### 使用 PM2（推荐）

```bash
npm install -g pm2

cd backend
pm2 start server.js --name homepage-backend
pm2 save
pm2 startup
```

### 使用 systemd

创建 `/etc/systemd/system/homepage-backend.service`：

```ini
[Unit]
Description=Homepage Backend Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/homepage-public/backend
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl enable homepage-backend
sudo systemctl start homepage-backend
```

## 🔧 常见问题

### 1. SQLite 安装失败？
```bash
# 使用预编译版本
npm install --build-from-source=better-sqlite3
```

### 2. 端口被占用？
修改 `.env` 中的 `PORT=3000` 为其他端口。

### 3. 数据丢失？
检查 `data` 目录是否正确挂载，确保有写入权限。

### 4. CORS 错误？
检查 `config.js` 中的 CORS 配置，确保允许前端域名。

## 📝 许可证

MIT License
