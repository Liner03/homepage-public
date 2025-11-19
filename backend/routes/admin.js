const express = require('express');
const path = require('path');
const { requireAuth, verifyAdmin } = require('../middleware/auth');
const ConfigManager = require('../utils/config-manager');

function createAdminRouter(config, dataStorage, visitStorage) {
  const router = express.Router();

  // 初始化配置管理器
  const projectRoot = path.join(__dirname, '../..');
  const configManager = new ConfigManager(projectRoot);

  // 根路由 - 自动跳转
  router.get('/', (req, res) => {
    if (req.session && req.session.isAdmin) {
      return res.redirect('/admin/dashboard');
    }
    res.redirect('/admin/login');
  });

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

  // 前端配置页面
  router.get('/frontend-config', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/frontend-config.html'));
  });

  // 语言配置页面
  router.get('/language-config', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/language-config.html'));
  });

  // 日记配置页面
  router.get('/diary-config', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/diary-config.html'));
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

      // 获取存储类型
      const storageType = config.visitStorage.toUpperCase();

      res.json({
        todayVisits: visitStats.todayCount,
        totalVisits: visitStats.totalCount,
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

  // API: 导出全站配置数据
  router.get('/api/visit-stats/export', requireAuth, async (req, res) => {
    try {
      // 1. 导出访问统计数据
      let visitData = { daily: {}, total: 0 };
      if (typeof visitStorage.exportData === 'function') {
        visitData = await visitStorage.exportData();
      }

      // 2. 导出所有配置数据（从 dataStorage）
      const allData = dataStorage.loadData();

      // 构建完整的导出数据结构
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        storageType: config.visitStorage,
        data: {
          // 访问统计数据
          visitStats: {
            daily: visitData.daily || {},
            total: visitData.total || 0
          },
          // 所有配置数据（导出 data.json 中的所有字段）
          config: allData || {}
        }
      };

      res.json({
        success: true,
        data: exportData
      });
    } catch (error) {
      console.error('导出数据失败:', error);
      res.status(500).json({
        success: false,
        message: '导出失败: ' + error.message
      });
    }
  });

  // API: 导入全站配置数据
  router.post('/api/visit-stats/import', requireAuth, async (req, res) => {
    try {
      const { data, mode } = req.body;

      // 验证参数
      if (!data || !data.data) {
        return res.status(400).json({
          success: false,
          message: '无效的导入数据格式'
        });
      }

      if (!['merge', 'replace'].includes(mode)) {
        return res.status(400).json({
          success: false,
          message: '无效的导入模式，必须是 "merge" 或 "replace"'
        });
      }

      const importedData = data.data;
      const results = [];

      // 1. 导入访问统计数据
      if (importedData.visitStats && typeof visitStorage.importData === 'function') {
        const visitResult = await visitStorage.importData(importedData.visitStats, mode);
        results.push(`访问统计: ${visitResult.message}`);
      }

      // 2. 导入配置数据
      if (importedData.config) {
        const currentData = dataStorage.loadData();
        const configData = importedData.config;

        if (mode === 'replace') {
          // 替换模式：完全覆盖配置（使用导入的所有字段）
          dataStorage.saveData(configData);
          results.push('配置数据: 已替换');
        } else {
          // 合并模式：合并配置（导入的数据覆盖现有数据）
          const mergedData = { ...currentData };

          // 遍历导入的所有字段，覆盖到现有数据
          for (const [key, value] of Object.entries(configData)) {
            if (value !== null && value !== undefined) {
              mergedData[key] = value;
            }
          }

          dataStorage.saveData(mergedData);
          results.push('配置数据: 已合并');
        }
      }

      res.json({
        success: true,
        message: results.join(', '),
        mode: mode,
        details: results
      });
    } catch (error) {
      console.error('导入数据失败:', error);
      res.status(500).json({
        success: false,
        message: '导入失败: ' + error.message
      });
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

  // ==================== 用户设置 API ====================

  // API: 修改管理员密码
  router.post('/api/change-password', requireAuth, (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: '请提供当前密码和新密码'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: '新密码至少需要 6 个字符'
        });
      }

      // 验证当前密码
      const username = req.session.username;
      if (!verifyAdmin(username, currentPassword, config)) {
        return res.status(401).json({
          success: false,
          message: '当前密码错误'
        });
      }

      // 更新 .env 文件中的密码
      const envData = configManager.readEnv();
      envData.ADMIN_PASSWORD = newPassword;
      configManager.saveEnv(envData);

      res.json({
        success: true,
        message: '密码修改成功，下次登录时生效'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '修改失败: ' + error.message
      });
    }
  });

  // ==================== 栏目管理 API ====================

  // 获取栏目列表
  router.get('/api/sections', requireAuth, (req, res) => {
    try {
      const sections = configManager.getSections();
      res.json({
        success: true,
        sections: sections || []
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取失败: ' + error.message
      });
    }
  });

  // 创建新栏目
  router.post('/api/sections', requireAuth, (req, res) => {
    try {
      const sectionData = req.body;

      if (!sectionData.id || !sectionData.title) {
        return res.status(400).json({
          success: false,
          message: '缺少必要字段: id 和 title'
        });
      }

      const sections = configManager.getSections() || [];

      // 检查 ID 是否已存在
      if (sections.find(s => s.id === sectionData.id)) {
        return res.status(400).json({
          success: false,
          message: '栏目 ID 已存在'
        });
      }

      sections.push(sectionData);
      configManager.saveSections(sections);

      res.json({
        success: true,
        message: '创建成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '创建失败: ' + error.message
      });
    }
  });

  // 更新栏目
  router.put('/api/sections/:id', requireAuth, (req, res) => {
    try {
      const { id } = req.params;
      const sectionData = req.body;

      let sections = configManager.getSections() || [];
      const index = sections.findIndex(s => s.id === id);

      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: '栏目不存在'
        });
      }

      sections[index] = { ...sections[index], ...sectionData };
      configManager.saveSections(sections);

      res.json({
        success: true,
        message: '更新成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '更新失败: ' + error.message
      });
    }
  });

  // 删除栏目
  router.delete('/api/sections/:id', requireAuth, (req, res) => {
    try {
      const { id } = req.params;

      let sections = configManager.getSections() || [];
      const filteredSections = sections.filter(s => s.id !== id);

      if (filteredSections.length === sections.length) {
        return res.status(404).json({
          success: false,
          message: '栏目不存在'
        });
      }

      configManager.saveSections(filteredSections);

      res.json({
        success: true,
        message: '删除成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '删除失败: ' + error.message
      });
    }
  });

  return router;
}

module.exports = createAdminRouter;
