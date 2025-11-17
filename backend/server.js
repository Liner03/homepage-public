const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const DataStorage = require('./storage/data-storage');

// 根据配置选择访问统计存储适配器
let visitStorage;
const visitStorageType = config.visitStorage.toLowerCase();

console.log(`📊 访问统计存储方式: ${visitStorageType}`);

switch (visitStorageType) {
  case 'sqlite':
    const SqliteAdapter = require('./storage/sqlite-adapter');
    visitStorage = new SqliteAdapter(config.dataDir);
    console.log('✅ SQLite 存储已初始化');
    break;

  case 'cloudflare':
    const CloudflareAdapter = require('./storage/cloudflare-adapter');
    visitStorage = new CloudflareAdapter(config.cloudflare);
    console.log('✅ Cloudflare KV 存储已初始化');
    break;

  case 'json':
  default:
    const JsonAdapter = require('./storage/json-adapter');
    visitStorage = new JsonAdapter(config.dataDir);
    console.log('✅ JSON 文件存储已初始化');
    break;
}

// 通用数据存储（主题）
const dataStorage = new DataStorage(config.dataDir);

const app = express();

// 中间件
app.use(cors(config.cors));
app.use(express.json());

// Session 配置（管理后台需要）
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.env === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

// 静态文件服务（提供前端页面）
app.use(express.static(path.join(__dirname, '..')));

// 获取客户端 IP
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         'unknown';
}

// ==================== 管理后台路由 ====================

const createAdminRouter = require('./routes/admin');
const adminRouter = createAdminRouter(config, dataStorage, visitStorage);
app.use('/admin', adminRouter);

// ==================== API 路由 ====================

// 1. GitHub 贡献日历代理
app.get('/api/github/contributions', async (req, res) => {
  const { login, from, to } = req.query;

  if (!login || !from || !to) {
    return res.status(400).json({ error: 'missing params' });
  }

  // 支持测试 Token：优先使用 X-Test-Token header，否则使用环境变量
  const testToken = req.headers['x-test-token'];
  const token = testToken || config.githubToken;

  if (!token) {
    return res.status(500).json({ error: 'missing GITHUB_TOKEN env' });
  }

  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            colors
            weeks { contributionDays { date contributionCount color weekday } }
          }
        }
      }
      rateLimit { remaining resetAt cost }
    }
  `;

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'homepage-backend'
      },
      body: JSON.stringify({
        query,
        variables: { login, from, to }
      })
    });

    const data = await response.json();

    if (data.errors) {
      return res.status(502).json({ error: data.errors });
    }

    if (!data.data || !data.data.user) {
      return res.status(502).json({ error: 'invalid_response', detail: '未找到用户数据' });
    }

    const calendar = data.data.user.contributionsCollection.contributionCalendar;

    // 标准化输出
    const days = [];
    for (const week of calendar.weeks || []) {
      for (const day of week.contributionDays || []) {
        // 使用空值合并运算符，正确处理0值
        days.push({
          date: day.date,
          count: day.contributionCount ?? day.contributionsCount ?? 0,
          color: day.color,
          weekday: day.weekday
        });
      }
    }

    res.json({
      days,
      total: calendar.totalContributions || 0,
      colors: calendar.colors || []
    });

  } catch (error) {
    console.error('GitHub API 请求失败:', error);
    res.status(500).json({ error: 'proxy_error', detail: error.message });
  }
});

// 1.2 GitHub 贡献日历 - 第三方API代理（解决CORS问题）
app.get('/api/github/contributions-third-party', async (req, res) => {
  const { login } = req.query;

  if (!login) {
    return res.status(400).json({ error: 'missing_login' });
  }

  try {
    // 调用第三方API
    const apiUrl = `https://gh-calendar.rschristian.dev/user/${encodeURIComponent(login)}`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'homepage-backend'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'third_party_api_failed',
        status: response.status,
        detail: errorText
      });
    }

    const data = await response.json();

    // 转换为我们系统的格式
    const days = [];
    let totalContributions = 0;

    if (data.contributions && Array.isArray(data.contributions)) {
      for (const week of data.contributions) {
        if (Array.isArray(week)) {
          for (const day of week) {
            if (day && day.date) {
              days.push({
                date: day.date,
                count: day.count || 0,
                color: getColorByIntensity(day.intensity || 0),
                weekday: new Date(day.date).getDay()
              });
              totalContributions += day.count || 0;
            }
          }
        }
      }
    }

    // 返回与GraphQL API相同的格式
    res.json({
      days,
      total: totalContributions,
      colors: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
      source: 'third-party'
    });

  } catch (error) {
    console.error('第三方API代理请求失败:', error);
    res.status(500).json({ error: 'proxy_error', detail: error.message });
  }
});

