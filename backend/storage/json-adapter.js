const fs = require('fs');
const path = require('path');

/**
 * JSON 文件存储适配器
 * 适合小规模数据存储，简单易用，无需额外依赖
 */
class JsonAdapter {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.visitFile = path.join(dataDir, 'visit-stats.json');
    this.ensureDataDir();
    this.ensureDataFile();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  ensureDataFile() {
    if (!fs.existsSync(this.visitFile)) {
      this.saveData({ daily: {}, total: 0, ips: {} });
    }
  }

  loadData() {
    try {
      const content = fs.readFileSync(this.visitFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('加载数据失败:', error);
      return { daily: {}, total: 0, ips: {} };
    }
  }

  saveData(data) {
    try {
      fs.writeFileSync(this.visitFile, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('保存数据失败:', error);
      return false;
    }
  }

  /**
   * 记录访问
   * @param {string} date - 日期 (YYYY-MM-DD)
   * @param {string} ip - 客户端IP
   * @param {number} timestamp - 时间戳
   * @returns {Object} { todayCount, totalCount, isNewVisit }
   */
  async recordVisit(date, ip, timestamp) {
    const data = this.loadData();
    const ipKey = `${date}:${ip}`;

    // 清理过期的 IP 记录（超过 24 小时）
    this.cleanupExpiredIPs(data, timestamp);

    // 检查是否是新访问
    const isNewVisit = !data.ips[ipKey];

    if (isNewVisit) {
      // 更新今日计数
      data.daily[date] = (data.daily[date] || 0) + 1;

      // 更新总计数
      data.total += 1;

      // 记录 IP（带过期时间）
      data.ips[ipKey] = timestamp + 86400000; // 24小时后过期

      this.saveData(data);
    }

    return {
      todayCount: data.daily[date] || 0,
      totalCount: data.total,
      isNewVisit
    };
  }

  /**
   * 查询访问统计
   * @param {string} date - 日期 (YYYY-MM-DD)
   * @returns {Object} { todayCount, totalCount, date }
   */
  async getVisitStats(date) {
    const data = this.loadData();
    return {
      todayCount: data.daily[date] || 0,
      totalCount: data.total,
      date
    };
  }

  /**
   * 清理过期的 IP 记录
   */
  cleanupExpiredIPs(data, currentTimestamp) {
    const ips = data.ips || {};
    let changed = false;

    for (const [key, expireTime] of Object.entries(ips)) {
      if (currentTimestamp > expireTime) {
        delete ips[key];
        changed = true;
      }
    }

    if (changed) {
      data.ips = ips;
    }
  }

  /**
   * 导出所有访问数据
   * @returns {Object} { daily: {}, total: number }
   */
  async exportData() {
    const data = this.loadData();
    return {
      daily: data.daily || {},
      total: data.total || 0
    };
  }

  /**
   * 导入访问数据
   * @param {Object} importData - { daily: {}, total: number }
   * @param {string} mode - "merge" 或 "replace"
   * @returns {Object} { success: boolean, message: string }
   */
  async importData(importData, mode = 'merge') {
    try {
      const currentData = this.loadData();

      if (mode === 'replace') {
        // 替换模式：清空现有数据，导入新数据
        const newData = {
          daily: importData.daily || {},
          total: importData.total || 0,
          ips: {} // 清空 IP 记录
        };
        this.saveData(newData);
        return { success: true, message: '数据已替换' };
      } else if (mode === 'merge') {
        // 合并模式：合并每日数据，累加总数
        const mergedDaily = { ...currentData.daily };

        // 合并每日数据（相同日期的访问量相加）
        for (const [date, count] of Object.entries(importData.daily || {})) {
          mergedDaily[date] = (mergedDaily[date] || 0) + count;
        }

        const mergedData = {
          daily: mergedDaily,
          total: currentData.total + (importData.total || 0),
          ips: currentData.ips || {} // 保留现有 IP 记录
        };

        this.saveData(mergedData);
        return { success: true, message: '数据已合并' };
      } else {
        return { success: false, message: '无效的导入模式' };
      }
    } catch (error) {
      console.error('导入数据失败:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = JsonAdapter;
