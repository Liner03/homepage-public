const express = require('express');
const path = require('path');
const { requireAuth, verifyAdmin } = require('../middleware/auth');

function createAdminRouter(config, dataStorage, visitStorage) {
  const router = express.Router();

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
        lastDay: userData.days[userData.days.length - 1] || null
      }));

      res.json({ users });
    } catch (error) {
      res.status(500).json({ error: 'server_error', message: error.message });
    }
  });

  return router;
}

module.exports = createAdminRouter;
