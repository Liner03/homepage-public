# 🏠 个人主页项目

## 🌐 在线演示
**我的站点：** _[待部署]_
**原作者演示：** [https://edxx.de](https://edxx.de)

## 👨‍💻 项目信息
**原作者：** [阿布白（IonRh）](https://github.com/IonRh)
**原项目地址：** [https://github.com/IonRh/homepage-public](https://github.com/IonRh/homepage-public)

**二开作者：** [zduu](https://github.com/zduu)
**二开项目地址：** [https://github.com/zduu/homepage-public](https://github.com/zduu/homepage-public)

> 🚀 使用原生 HTML、CSS、JS 构建，未依赖任何框架或插件，保证轻量高效。

## ✨ 项目功能

- 🎨 **简洁美观** - 提供清爽的主页展示界面
- 📱 **响应式设计** - 完美适配手机、平板、桌面等各种设备
- ⚡ **极速加载** - 优化性能，提升用户浏览体验
- 📊 **GitHub 统计** - 通过第三方 API 获取完整的 GitHub 贡献数据（无需 Token）
- 🌍 **访客信息** - 显示访客 IP 地址和地理位置
- ⚙️ **配置驱动** - 通过可视化后台管理所有配置，无需手动编辑文件
- 🧭 **访问统计** - 展示今日/累计访问次数（支持 JSON/SQLite/Cloudflare KV）
- 🔧 **模块化设计** - 第三个标签页支持多种类型：日记统计（支持 RSS）、项目展示、自定义内容，或完全禁用
- 🎯 **个性化** - 支持自定义标签、项目、技能展示
- 🛠️ **可视化管理** - 内置管理后台，零门槛配置
- 📝 **日记统计** - 支持 RSS 订阅源统计，自动计算写作天数和连续记录
- 💎 **图标系统** - 使用 Heroicons，提供丰富的 SVG 图标库

## 🎯 部署方式

### ⚠️ 重要提示

本项目**必须使用 Node.js 后端**，不支持纯静态部署。

**为什么？**
- GitHub 贡献日历需要后端代理第三方 API（避免 CORS）
- 日记统计需要后端解析 RSS 订阅源
- 管理后台需要后端提供 API 接口
- 前端配置、主题色等功能都依赖后端存储

### 支持的部署方式

✅ **Node.js 后端部署**（唯一支持的方式）
- VPS / 云主机（Ubuntu、CentOS 等）
- Docker 容器部署
- 任何支持 Node.js 的服务器

❌ **不支持的部署方式**
- 纯静态部署（GitHub Pages、Netlify、Vercel 等）
- Cloudflare Pages（除非手动补全所有 Functions）

## 🚀 快速开始

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/Liner03/homepage-public.git
cd homepage-public

# 2. 创建前端配置文件
cp config.example.js config.js
# 编辑 config.js，修改 github.username

# 3. 配置并启动后端
cd backend
npm install
cp .env.example .env

# 4. 编辑 .env 文件
# - 修改管理员账号密码（重要！）
# - 选择存储方式：json（默认）| sqlite | cloudflare

# 5. 启动服务
npm start

# 6. 访问
# 前端：http://localhost:3000
# 后台：http://localhost:3000/admin/login
```

### 生产环境部署

#### 方式一：使用 PM2（推荐）

```bash
# 在服务器上克隆项目
git clone https://github.com/Liner03/homepage-public.git
cd homepage-public

# 配置前端
cp config.example.js config.js
# 编辑 config.js

# 配置后端
cd backend
npm install --production
cp .env.example .env
nano .env  # 修改配置

# 安装并使用 PM2
npm install -g pm2
pm2 start server.js --name homepage
pm2 save
pm2 startup  # 设置开机自启
```

#### 方式二：使用 Docker

```bash
# 在项目根目录执行
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 停止服务
docker-compose down
```

#### Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/homepage-public;
        try_files $uri $uri/ /index.html;
    }

    # API 代理到后端
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 管理后台
    location /admin/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🛠️ 配置说明

### 环境变量配置（`.env` 文件）

编辑 `backend/.env`：

```bash
# 服务器配置
PORT=3000
NODE_ENV=development

# 访问统计存储方式：json | sqlite | cloudflare
VISIT_STORAGE=json

# 管理后台账号配置（⚠️ 重要：请修改默认密码！）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_this_password_123
SESSION_SECRET=change_this_secret_key_random_string

# 数据存储路径
DATA_DIR=./data
```

### 存储方式选择

| 存储方式 | 适用场景 | 性能 | 配置难度 |
|---------|---------|------|---------|
| **JSON** | 个人站点、低流量（< 1000 PV/天） | ⭐⭐⭐ | ✅ 极简 |
| **SQLite** | 生产环境、中高流量（> 1000 PV/天） | ⭐⭐⭐⭐⭐ | ✅ 简单 |
| **Cloudflare KV** | 全球分布、高可用 | ⭐⭐⭐⭐ | ⚠️ 需要账号 |

**推荐配置：**
- 个人主页：`VISIT_STORAGE=json`（默认）
- 生产环境：`VISIT_STORAGE=sqlite`

## 🛠️ 管理后台

### 访问后台

```
http://localhost:3000/admin/login
```

### 默认账号

```
用户名：admin
密码：change_this_password_123
```

⚠️ **安全提示**：首次部署后请立即修改默认密码！

### 后台功能

后台提供完整的可视化配置界面，**无需手动编辑任何配置文件**：

| 功能模块 | 说明 |
|---------|------|
| 📊 **仪表板** | 查看访问统计、签到用户、系统信息 |
| ⚙️ **前端配置** | 修改个人信息、社交链接、项目、技能等（替代手动编辑 `config.js`） |
| 🌐 **语言配置** | 自定义所有文本内容（支持多语言） |
| 📝 **日记配置** | 配置日记 RSS 订阅源、自定义模块 |
| 🎨 **栏目管理** | 新增、删除、隐藏栏目 |

### 功能特点

- ✅ **零门槛配置** - 点击即可修改，无需懂代码
- ✅ **实时保存** - 修改后自动保存到 `backend/data/data.json`
- ✅ **数据持久化** - 所有配置永久保存
- ✅ **安全认证** - 基于 session 的身份验证

## 📝 日记统计功能

### 功能特性

- 📊 **RSS 统计** - 自动读取 RSS 订阅源，统计文章数量
- 📅 **写作天数** - 自动计算从第一篇到最新的天数
- 🔥 **连续记录** - 统计最长连续写作天数
- 🎨 **自定义模块** - 支持添加自定义统计项

### 配置方式

**推荐：使用管理后台配置**

1. 访问 `/admin/diary-config`
2. 填写 RSS 订阅地址（如：`https://your-blog.com/feed.xml`）
3. 选择认证方式（可选）
4. 保存配置

**可选：手动编辑配置文件**

编辑 `modules/custom-section-config.js`：

```javascript
const CUSTOM_SECTION_CONFIG = {
    enabled: true,
    type: 'diary',  // diary | projects | custom | disabled
    title: '日记',
    icon: 'fas fa-book',
    config: {
        endpoint: "https://your-blog.com/feed.xml",
        authType: "x-api-key",  // 可选
        apiKey: ""  // 可选
    }
};
```

### 支持的栏目类型

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| **diary** | 日记统计（支持 RSS） | 个人博客、写作记录 |
| **projects** | 项目展示 | GitHub 项目集合 |
| **custom** | 自定义内容 | 任意 HTML + JS |
| **disabled** | 完全禁用 | 只需两个标签页 |

## 💎 图标系统

本项目使用 **Heroicons** 作为图标库，提供丰富的 SVG 图标。

### 推荐资源

- **头像图片**：[Gravatar](https://gravatar.com/) 或 [GitHub 头像](https://github.com/username.png)
- **项目图标**：[Heroicons](https://heroicons.com/)
- **技能图标**：[DevIcons](https://devicons.github.io/devicon/) 或 [Simple Icons](https://simpleicons.org/)

## 📊 GitHub 贡献日历

### 数据来源

本项目使用**第三方 API** 获取完整的 GitHub 贡献数据，**无需配置 GITHUB_TOKEN**。

**API 地址：** `https://gh-calendar.rschristian.dev/user/{username}`

### 优势

- ✅ **无需 Token** - 完全公开访问，零配置
- ✅ **完整数据** - 包含组织私有仓库的贡献（与 GitHub Profile 一致）
- ✅ **后端代理** - 避免 CORS 问题
- ✅ **自动缓存** - 减少 API 调用，提升性能

### 技术实现

前端调用后端代理：
```
前端 → /api/github/contributions-third-party
     → 后端代理 → https://gh-calendar.rschristian.dev/user/{username}
```

如果第三方 API 失败，页面会显示错误提示，需要检查网络连接。

详见 `GITHUB_API_LIMITATIONS.md` 文档。

## 📈 访问统计功能

### 数据持久化

数据保存在 `backend/data/` 目录：

```
backend/data/
├── data.json          # 前端配置、主题色、签到数据
├── visit-stats.json   # 访问统计（JSON 模式）
└── visit-stats.db     # 访问统计（SQLite 模式）
```

### 数据备份

```bash
# 定期备份 data 目录
tar -czf backup-$(date +%Y%m%d).tar.gz backend/data/
```

## 🔍 部署前检查清单

- [ ] 创建 `config.js` 文件并修改 `github.username`
- [ ] 修改管理后台默认密码（`backend/.env`）
- [ ] 选择合适的存储方式（JSON/SQLite）
- [ ] 配置好服务器环境（Node.js >= 14）
- [ ] 本地测试正常（运行后访问测试）
- [ ] 准备好域名和 SSL 证书（生产环境）

## 📝 注意事项

- ✅ 所有配置都可以通过管理后台修改，无需手动编辑文件
- ✅ GitHub 统计数据为真实 API 数据，无需 Token
- ✅ 支持完全自定义所有页面内容
- ⚠️ **必须使用 Node.js 后端，不支持纯静态部署**
- ⚠️ **请保留原作者信息，遵守开源协议**
- 💡 如遇问题，欢迎提交 [Issue](https://github.com/Liner03/homepage-public/issues)

## 🔧 常见问题

### 1. 为什么不支持纯静态部署？

因为项目依赖后端提供以下关键功能：
- GitHub 贡献日历代理（避免 CORS）
- 日记 RSS 统计
- 管理后台 API
- 前端配置存储

### 2. 可以部署到 Vercel/Netlify 吗？

不建议。虽然这些平台支持 Serverless Functions，但项目的后端架构基于 Express.js，需要完整的 Node.js 运行环境。

### 3. SQLite 安装失败怎么办？

```bash
# 使用预编译版本
npm install --build-from-source=better-sqlite3
```

### 4. 忘记管理员密码怎么办？

编辑 `backend/.env` 文件，修改 `ADMIN_PASSWORD`，重启服务即可。

## 📄 开源协议

本项目基于原作者的开源协议，请遵守相关条款。

## 🙏 致谢

感谢原作者 [阿布白（IonRh）](https://github.com/IonRh) 提供的优秀开源项目。
感谢二开作者 [zduu](https://github.com/zduu) 对项目的持续改进。

---

⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！
