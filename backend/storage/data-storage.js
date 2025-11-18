const fs = require('fs');
const path = require('path');

/**
 * 通用数据存储（主题等）
 * 使用 JSON 文件存储
 */
class DataStorage {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.dataFile = path.join(dataDir, 'data.json');
    this.ensureDataDir();
    this.ensureDataFile();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  ensureDataFile() {
    if (!fs.existsSync(this.dataFile)) {
      this.saveData({ theme: null });
    }
  }

  loadData() {
    try {
      const content = fs.readFileSync(this.dataFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('加载数据失败:', error);
      return { theme: null };
    }
  }

  saveData(data) {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('保存数据失败:', error);
      return false;
    }
  }

  // ==================== 主题相关 ====================

  /**
   * 获取全局主题色
   */
  getTheme() {
    const data = this.loadData();
    return data.theme;
  }

  /**
   * 保存全局主题色
   */
  saveTheme(themeColor) {
    const data = this.loadData();
    data.theme = {
      ...themeColor,
      timestamp: Date.now()
    };
    return this.saveData(data);
  }

  /**
   * 删除全局主题色
   */
  deleteTheme() {
    const data = this.loadData();
    data.theme = null;
    return this.saveData(data);
  }

  // ==================== 通用键值存储 ====================

  /**
   * 获取指定 key 的数据
   */
  get(key) {
    const data = this.loadData();
    return data[key];
  }

  /**
   * 设置指定 key 的数据
   */
  set(key, value) {
    const data = this.loadData();
    data[key] = value;
    return this.saveData(data);
  }

  /**
   * 删除指定 key 的数据
   */
  delete(key) {
    const data = this.loadData();
    delete data[key];
    return this.saveData(data);
  }
}

module.exports = DataStorage;
