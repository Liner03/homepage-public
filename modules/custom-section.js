/**
 * 自定义栏目模块
 * 
 * 这个模块允许开发者自定义第三个标签页的内容
 * 可以是日记统计、项目展示、个人作品或任何其他内容
 * 
 * 使用方法：
 * 1. 在 custom-section-config.js 中配置栏目信息
 * 2. 在这个文件中实现具体的功能逻辑
 * 3. 如果不需要自定义栏目，在配置中设置 enabled: false
 */

// 导入配置
let customSectionConfig = {};
try {
    if (typeof CUSTOM_SECTION_CONFIG !== 'undefined') {
        customSectionConfig = CUSTOM_SECTION_CONFIG;
    }
} catch (e) {
    console.warn('自定义栏目配置未找到，使用默认配置');
}

/**
 * 初始化自定义栏目
 */
function initCustomSection() {
    console.log('开始初始化自定义栏目...');

    if (!customSectionConfig.enabled) {
        console.log('自定义栏目已禁用');
        hideCustomSection();
        return;
    }

    console.log('初始化自定义栏目:', customSectionConfig.title, '类型:', customSectionConfig.type);

    // 显示自定义栏目
    showCustomSection();

    // 更新标签页标题和图标
    updateTabTitle();

    // 根据类型初始化不同的功能
    switch (customSectionConfig.type) {
        case 'diary':
            initDiaryStats();
            break;
        case 'projects':
            initProjectsDisplay();
            break;
        case 'custom':
            initCustomContent();
            break;
        default:
            console.warn('未知的自定义栏目类型:', customSectionConfig.type);
            hideCustomSection();
    }
}

/**
 * 显示自定义栏目
 */
function showCustomSection() {
    const tabButton = document.getElementById('view-diary');
    const sectionContainer = document.querySelector('.diary-stats');

    if (tabButton) {
        tabButton.style.display = '';
        console.log('显示自定义栏目标签页');
    }

    if (sectionContainer) {
        sectionContainer.style.display = 'none'; // 默认隐藏，等待用户点击
        console.log('准备自定义栏目容器');
    }
}

/**
 * 隐藏自定义栏目
 */
function hideCustomSection() {
    const tabButton = document.getElementById('view-diary');
    const sectionContent = document.querySelector('.diary-stats');

    if (tabButton) {
        tabButton.style.display = 'none';
        console.log('隐藏自定义栏目标签页');
    }

    if (sectionContent) {
        sectionContent.style.display = 'none';
        console.log('隐藏自定义栏目容器');
    }
}

/**
 * 更新标签页标题和图标
 */
function updateTabTitle() {
    const tabButton = document.getElementById('view-diary');
    if (tabButton && customSectionConfig.title) {
        tabButton.textContent = customSectionConfig.title;
        console.log('更新标签页标题为:', customSectionConfig.title);
    }

    // 更新栏目标题和图标
    const sectionContainer = document.querySelector('.diary-stats');
    if (sectionContainer) {
        const titleElement = sectionContainer.querySelector('h2');
        if (titleElement && customSectionConfig.title && customSectionConfig.icon) {
            titleElement.innerHTML = `<i class="${customSectionConfig.icon}"></i> ${customSectionConfig.title}`;
            console.log('更新栏目标题和图标');
        }
    }
}

/**
 * 日记统计功能（使用本地 RSS 代理 API）
 */
async function initDiaryStats() {
    try {
        // 使用本地 API 端点（后端会代理 RSS 并缓存）
        const endpoint = '/api/diary/stats';

        console.log('正在请求日记API:', endpoint);

        const response = await fetch(endpoint);
        console.log('API响应状态:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API请求失败:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('API响应数据:', result);

        // 检查API响应格式
        if (!result.success) {
            console.error('API返回错误:', result.message);
            throw new Error(result.message || '获取日记统计失败');
        }

        const data = result.data;
        const {
            consecutive_days: consecutive,
            total_days_with_entries: totalDays,
            total_entries: totalEntries,
            latest_entry_date: latestDate,
            current_streak_start: streakStart
        } = data;

        setText('diary-consecutive', consecutive ?? '--');
        setText('diary-total-days', totalDays ?? '--');
        setText('diary-total-entries', totalEntries ?? '--');
        setText('diary-latest', latestDate ? formatDate(latestDate) : '--');
        setText('diary-streak-start', streakStart ? formatDate(streakStart) : '--');

        console.log('日记统计数据加载成功:', {
            consecutive,
            totalDays,
            totalEntries,
            latestDate,
            streakStart,
            cached: result.cached
        });

        // 如果数据来自缓存，在控制台提示
        if (result.cached) {
            console.log('📦 数据来自缓存');
        }
    } catch (e) {
        console.warn('加载日记统计失败：', e);
        console.warn('请确保已在后台配置页面设置 RSS 订阅地址');
        setText('diary-consecutive', '--');
        setText('diary-total-days', '--');
        setText('diary-total-entries', '--');
        setText('diary-latest', '--');
        setText('diary-streak-start', '--');
    }
}

/**
 * 项目展示功能
 */
function initProjectsDisplay() {
    const container = document.querySelector('.diary-stats');
    if (!container) return;

    const projects = customSectionConfig.config.projects || [];
    
    container.innerHTML = `
        <h2><i class="${customSectionConfig.icon || 'fas fa-folder'}"></i> ${customSectionConfig.title}</h2>
        <div class="projects-grid">
            ${projects.map(project => `
                <div class="project-item">
                    <div class="project-header">
                        <h3>${project.name}</h3>
                        <span class="project-status ${project.status}">${project.status}</span>
                    </div>
                    <p class="project-description">${project.description}</p>
                    <div class="project-links">
                        ${project.github ? `<a href="${project.github}" target="_blank"><i class="fab fa-github"></i></a>` : ''}
                        ${project.demo ? `<a href="${project.demo}" target="_blank"><i class="fas fa-external-link-alt"></i></a>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * 自定义内容功能
 */
function initCustomContent() {
    const container = document.querySelector('.diary-stats');
    if (!container) return;

    const customHTML = customSectionConfig.config.html || '<p>请在配置中设置自定义内容</p>';
    
    container.innerHTML = `
        <h2><i class="${customSectionConfig.icon || 'fas fa-star'}"></i> ${customSectionConfig.title}</h2>
        <div class="custom-content">
            ${customHTML}
        </div>
    `;

    // 如果有自定义JavaScript，执行它
    if (customSectionConfig.config.javascript) {
        try {
            eval(customSectionConfig.config.javascript);
        } catch (e) {
            console.error('执行自定义JavaScript失败:', e);
        }
    }
}

/**
 * 工具函数
 */
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
}

function formatDate(iso) {
    try {
        const d = new Date(iso);
        return d.toISOString().slice(0, 10);
    } catch {
        return iso;
    }
}

// 导出函数供外部调用
if (typeof window !== 'undefined') {
    window.initCustomSection = initCustomSection;
}

// 如果是模块环境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initCustomSection,
        initDiaryStats,
        initProjectsDisplay,
        initCustomContent
    };
}
