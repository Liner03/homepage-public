# Tailwind CSS 4 构建说明

本项目使用 **Tailwind CSS v4** 构建工具，采用现代化的 CSS 优先配置方式。

## 🆕 Tailwind CSS 4 新特性

- ✅ **CSS 优先配置**：使用 `@import` 和 `@theme` 指令
- ✅ **无需 config.js**：所有配置都在 CSS 中完成
- ✅ **更快的构建速度**：优化的编译引擎
- ✅ **原生 CSS 变量**：完全基于自定义属性

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
│   └── input.css          # Tailwind 4 源文件（使用 @import 和 @theme）
├── static/
│   ├── tailwind.css       # 构建生成的文件（已忽略）
│   └── style.css          # 自定义样式
├── package.json           # 前端依赖和构建脚本
└── index.html             # 引用构建后的 CSS
```

## ⚙️ Tailwind 4 配置（CSS 优先）

在 `src/input.css` 中配置：

```css
/* 导入 Tailwind CSS 4 */
@import "tailwindcss";

/* 使用 @theme 指令配置主题 */
@theme {
  /* 自定义颜色 */
  --color-primary: #3b82f6;

  /* 自定义字体 */
  --font-family-sans: system-ui, sans-serif;

  /* 自定义间距 */
  --spacing-custom: 2.5rem;
}
```

### 深色模式
Tailwind 4 自动支持 `dark:` 前缀，使用系统偏好设置。

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

## 💡 Tailwind 4 vs 3 差异

| 特性 | v3 | v4 |
|------|----|----|
| 配置方式 | tailwind.config.js | CSS 中的 @theme |
| 导入方式 | @tailwind 指令 | @import "tailwindcss" |
| 深色模式 | darkMode: 'class' | 内置支持 |
| 自定义主题 | theme.extend {} | @theme { --var: value } |

## 🔄 从 v3 迁移到 v4

1. 删除 `tailwind.config.js`
2. 更新 `src/input.css`：
   ```css
   /* 旧：Tailwind v3 */
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

   /* 新：Tailwind v4 */
   @import "tailwindcss";
   @theme { /* 配置 */ }
   ```
3. 运行 `npm install` 和 `npm run build:css`

## 💡 最佳实践

- ✅ 使用 Tailwind 类名快速开发 UI
- ✅ 在 `@theme` 中定义项目级别的主题变量
- ✅ 自定义样式放在 `static/style.css`
- ✅ 修改 HTML 后记得重新构建 CSS
- ❌ 不要手动编辑 `static/tailwind.css`（会被覆盖）
- ❌ 不要创建 `tailwind.config.js`（v4 不需要）
