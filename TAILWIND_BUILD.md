# 前端构建说明

本项目使用 **npm** 统一管理前端依赖，包括 **Tailwind CSS v4** 和 **Font Awesome**，无需依赖外部 CDN。

## 📦 依赖管理

本项目通过 npm 管理以下前端资源：
- **Tailwind CSS v4** - 现代化 CSS 框架
- **Font Awesome** - 完整图标库

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

### 完整构建（推荐）
```bash
npm run build
```
构建所有资源（Tailwind CSS + Font Awesome）

### 单独构建 Tailwind CSS
```bash
npm run build:css
```
生成压缩的 CSS 文件到 `static/tailwind.css`

### 单独构建 Font Awesome
```bash
npm run build:fontawesome
```
复制 Font Awesome CSS 和字体文件到 `static/`

### 开发环境监听（自动重新构建）
```bash
npm run watch:css
# 或
npm run dev
```
监听文件变化，自动重新构建 Tailwind CSS

## 📁 项目结构

```
homepage-public/
├── src/
│   └── input.css          # Tailwind 4 源文件（使用 @import 和 @theme）
├── static/
│   ├── tailwind.css       # 构建生成的文件（已忽略）
│   ├── fontawesome.css    # Font Awesome CSS（已忽略）
│   ├── webfonts/          # Font Awesome 字体文件（已忽略）
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
3. **Font Awesome** (`./static/fontawesome.css`) - 图标库

## 🎯 Font Awesome 使用

### 安装和构建
Font Awesome 通过 npm 包 `@fortawesome/fontawesome-free` 管理：

```bash
# 安装（已包含在 package.json 中）
npm install

# 构建会自动复制 Font Awesome 文件
npm run build
```

### 使用图标
在 HTML 中直接使用 Font Awesome 图标：

```html
<i class="fas fa-heart"></i>
<i class="fab fa-github"></i>
<i class="far fa-star"></i>
```

### 图标类型
- `fas` - Solid 实心图标
- `far` - Regular 常规图标
- `fab` - Brands 品牌图标

## 🚀 部署流程

1. 修改代码后运行完整构建：
   ```bash
   npm run build
   ```

2. 提交代码（不包括生成的文件，它们在 .gitignore 中）：
   - `static/tailwind.css`
   - `static/fontawesome.css`
   - `static/webfonts/`

3. 服务器部署时自动运行构建：
   ```bash
   npm install  # postinstall 钩子会自动运行 npm run build
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
- ✅ 使用 npm 管理所有前端依赖，避免 CDN
- ✅ 修改 HTML 后记得重新构建：`npm run build`
- ✅ `npm install` 会自动触发构建（postinstall 钩子）
- ❌ 不要手动编辑生成的文件（会被覆盖）
- ❌ 不要创建 `tailwind.config.js`（v4 不需要）
- ❌ 不要使用 CDN 引用（已改为本地构建）
