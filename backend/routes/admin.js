const express = require('express');
const path = require('path');
const { requireAuth, verifyAdmin } = require('../middleware/auth');
const ConfigManager = require('../utils/config-manager');

function createAdminRouter(config, dataStorage, visitStorage) {
  const router = express.Router();

  // 初始化配置管理器
  const projectRoot = path.join(__dirname, '../..');
  const configManager = new ConfigManager(projectRoot);

  // 登录页面
  router.get('/login', (req, res) => {
    if (req.session && req.session.isAdmin) {
      return res.redirect('/admin/dashboard');
    }
    res.sendFile(path.join(__dirname, '../public/admin/login.html'));
  });

  // 管理面板页面
  router.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/dashboard.html'));
  });

  // API: 登录
  router.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'bad_request', message: '请输入用户名和密码' });
    }

    if (verifyAdmin(username, password, config)) {
      req.session.isAdmin = true;
      req.session.username = username;
      res.json({ success: true, message: '登录成功' });
    } else {
      res.status(401).json({ error: 'invalid_credentials', message: '用户名或密码错误' });
    }
  });

  // API: 退出登录
  router.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: '已退出登录' });
  });

  // API: 检查登录状态
  router.get('/api/check', requireAuth, (req, res) => {
    res.json({ success: true, username: req.session.username });
  });

  // API: 获取统计概览
  router.get('/api/stats', requireAuth, async (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);

      // 获取今日和总访问
      const visitStats = await visitStorage.getVisitStats(today);

      // 获取签到用户数
      const data = dataStorage.loadData();
      const checkinUsers = Object.keys(data.checkin || {}).length;

      // 获取存储类型
      const storageType = config.visitStorage.toUpperCase();

      res.json({
        todayVisits: visitStats.todayCount,
        totalVisits: visitStats.totalCount,
        checkinUsers,
        storageType
      });
    } catch (error) {
      res.status(500).json({ error: 'server_error', message: error.message });
    }
  });

  // API: 获取访问统计（最近7天）
  router.get('/api/visit-stats', requireAuth, async (req, res) => {
    try {
      const stats = [];
      const today = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().slice(0, 10);

        const visitStats = await visitStorage.getVisitStats(dateStr);
        stats.push({
          date: dateStr,
          count: visitStats.todayCount
        });
      }

      res.json({ stats });
    } catch (error) {
      res.status(500).json({ error: 'server_error', message: error.message });
    }
  });

  // API: 获取签到用户列表
  router.get('/api/checkins', requireAuth, (req, res) => {
    try {
      const data = dataStorage.loadData();
      const checkins = data.checkin || {};

      const users = Object.entries(checkins).map(([uid, userData]) => ({
        uid,
        totalDays: userData.days.length,
        lastDay: userData.days[userData.days.length - 1] || null,
        days: userData.days
      }));

      res.json({ users });
    } catch (error) {
      res.status(500).json({ error: 'server_error', message: error.message });
    }
  });

  // ==================== 配置管理 API ====================

  // API: 获取 .env 配置
  router.get('/api/config/env', requireAuth, (req, res) => {
    try {
      const envData = configManager.readEnv();
      res.json({ success: true, data: envData });
    } catch (error) {
      res.status(500).json({ error: 'server_error', message: error.message });
    }
  });

  // API: 保存 .env 配置
  router.post('/api/config/env', requireAuth, (req, res) => {
    try {
      const envData = req.body;

      if (!envData || typeof envData !== 'object') {
        return res.status(400).json({ error: 'bad_request', message: '无效的配置数据' });
      }

      const success = configManager.saveEnv(envData);

      if (success) {
        res.json({
          success: true,
          message: '配置已保存，请重启服务器使配置生效',
          needRestart: true
        });
      } else {
        res.status(500).json({ error: 'save_failed', message: '保存失败' });
      }
    } catch (error) {
      res.status(500).json({ error: 'server_error', message: error.message });
    }
  });

  // API: 获取前端 config.js
  router.get('/api/config/frontend', requireAuth, (req, res) => {
    try {
      const configContent = configManager.readConfig();

      if (configContent === null) {
        return res.status(404).json({ error: 'not_found', message: 'config.js 文件不存在' });
      }

      res.json({ success: true, content: configContent });
    } catch (error) {
      res.status(500).json({ error: 'server_error', message: error.message });
    }
  });

  // API: 保存前端 config.js
  router.post('/api/config/frontend', requireAuth, (req, res) => {
    try {
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'bad_request', message: '无效的配置内容' });
      }

      configManager.saveConfig(content);
      res.json({ success: true, message: '配置已保存' });
    } catch (error) {
      res.status(500).json({ error: 'server_error', message: error.message });
    }
  });

  // API: 获取配置示例
  router.get('/api/config/example', requireAuth, (req, res) => {
    try {
      const exampleContent = configManager.getConfigExample();
      res.json({ success: true, content: exampleContent });
    } catch (error) {
      res.status(500).json({ error: 'server_error', message: error.message });
    }
  });

  // ==================== 数据管理 API ====================

  // API: 删除签到用户
  router.delete('/api/checkins/:uid', requireAuth, (req, res) => {
    try {
      const { uid } = req.params;
      const data = dataStorage.loadData();

      if (data.checkin && data.checkin[uid]) {
        delete data.checkin[uid];
        dataStorage.saveData(data);
        res.json({ success: true, message: '用户签到记录已删除' });
      } else {
        res.status(404).json({ error: 'not_found', message: '用户不存在' });
      }
    } catch (error) {
      res.status(500).json({ error: 'server_error', message: error.message });
    }
  });

  // API: 清空所有签到数据
  router.delete('/api/checkins', requireAuth, (req, res) => {
    try {
      const data = dataStorage.loadData();
      data.checkin = {};
      dataStorage.saveData(data);
      res.json({ success: true, message: '所有签到数据已清空' });
    } catch (error) {
      res.status(500).json({ error: 'server_error', message: error.message });
    }
  });

  return router;
}

module.exports = createAdminRouter;
