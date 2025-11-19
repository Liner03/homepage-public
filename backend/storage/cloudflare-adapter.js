/**
 * Cloudflare KV 存储适配器
 * 通过 Cloudflare REST API 访问 KV 存储
 * 适合已有 Cloudflare Pages 部署的场景
 */
class CloudflareAdapter {
  constructor(config) {
    this.accountId = config.accountId;
    this.namespaceId = config.namespaceId;
    this.apiToken = config.apiToken;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}`;

    if (!this.accountId || !this.namespaceId || !this.apiToken) {
      throw new Error('Cloudflare KV 配置不完整，请检查 CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_NAMESPACE_ID, CLOUDFLARE_API_TOKEN');
    }
  }

  /**
   * KV GET 请求
   */
  async kvGet(key) {
    const url = `${this.baseUrl}/values/${key}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`KV GET 失败: ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * KV PUT 请求
   */
  async kvPut(key, value, expirationTtl = null) {
    const url = `${this.baseUrl}/values/${key}${expirationTtl ? `?expiration_ttl=${expirationTtl}` : ''}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'text/plain'
      },
      body: value
    });

    if (!response.ok) {
      throw new Error(`KV PUT 失败: ${response.statusText}`);
    }

    return true;
  }

  /**
   * 记录访问
   */
  async recordVisit(date, ip, timestamp) {
    const todayKey = `daily-visit:${date}`;
    const totalKey = 'daily-visit:total';
    const ipKey = `daily-visit:ip:${date}:${ip}`;

    try {
      // 检查该 IP 今天是否已经访问过
      const existingIP = await this.kvGet(ipKey);
      const isNewVisit = !existingIP;

      let todayCount = 0;
      let totalCount = 0;

      if (isNewVisit) {
        // 新访问：更新今日计数
        const todayRaw = await this.kvGet(todayKey);
        todayCount = todayRaw ? parseInt(todayRaw) + 1 : 1;
        await this.kvPut(todayKey, todayCount.toString());

        // 更新总计数
        const totalRaw = await this.kvGet(totalKey);
        totalCount = totalRaw ? parseInt(totalRaw) + 1 : 1;
        await this.kvPut(totalKey, totalCount.toString());

        // 记录 IP 访问（24小时过期）
        await this.kvPut(ipKey, timestamp.toString(), 86400);

        console.log(`新访问 - IP: ${ip}, 日期: ${date}, 今日: ${todayCount}, 总计: ${totalCount}`);
      } else {
        // 已访问过：只返回当前计数
        const todayRaw = await this.kvGet(todayKey);
        const totalRaw = await this.kvGet(totalKey);
        todayCount = todayRaw ? parseInt(todayRaw) : 0;
        totalCount = totalRaw ? parseInt(totalRaw) : 0;

        console.log(`重复访问 - IP: ${ip}, 日期: ${date}`);
      }

      return {
        todayCount,
        totalCount,
        isNewVisit
      };
    } catch (error) {
      console.error('Cloudflare KV 操作失败:', error);
      throw error;
    }
  }

  /**
   * 查询访问统计
   */
  async getVisitStats(date) {
    try {
      const todayKey = `daily-visit:${date}`;
      const totalKey = 'daily-visit:total';

      const todayRaw = await this.kvGet(todayKey);
      const totalRaw = await this.kvGet(totalKey);

      return {
        todayCount: todayRaw ? parseInt(todayRaw) : 0,
        totalCount: totalRaw ? parseInt(totalRaw) : 0,
        date
      };
    } catch (error) {
      console.error('Cloudflare KV 查询失败:', error);
      throw error;
    }
  }

  /**
   * 列出所有键（支持前缀过滤）
   */
  async kvList(prefix = '') {
    const url = `${this.baseUrl}/keys${prefix ? `?prefix=${prefix}` : ''}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`KV LIST 失败: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result || [];
  }

  /**
   * 批量删除键
   */
  async kvDeleteBulk(keys) {
    const url = `${this.baseUrl}/bulk`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(keys)
    });

    if (!response.ok) {
      throw new Error(`KV DELETE BULK 失败: ${response.statusText}`);
    }

    return true;
  }

  /**
   * 导出所有访问数据
   * @returns {Object} { daily: {}, total: number }
   */
  async exportData() {
    try {
      // 列出所有 daily-visit: 开头的键（排除 IP 键）
      const keys = await this.kvList('daily-visit:');

      const daily = {};
      let total = 0;

      // 遍历所有键，获取数据
      for (const key of keys) {
        const keyName = key.name;

        // 跳过 IP 记录和 total 键
        if (keyName.startsWith('daily-visit:ip:')) {
          continue;
        }

        if (keyName === 'daily-visit:total') {
          const totalRaw = await this.kvGet(keyName);
          total = totalRaw ? parseInt(totalRaw) : 0;
        } else if (keyName.startsWith('daily-visit:')) {
          // 提取日期 (daily-visit:YYYY-MM-DD)
          const date = keyName.replace('daily-visit:', '');
          const countRaw = await this.kvGet(keyName);
          daily[date] = countRaw ? parseInt(countRaw) : 0;
        }
      }

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
      if (mode === 'replace') {
        // 清空现有数据
        const keys = await this.kvList('daily-visit:');
        const keysToDelete = keys
          .filter(k => !k.name.startsWith('daily-visit:ip:')) // 保留 IP 记录（会自动过期）
          .map(k => k.name);

        if (keysToDelete.length > 0) {
          await this.kvDeleteBulk(keysToDelete);
        }

        // 插入新数据
        for (const [date, count] of Object.entries(importData.daily || {})) {
          await this.kvPut(`daily-visit:${date}`, count.toString());
        }

        // 更新总数
        await this.kvPut('daily-visit:total', (importData.total || 0).toString());

        return { success: true, message: '数据已替换' };
      } else if (mode === 'merge') {
        // 合并每日数据
        for (const [date, count] of Object.entries(importData.daily || {})) {
          const todayKey = `daily-visit:${date}`;
          const existingRaw = await this.kvGet(todayKey);
          const existingCount = existingRaw ? parseInt(existingRaw) : 0;
          await this.kvPut(todayKey, (existingCount + count).toString());
        }

        // 累加总数
        const totalRaw = await this.kvGet('daily-visit:total');
        const existingTotal = totalRaw ? parseInt(totalRaw) : 0;
        await this.kvPut('daily-visit:total', (existingTotal + (importData.total || 0)).toString());

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

module.exports = CloudflareAdapter;
