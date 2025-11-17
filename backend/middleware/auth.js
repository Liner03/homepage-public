/**
 * 身份验证中间件
 */

// 检查是否已登录
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: 'unauthorized', message: '请先登录' });
}

// 验证管理员凭据
function verifyAdmin(username, password, config) {
  const adminUsername = config.adminUsername || 'admin';
  const adminPassword = config.adminPassword || 'admin123';

  return username === adminUsername && password === adminPassword;
}

module.exports = {
  requireAuth,
  verifyAdmin
};
