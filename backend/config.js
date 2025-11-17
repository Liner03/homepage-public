require('dotenv').config();

module.exports = {
  // 服务器配置
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',

  // GitHub Token
  githubToken: process.env.GITHUB_TOKEN,

  // 访问统计存储方式: json | sqlite | cloudflare
  visitStorage: process.env.VISIT_STORAGE || 'json',

  // 数据目录
  dataDir: process.env.DATA_DIR || './data',

  // Cloudflare KV 配置
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    namespaceId: process.env.CLOUDFLARE_NAMESPACE_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN
  },

  // CORS 配置
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }
};
