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
}

module.exports = CloudflareAdapter;
