# ✨ 添加独立 Node.js 后端支持，无需 Cloudflare KV

## 📋 PR 概述

本 PR 为个人主页项目添加了**独立的 Node.js 后端**支持，让用户可以完全脱离 Cloudflare KV，在自己的服务器上部署完整功能的个人主页。

## 🎯 解决的问题

- ❌ **原有限制**：访问统计、主题同步等功能依赖 Cloudflare KV 存储
- ❌ **部署受限**：必须使用 Cloudflare Pages 才能使用完整功能
- ❌ **数据控制**：无法自主掌控数据存储

## ✨ 新增功能

### 1. 轻量级 Node.js 后端
- 🚀 基于 Express.js，简单高效
- 📦 零框架依赖，代码清晰易维护
- ⚡ 支持所有原有 API 功能

### 2. 灵活的存储方式
支持三种访问统计存储方式，用户可根据需求选择：

| 存储方式 | 适用场景 | 优点 | 配置难度 |
|---------|---------|------|---------|
| **JSON** | 个人站点、低流量 | 零依赖、易调试 | ✅ 极简 |
| **SQLite** | 中等流量、生产环境 | 高性能、支持并发 | ✅ 简单 |
| **Cloudflare KV** | 全球分布、高可用 | 全球 CDN、免费额度 | ⚠️ 需要账号 |

**推荐配置：**
- 个人主页（< 1000 PV/天）：`VISIT_STORAGE=json`（默认）
- 生产环境（> 1000 PV/天）：`VISIT_STORAGE=sqlite`
- 已有 Cloudflare：`VISIT_STORAGE=cloudflare`

### 3. 完整的 API 实现
- ✅ GitHub 贡献日历代理
- ✅ 访问统计（带 IP 去重）
- ✅ 签到功能
- ✅ 主题色同步
- ✅ 健康检查端点

### 4. 生产级部署支持
- 📦 Docker / docker-compose 支持
- 🔧 PM2 进程管理配置
- 🌐 Nginx 反向代理示例
- 📝 systemd 服务配置

## 📁 文件结构

```
backend/
├── server.js                 # Express 主服务器
├── config.js                 # 统一配置管理
├── package.json              # 依赖管理
├── .env.example              # 环境变量示例
├── Dockerfile                # Docker 镜像（可选）
├── README.md                 # 详细文档
├── storage/                  # 存储适配器
│   ├── json-adapter.js       # JSON 文件存储
│   ├── sqlite-adapter.js     # SQLite 数据库
│   ├── cloudflare-adapter.js # Cloudflare KV（兼容原方案）
│   └── data-storage.js       # 通用数据存储（主题、签到）
└── data/                     # 数据目录（持久化）
    ├── data.json             # 主题、签到数据
    ├── visit-stats.json      # 访问统计（JSON 模式）
    └── visit-stats.db        # 访问统计（SQLite 模式）
```

## 🚀 快速开始

### 方式一：直接运行
```bash
cd backend
npm install
cp .env.example .env
npm start
# 访问 http://localhost:3000
```

### 方式二：Docker 部署
```bash
docker-compose up -d
# 访问 http://localhost:3000
```

### 方式三：生产环境（PM2）
```bash
cd backend
npm install --production
pm2 start server.js --name homepage-backend
pm2 save
```

## ⚙️ 配置说明

编辑 `backend/.env` 文件：

```bash
# 服务器端口
PORT=3000

# 访问统计存储方式: json | sqlite | cloudflare
VISIT_STORAGE=json

# GitHub Token（可选，用于精确贡献日历）
GITHUB_TOKEN=your_github_token_here

# Cloudflare KV 配置（仅当 VISIT_STORAGE=cloudflare 时需要）
# CLOUDFLARE_ACCOUNT_ID=xxx
# CLOUDFLARE_NAMESPACE_ID=xxx
# CLOUDFLARE_API_TOKEN=xxx
```

## ✅ 兼容性保证

- ✅ **向后兼容**：保持与原有 Cloudflare Functions 完全兼容
- ✅ **前端无需修改**：API 端点保持一致
- ✅ **自动回退**：前端会自动检测后端可用性
- ✅ **纯静态支持**：仍支持无后端的纯静态部署

## 📊 性能对比

| 功能 | 纯静态 | Python start.py | Node.js 后端 | Cloudflare KV |
|-----|--------|----------------|--------------|---------------|
| 访问统计 | ❌ 仅本地 | ✅ JSON 文件 | ✅ JSON/SQLite/KV | ✅ KV 存储 |
| 跨设备同步 | ❌ | ❌ | ✅ | ✅ |
| IP 去重 | ❌ | ✅ | ✅ | ✅ |
| 部署难度 | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 性能 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 成本 | 免费 | 免费 | 服务器成本 | 免费额度 |

## 📝 测试清单

- [x] JSON 存储模式测试
- [x] SQLite 存储模式测试
- [x] API 端点功能测试
- [x] CORS 跨域配置
- [x] IP 去重逻辑
- [x] 环境变量配置
- [x] 文档完整性

## 📚 文档更新

- ✅ 更新主 README，添加三种部署方式对比
- ✅ 新增 `backend/README.md`，详细说明配置和部署
- ✅ 添加 Nginx 反向代理配置示例
- ✅ 提供生产环境部署指南（PM2、systemd）
- ✅ 更新 .gitignore，排除后端数据文件

## 🎁 额外收获

- 🐳 Docker 支持（可选）
- 📊 健康检查端点
- 🔧 优雅关闭处理
- 📝 详细的错误日志
- 🌐 完整的 CORS 配置

## 🔗 相关链接

- 后端详细文档：[backend/README.md](backend/README.md)
- Docker 配置：[docker-compose.yml](docker-compose.yml)
- Nginx 配置：[nginx.conf](nginx.conf)

## 🙏 致谢

感谢原作者提供的优秀项目基础，本 PR 在保持原有设计理念的基础上，为用户提供了更多的部署选择和数据自主权。

---

**Review 要点：**
1. 代码结构是否清晰易维护
2. 存储适配器设计是否合理
3. 文档是否足够详细
4. 是否保持了向后兼容性

欢迎提出任何建议和改进意见！🎉
