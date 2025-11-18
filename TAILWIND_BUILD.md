# Tailwind CSS 构建说明

本项目使用 Tailwind CSS 构建工具，而不是 CDN。

## 📦 初始设置

首次克隆项目后，需要安装依赖：

```bash
npm install
```

## 🔨 构建命令

### 生产环境构建（压缩）
```bash
npm run build:css
```
生成压缩的 CSS 文件到 `static/tailwind.css`

### 开发环境监听（自动重新构建）
```bash
npm run watch:css
# 或
npm run dev
```
监听文件变化，自动重新构建 CSS

## 📁 项目结构

```
homepage-public/
├── src/
│   └── input.css          # Tailwind 源文件（包含 @tailwind 指令）
├── static/
│   ├── tailwind.css       # 构建生成的文件（已忽略）
│   └── style.css          # 自定义样式
├── tailwind.config.js     # Tailwind 配置文件
├── package.json           # 前端依赖和构建脚本
└── index.html             # 引用构建后的 CSS
```

## ⚙️ Tailwind 配置

### 扫描路径（tailwind.config.js）
```javascript
content: [
  "./index.html",
  "./modules/**/*.{html,js}",
  "./static/**/*.js"
]
```

### 深色模式
使用系统深色模式：`darkMode: 'media'`

## 🎨 样式加载顺序

在 `index.html` 中：
1. **Tailwind CSS** (`./static/tailwind.css`) - 基础样式
2. **自定义样式** (`./static/style.css`) - 覆盖和扩展

## 🚀 部署流程

1. 修改代码后运行构建：
   ```bash
   npm run build:css
   ```

2. 提交代码（不包括 `static/tailwind.css`，它在 .gitignore 中）

3. 服务器部署时自动运行构建：
   ```bash
   npm install
   npm run build:css
   ```

## 💡 提示

- ✅ 使用 Tailwind 类名来快速开发 UI
- ✅ 自定义样式放在 `static/style.css`
- ✅ 修改 HTML 后记得重新构建 CSS
- ❌ 不要手动编辑 `static/tailwind.css`（会被覆盖）
