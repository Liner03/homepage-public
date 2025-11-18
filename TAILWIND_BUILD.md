# 前端构建说明

本项目使用 **npm** 统一管理前端依赖，包括 **Tailwind CSS v4** 和 **Heroicons** 图标库，无需依赖外部 CDN。

## 📦 依赖管理

本项目通过 npm 和内置 SVG 图标管理以下前端资源：
- **Tailwind CSS v4** - 现代化 CSS 框架
- **Heroicons** - 轻量级 SVG 图标库（无需 npm，内置于项目中）

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
构建 Tailwind CSS 资源

### 单独构建 Tailwind CSS
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
监听文件变化，自动重新构建 Tailwind CSS

## 📁 项目结构

```
homepage-public/
├── src/
│   └── input.css          # Tailwind 4 源文件（使用 @import 和 @theme）
├── static/
│   ├── tailwind.css       # 构建生成的文件（已忽略）
│   ├── style.css          # 自定义样式
│   └── icons.js           # Heroicons SVG 图标库
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
3. **Heroicons** (`./static/icons.js`) - SVG 图标库

## 🎯 Heroicons 使用

### 特点
- ✅ **纯 SVG**：无字体文件依赖，避免加载问题
- ✅ **轻量级**：按需加载，极小体积
- ✅ **品牌图标**：包含 GitHub、Twitter 等社交媒体图标

### JavaScript API

```javascript
// 创建图标
const githubIcon = createIcon('github');

// 创建带类名的图标
const iconWithClass = createIcon('envelope', 'custom-class');
```

### 在 config.js 中使用

```javascript
social: {
  github: {
    url: "https://github.com/username",
    icon: "github"  // Heroicon 名称
  },
  email: {
    url: "admin@example.com",
    icon: "envelope"
  }
}
```

### 常用图标

#### 社交媒体（品牌图标）
- `github` - GitHub
- `wechat` - 微信
- `telegram` - Telegram
- `twitter` - Twitter (X)
- `linkedin` - LinkedIn
- `google` - Google

#### UI 图标（Heroicons）
- `envelope` - 邮件
- `user` - 用户
- `cog` - 设置
- `home` - 主页
- `pencil` - 编辑
- `trash` - 删除
- `plus` - 添加
- `x-mark` - 关闭
- `check` - 确认
- `calendar` - 日历

[查看完整图标列表](https://heroicons.com)

## 🚀 部署流程

1. 修改代码后运行完整构建：
   ```bash
   npm run build
   ```

2. 提交代码（不包括生成的文件，它们在 .gitignore 中）：
   - `static/tailwind.css`
   - `backend/public/static/`

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

## 🎨 从 Font Awesome 迁移到 Heroicons

### 为什么迁移？
- ❌ Font Awesome 使用字体文件，可能出现加载问题
- ❌ 需要额外的构建步骤和依赖
- ❌ 文件体积较大

- ✅ Heroicons 使用纯 SVG，稳定可靠
- ✅ 无需构建，直接使用
- ✅ 轻量级，按需加载

### 迁移步骤

本项目已完成迁移，无需额外操作。如果你要手动迁移：

1. 移除 Font Awesome 依赖：
   ```bash
   npm uninstall @fortawesome/fontawesome-free
   ```

2. 引入 Heroicons 图标库：
   ```html
   <script src="./static/icons.js"></script>
   ```

3. 使用新 API：
   ```javascript
   // 旧：Font Awesome
   <i class="fas fa-github"></i>

   // 新：Heroicons
   createIcon('github')
   ```

## 💡 最佳实践

- ✅ 使用 Tailwind 类名快速开发 UI
- ✅ 在 `@theme` 中定义项目级别的主题变量
- ✅ 自定义样式放在 `static/style.css`
- ✅ 使用 Heroicons 图标，避免字体文件加载问题
- ✅ 使用 npm 管理前端依赖，避免 CDN
- ✅ 修改 HTML 后记得重新构建：`npm run build`
- ✅ `npm install` 会自动触发构建（postinstall 钩子）
- ❌ 不要手动编辑生成的文件（会被覆盖）
- ❌ 不要创建 `tailwind.config.js`（v4 不需要）
- ❌ 不要使用 CDN 引用（已改为本地构建）
- ❌ 不要使用 Font Awesome（已迁移到 Heroicons）
