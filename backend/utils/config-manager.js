const fs = require('fs');
const path = require('path');

/**
 * 配置管理工具
 * 用于读取和修改 .env 和 config.js 文件
 */
class ConfigManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.envPath = path.join(projectRoot, 'backend', '.env');
    this.configPath = path.join(projectRoot, 'config.js');
  }

  // ==================== .env 文件管理 ====================

  /**
   * 读取 .env 文件
   */
  readEnv() {
    try {
      if (!fs.existsSync(this.envPath)) {
        return {};
      }

      const content = fs.readFileSync(this.envPath, 'utf8');
      const env = {};

      content.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;

        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          // 移除引号
          value = value.replace(/^["']|["']$/g, '');
          env[key] = value;
        }
      });

      return env;
    } catch (error) {
      console.error('读取 .env 失败:', error);
      return {};
    }
  }

  /**
   * 保存 .env 文件
   */
  saveEnv(envData) {
    try {
      const lines = [];

      // 保留分组和注释结构
      const groups = {
        server: ['PORT', 'NODE_ENV'],
        github: ['GITHUB_TOKEN'],
        storage: ['VISIT_STORAGE', 'DATA_DIR'],
        cloudflare: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_NAMESPACE_ID', 'CLOUDFLARE_API_TOKEN'],
        admin: ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'SESSION_SECRET']
      };

      lines.push('# 服务器配置');
      groups.server.forEach(key => {
        if (envData[key] !== undefined) {
          lines.push(`${key}=${envData[key]}`);
        }
      });

      lines.push('');
      lines.push('# GitHub Token (用于精确贡献日历，可选)');
      lines.push('# 获取地址：https://github.com/settings/tokens');
      lines.push('# 创建 Fine-grained token，选择"只读公共仓库"权限');
      groups.github.forEach(key => {
        if (envData[key] !== undefined) {
          lines.push(`${key}=${envData[key]}`);
        }
      });

      lines.push('');
      lines.push('# 访问统计存储方式：json | sqlite | cloudflare');
      groups.storage.forEach(key => {
        if (envData[key] !== undefined) {
          lines.push(`${key}=${envData[key]}`);
        }
      });

      lines.push('');
      lines.push('# Cloudflare KV 配置 (仅当 VISIT_STORAGE=cloudflare 时需要)');
      groups.cloudflare.forEach(key => {
        const value = envData[key];
        if (value !== undefined) {
          if (value === '' || value === 'your_account_id' || value === 'your_namespace_id' || value === 'your_api_token') {
            lines.push(`# ${key}=${value}`);
          } else {
            lines.push(`${key}=${value}`);
          }
        }
      });

      lines.push('');
      lines.push('# 管理后台账号配置');
      groups.admin.forEach(key => {
        if (envData[key] !== undefined) {
          lines.push(`${key}=${envData[key]}`);
        }
      });

      fs.writeFileSync(this.envPath, lines.join('\n') + '\n', 'utf8');
      return true;
    } catch (error) {
      console.error('保存 .env 失败:', error);
      return false;
    }
  }

  // ==================== config.js 文件管理 ====================

  /**
   * 读取 config.js 文件（前端配置）
   */
  readConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }

      const content = fs.readFileSync(this.configPath, 'utf8');

      // 简单解析（实际项目中可能需要更复杂的解析）
      // 这里返回原始内容，让前端用文本编辑器编辑
      return content;
    } catch (error) {
      console.error('读取 config.js 失败:', error);
      return null;
    }
  }

  /**
   * 保存 config.js 文件
   */
  saveConfig(content) {
    try {
      // 验证 JavaScript 语法
      try {
        // 简单的语法检查：确保包含 CONFIG 对象
        if (!content.includes('const CONFIG') && !content.includes('var CONFIG')) {
          throw new Error('配置文件必须包含 CONFIG 对象');
        }
      } catch (error) {
        throw new Error('配置文件语法错误: ' + error.message);
      }

      fs.writeFileSync(this.configPath, content, 'utf8');
      return true;
    } catch (error) {
      console.error('保存 config.js 失败:', error);
      throw error;
    }
  }

  /**
   * 获取配置文件的示例内容
   */
  getConfigExample() {
    try {
      const examplePath = path.join(this.projectRoot, 'config.example.js');
      if (fs.existsSync(examplePath)) {
        return fs.readFileSync(examplePath, 'utf8');
      }
      return null;
    } catch (error) {
      console.error('读取 config.example.js 失败:', error);
      return null;
    }
  }

  // ==================== 栏目管理 ====================

  /**
   * 获取栏目配置
   */
  getSections() {
    try {
      const sectionsPath = path.join(this.projectRoot, 'backend', 'data', 'sections.json');

      if (!fs.existsSync(sectionsPath)) {
        return [];
      }

      const content = fs.readFileSync(sectionsPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('读取 sections.json 失败:', error);
      return [];
    }
  }

  /**
   * 保存栏目配置
   */
  saveSections(sections) {
    try {
      const sectionsPath = path.join(this.projectRoot, 'backend', 'data', 'sections.json');
      const dataDir = path.dirname(sectionsPath);

      // 确保 data 目录存在
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(sectionsPath, JSON.stringify(sections, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('保存 sections.json 失败:', error);
      throw error;
    }
  }
}

module.exports = ConfigManager;