// 根据强度值获取颜色
function getColorByIntensity(intensity) {
  const colors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  return colors[Math.min(intensity, 4)] || colors[0];
}

// 2. 访问统计 - GET（查询）
app.get('/api/daily-visit', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'bad_date', message: '日期格式错误，应为YYYY-MM-DD' });
  }

  try {
    const stats = await visitStorage.getVisitStats(date);
    res.json(stats);
  } catch (error) {
    console.error('查询访问统计失败:', error);
    res.status(500).json({ error: 'query_failed', message: error.message });
  }
});

// 3. 访问统计 - POST（记录）
app.post('/api/daily-visit', async (req, res) => {
  const { date, timestamp } = req.body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'bad_date', message: '日期格式错误，应为YYYY-MM-DD' });
  }

  const clientIP = getClientIP(req);
  const ts = timestamp || Date.now();

  try {
    const result = await visitStorage.recordVisit(date, clientIP, ts);
    res.json({
      ...result,
      message: result.isNewVisit ? '新访问记录已保存' : '今日已记录此IP访问'
    });
  } catch (error) {
    console.error('记录访问失败:', error);
    res.status(500).json({ error: 'record_failed', message: error.message });
  }
});

// 4. 主题 - GET（查询）
app.get('/api/theme', (req, res) => {
  try {
    const theme = dataStorage.getTheme();

    if (theme) {
      res.json({
        success: true,
        data: theme,
        message: '获取全局主题色成功'
      });
    } else {
      res.json({
        success: true,
        data: null,
        message: '暂无全局主题色设置'
      });
    }
  } catch (error) {
    console.error('获取主题失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. 主题 - POST（保存）
app.post('/api/theme', (req, res) => {
  const { r, g, b, angle, saturation, lightness } = req.body;

  // 验证颜色数据
  if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number' ||
      r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    return res.status(400).json({
      success: false,
      message: 'RGB颜色值格式错误'
    });
  }

  try {
    const themeColor = {
      r, g, b,
      angle: angle || 0,
      saturation: saturation || 100,
      lightness: lightness || 50,
      userAgent: req.headers['user-agent'] || 'unknown'
    };

    dataStorage.saveTheme(themeColor);

    res.json({
      success: true,
      data: themeColor,
      message: '全局主题色设置成功'
    });
  } catch (error) {
    console.error('保存主题失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. 主题 - DELETE（删除）
app.delete('/api/theme', (req, res) => {
  try {
    dataStorage.deleteTheme();
    res.json({
      success: true,
      message: '全局主题色已重置为默认'
    });
  } catch (error) {
    console.error('删除主题失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// OPTIONS 预检请求处理
app.options('*', cors(config.cors));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    storage: {
      visit: visitStorageType,
      data: 'json'
    },
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
const server = app.listen(config.port, () => {
  console.log('');
  console.log('🚀 个人主页后端服务已启动');
  console.log(`📍 访问地址: http://localhost:${config.port}`);
  console.log(`📊 访问统计: ${visitStorageType} 存储`);
  console.log(`💾 数据目录: ${config.dataDir}`);
  console.log('');
  console.log('按 Ctrl+C 停止服务器');
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    if (visitStorage.close) {
      visitStorage.close();
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n收到中断信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    if (visitStorage.close) {
      visitStorage.close();
    }
    process.exit(0);
  });
});
