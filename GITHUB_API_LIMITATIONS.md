# GitHub API 限制说明

## 问题：为什么显示的贡献数少于GitHub Profile？

### 现象
- **GitHub Profile** (https://github.com/Liner03): 593 contributions
- **本系统获取**: 168 contributions
- **差异**: 425 contributions (缺失71.8%)

## 原因：GitHub GraphQL API 的已知限制

### 官方文档确认

根据GitHub官方文档和社区讨论：

1. **GitHub Community Discussion #24812**
   - 标题：_"APIv4 feature request: allow contributionsCollection to include private contributions"_
   - 链接：https://github.com/orgs/community/discussions/24812
   - 状态：**功能请求，尚未实现**

2. **StackOverflow 确认**
   - ["GitHub's GraphQL API contributionsCollection not pulling from SSO organizations"](https://stackoverflow.com/questions/73915679)
   - ["Github V4 graphql - Can't get organization user contribution info"](https://stackoverflow.com/questions/62619169)

### 具体限制

`contributionsCollection` GraphQL API **无法返回**以下类型的贡献：

❌ **组织私有仓库的贡献**
- 即使Token有 `repo` 权限
- 即使组织已授权Token访问
- 即使用户是组织成员

❌ **SSO保护的组织贡献**
- 启用了SAML SSO的组织
- 即使通过了SSO授权

❌ **某些私有仓库的贡献**
- 根据StackOverflow：_"It is impossible to get this query to include private contributions, even when appropriately authenticated"_

### GitHub Profile 为什么能显示？

GitHub的个人主页使用的是**内部API**，不是公开的GraphQL API：
- 内部API有更高的权限
- 可以访问用户自己的完整私有数据
- 公开API出于安全考虑做了限制

## 解决方案

### 方案对比

| 方案 | 优点 | 缺点 | 准确度 |
|------|------|------|--------|
| **GraphQL API** (当前) | 数据最准确 | 只能获取公开贡献 | ⭐⭐⭐⭐⭐ (公开部分) |
| **Events API** | 可获取部分组织贡献 | 仅最近300事件，估算不准 | ⭐⭐⭐ |
| **混合方案** | 数据更完整 | 仍有缺失，复杂度高 | ⭐⭐⭐⭐ |

### 推荐方案

#### 1. 接受限制 + 清晰说明（最简单）

在UI上显示：
```
📊 贡献统计
公开贡献：168 次
完整数据：查看 GitHub Profile (593 次)

ℹ️ 由于GitHub API限制，此处仅显示公开仓库的贡献
   组织私有仓库的贡献请访问您的GitHub主页查看
```

#### 2. 实现Events API补充（部分改善）

```javascript
// 伪代码
const graphqlContribs = await fetchGraphQL();  // 168次（准确）
const eventsContribs = await fetchEvents();     // 可能更多（估算）
const merged = mergeContributions(graphqlContribs, eventsContribs);
```

**预期效果**：
- 可能从168提升到250-350次
- 仍然达不到593次（私有仓库事件仍受限）

#### 3. 手动输入补充（最准确）

在后台配置添加：
```
GitHub Profile总贡献数：[593]（手动输入）
API获取的公开贡献：168（自动）
```

前端显示：
```
📊 过去一年贡献：593 次
   └─ 公开仓库：168 次
   └─ 私有/组织：425 次（估算）
```

## 技术细节

### GraphQL Query
```graphql
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions  # 仅包含公开的
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}
```

### Events API
```bash
GET /users/{username}/events?per_page=100
```

**返回内容**：
- 最近100-300个公开事件
- 包括 PushEvent, PullRequestEvent, IssuesEvent等
- 可能包含组织公开仓库的活动

## 相关链接

- [GitHub GraphQL API文档](https://docs.github.com/en/graphql)
- [功能请求讨论](https://github.com/orgs/community/discussions/24812)
- [StackOverflow讨论1](https://stackoverflow.com/questions/73915679)
- [StackOverflow讨论2](https://stackoverflow.com/questions/62619169)

## 结论

**这不是我们系统的bug，而是GitHub公开API的设计限制。**

如果需要显示完整的贡献数，建议：
1. 在UI上明确说明限制
2. 提供到GitHub Profile的链接
3. 可选：实现Events API补充（部分改善）
4. 可选：允许手动输入总贡献数

---

_文档创建日期：2025-11-17_
_基于GitHub API v4 (GraphQL) 和 REST API v3_
