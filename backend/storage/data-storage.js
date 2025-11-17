const fs = require('fs');
const path = require('path');

/**
 * 通用数据存储（主题、签到等）
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
      this.saveData({ checkin: {}, theme: null });
    }
  }

  loadData() {
    try {
      const content = fs.readFileSync(this.dataFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('加载数据失败:', error);
      return { checkin: {}, theme: null };
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

  // ==================== 签到相关 ====================

  /**
   * 获取用户签到数据
   */
  getCheckinData(uid) {
    const data = this.loadData();
    return data.checkin[uid] || { days: [] };
  }

  /**
   * 保存用户签到
   */
  saveCheckin(uid, day) {
    const data = this.loadData();

    if (!data.checkin[uid]) {
      data.checkin[uid] = { days: [] };
    }

    const days = data.checkin[uid].days;
    const isNewDay = !days.includes(day);

    if (isNewDay) {
      days.push(day);
      days.sort();
    }

    this.saveData(data);

    return {
      ok: true,
      days: days,
      newDay: isNewDay,
      message: isNewDay ? '新访问记录已保存' : '今日已记录'
    };
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
}

module.exports = DataStorage;
