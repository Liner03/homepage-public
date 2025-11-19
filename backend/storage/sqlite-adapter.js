const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * SQLite 存储适配器
 * 适合需要更高性能和并发支持的场景
 */
class SqliteAdapter {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, 'visit-stats.db');
    this.ensureDataDir();
    this.db = new Database(this.dbPath);
    this.initDatabase();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  initDatabase() {
    // 创建每日访问统计表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_visits (
        date TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0
      )
    `);

    // 创建总访问统计表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS total_visits (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        count INTEGER DEFAULT 0
      )
    `);

    // 创建 IP 去重表（带过期时间）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS visit_ips (
        ip_date_key TEXT PRIMARY KEY,
        expire_time INTEGER
      )
    `);

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_expire_time ON visit_ips(expire_time)
    `);

    // 初始化总计数（如果不存在）
    const insert = this.db.prepare('INSERT OR IGNORE INTO total_visits (id, count) VALUES (1, 0)');
    insert.run();
  }

  /**
   * 记录访问
   */
  async recordVisit(date, ip, timestamp) {
    const ipKey = `${date}:${ip}`;
    const expireTime = timestamp + 86400000; // 24小时后过期

    // 清理过期的 IP 记录
    this.cleanupExpiredIPs(timestamp);

    // 检查是否是新访问
    const checkStmt = this.db.prepare('SELECT 1 FROM visit_ips WHERE ip_date_key = ?');
    const exists = checkStmt.get(ipKey);
    const isNewVisit = !exists;

    if (isNewVisit) {
      // 使用事务保证原子性
      const transaction = this.db.transaction(() => {
        // 记录 IP
        const insertIp = this.db.prepare('INSERT INTO visit_ips (ip_date_key, expire_time) VALUES (?, ?)');
        insertIp.run(ipKey, expireTime);

        // 更新今日计数
        const updateDaily = this.db.prepare(`
          INSERT INTO daily_visits (date, count) VALUES (?, 1)
          ON CONFLICT(date) DO UPDATE SET count = count + 1
        `);
        updateDaily.run(date);

        // 更新总计数
        const updateTotal = this.db.prepare('UPDATE total_visits SET count = count + 1 WHERE id = 1');
        updateTotal.run();
      });

      transaction();
    }

    // 获取统计数据
    const dailyStmt = this.db.prepare('SELECT count FROM daily_visits WHERE date = ?');
    const totalStmt = this.db.prepare('SELECT count FROM total_visits WHERE id = 1');

    const dailyRow = dailyStmt.get(date);
    const totalRow = totalStmt.get();

    return {
      todayCount: dailyRow ? dailyRow.count : 0,
      totalCount: totalRow ? totalRow.count : 0,
      isNewVisit
    };
  }

  /**
   * 查询访问统计
   */
  async getVisitStats(date) {
    const dailyStmt = this.db.prepare('SELECT count FROM daily_visits WHERE date = ?');
    const totalStmt = this.db.prepare('SELECT count FROM total_visits WHERE id = 1');

    const dailyRow = dailyStmt.get(date);
    const totalRow = totalStmt.get();

    return {
      todayCount: dailyRow ? dailyRow.count : 0,
      totalCount: totalRow ? totalRow.count : 0,
      date
    };
  }

  /**
   * 清理过期的 IP 记录
   */
  cleanupExpiredIPs(currentTimestamp) {
    const stmt = this.db.prepare('DELETE FROM visit_ips WHERE expire_time < ?');
    stmt.run(currentTimestamp);
  }

  /**
   * 导出所有访问数据
   * @returns {Object} { daily: {}, total: number }
   */
  async exportData() {
    try {
      // 获取所有每日数据
      const dailyStmt = this.db.prepare('SELECT date, count FROM daily_visits');
      const dailyRows = dailyStmt.all();

      const daily = {};
      for (const row of dailyRows) {
        daily[row.date] = row.count;
      }

      // 获取总数
      const totalStmt = this.db.prepare('SELECT count FROM total_visits WHERE id = 1');
      const totalRow = totalStmt.get();
      const total = totalRow ? totalRow.count : 0;

      return { daily, total };
    } catch (error) {
      console.error('导出数据失败:', error);
      throw error;
    }
  }

  /**
   * 导入访问数据
   * @param {Object} importData - { daily: {}, total: number }
   * @param {string} mode - "merge" 或 "replace"
   * @returns {Object} { success: boolean, message: string }
   */
  async importData(importData, mode = 'merge') {
    try {
      const transaction = this.db.transaction(() => {
        if (mode === 'replace') {
          // 清空现有数据
          this.db.prepare('DELETE FROM daily_visits').run();
          this.db.prepare('DELETE FROM visit_ips').run();
          this.db.prepare('UPDATE total_visits SET count = 0 WHERE id = 1').run();

          // 插入新数据
          const insertDaily = this.db.prepare('INSERT INTO daily_visits (date, count) VALUES (?, ?)');
          for (const [date, count] of Object.entries(importData.daily || {})) {
            insertDaily.run(date, count);
          }

          // 更新总数
          this.db.prepare('UPDATE total_visits SET count = ? WHERE id = 1').run(importData.total || 0);
        } else if (mode === 'merge') {
          // 合并每日数据
          const mergeDaily = this.db.prepare(`
            INSERT INTO daily_visits (date, count) VALUES (?, ?)
            ON CONFLICT(date) DO UPDATE SET count = count + excluded.count
          `);

          for (const [date, count] of Object.entries(importData.daily || {})) {
            mergeDaily.run(date, count);
          }

          // 累加总数
          this.db.prepare('UPDATE total_visits SET count = count + ? WHERE id = 1').run(importData.total || 0);
        } else {
          throw new Error('无效的导入模式');
        }
      });

      transaction();
      return { success: true, message: mode === 'replace' ? '数据已替换' : '数据已合并' };
    } catch (error) {
      console.error('导入数据失败:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = SqliteAdapter;
