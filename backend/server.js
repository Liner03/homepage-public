const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const DataStorage = require('./storage/data-storage');

// 确保使用绝对路径
const rootDir = path.resolve(__dirname, '..');
const staticDir = path.join(rootDir, 'static');
const backendStaticDir = path.join(__dirname, 'public', 'static');

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

// 静态文件服务（按优先级顺序）
// 1. 前端静态资源（CSS/字体）- 使用绝对路径
app.use('/static', express.static(staticDir));

// 2. 后台管理静态资源
app.use('/admin/static', express.static(backendStaticDir));

// 3. 其他静态文件（HTML/JS 等）
app.use(express.static(rootDir));

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

// 7. 栏目配置 - GET（公开API，前端使用）
app.get('/api/sections', (req, res) => {
  try {
    const ConfigManager = require('./utils/config-manager');
    const configManager = new ConfigManager(path.join(__dirname, '..'));
    const sections = configManager.getSections();

    res.json({
      success: true,
      sections: sections || []
    });
  } catch (error) {
    console.error('获取栏目配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 语言配置 API ====================

// 8. 获取语言配置 - GET（公开API，前端使用）
app.get('/api/language-config', (req, res) => {
  try {
    let languageConfig = dataStorage.get('language-config');

    // 如果没有配置，返回默认配置
    if (!languageConfig) {
      languageConfig = {
        'JavaScript': 'js',
        'Python': 'py',
        'TypeScript': 'ts',
        'CSS': 'css',
        'HTML': 'css',
        'Java': 'py',
        'C++': 'py',
        'C': 'py',
        'Go': 'py',
        'Rust': 'py',
        'Vue': 'js',
        'React': 'js',
        'PHP': 'py',
        'Ruby': 'py',
        'Swift': 'py',
        'Kotlin': 'py',
        'Dart': 'py',
        'Shell': 'py'
      };
      // 保存默认配置
      dataStorage.set('language-config', languageConfig);
    }

    res.json({
      success: true,
      data: languageConfig
    });
  } catch (error) {
    console.error('获取语言配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 9. 保存语言配置 - POST（需要认证，后台管理使用）
app.post('/api/language-config', (req, res) => {
  try {
    const newConfig = req.body;

    // 验证配置格式
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({
        success: false,
        message: '无效的配置数据'
      });
    }

    // 验证每个语言配置
    for (const [language, cssClass] of Object.entries(newConfig)) {
      if (typeof language !== 'string' || typeof cssClass !== 'string') {
        return res.status(400).json({
          success: false,
          message: `语言 "${language}" 的配置格式错误`
        });
      }
    }

    // 保存配置
    dataStorage.set('language-config', newConfig);

    res.json({
      success: true,
      message: '语言配置保存成功'
    });
  } catch (error) {
    console.error('保存语言配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 10. 更新单个语言配置 - PUT
app.put('/api/language-config/:language', (req, res) => {
  try {
    const language = decodeURIComponent(req.params.language);
    const { cssClass } = req.body;

    if (!cssClass || typeof cssClass !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'CSS类名不能为空'
      });
    }

    // 获取当前配置
    let languageConfig = dataStorage.get('language-config') || {};

    // 更新或添加语言配置
    languageConfig[language] = cssClass;

    // 保存配置
    dataStorage.set('language-config', languageConfig);

    res.json({
      success: true,
      message: `语言 "${language}" 配置已更新`
    });
  } catch (error) {
    console.error('更新语言配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 11. 删除语言配置 - DELETE
app.delete('/api/language-config/:language', (req, res) => {
  try {
    const language = decodeURIComponent(req.params.language);

    // 获取当前配置
    let languageConfig = dataStorage.get('language-config') || {};

    // 检查语言是否存在
    if (!languageConfig[language]) {
      return res.status(404).json({
        success: false,
        message: `语言 "${language}" 不存在`
      });
    }

    // 删除语言配置
    delete languageConfig[language];

    // 保存配置
    dataStorage.set('language-config', languageConfig);

    res.json({
      success: true,
      message: `语言 "${language}" 配置已删除`
    });
  } catch (error) {
    console.error('删除语言配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 12. 重置语言配置为默认值 - POST
app.post('/api/language-config/reset', (req, res) => {
  try {
    const defaultConfig = {
      'JavaScript': 'js',
      'Python': 'py',
      'TypeScript': 'ts',
      'CSS': 'css',
      'HTML': 'css',
      'Java': 'py',
      'C++': 'py',
      'C': 'py',
      'Go': 'py',
      'Rust': 'py',
      'Vue': 'js',
      'React': 'js',
      'PHP': 'py',
      'Ruby': 'py',
      'Swift': 'py',
      'Kotlin': 'py',
      'Dart': 'py',
      'Shell': 'py'
    };

    dataStorage.set('language-config', defaultConfig);

    res.json({
      success: true,
      message: '语言配置已重置为默认值',
      data: defaultConfig
    });
  } catch (error) {
    console.error('重置语言配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 语言标签管理 API ====================

// 13. 获取语言标签 - GET（公开API，前端使用）
app.get('/api/language-tags', (req, res) => {
  try {
    let languageTags = dataStorage.get('language-tags');

    // 如果没有配置，返回默认标签
    if (!languageTags) {
      languageTags = [
        { lang: 'JavaScript', percent: 35 },
        { lang: 'Python', percent: 25 },
        { lang: 'TypeScript', percent: 20 },
        { lang: 'CSS', percent: 20 }
      ];
      dataStorage.set('language-tags', languageTags);
    }

    res.json({
      success: true,
      data: languageTags
    });
  } catch (error) {
    console.error('获取语言标签失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 14. 保存语言标签 - POST（需要认证，后台管理使用）
app.post('/api/language-tags', (req, res) => {
  try {
    const newTags = req.body;

    // 验证数据格式
    if (!Array.isArray(newTags)) {
      return res.status(400).json({
        success: false,
        message: '无效的数据格式'
      });
    }

    // 验证每个标签
    for (const tag of newTags) {
      if (!tag.lang || typeof tag.lang !== 'string') {
        return res.status(400).json({
          success: false,
          message: '语言名称不能为空'
        });
      }
      if (typeof tag.percent !== 'number' || tag.percent < 0 || tag.percent > 100) {
        return res.status(400).json({
          success: false,
          message: `"${tag.lang}" 的百分比必须在 0-100 之间`
        });
      }
    }

    // 保存标签
    dataStorage.set('language-tags', newTags);

    res.json({
      success: true,
      message: '语言标签保存成功'
    });
  } catch (error) {
    console.error('保存语言标签失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 15. 重置语言标签为默认值 - POST
app.post('/api/language-tags/reset', (req, res) => {
  try {
    const defaultTags = [
      { lang: 'JavaScript', percent: 35 },
      { lang: 'Python', percent: 25 },
      { lang: 'TypeScript', percent: 20 },
      { lang: 'CSS', percent: 20 }
    ];

    dataStorage.set('language-tags', defaultTags);

    res.json({
      success: true,
      message: '语言标签已重置为默认值',
      data: defaultTags
    });
  } catch (error) {
    console.error('重置语言标签失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 日记配置 API ====================

// 8. 获取日记配置 - GET（公开API）
app.get('/api/diary/config', async (req, res) => {
  try {
    const config = await dataStorage.get('diary-config');
    res.json({
      success: true,
      config: config || {
        enabled: true,
        type: 'diary',
        title: '日记',
        icon: 'fas fa-book',
        config: {
          rssUrl: '',
          cacheTime: 30
        }
      }
    });
  } catch (error) {
    console.error('获取日记配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 9. 保存日记配置 - POST（需要认证）
app.post('/api/diary/config', async (req, res) => {
  try {
    const newConfig = req.body;

    // 验证配置
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({
        success: false,
        message: '无效的配置数据'
      });
    }

    // 保存配置
    await dataStorage.set('diary-config', newConfig);

    // 同时更新 custom-section-config.js 文件
    const ConfigManager = require('./utils/config-manager');
    const configManager = new ConfigManager(path.join(__dirname, '..'));
    configManager.updateDiaryConfig(newConfig);

    res.json({
      success: true,
      message: '配置保存成功'
    });
  } catch (error) {
    console.error('保存日记配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 10. RSS 统计数据 - POST（用于测试）
app.post('/api/diary/rss-stats', async (req, res) => {
  try {
    const { rssUrl } = req.body;

    if (!rssUrl) {
      return res.status(400).json({
        success: false,
        message: 'RSS URL 不能为空'
      });
    }

    // 获取并解析 RSS
    const stats = await fetchAndParseRSS(rssUrl);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取 RSS 统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 11. 日记统计数据 - GET（前端使用，带缓存）
app.get('/api/diary/stats', async (req, res) => {
  try {
    // 获取配置
    const config = await dataStorage.get('diary-config');

    if (!config || !config.enabled || !config.config || !config.config.rssUrl) {
      return res.status(404).json({
        success: false,
        message: '日记功能未配置或未启用'
      });
    }

    const rssUrl = config.config.rssUrl;
    const cacheTime = (config.config.cacheTime || 30) * 60 * 1000; // 转换为毫秒
    const cacheKey = 'diary-rss-cache';

    // 检查缓存
    const cached = await dataStorage.get(cacheKey);
    if (cached && cached.timestamp && (Date.now() - cached.timestamp < cacheTime)) {
      return res.json({
        success: true,
        data: cached.data,
        cached: true
      });
    }

    // 获取最新数据
    const stats = await fetchAndParseRSS(rssUrl);

    // 更新缓存
    await dataStorage.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      data: stats,
      cached: false
    });
  } catch (error) {
    console.error('获取日记统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// RSS 获取和解析辅助函数
async function fetchAndParseRSS(rssUrl) {
  // 使用 Node.js 内置模块获取 RSS 内容
  const https = require('https');
  const http = require('http');
  const { URL } = require('url');

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(rssUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HomepageRSSBot/1.0)'
      }
    };

    protocol.get(rssUrl, options, (response) => {
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchAndParseRSS(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      let xml = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        xml += chunk;
      });

      response.on('end', () => {
        try {
          // 解析 RSS/Atom XML
          const entries = [];

          // 匹配 RSS <item> 或 Atom <entry>
          const itemRegex = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
          const dateRegex = /<(?:pubDate|published|updated|dc:date)>([^<]+)<\/(?:pubDate|published|updated|dc:date)>/i;

          let match;
          while ((match = itemRegex.exec(xml)) !== null) {
            const itemXml = match[0];
            const dateMatch = itemXml.match(dateRegex);

            if (dateMatch && dateMatch[1]) {
              try {
                const date = new Date(dateMatch[1]);
                if (!isNaN(date.getTime())) {
                  entries.push({
                    date: date.toISOString().split('T')[0] // YYYY-MM-DD
                  });
                }
              } catch (e) {
                // 忽略无效日期
              }
            }
          }

          // 按日期排序（最新的在前）
          entries.sort((a, b) => new Date(b.date) - new Date(a.date));

          // 计算统计数据
          const stats = calculateStats(entries);
          resolve(stats);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// 计算统计数据
function calculateStats(entries) {
  if (!entries || entries.length === 0) {
    return {
      consecutive_days: 0,
      total_days_with_entries: 0,
      total_entries: 0,
      latest_entry_date: null,
      current_streak_start: null
    };
  }

  const total_entries = entries.length;
  const latest_entry_date = entries[0].date;

  // 统计每天的文章数
  const dateMap = new Map();
  for (const entry of entries) {
    dateMap.set(entry.date, (dateMap.get(entry.date) || 0) + 1);
  }

  const total_days_with_entries = dateMap.size;

  // 获取所有日期并排序
  const dates = Array.from(dateMap.keys()).sort((a, b) => new Date(b) - new Date(a));

  // 计算连续天数
  let consecutive_days = 0;
  let current_streak_start = null;

  if (dates.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentDate = new Date(dates[0]);
    currentDate.setHours(0, 0, 0, 0);

    // 检查最新文章是否在今天或昨天
    const dayDiff = Math.floor((today - currentDate) / (1000 * 60 * 60 * 24));

    if (dayDiff <= 1) {
      consecutive_days = 1;
      current_streak_start = dates[0];

      // 向后查找连续日期
      for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i - 1]);
        const currDate = new Date(dates[i]);
        const diff = Math.floor((prevDate - currDate) / (1000 * 60 * 60 * 24));

        if (diff === 1) {
          consecutive_days++;
          current_streak_start = dates[i];
        } else {
          break;
        }
      }
    }
  }

  return {
    consecutive_days,
    total_days_with_entries,
    total_entries,
    latest_entry_date,
    current_streak_start
  };
}

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

// 初始化默认栏目配置
function initDefaultSections() {
  const ConfigManager = require('./utils/config-manager');
  const configManager = new ConfigManager(path.join(__dirname, '..'));

  try {
    const sections = configManager.getSections();

    // 如果还没有栏目配置，初始化默认栏目
    if (!sections || sections.length === 0) {
      // 尝试读取前端配置，检查各栏目是否有数据
      let configData = {};
      try {
        const configContent = configManager.readConfig();
        if (configContent) {
          // 简单解析 CONFIG 对象
          const match = configContent.match(/const\s+CONFIG\s*=\s*(\{[\s\S]*?\});?\s*$/m);
          if (match) {
            // 使用 eval 解析（仅用于初始化，生产环境应该用更安全的方式）
            configData = eval('(' + match[1] + ')');
          }
        }
      } catch (error) {
        console.log('⚠️ 无法读取前端配置，使用默认设置');
      }

      const defaultSections = [
        {
          id: 'websites',
          title: '我的站点',
          icon: 'fa-globe',
          field: 'websites',
          position: 'content-below',
          defaultTemplate: 'card-grid',
          hidden: !configData.websites || configData.websites.length === 0, // 如果为空则隐藏
          itemFields: [
            { name: 'id', label: 'ID', type: 'text', required: true },
            { name: 'title', label: '标题', type: 'text', required: true },
            { name: 'url', label: '链接', type: 'url', required: true },
            { name: 'description', label: '描述', type: 'textarea', required: false },
            { name: 'icon', label: '图标', type: 'text', required: false },
            { name: 'hidden', label: '隐藏', type: 'checkbox', required: false }
          ]
        },
        {
          id: 'projects',
          title: '项目集',
          icon: 'fa-code',
          field: 'projects',
          position: 'content-below',
          defaultTemplate: 'card-grid',
          hidden: !configData.projects || configData.projects.length === 0, // 如果为空则隐藏
          itemFields: [
            { name: 'id', label: 'ID', type: 'text', required: true },
            { name: 'title', label: '标题', type: 'text', required: true },
            { name: 'url', label: '链接', type: 'url', required: true },
            { name: 'description', label: '描述', type: 'textarea', required: false },
            { name: 'icon', label: '图标', type: 'text', required: false },
            { name: 'tags', label: '标签', type: 'tags', required: false },
            { name: 'hidden', label: '隐藏', type: 'checkbox', required: false }
          ]
        },
        {
          id: 'skills',
          title: '技能栈',
          icon: 'fa-star',
          field: 'skills',
          position: 'content-below',
          defaultTemplate: 'icon-wall',
          hidden: !configData.skills || configData.skills.length === 0, // 如果为空则隐藏
          itemFields: [
            { name: 'id', label: 'ID', type: 'text', required: true },
            { name: 'name', label: '名称', type: 'text', required: true },
            { name: 'icon', label: '图标', type: 'text', required: false },
            { name: 'level', label: '熟练度', type: 'number', required: false },
            { name: 'hidden', label: '隐藏', type: 'checkbox', required: false }
          ]
        },
        {
          id: 'timeline',
          title: '时间线',
          icon: 'fa-history',
          field: 'timeline',
          position: 'content-below',
          defaultTemplate: 'list',
          hidden: !configData.timeline || configData.timeline.length === 0, // 如果为空则隐藏
          itemFields: [
            { name: 'id', label: 'ID', type: 'text', required: true },
            { name: 'date', label: '日期', type: 'text', required: true },
            { name: 'title', label: '标题', type: 'text', required: true },
            { name: 'description', label: '描述', type: 'textarea', required: false },
            { name: 'hidden', label: '隐藏', type: 'checkbox', required: false }
          ]
        }
      ];

      configManager.saveSections(defaultSections);

      // 统计隐藏的栏目
      const hiddenCount = defaultSections.filter(s => s.hidden).length;
      console.log(`✅ 已初始化默认栏目配置 (${defaultSections.length}个栏目, ${hiddenCount}个已隐藏)`);
    } else {
      // 如果栏目配置已存在，检查是否需要更新 hidden 状态
      updateSectionsHiddenStatus(configManager, sections);
    }
  } catch (error) {
    console.error('❌ 初始化栏目配置失败:', error);
  }
}

// 更新栏目的 hidden 状态（基于项目数量）
function updateSectionsHiddenStatus(configManager, sections) {
  try {
    // 读取前端配置
    let configData = {};
    try {
      const configContent = configManager.readConfig();
      if (configContent) {
        const match = configContent.match(/const\s+CONFIG\s*=\s*(\{[\s\S]*?\});?\s*$/m);
        if (match) {
          configData = eval('(' + match[1] + ')');
        }
      }
    } catch (error) {
      return; // 无法读取配置，跳过更新
    }

    let updated = false;
    sections.forEach(section => {
      const items = configData[section.field];
      const shouldHide = !items || items.length === 0;

      // 如果当前是显示的，但项目为空，自动设置为隐藏
      if (!section.hidden && shouldHide) {
        section.hidden = true;
        updated = true;
        console.log(`ℹ️ 栏目 "${section.title}" 无项目，已自动隐藏`);
      }
    });

    if (updated) {
      configManager.saveSections(sections);
    }
  } catch (error) {
    console.error('⚠️ 更新栏目隐藏状态失败:', error);
  }
}

// 启动服务器
const server = app.listen(config.port, () => {
  console.log('');
  console.log('🚀 个人主页后端服务已启动');
  console.log(`📍 访问地址: http://localhost:${config.port}`);
  console.log(`📊 访问统计: ${visitStorageType} 存储`);
  console.log(`💾 数据目录: ${config.dataDir}`);
  console.log(`📁 前端静态目录: ${staticDir}`);
  console.log(`📁 后端静态目录: ${backendStaticDir}`);
  console.log(`📁 根目录: ${rootDir}`);
  console.log('');
  console.log('按 Ctrl+C 停止服务器');

  // 初始化栏目配置
  initDefaultSections();
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
