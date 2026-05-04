/**
 * solodungeons.js - 单人副本和掉落符文模块
 *
 * 功能：
 * - 获取单人副本列表和掉落符文列表
 * - 基于距离、奖励、难度等多维度评分排序
 * - 复用战斗 TAB (user API) 数据获取玩家位置
 *
 * 数据加载流程：
 * 1. 检查 user API 数据是否存在，不存在则加载并填充战斗 TAB
 * 2. 加载单人副本/符文列表
 * 3. 如果返回的玩家位置与全局数据不符，强制刷新 user 数据
 */

(function () {
    'use strict';

    // API 端点
    const API_ENDPOINTS = {
        soloDungeons: 'https://api.stellarodyssey.app/api/public/solodungeons',
        runeDrops: 'https://api.stellarodyssey.app/api/public/activerunes',
        user: 'https://api.stellarodyssey.app/api/public/user',
        journal: 'https://api.stellarodyssey.app/api/public/journal'
    };

    // 数据缓存（避免切换语言时重新请求 API）
    let cachedDungeonsData = null;
    let cachedRunesData = null;


    // 详细寻路面板激活状态（语言切换时用于重新渲染）
    let _activePathDetail = null; // { startPos, endPos, index, route, trajectories, totalDistance, stepLimit }
    let _stepLimit = null; // 每跳最大距离（光年），null 表示无限制

    // 已选路线列表
    let selectedRoutes = [];

    // 规划返回原位
    let _returnToOrigin = false;

    // 副本 Filter 状态
    let _dungeonFilter = {
        rewardMin: -20,
        rewardMax: 50,
        diffMin: -20,
        diffMax: 20,
        attemptsMin: 1,
        attemptsMax: 12,
        roomsMin: 5,
        roomsMax: 10,
    };

    // 未过滤的原始副本列表（用于 filter 变更时重新过滤）
    let _allDungeons = [];

    // 待选列表（用于动态重新评分）
    let remainingDungeons = [];
    let remainingRunes = [];

    // 玩家位置（用于起点计算）
    let playerPos = null;

    /**
     * 获取 API Key
     */
    function getApiKey() {
        let apiKey = localStorage.getItem('systems_api_key') || localStorage.getItem('api_key');
        const systemsApiKeyInput = document.getElementById('systems_api_key');
        const apiKeyInput = document.getElementById('api_key');
        if (systemsApiKeyInput && systemsApiKeyInput.value) {
            apiKey = systemsApiKeyInput.value;
        } else if (apiKeyInput && apiKeyInput.value) {
            apiKey = apiKeyInput.value;
        }
        return apiKey;
    }

    /**
     * 翻译辅助函数（支持插值 vars）
     */
    function t(key, varsOrFallback) {
        if (typeof window._t === 'function') {
            // 如果第二个参数是对象，传递给 _t 做插值
            if (varsOrFallback && typeof varsOrFallback === 'object') {
                const result = window._t(key, varsOrFallback);
                return result !== key ? result : key;
            }
            const result = window._t(key);
            // 如果翻译结果等于key（未找到），则使用fallback
            if (result === key && varsOrFallback !== undefined) {
                return varsOrFallback;
            }
            return result;
        }
        return (varsOrFallback && typeof varsOrFallback !== 'object') ? varsOrFallback : key;
    }

    /**
     * 延迟函数
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== 数据加载与共享 ====================

    /**
     * 加载 User API 数据（如果不存在）
     * 返回后保存到全局并填充战斗 TAB
     */
    async function ensureUserData() {
        if (window.stellarOdysseyUserData) {
            return window.stellarOdysseyUserData;
        }

        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('请先输入 API Key');
        }

        const response = await fetch(API_ENDPOINTS.user, {
            headers: {
                'Accept': 'application/json',
                'sodyssey-api-key': apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`User API HTTP ${response.status}`);
        }

        const data = await response.json();
        window.stellarOdysseyUserData = data;

        // 填充战斗 TAB 数据
        populateBattleTab(data);

        return data;
    }

    /**
     * 强制刷新 User 数据
     */
    async function forceRefreshUserData() {
        window.stellarOdysseyUserData = null;
        await ensureUserData();
    }

    /**
     * 强制刷新 Journal 数据（更新星图全局暴露）
     */
    async function forceRefreshJournalData() {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('请先输入 API Key');
        }

        const response = await fetch(API_ENDPOINTS.journal, {
            headers: {
                'Accept': 'application/json',
                'sodyssey-api-key': apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`Journal API HTTP ${response.status}`);
        }

        const journalData = await response.json();
        window.stellarOdysseyJournalData = journalData;

        // 同时更新 localStorage 中的玩家位置
        if (journalData.fullJournal && journalData.fullJournal.length > 0) {
            const pos = journalData.fullJournal[0];
            if (typeof pos.coordinate_x === 'number' && typeof pos.coordinate_y === 'number') {
                localStorage.setItem('player_position', JSON.stringify({
                    x: pos.coordinate_x,
                    y: pos.coordinate_y
                }));
            }
        }

        return journalData;
    }

    /**
     * 强制刷新 User 和 Journal 数据
     */
    async function forceRefreshUserAndJournalData() {
        // 先刷新 User 数据
        await forceRefreshUserData();
        // 延迟 1 秒避免请求过快
        await delay(1000);
        // 再刷新 Journal 数据
        await forceRefreshJournalData();
    }

    /**
     * 填充战斗 TAB 数据
     */
    function populateBattleTab(userData) {
        if (!userData || !userData.data) return;

        const data = userData.data;

        // 填充基础属性
        if (data.stats) {
            setInputValue('power', data.stats.power);
            setInputValue('precision', data.stats.precision);
            setInputValue('evasion', data.stats.evasion);
            setInputValue('hull', data.stats.hull);
            setInputValue('available_points', data.stats.available);
        }

        // 填充飞船装备
        if (data.ship) {
            setInputValue('weapon', data.ship.weapon);
            setInputValue('shield', data.ship.shield);
        }

        // 填充克隆体属性
        if (data.clones) {
            setInputValue('critical_chance', data.clones.critical_chance);
            setInputValue('critical_damage', data.clones.critical_damage);
            setInputValue('dual_shot', data.clones.dual_shot);
        }

        // 填充当前 NPC
        if (data.actions) {
            setInputValue('current_npc', data.actions.currentNpc);
            setInputValue('current_npc_level', data.actions.currentNpcLevel);
        }

        // 填充技能
        if (data.skills) {
            Object.entries(data.skills).forEach(([skill, level]) => {
                setInputValue(`skill_${skill}`, level);
            });
        }

        // 填充建筑
        if (data.squadron && data.squadron.buildings) {
            data.squadron.buildings.forEach(b => {
                setInputValue(`building_${b.name}`, b.level);
            });
        }

        // 填充 premium
        if (data.premium) {
            setInputValue('premium', data.premium);
        }

        // 填充声望
        if (data.reputation) {
            Object.entries(data.reputation).forEach(([rep, value]) => {
                setInputValue(`reputation_${rep}`, value);
            });
        }
    }

    /**
     * 设置输入框值
     */
    function setInputValue(id, value) {
        const input = document.getElementById(id);
        if (input && value !== undefined && value !== null) {
            input.value = value;
            // 触发 change 事件
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    // ==================== 玩家位置 ====================

    /**
     * 从 dungeon/rune 数据中提取玩家位置
     */
    function extractPlayerLocationFromDungeons(data) {
        if (!data || !data.dungeons || data.dungeons.length === 0) {
            return null;
        }
        const playerLocationStr = data.dungeons[0].playerLocation;
        if (!playerLocationStr) return null;

        try {
            const match = playerLocationStr.match(/\[(-?\d+),(-?\d+),(-?\d+)\]/);
            if (match) {
                return { x: parseInt(match[1], 10), y: parseInt(match[2], 10) };
            }
        } catch (e) {
            console.warn('Failed to parse playerLocation:', playerLocationStr);
        }
        return null;
    }

    /**
     * 从 user 数据中提取玩家位置
     */
    function extractPlayerLocationFromUser(userData) {
        if (!userData || !userData.data || !userData.data.location) return null;
        const loc = userData.data.location;
        if (typeof loc.coordinate_x === 'number' && typeof loc.coordinate_y === 'number') {
            return { x: loc.coordinate_x, y: loc.coordinate_y };
        }
        return null;
    }

    /**
     * 获取玩家当前位置
     * 优先从全局 user 数据获取，其次 localStorage
     */
    function getPlayerPosition() {
        // 从 user 数据
        if (window.stellarOdysseyUserData) {
            const pos = extractPlayerLocationFromUser(window.stellarOdysseyUserData);
            if (pos) return pos;
        }

        // 从 localStorage
        const savedPos = localStorage.getItem('player_position');
        if (savedPos) {
            try {
                const pos = JSON.parse(savedPos);
                if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                    return pos;
                }
            } catch (e) {
                console.warn('Failed to parse player position:', e);
            }
        }

        return null;
    }

    /**
     * 从 dungeon/rune 数据中提取玩家位置（作为备选）
     */
    function getPlayerPositionFromDungeons(dungeonsData, runesData) {
        if (dungeonsData) {
            const pos = extractPlayerLocationFromDungeons(dungeonsData);
            if (pos) return pos;
        }
        if (runesData) {
            const pos = extractPlayerLocationFromDungeons(runesData);
            if (pos) return pos;
        }
        return null;
    }

    /**
     * 从 journal 数据中提取玩家位置
     */
    function extractPlayerLocationFromJournal(journalData) {
        if (!journalData || !journalData.fullJournal || journalData.fullJournal.length === 0) {
            return null;
        }
        const pos = journalData.fullJournal[0];
        if (typeof pos.coordinate_x === 'number' && typeof pos.coordinate_y === 'number') {
            return { x: pos.coordinate_x, y: pos.coordinate_y };
        }
        return null;
    }

    /**
     * 检查 dungeon 返回的玩家位置是否与全局 journal 数据一致
     * 注意：User API 不返回坐标，坐标只在 Journal API 中
     */
    function checkPlayerPositionMismatch(dungeonData) {
        const dungeonPos = extractPlayerLocationFromDungeons(dungeonData);
        if (!dungeonPos) return false;

        // 优先从全局 journal 数据获取位置
        let globalPos = null;
        if (window.stellarOdysseyJournalData) {
            globalPos = extractPlayerLocationFromJournal(window.stellarOdysseyJournalData);
        }

        // 如果全局没有 journal 数据，尝试 localStorage
        if (!globalPos) {
            globalPos = getPlayerPosition();
        }

        if (!globalPos) return true; // 全局没有位置，需要刷新

        // 严格对比，不允许误差
        return dungeonPos.x !== globalPos.x || dungeonPos.y !== globalPos.y;
    }

    // ==================== 核心功能 ====================

    /**
     * 计算两点之间的直线距离（光年）
     * 坐标每1单位 = 10光年
     */
    function calculateDistance(x1, y1, x2, y2) {
        const coordinateUnits = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        return coordinateUnits * 10;
    }

    /**
     * 获取两点之间的寻路距离（光年）
     * 优先使用 PathfinderService（含传送门），
     * 降级到直线距离并标记为估算。
     * 返回 { distance: number, isPathfinder: boolean }
     * 始终比较三条路线（直接飞行、初始星系、空间站），选取最短距离。
     */
    function getPathfinderDistance(x1, y1, x2, y2) {
        // 优先用 PathfinderService 单例（独立于星图 TAB）
        const grid = (window.PathfinderService && typeof window.PathfinderService.getGrid === 'function')
            ? window.PathfinderService.getGrid()
            : window.stellarOdysseyPathfinderGrid;  // 兼容星图 TAB 旧方式

        if (grid && typeof grid.findShortestPath === 'function') {
            try {
                const result = grid.findShortestPath({ x: x1, y: y1 }, { x: x2, y: y2 });
                const directDist = result.directDistance ?? null;
                const starterDist = result.starterSystemOnly?.distance ?? null;
                const stationDist = result.withSpaceStation?.distance ?? null;
                // Always compare all three routes and pick the shortest
                const distances = [];
                if (directDist !== null && isFinite(directDist)) distances.push(directDist);
                if (starterDist !== null && isFinite(starterDist)) distances.push(starterDist);
                if (stationDist !== null && isFinite(stationDist)) distances.push(stationDist);
                if (distances.length > 0) {
                    return { distance: Math.min(...distances), isPathfinder: true };
                }
            } catch (e) {
                console.warn('[SoloDungeons] Pathfinder failed, fallback to linear:', e);
            }
        }
        return { distance: calculateDistance(x1, y1, x2, y2), isPathfinder: false };
    }

    /**
     * 根据数值计算颜色（深色渐变）
     */
    /**
     * 根据剩余时间计算颜色（基于评分公式：19h=100分，纯绿）
     * @param {Object} item - 副本/符文 item
     * @returns {string} CSS color
     */
    function getTimeColor(item) {
        const ts = getExpiresAt(item);
        if (ts === null) return '#9ca3af';
        const now = new Date();
        const expiry = new Date(ts * 1000);
        const diffHours = (expiry - now) / (1000 * 60 * 60);
        if (diffHours <= 0) return '#ef4444'; // 过期=红色
        // timeScore = min(100, timeRemainingHours / 19 * 100)
        const timeScore = Math.min(100, Math.max(0, diffHours / 19 * 100));
        // 0分=红色，50分=黄色，100分=绿色
        if (timeScore <= 20) {
            return '#ef4444'; // 红色
        } else if (timeScore <= 50) {
            return '#f97316'; // 橙色
        } else if (timeScore <= 75) {
            return '#eab308'; // 黄色
        } else {
            return '#22c55e'; // 绿色
        }
    }

    function getModifierColor(value, isDifficulty = false) {
        const clamped = Math.max(-50, Math.min(50, value || 0));
        const normalized = clamped / 50;

        if (normalized === 0) return '#9ca3af';

        if (isDifficulty) {
            if (normalized < 0) {
                const lightness = 45 + Math.abs(normalized) * 15;
                return `hsl(145, 85%, ${lightness}%)`;
            } else {
                const lightness = 45 + normalized * 15;
                return `hsl(0, 85%, ${lightness}%)`;
            }
        } else {
            if (normalized < 0) {
                const lightness = 45 + Math.abs(normalized) * 15;
                return `hsl(0, 85%, ${lightness}%)`;
            } else {
                const lightness = 45 + normalized * 15;
                return `hsl(145, 85%, ${lightness}%)`;
            }
        }
    }

    /**
     * 格式化时间差
     * 兼容副本 closesAt（Unix timestamp）和符文 expires_at（Unix timestamp）
     */
    function formatTimeRemaining(expiresAt) {
        const now = new Date();
        let expiry;

        if (typeof expiresAt === 'number') {
            expiry = new Date(expiresAt * 1000);
        } else {
            expiry = new Date(expiresAt);
        }

        const diffMs = expiry - now;
        if (isNaN(diffMs) || diffMs <= 0) {
            return t('solodungeons.expired', '已过期');
        }

        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHours > 0) {
            return `${diffHours}h ${diffMinutes}m`;
        }
        return `${diffMinutes}m`;
    }

    /**
     * 格式化时间差（从 item 自动提取过期字段）
     */
    function formatItemTimeRemaining(item) {
        const ts = getExpiresAt(item);
        if (ts === null) return '—';
        return formatTimeRemaining(ts);
    }

    /**
     * 从 item 中提取坐标
     * 兼容副本（system.coordinate_x/y）和符文（顶层 coordinate_x/y）
     */
    function getCoordinates(item) {
        if (item.system && typeof item.system.coordinate_x === 'number' && typeof item.system.coordinate_y === 'number') {
            return { x: item.system.coordinate_x, y: item.system.coordinate_y };
        }
        if (typeof item.coordinate_x === 'number' && typeof item.coordinate_y === 'number') {
            return { x: item.coordinate_x, y: item.coordinate_y };
        }
        return null;
    }

    /**
     * 获取 item 的过期时间戳（兼容副本 closesAt 和符文 expires_at）
     */
    function getExpiresAt(item) {
        if (typeof item.closesAt === 'number') return item.closesAt;
        if (typeof item.expires_at === 'number') return item.expires_at;
        return null;
    }

    /**
     * 判断 item 是否为符文
     */
    function isRuneItem(item) {
        return typeof item.rune_name === 'string' || typeof item.rune_index === 'number';
    }

    /**
     * 获取当前起点坐标（已选路线最后一项的坐标，或玩家位置）
     */
    function getCurrentStartPos() {
        if (selectedRoutes.length > 0) {
            const lastRoute = selectedRoutes[selectedRoutes.length - 1];
            return getCoordinates(lastRoute);
        }
        return playerPos;
    }

    /**
     * 重新计算所有待选项的评分并重新渲染
     */
    function recalculateAndRender() {
        const container = document.getElementById('solodungeonsOutput');
        if (!container) return;

        // 数据尚未加载时不渲染（避免覆盖 loading 状态或空内容）
        if (cachedDungeonsData === null && cachedRunesData === null) return;

        // 直接委托给 renderCombinedTable（新版本始终显示表头，距离归一化以 remainingDungeons 为准）
        // dungeons 参数传 remainingDungeons 是安全的——renderCombinedTable 内部使用 remainingDungeons 进行过滤和归一化
        renderCombinedTable(remainingDungeons, remainingRunes, container, null, null);

        // 更新动作按钮状态
        updateActionButtons();

        // 渲染已选路线列表
        renderRouteList();
    }

    /**
     * 根据当前 _dungeonFilter 过滤副本列表
     */
    function applyDungeonFilter(dungeons) {
        if (!dungeons) return [];
        return dungeons.filter(d => {
            const reward = d.reward_modifier ?? 0;
            const diff   = d.difficulty_modifier ?? 0;
            const att    = d.attempts ?? 0;
            const rooms  = Array.isArray(d.rooms) ? d.rooms.length : 5;
            return (
                reward  >= _dungeonFilter.rewardMin  && reward  <= _dungeonFilter.rewardMax &&
                diff    >= _dungeonFilter.diffMin     && diff    <= _dungeonFilter.diffMax &&
                att     >= _dungeonFilter.attemptsMin && att     <= _dungeonFilter.attemptsMax &&
                rooms   >= _dungeonFilter.roomsMin   && rooms   <= _dungeonFilter.roomsMax
            );
        });
    }

    /**
     * 检查 filter 是否为默认值（用于显示 badge）
     */
    function isDungeonFilterActive() {
        return (
            _dungeonFilter.rewardMin  > -20 || _dungeonFilter.rewardMax  < 50 ||
            _dungeonFilter.diffMin    > -20 || _dungeonFilter.diffMax    < 20 ||
            _dungeonFilter.attemptsMin > 1   || _dungeonFilter.attemptsMax < 12 ||
            _dungeonFilter.roomsMin   > 5   || _dungeonFilter.roomsMax   < 10
        );
    }

    /**
     * 计算一批条目的距离上下限（用于距离评分归一化）
     * @param {Array} items     - 条目列表
     * @param {Object} startPos - 起点 {x, y}
     * @returns {{ minDist: number, maxDist: number }}
     */
    function computeDistanceBounds(items, startPos) {
        if (!startPos || items.length === 0) return { minDist: 0, maxDist: 1 };
        let minDist = Infinity, maxDist = -Infinity;
        for (const item of items) {
            const coords = getCoordinates(item);
            if (!coords) continue;
            const pfResult = getPathfinderDistance(startPos.x, startPos.y, coords.x, coords.y);
            const d = pfResult.distance;
            if (d < minDist) minDist = d;
            if (d > maxDist) maxDist = d;
        }
        if (!isFinite(minDist)) return { minDist: 0, maxDist: 1 };
        // 避免 min === max 时除以零
        if (minDist === maxDist) return { minDist, maxDist: maxDist + 1 };
        return { minDist, maxDist };
    }

    /**
     * 计算副本评分（使用寻路距离）
     * @param {Object} item       - 副本/符文条目
     * @param {Object} playerPos  - 起点 {x, y}
     * @param {Object} distBounds - 当前列表的距离上下限 { minDist, maxDist }
     * @param {number|null} stepLimit - 每跳最大距离（光年），null 表示无限制
     */
    function calculateScore(item, playerPos, distBounds, stepLimit) {
        if (!playerPos) {
            return { score: 0, details: { canReach: false, noPlayerPos: true } };
        }

        const coords = getCoordinates(item);
        if (!coords) {
            return { score: 0, details: { canReach: false, invalidCoords: true } };
        }

        const linearDistance = calculateDistance(playerPos.x, playerPos.y, coords.x, coords.y);

        // 根据步进限制选择寻路方式
        // 所有坐标都是可达的，步进限制只是分段方式
        let distance = linearDistance * 10;
        let isPathfinder = false;
        let stepLimited = false;

        const pfGrid = (window.PathfinderService && typeof window.PathfinderService.getGrid === 'function')
            ? window.PathfinderService.getGrid()
            : window.stellarOdysseyPathfinderGrid;

        if (stepLimit && pfGrid && typeof pfGrid.findStepLimitedPath === 'function') {
            // 步进限制模式
            try {
                const result = pfGrid.findStepLimitedPath(
                    { x: playerPos.x, y: playerPos.y },
                    { x: coords.x, y: coords.y },
                    stepLimit
                );
                distance = result.distance;
                isPathfinder = true;
                stepLimited = true;
            } catch (e) {
                // 降级到直线
                distance = linearDistance * 10;
            }
        } else {
            // 标准模式（无步进限制）
            const pfResult = getPathfinderDistance(playerPos.x, playerPos.y, coords.x, coords.y);
            distance = pfResult.distance;
            isPathfinder = pfResult.isPathfinder;
        }

        const now = new Date();
        const ts = getExpiresAt(item);
        const expiry = ts !== null ? new Date(ts * 1000) : new Date(item.closesAt * 1000);
        const timeRemainingHours = (expiry - now) / (1000 * 60 * 60);

        // 过期的不参与评分
        if (timeRemainingHours <= 0) {
            return { score: -1, details: { linearDistance, distance, isPathfinder, timeRemainingHours, canReach: false } };
        }

        const distanceScore = (() => {
            if (!distBounds) {
                // 无 bounds 时降级为指数衰减（兼容外部调用）
                return Math.max(0, 100 * Math.exp(-distance / 500));
            }
            const { minDist, maxDist } = distBounds;
            if (maxDist === minDist) return 100;
            // 最近=100, 最远=0，线性归一
            return Math.max(0, Math.min(100, (maxDist - distance) / (maxDist - minDist) * 100));
        })();
        const timeScore = Math.min(100, Math.max(0, timeRemainingHours / 19 * 100)); // 6-19h -> 19h=100分
        const rewardMod = item.reward_modifier || 0;
        const diffMod = item.difficulty_modifier || 0;
        // 合并奖励与难度：reward越高越好，difficulty越低越好
        // reward范围 -20~+50，difficulty范围 -20~+20，合并值 reward-difficulty 范围 -40~+70
        const mergedScore = Math.min(100, Math.max(0, (rewardMod - diffMod + 40) / 110 * 100));
        const roomsCount = Array.isArray(item.rooms) ? item.rooms.length : 5;
        // 房间数量评分：5间=0分，10间=100分
        const roomsScore = Math.min(100, Math.max(0, (roomsCount - 5) / 5 * 100));
        const attempts = item.attempts || 1; // 最低1次（0次已被过滤）
        // 尝试次数评分：1次=0分，12次=100分
        const attemptsScore = Math.min(100, Math.max(0, (attempts - 1) / 11 * 100));

        const score = (
            distanceScore * 0.20 +
            timeScore * 0.10 +
            mergedScore * 0.30 +
            roomsScore * 0.30 +
            attemptsScore * 0.10
        );

        return {
            score: Math.round(score),
            details: {
                linearDistance: Math.floor(linearDistance * 100) / 100,
                distance: Math.floor(distance * 100) / 100,
                isPathfinder,
                stepLimited,
                distanceScore: Math.round(distanceScore),
                timeRemainingHours: Math.round(timeRemainingHours * 10) / 10,
                timeScore: Math.round(timeScore),
                rewardMod,
                diffMod,
                mergedScore: Math.round(mergedScore),
                roomsCount,
                roomsScore: Math.round(roomsScore),
                attempts,
                attemptsScore: Math.round(attemptsScore),
                canReach: true,
                stepLimited
            }
        };
    }

    // ==================== 渲染 ====================

    /**
     * 构建固定表头 ListView HTML
     * @param {string} tableClass - sdt-dungeons | sdt-runes
     * @param {string} headerHtml - <th>...</th> 序列
     * @param {string} bodyHtml - <tr>...</tr> 序列（可为空字符串）
     * @param {string|null} emptyMsg - 无数据时显示的文字（可选）
     */
    function buildListView(tableClass, headerHtml, bodyHtml, emptyMsg) {
        let bodyContent = bodyHtml;
        if (!bodyContent) {
            const colCount = (headerHtml.match(/<th/g) || []).length || 1;
            const msg = emptyMsg || t('solodungeons.no_data', '暂无数据');
            bodyContent = `<tr><td colspan="${colCount}" class="solodungeons-listview-body-empty">${msg}</td></tr>`;
        }
        return `
        <div class="solodungeons-listview">
            <div class="solodungeons-listview-header">
                <table class="${tableClass}"><thead><tr>${headerHtml}</tr></thead></table>
            </div>
            <div class="solodungeons-listview-body">
                <table class="${tableClass}"><tbody>${bodyContent}</tbody></table>
            </div>
        </div>`;
    }

    function renderCombinedTable(dungeons, runes, container, dungeonsData, runesData) {
        // 优先从全局获取位置，如果没有则从 dungeon/rune 数据中提取
        const tempPlayerPos = getPlayerPosition();
        if (tempPlayerPos) {
            playerPos = tempPlayerPos;
        } else {
            playerPos = getPlayerPositionFromDungeons(dungeonsData, runesData);
        }

        // 检测 pathfinder 是否可用（优先 PathfinderService，兼容旧的全局变量）
        const pfGrid = (window.PathfinderService && typeof window.PathfinderService.getGrid === 'function')
            ? window.PathfinderService.getGrid()
            : window.stellarOdysseyPathfinderGrid;
        const pfAvailable = !!(pfGrid && typeof pfGrid.findShortestPath === 'function');

        // 初始化待选列表（只初始化一次，除非数据更新）
        console.log('[SoloDungeons] renderCombinedTable init check:', {
            remainingDungeonsLength: remainingDungeons.length,
            remainingRunesLength: remainingRunes.length,
            dungeonsLength: dungeons?.length,
            runesLength: runes?.length
        });
        // remainingDungeons / remainingRunes 已在 loadSoloDungeonsAndRunes 中由新 API 数据重置，
        // 此处不再需要初始化逻辑。

        let html = '';
        const playerPosStr = playerPos ? `[${playerPos.x}, ${playerPos.y}]` : t('solodungeons.unknown', '未知');

        // 获取当前起点
        const startPos = getCurrentStartPos();

        // 单人副本部分（始终渲染结构，有数据时显示列表，无数据时显示空占位）
        {
            let scoredDungeons = null;
            const dungeonRows = '';
            const dungeonSummary = '';
            if (remainingDungeons.length > 0) {
                const dungeonBounds = computeDistanceBounds(remainingDungeons, startPos);
                scoredDungeons = remainingDungeons.map(d => ({ ...d, ...calculateScore(d, startPos, dungeonBounds, _stepLimit) }))
                    .sort((a, b) => b.score - a.score);
            }
            html += `<div class="sdt-dungeon-section">`;
            html += `<div class="sdt-section-title">${t('block.solodungeons', '单人副本')}</div>`;
            html += `<div class="solodungeons-summary">
                <span class="summary-item">${t('solodungeons.total', '总计')}: <b>${remainingDungeons.length}</b></span>
                <span class="summary-item">${t('solodungeons.player_pos', '玩家位置')}: <b>${playerPosStr}</b></span>
            </div>`;
            html += buildListView(
                'sdt-dungeons',
                renderDungeonsHeader(pfAvailable),
                scoredDungeons ? renderDungeonsRows(scoredDungeons, pfAvailable) : '',
                scoredDungeons ? undefined : t('solodungeons.no_filtered_data', '无匹配的副本')
            );
            html += `</div>`;
        }

        // 掉落符文部分（始终渲染结构，有数据时显示列表，无数据时显示空占位）
        {
            let sortedRunes = null;
            if (remainingRunes.length > 0) {
                sortedRunes = [...remainingRunes].sort((a, b) => {
                    const ca = getCoordinates(a), cb = getCoordinates(b);
                    if (!ca || !startPos) return 0;
                    if (!cb) return -1;
                    const da = getPathfinderDistance(startPos.x, startPos.y, ca.x, ca.y).distance;
                    const db = getPathfinderDistance(startPos.x, startPos.y, cb.x, cb.y).distance;
                    return da - db;
                });
            }
            html += `<div class="sdt-rune-section">`;
            html += `<div class="sdt-section-title">${t('block.runedrops', '掉落符文')}</div>`;
            html += `<div class="solodungeons-summary">
                <span class="summary-item">${t('runedrops.total', '总计')}: <b>${remainingRunes.length}</b></span>
                <span class="summary-item">${t('solodungeons.player_pos', '玩家位置')}: <b>${playerPosStr}</b></span>
            </div>`;
            html += buildListView(
                'sdt-runes',
                renderRunesHeader(pfAvailable),
                sortedRunes ? renderRunesRows(sortedRunes, pfAvailable) : '',
                sortedRunes ? undefined : t('solodungeons.no_filtered_data', '无匹配的符文')
            );
            html += `</div>`;
        }

        container.innerHTML = html;

        // 绑定行选中事件
        container.querySelectorAll('.solodungeons-listview-body tr').forEach(row => {
            row.addEventListener('click', function () {
                // 只在同一个 listview-body 内取消其他选中
                const tbody = this.closest('.solodungeons-listview-body');
                tbody.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
                this.classList.add('selected');
            });
        });

        // 渲染已选路线列表
        renderRouteList();
    }

    /**
     * 添加到已选路线
     */
    function addToRoute(item, type) {
        const itemKey = generateItemKey(item);
        console.log('[SoloDungeons] addToRoute called:', { 
            itemKey, 
            type,
            remainingDungeonsCount: remainingDungeons.length,
            remainingRunesCount: remainingRunes.length
        });
        
        // 检查是否已存在
        if (selectedRoutes.some(r => generateItemKey(r) === itemKey)) {
            return; // 已存在
        }

        // 从待选列表移除
        if (type === 'dungeon') {
            remainingDungeons = remainingDungeons.filter(d => generateItemKey(d) !== itemKey);
        } else {
            remainingRunes = remainingRunes.filter(r => generateItemKey(r) !== itemKey);
        }

        // 添加到已选路线
        selectedRoutes.push({ ...item, _type: type, _key: itemKey });

        console.log('[SoloDungeons] After addToRoute:', {
            remainingDungeonsCount: remainingDungeons.length,
            remainingRunesCount: remainingRunes.length,
            selectedRoutesCount: selectedRoutes.length
        });

        // 重新计算并渲染
        recalculateAndRender();
    }

    /**
     * 从已选路线移除
     */
    function removeFromRoute(id) {
        // 找到要移除的项
        const route = selectedRoutes.find(r => r._key === id);
        if (!route) return;

        // 放回待选列表
        if (route._type === 'dungeon') {
            remainingDungeons.push(route);
        } else {
            remainingRunes.push(route);
        }

        // 从已选路线移除
        selectedRoutes = selectedRoutes.filter(r => r._key !== id);

        // 重新计算并渲染
        recalculateAndRender();
    }

    /**
     * 更新动作按钮状态
     */
    function updateActionButtons() {
        document.querySelectorAll('.sdt-action-btn:not(.disabled)').forEach(btn => {
            const id = btn.dataset.id;
            const isSelected = selectedRoutes.some(r => r._key === id);
            if (isSelected) {
                btn.classList.add('disabled');
            }
        });
        document.querySelectorAll('.sdt-action-btn.disabled').forEach(btn => {
            const id = btn.dataset.id;
            const isSelected = selectedRoutes.some(r => r._key === id);
            if (!isSelected) {
                btn.classList.remove('disabled');
            }
        });
    }

    /**
     * 计算并更新已选路线标题右侧的"总寻路距离"
     */
    function updateRouteListTotalDistance() {
        const el = document.getElementById('routeListTotalDistance');
        if (!el) return;

        if (selectedRoutes.length === 0) {
            el.textContent = '';
            return;
        }

        // 确保 playerPos 有值（可能数据已加载但 playerPos 尚未同步）
        let pos = playerPos;
        if (!pos) {
            pos = getPlayerPosition();
        }

        const pfGrid = (window.PathfinderService && typeof window.PathfinderService.getGrid === 'function')
            ? window.PathfinderService.getGrid()
            : window.stellarOdysseyPathfinderGrid;

        let totalDist = 0;
        for (const route of selectedRoutes) {
            const coords = getCoordinates(route);
            if (coords && pos) {
                if (_stepLimit && pfGrid && typeof pfGrid.findStepLimitedPath === 'function') {
                    const result = pfGrid.findStepLimitedPath(
                        { x: pos.x, y: pos.y },
                        { x: coords.x, y: coords.y },
                        _stepLimit
                    );
                    totalDist += result.distance;
                } else {
                    const pfResult = getPathfinderDistance(pos.x, pos.y, coords.x, coords.y);
                    totalDist += pfResult.distance;
                }
                pos = coords;
            } else {
                break;
            }
        }

        // 如果勾选了返回原位，加上返回距离（从最后目的地返回玩家位置）
        let returnDist = 0;
        if (_returnToOrigin && selectedRoutes.length > 0 && pos && playerPos) {
            if (_stepLimit && pfGrid && typeof pfGrid.findStepLimitedPath === 'function') {
                const result = pfGrid.findStepLimitedPath(
                    { x: pos.x, y: pos.y },
                    { x: playerPos.x, y: playerPos.y },
                    _stepLimit
                );
                returnDist = result.distance;
            } else {
                // 降级到寻路距离
                const pfResult = getPathfinderDistance(pos.x, pos.y, playerPos.x, playerPos.y);
                returnDist = pfResult.distance;
            }
        }

        const limitLabel = _stepLimit ? `[${_stepLimit}ly]` : '';
        const returnLabel = _returnToOrigin && selectedRoutes.length > 0 ? ` (${t('solodungeons.return_distance', '+返回:')} ${(Math.floor(returnDist * 100) / 100).toFixed(2)})` : '';
        el.textContent = `${t('solodungeons.total_distance', '总寻路距离')} ${limitLabel}: ${(Math.floor(totalDist * 100) / 100).toFixed(2)}${returnLabel}`;
    }

    /**
     * 渲染已选路线列表
     */
    function renderRouteList() {
        const container = document.getElementById('solodungeonsRouteList');
        if (!container) return;

        if (selectedRoutes.length === 0 && !_returnToOrigin) {
            container.innerHTML = `<div class="route-list-empty">${t('solodungeons.route_empty', '暂无已选路线')}</div>`;
            updateRouteListTotalDistance();
            return;
        }

        const removeSvg = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`;

        let html = selectedRoutes.map(route => {
            const coords = getCoordinates(route);
            const coordsStr = coords ? `[${coords.x},${coords.y}]` : '—';
            const typeText = route._type === 'dungeon' ? t('solodungeons.type_dungeon', '副本') : t('solodungeons.type_rune', '符文');
            const itemKey = route._key || generateItemKey(route);

            let scoreDisplay, scoreClass;
            if (isRuneItem(route)) {
                // 符文：不显示评分，显示符文名
                scoreDisplay = `<span style="font-size:0.7em;color:#a78bfa">${t('solodungeons.type_rune','符文')}</span>`;
                scoreClass = '';
            } else {
                scoreDisplay = route.score > 0 ? route.score : '—';
                scoreClass = route.score >= 80 ? 'high' : route.score >= 50 ? 'med' : 'low';
            }

            return `<div class="route-list-item" data-id="${itemKey}" data-route-index="${selectedRoutes.indexOf(route)}">
                <span class="route-score ${scoreClass}">${scoreDisplay}</span>
                <div class="route-info">
                    <div class="route-coords">${coordsStr}</div>
                    <div class="route-type">${typeText}</div>
                </div>
                <span class="route-remove" data-id="${itemKey}" title="${t('solodungeons.remove_from_route', '从路线移除')}">${removeSvg}</span>
            </div>`;
        }).join('');

        // 添加返回原位项
        if (_returnToOrigin && selectedRoutes.length > 0 && playerPos) {
            const returnSvg = `<svg viewBox="0 0 24 24" width="12" height="12"><path fill="white" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`;
            html += `<div class="route-list-item route-return-item" data-return="true">
                <span class="route-score">${returnSvg}</span>
                <div class="route-info">
                    <div class="route-coords">${t('solodungeons.return_to_origin', '返回原位')}</div>
                    <div class="route-type">${playerPos ? `[${playerPos.x}, ${playerPos.y}]` : '—'}</div>
                </div>
            </div>`;
        } else if (selectedRoutes.length === 0) {
            container.innerHTML = `<div class="route-list-empty">${t('solodungeons.route_empty', '暂无已选路线')}</div>`;
            updateRouteListTotalDistance();
            return;
        }

        container.innerHTML = html;

        // 绑定移除按钮点击事件
        container.querySelectorAll('.route-remove').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.id;
                removeFromRoute(id);
                // 如果被移除的条目正是当前激活的详细寻路条目，则清空面板
                if (_activePathDetail && (_activePathDetail.route._key === id || _activePathDetail.route._id === id)) {
                    clearPathDetailPanel();
                }
            });
        });

        // 更新标题右侧的总寻路距离
        updateRouteListTotalDistance();

        // 绑定条目点击事件（点击整行触发详细寻路，排除点击删除按钮和返回项的情况）
        container.querySelectorAll('.route-list-item:not(.route-return-item)').forEach((item) => {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.route-remove')) return; // 忽略删除按钮

                const routeIndex = parseInt(this.dataset.routeIndex, 10);
                const route = selectedRoutes[routeIndex];
                if (!route) return;

                // 高亮选中
                container.querySelectorAll('.route-list-item.route-item-selected').forEach(el => el.classList.remove('route-item-selected'));
                this.classList.add('route-item-selected');

                // 起点：前一项的坐标，或玩家位置
                const startPos = routeIndex === 0 ? playerPos : getCoordinates(selectedRoutes[routeIndex - 1]);
                const endPos = getCoordinates(route);
                renderPathDetail(startPos, endPos, route, routeIndex);
            });
        });

        // 绑定返回原位项点击事件
        const returnItem = container.querySelector('.route-return-item');
        if (returnItem) {
            returnItem.addEventListener('click', function() {
                // 高亮选中
                container.querySelectorAll('.route-list-item.route-item-selected').forEach(el => el.classList.remove('route-item-selected'));
                this.classList.add('route-item-selected');

                // 返回原位：从最后一个目的地点返回玩家位置
                const lastRoute = selectedRoutes[selectedRoutes.length - 1];
                const startPos = lastRoute ? getCoordinates(lastRoute) : playerPos;
                const endPos = playerPos;
                renderPathDetail(startPos, endPos, { _type: 'return', _key: '__return_to_origin__' }, -1);
            });
        }
    }

    /**
     * 清除详细寻路面板并移除路线列表高亮
     */
    function clearPathDetailPanel() {
        _activePathDetail = null;
        const panel = document.getElementById('routePathDetailContent');
        if (panel) {
            panel.removeAttribute('data-active-key');
            panel.innerHTML = `<div class="route-path-detail-empty">${t('solodungeons.path_detail_hint', '点击已选路线中的条目查看寻路详情')}</div>`;
        }
        // 移除路线列表中的选中高亮
        const routeList = document.getElementById('solodungeonsRouteList');
        if (routeList) {
            routeList.querySelectorAll('.route-item-selected').forEach(el => el.classList.remove('route-item-selected'));
        }
    }

    /**
     * 渲染详细寻路面板
     * @param {Object|null} startPos - 起点 {x, y}
     * @param {Object|null} endPos   - 终点 {x, y}
     * @param {Object} route         - 路线条目（用于显示信息）
     * @param {number} index         - 路线序号（0-based）
     */
    function renderPathDetail(startPos, endPos, route, index) {
        const panel = document.getElementById('routePathDetailContent');
        if (!panel) return;

        // 记录当前激活的条目 key，用于删除时清空
        panel.dataset.activeKey = route._key || generateItemKey(route);

        const _t = (key, fallback) => t(key, fallback);

        if (!startPos || !endPos) {
            panel.innerHTML = `<div class="rpd-no-path">${_t('solodungeons.path_no_pos', '无法获取坐标，无法寻路')}</div>`;
            _activePathDetail = null; // 清除激活状态
            return;
        }

        // 是否为返回原位
        const isReturn = route._type === 'return' || route._key === '__return_to_origin__';
        const typeText = isReturn
            ? _t('solodungeons.return_to_origin', '返回原位')
            : (route._type === 'dungeon' ? _t('solodungeons.type_dungeon', '副本') : _t('solodungeons.type_rune', '符文'));

        // 保存激活状态（语言切换时重新渲染用），trajectories/totalDistance 待 pathfinder 计算后补充
        _activePathDetail = { startPos, endPos, index, route, trajectories: null, totalDistance: null, pathReached: null };

        // 获取 Pathfinder Grid
        const pfGrid = (window.PathfinderService && typeof window.PathfinderService.getGrid === 'function')
            ? window.PathfinderService.getGrid()
            : window.stellarOdysseyPathfinderGrid;

        const startCoordStr = `[${startPos.x}, ${startPos.y}]`;
        const endCoordStr   = `[${endPos.x}, ${endPos.y}]`;

        // 路径计算（优先复用缓存结果，避免重复 pathfinding）
        // 步进限制变化时重新计算
        let trajectories = _activePathDetail.trajectories;
        let totalDistance = _activePathDetail.totalDistance;
        let pathReached = _activePathDetail.pathReached !== undefined ? _activePathDetail.pathReached : null;
        let isPf = !!trajectories;
        const needRecalc = !trajectories ||
            _activePathDetail.stepLimit !== _stepLimit ||
            _activePathDetail.startPos.x !== startPos.x ||
            _activePathDetail.startPos.y !== startPos.y ||
            _activePathDetail.endPos.x !== endPos.x ||
            _activePathDetail.endPos.y !== endPos.y;

        if (needRecalc && pfGrid && typeof pfGrid.findStepLimitedPath === 'function') {
            try {
                const chosen = pfGrid.findStepLimitedPath(
                    { x: startPos.x, y: startPos.y },
                    { x: endPos.x, y: endPos.y },
                    _stepLimit
                );
                if (chosen && chosen.trajectories) {
                    trajectories = chosen.trajectories;
                    totalDistance = chosen.distance;
                    pathReached = chosen.reached !== undefined ? chosen.reached : true;
                    isPf = true;
                    // 缓存结果（含 stepLimit 标记和 reached 状态）
                    _activePathDetail.trajectories = trajectories;
                    _activePathDetail.totalDistance = totalDistance;
                    _activePathDetail.pathReached = pathReached;
                    _activePathDetail.stepLimit = _stepLimit;
                    _activePathDetail.startPos = { x: startPos.x, y: startPos.y };
                    _activePathDetail.endPos = { x: endPos.x, y: endPos.y };
                }
            } catch (e) {
                console.warn('[SoloDungeons] PathDetail: step pathfinder failed', e);
            }
        }

        // 如果寻路不可用，显示直线距离
        if (!trajectories) {
            const linDist = Math.sqrt(Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2)) * 10;
            panel.innerHTML = `
                <div class="rpd-header">
                    <div class="rpd-header-row">
                        <span class="rpd-label">${_t('path.from', '出发')}</span>
                        <span class="rpd-coord">${startCoordStr}</span>
                        <span class="rpd-label" style="margin-left:0.8em">${_t('path.to', '到达')}</span>
                        <span class="rpd-coord">${endCoordStr}</span>
                        <span class="rpd-total-dist">${(Math.floor(linDist * 100) / 100).toFixed(2)} ly (${_t('solodungeons.linear_only', '仅直线')})</span>
                    </div>
                    <div class="rpd-header-row">
                        <span class="rpd-label">${_t('solodungeons.type', '类型')}</span>
                        <span>${typeText}</span>
                        <span style="color:#6b7280; margin-left:0.5em; font-size:0.82em">${_t('solodungeons.path_detail_hint_nopf', '寻路引擎未就绪，仅显示直线距离')}</span>
                    </div>
                </div>
                <div class="rpd-no-path">${_t('solodungeons.path_no_pf', '寻路引擎未初始化，请先切换到星图/副本 TAB 加载数据')}</div>`;
            return;
        }

        // 构建路径点列表 HTML
        const listItems = trajectories.map((traj, i) => {
            const fromIsStarter = pfGrid.isStarter(traj.from);
            const fromIsStation = pfGrid.isStation(traj.from);
            const toIsStarter   = pfGrid.isStarter(traj.to);
            const toIsStation   = pfGrid.isStation(traj.to);

            const fromLabel = fromIsStation ? _t('path.station', '(空间站)') :
                              fromIsStarter ? _t('path.initial', '(初始)') : '';
            const toLabel   = toIsStation   ? _t('path.station', '(空间站)') :
                              toIsStarter   ? _t('path.initial', '(初始)') : '';

            const distDisplay = traj.distance === 0
                ? `0 ${_t('path.ly', '光年')} ${_t('solodungeons.path_teleport', '(传送)')}`
                : `${Math.floor(traj.distance * 100) / 100} ${_t('path.ly', '光年')}`;

            const segTitle = _t('path.segment', { n: i + 1 });

            return `<div class="list-item" style="cursor:pointer" title="${_t('solodungeons.click_copy', '点击复制目标坐标')}" data-copy-x="${traj.to.x}" data-copy-y="${traj.to.y}">
                <div class="item-content">
                    <div class="item-title">${segTitle}</div>
                    <div class="item-description">
                        <div name="from">${_t('path.from', '起点:')}<br>[${traj.from.x}, ${traj.from.y}]${fromLabel ? `<br><span style="color:#6b7280;font-size:0.82em">${fromLabel}</span>` : ''}</div>
                        <div name="to">${_t('path.to', '终点:')}<br>[${traj.to.x}, ${traj.to.y}]${toLabel ? `<br><span style="color:#6b7280;font-size:0.82em">${toLabel}</span>` : ''}</div>
                        <div name="distance">${Math.floor(traj.distance * 100) / 100}<br/>${_t('path.ly', '光年')}</div>
                    </div>
                </div>
            </div>`;
        }).join('');

        const totalDistStr = _t('path.total', { d: (Math.floor(totalDistance * 100) / 100).toFixed(2) });

        panel.innerHTML = `
            <div class="rpd-header">
                <div class="rpd-header-row">
                    <span class="rpd-label">${_t('path.from', '起点:')}</span>
                    <span class="rpd-coord">${startCoordStr}</span>
                    <span class="rpd-label" style="margin-left:0.8em">${_t('path.to', '终点:')}</span>
                    <span class="rpd-coord">${endCoordStr}</span>
                    <span class="rpd-total-dist">${totalDistStr}</span>
                </div>
                <div class="rpd-header-row">
                    <span class="rpd-label">${_t('solodungeons.type', '类型')}</span>
                    <span>${typeText}</span>
                    <span style="color:#6b7280; margin-left:0.5em; font-size:0.82em">${_t('solodungeons.path_segment_count', '共 {n} 段').replace('{n}', trajectories.length)}</span>
                </div>
            </div>
            <div class="rpd-list">${listItems}</div>`;

        // 绑定复制坐标事件
        panel.querySelectorAll('.list-item[data-copy-x]').forEach(item => {
            item.addEventListener('click', function() {
                const cx = this.dataset.copyX;
                const cy = this.dataset.copyY;
                const text = `___STELLAR_ODYSSEY_SIM___\n{\nx: ${cx},\ny: ${cy}\n}`;
                const doCopy = (() => {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        return (t) => navigator.clipboard.writeText(t);
                    }
                    // 降级：创建临时 textarea
                    const ta = document.createElement('textarea');
                    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
                    document.body.appendChild(ta);
                    return (t) => { ta.value = t; ta.select(); document.execCommand('copy'); document.body.removeChild(ta); };
                })();
                doCopy(text);
                // 渐隐提示
                const tip = document.createElement('span');
                tip.textContent = _t('solodungeons.copied', '已复制');
                tip.style.cssText = 'position:absolute;right:0;top:50%;transform:translateY(-50%);background:#22c55e;color:#fff;font-size:0.75em;padding:2px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;opacity:1;transition:opacity 2s;z-index:10';
                this.style.position = 'relative';
                this.appendChild(tip);
                setTimeout(() => { tip.style.opacity = '0'; }, 100);
                setTimeout(() => { tip.remove(); }, 800);
            });
        });
    }

    /**
     * 生成副本/符文的唯一标识符（使用坐标 + 过期时间）
     */
    function generateItemKey(item) {
        const coords = getCoordinates(item);
        const x = coords ? coords.x : '?';
        const y = coords ? coords.y : '?';
        const ts = getExpiresAt(item) ?? '?';
        return `d_${x}_${y}_${ts}`;
    }

    function renderDungeonsHeader(pfAvailable) {
        return `
            <th class="sdt-col-score">${t('solodungeons.col_score', '评分')}</th>
            <th class="sdt-col-info">${t('solodungeons.col_info', '条目信息')}</th>
            <th class="sdt-col-action"></th>`;
    }

    function renderDungeonsRows(dungeons, pfAvailable) {
        return dungeons.map(d => {
            const scoreClass = d.score >= 80 ? 'high' : d.score >= 50 ? 'med' : 'low';
            const coords = getCoordinates(d);
            const coordsStr = coords ? `[${coords.x},${coords.y}]` : '—';
            const scoreDisplay = d.score > 0 ? d.score : (d.score === -1 ? '!' : '—');
            const linearDist = d.details.linearDistance != null ? `${(Math.floor(d.details.linearDistance * 100) / 100).toFixed(2)} ly` : '—';
            const pfDist = pfAvailable && d.details.distance != null ? `${(Math.floor(d.details.distance * 100) / 100).toFixed(2)} ly` : '—';
            const timeLeft = formatTimeRemaining(d.closesAt);
            const rewardText = d.reward_modifier !== undefined ? (d.reward_modifier > 0 ? '+' : '') + d.reward_modifier + '%' : '—';
            const diffText = d.difficulty_modifier !== undefined ? (d.difficulty_modifier > 0 ? '+' : '') + d.difficulty_modifier + '%' : '—';
            const attemptsText = d.attempts !== undefined ? d.attempts : '—';

            // 使用 generateItemKey 生成唯一标识
            const itemKey = generateItemKey(d);
            const isSelected = selectedRoutes.some(r => generateItemKey(r) === itemKey);
            const actionBtnClass = isSelected ? 'sdt-action-btn disabled' : 'sdt-action-btn';
            const arrowSvg = `<svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`;
            
            return `<tr data-id="${itemKey}" data-type="dungeon" data-data="${encodeURIComponent(JSON.stringify(d))}">
                <td class="sdt-score ${scoreClass}">${scoreDisplay}</td>
                <td class="sdt-info">
                    <div class="sdt-info-row sdt-coords-line">${coordsStr}<span class="sdt-time-right">${t('solodungeons.col_time_left', '剩余')}: <span style="color:${getTimeColor(d)}">${timeLeft}</span></span></div>
                    <div class="sdt-info-row sdt-stats-line">
                        <span class="sdt-stat"><span class="sdt-label">${t('solodungeons.col_attempts', '次数')}:</span> ${attemptsText}</span>
                        <span class="sdt-stat"><span class="sdt-label">${t('solodungeons.col_reward', '奖励')}:</span> <span style="color:${getModifierColor(d.reward_modifier,false)}">${rewardText}</span></span>
                        <span class="sdt-stat"><span class="sdt-label">${t('solodungeons.col_difficulty', '难度')}:</span> <span style="color:${getModifierColor(d.difficulty_modifier,true)}">${diffText}</span></span>
                        <span class="sdt-stat"><span class="sdt-label">${t('solodungeons.col_rooms', '房间')}:</span> ${d.rooms ? d.rooms.length : '—'}</span>
                    </div>
                    <div class="sdt-info-row sdt-dist-line">
                        <span class="sdt-stat"><span class="sdt-label">${t('solodungeons.col_linear_dist', '直线')}:</span> <span class="sdt-dist">${linearDist}</span></span>
                        <span class="sdt-stat"><span class="sdt-label">${pfAvailable ? t('solodungeons.col_pf_distance', '寻路') : t('solodungeons.col_distance', '距离')}:</span> <span class="sdt-pfdist">${pfDist}</span></span>
                    </div>
                </td>
                <td class="sdt-action">
                    <span class="${actionBtnClass}" data-id="${itemKey}" data-type="dungeon" title="${t('solodungeons.add_to_route', '添加到路线')}">${arrowSvg}</span>
                </td>
            </tr>`;
        }).join('');
    }

    function renderRunesHeader(pfAvailable) {
        return `
            <th class="sdt-col-info">${t('runedrops.col_info', '符文信息')}</th>
            <th class="sdt-col-action"></th>`;
    }

    function renderRunesRows(runes, pfAvailable) {
        return runes.map(r => {
            const coords = getCoordinates(r);
            const coordsStr = coords ? `[${coords.x},${coords.y}]` : '—';
            const timeLeft = formatItemTimeRemaining(r);
            const runeName = r.rune_name || '—';
            const runeIndex = r.rune_index !== undefined ? `#${r.rune_index}` : '';
            const foundBy = r.found_by || '—';
            const starName = r.star || '—';
            const systemName = r.name || '—';

            // 距离计算（仅用于展示，不参与评分）
            let distStr = '—';
            if (coords && playerPos) {
                const pfResult = getPathfinderDistance(playerPos.x, playerPos.y, coords.x, coords.y);
                distStr = `${Math.floor(pfResult.distance * 100) / 100} ly`;
            }

            const itemKey = generateItemKey(r);
            const isSelected = selectedRoutes.some(route => generateItemKey(route) === itemKey);
            const actionBtnClass = isSelected ? 'sdt-action-btn disabled' : 'sdt-action-btn';
            const arrowSvg = `<svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`;

            return `<tr data-id="${itemKey}" data-type="rune" data-data="${encodeURIComponent(JSON.stringify(r))}">
                <td class="sdt-info" colspan="1">
                    <div class="sdt-info-row sdt-coords-line">${coordsStr} &nbsp;<span style="color:#a78bfa;font-size:0.88em">${runeName}</span><span class="sdt-time-right">${t('solodungeons.col_time_left', '剩余')}: <span style="color:${getTimeColor(r)}">${timeLeft}</span></span></div>
                    <div class="sdt-info-row sdt-stats-line">
                        <span class="sdt-stat"><span class="sdt-label">${t('runedrops.col_star', '恒星')}:</span> ${starName}</span>
                        <span class="sdt-stat"><span class="sdt-label">${t('runedrops.col_system', '星系')}:</span> ${systemName}</span>
                        <span class="sdt-stat"><span class="sdt-label">${t('runedrops.col_found_by', '发现者')}:</span> ${foundBy}</span>
                    </div>
                    <div class="sdt-info-row sdt-dist-line">
                        <span class="sdt-stat"><span class="sdt-label">${pfAvailable ? t('solodungeons.col_pf_distance', '寻路') : t('solodungeons.col_distance', '距离')}:</span> <span class="sdt-pfdist">${distStr}</span></span>
                    </div>
                </td>
                <td class="sdt-action">
                    <span class="${actionBtnClass}" data-id="${itemKey}" data-type="rune" title="${t('solodungeons.add_to_route', '添加到路线')}">${arrowSvg}</span>
                </td>
            </tr>`;
        }).join('');
    }

    // ==================== 主加载逻辑 ====================

    /**
     * 加载单人副本和符文数据（合并加载）
     * @param {HTMLElement} outputDiv - 输出容器
     * @param {boolean} forceRefresh - 是否强制刷新数据（忽略缓存）
     */
    async function loadSoloDungeonsAndRunes(outputDiv, forceRefresh = false) {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error(t('solodungeons.error_no_api_key', '请先输入 API Key'));
        }

        // 检查缓存：只要有任何一个缓存数据且不是强制刷新，就使用缓存渲染
        const hasPartialCache = (cachedDungeonsData !== null) || (cachedRunesData !== null);
        console.log('[SoloDungeons] Cache check: hasPartialCache=' + hasPartialCache + ', forceRefresh=' + forceRefresh + 
                     ', cachedDungeons=' + (cachedDungeonsData !== null) + 
                     ', cachedRunes=' + (cachedRunesData !== null));
        
        if (hasPartialCache && !forceRefresh) {
            console.log('[SoloDungeons] Using cached data, skipping API request. remainingDungeons.length=' + remainingDungeons.length);
            // 直接渲染缓存数据（只用最新的玩家位置重新计算评分）
            renderCombinedTable(
                cachedDungeonsData?.dungeons,
                cachedRunesData?.runeSystems,
                outputDiv,
                cachedDungeonsData,
                cachedRunesData
            );
            return;
        }

        // 非缓存分支：需要完整初始化
        outputDiv.innerHTML = `<div class="loading">${t('solodungeons.fetching', '正在初始化数据...')}</div>`;

        // 步骤 1: 确保 User 数据已加载（T0 级模块的初始化途径）
        try {
            await ensureUserData();
        } catch (e) {
            console.warn('Failed to load user data:', e);
        }

        // 步骤 1.5: 确保 Pathfinder 已初始化
        // 原则：T0 级模块（星图）是主要初始化途径；T0 未初始化时自己初始化，有则复用
        if (window.PathfinderService) {
            await window.PathfinderService.ensureInitialized(apiKey);
        }

        outputDiv.innerHTML = `<div class="loading">${t('solodungeons.fetching', '正在获取单人副本和符文列表...')}</div>`;

        // 步骤 2: 并行加载单人副本和符文
        const [dungeonsRes, runesRes] = await Promise.all([
            fetch(API_ENDPOINTS.soloDungeons, {
                headers: { 'Accept': 'application/json', 'sodyssey-api-key': apiKey }
            }),
            fetch(API_ENDPOINTS.runeDrops, {
                headers: { 'Accept': 'application/json', 'sodyssey-api-key': apiKey }
            })
        ]);

        if (!dungeonsRes.ok && !runesRes.ok) {
            throw new Error('Failed to fetch both dungeons and runes');
        }

        const dungeonsData = dungeonsRes.ok ? await dungeonsRes.json() : null;
        const runesData = runesRes.ok ? await runesRes.json() : null;

        // 步骤 3: 检查玩家位置是否变化
        let needRefresh = (dungeonsData && checkPlayerPositionMismatch(dungeonsData)) ||
                           (runesData && checkPlayerPositionMismatch(runesData));

        if (needRefresh) {
            outputDiv.innerHTML = `<div class="loading">${t('solodungeons.fetching', '检测到位置变化，正在刷新数据...')}</div>`;
            // 同时刷新 User API 和 Journal API
            await forceRefreshUserAndJournalData();
            // 刷新后重新检查是否还需要再次刷新（理论上不需要，但为了保险）
            needRefresh = (dungeonsData && checkPlayerPositionMismatch(dungeonsData)) ||
                         (runesData && checkPlayerPositionMismatch(runesData));
        }

        // 更新缓存：API 有响应则保留数据（即使是空数组），无响应才保留旧缓存
        // 过滤掉已跑过的副本（alreadyRan === true）
        if (dungeonsRes.ok && dungeonsData?.dungeons) {
            const filtered = dungeonsData.dungeons.filter(d => !d.alreadyRan);
            cachedDungeonsData = { dungeons: filtered };
        }
        if (runesRes.ok) {
            cachedRunesData = Array.isArray(runesData?.runeSystems) ? runesData : null;
        }
        // 渲染结果（使用最新的玩家位置计算评分）
        // 刷新时清空已选路线和待选列表，直接用新 API 数据重置
        selectedRoutes = [];
        _activePathDetail = null;
        clearPathDetailPanel();
        const dungeonsForRender = cachedDungeonsData?.dungeons || [];
        _allDungeons = [...dungeonsForRender];
        remainingDungeons = applyDungeonFilter(_allDungeons);
        remainingRunes    = Array.isArray(cachedRunesData?.runeSystems)   ? [...cachedRunesData.runeSystems]  : [];
        renderCombinedTable(
            dungeonsForRender,
            cachedRunesData?.runeSystems,
            outputDiv,
            dungeonsData,
            runesData
        );
    }

    /**
     * 清除缓存数据
     */
    function clearCache() {
        cachedDungeonsData = null;
        cachedRunesData = null;
        selectedRoutes = [];
        _allDungeons = [];
        remainingDungeons = [];
        remainingRunes = [];
        playerPos = null;
        _activePathDetail = null;
    }

    // ==================== 路线保存/载入 ====================

    const ROUTES_STORAGE_KEY = 'solodungeons_routes';

    /**
     * 获取所有已保存的路线
     */
    function getSavedRoutes() {
        try {
            const data = localStorage.getItem(ROUTES_STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('[SoloDungeons] Failed to load routes:', e);
            return {};
        }
    }

    /**
     * 保存路线
     */
    function saveRoute(routeName) {
        if (!routeName || selectedRoutes.length === 0) {
            alert(t('solodungeons.save_empty', '请先选择路线或输入名称'));
            return false;
        }

        const routes = getSavedRoutes();
        routes[routeName] = {
            routes: [...selectedRoutes],
            timestamp: new Date().toISOString()
        };

        try {
            localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(routes));
            console.log('[SoloDungeons] Route saved:', routeName);
            return true;
        } catch (e) {
            console.error('[SoloDungeons] Failed to save route:', e);
            alert(t('solodungeons.save_failed', '保存失败'));
            return false;
        }
    }

    /**
     * 载入路线
     */
    function loadRoute(routeName, dungeonData, runeData) {
        const routes = getSavedRoutes();
        const routeData = routes[routeName];

        if (!routeData) {
            alert(t('solodungeons.load_not_found', '路线不存在'));
            return false;
        }

        // 清空当前选择
        selectedRoutes = [];
        remainingDungeons = dungeonData ? [...dungeonData] : [];
        remainingRunes = runeData ? [...runeData] : [];

        // 恢复保存的路线（从待选列表中移除已选项目）
        for (const item of routeData.routes) {
            const type = item._type || item.type;
            const itemKey = item._key || generateItemKey(item);

            if (type === 'dungeon') {
                remainingDungeons = remainingDungeons.filter(d => generateItemKey(d) !== itemKey);
            } else {
                remainingRunes = remainingRunes.filter(r => generateItemKey(r) !== itemKey);
            }

            selectedRoutes.push({ ...item, _key: itemKey });
        }

        // 重新渲染
        recalculateAndRender();
        console.log('[SoloDungeons] Route loaded:', routeName);
        return true;
    }

    /**
     * 删除路线
     */
    function deleteRoute(routeName) {
        const routes = getSavedRoutes();
        if (routes[routeName]) {
            delete routes[routeName];
            localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(routes));
            console.log('[SoloDungeons] Route deleted:', routeName);
            return true;
        }
        return false;
    }

    // ==================== 暴露到全局 ====================

    window.SoloDungeonsModule = {
        loadSoloDungeonsAndRunes,
        recalculateAndRender,
        clearCache,
        ensureUserData,
        forceRefreshUserData,
        forceRefreshJournalData,
        forceRefreshUserAndJournalData,
        getPlayerPosition,
        calculateScore,
        getModifierColor,
        API_ENDPOINTS
    };

    // ==================== DOM 事件 ====================

    document.addEventListener('DOMContentLoaded', function () {
        const outputDiv = document.getElementById('solodungeonsOutput');

        // 合并的加载按钮
        const fetchBtn = document.getElementById('fetchSoloDungeonsBtn');
        if (fetchBtn && outputDiv) {
            fetchBtn.addEventListener('click', async function () {
                try {
                    await loadSoloDungeonsAndRunes(outputDiv, true); // true = 强制刷新
                } catch (error) {
                    outputDiv.innerHTML = `<div class="error">${t('solodungeons.error_fetch', '获取失败: ')}${error.message}</div>`;
                }
            });
        }

        // 事件委托：绑定动作按钮点击（使用 delegation，只需绑定一次）
        document.addEventListener('click', function(e) {
            const btn = e.target.closest('.sdt-action-btn:not(.disabled)');
            if (!btn || !outputDiv) return;

            e.stopPropagation();
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            console.log('[SoloDungeons] Arrow clicked:', { id, type });

            // 从 DOM 中找到对应的数据项（从同一 table 中查找）
            const row = btn.closest('tr');
            if (!row) return;

            // 从 row 的 data 属性获取完整信息
            const item = findItemById(id, type);
            if (item) {
                addToRoute(item, type);
            } else {
                console.log('[SoloDungeons] Item not found:', { id, type });
            }
        });

        // 初始化已选路线列表显示
        renderRouteList();

        // 初始化保存路线按钮
        const saveBtn = document.getElementById('saveRouteBtn');
        const routeNameInput = document.getElementById('routeNameInput');
        const newRouteNameInput = document.getElementById('newRouteName');
        const loadSelect = document.getElementById('loadRouteSelect');
        const loadBtn = document.getElementById('loadRouteBtn');
        const deleteBtn = document.getElementById('deleteRouteBtn');
        const clearBtn = document.getElementById('clearRouteBtn');

        // 刷新路线列表
        function refreshRouteSelect() {
            const routes = getSavedRoutes();
            const routeNames = Object.keys(routes).sort();
            loadSelect.innerHTML = `<option value="">${t('solodungeons.route_select_placeholder', '-- 选择路线 --')}</option>`;
            routeNames.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                const date = new Date(routes[name].timestamp);
                opt.textContent = `${name} (${routes[name].routes.length}${t('solodungeons.route_items_count', '项')}, ${date.toLocaleDateString()})`;
                loadSelect.appendChild(opt);
            });
        }

        // 保存路线按钮
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                if (routeNameInput.style.display === 'none') {
                    routeNameInput.style.display = 'block';
                    newRouteNameInput.focus();
                } else {
                    const name = newRouteNameInput.value.trim();
                    if (!name) {
                        alert(t('solodungeons.enter_name', '请输入路线名称'));
                        return;
                    }
                    if (saveRoute(name)) {
                        routeNameInput.style.display = 'none';
                        newRouteNameInput.value = '';
                        refreshRouteSelect();
                    }
                }
            });
        }

        // 载入路线按钮
        if (loadBtn) {
            loadBtn.addEventListener('click', function() {
                const selectedName = loadSelect.value;
                if (!selectedName) {
                    alert(t('solodungeons.select_route', '请选择要载入的路线'));
                    return;
                }
                loadRoute(selectedName, cachedDungeonsData?.dungeons, cachedRunesData?.runeSystems);
            });
        }

        // 删除路线按钮
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                const selectedName = loadSelect.value;
                if (!selectedName) {
                    alert(t('solodungeons.select_route', '请选择要删除的路线'));
                    return;
                }
                if (confirm(t('solodungeons.confirm_delete', '确定要删除路线 "%s" 吗？').replace('%s', selectedName))) {
                    deleteRoute(selectedName);
                    refreshRouteSelect();
                }
            });
        }

        // 清空路线按钮
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                if (selectedRoutes.length === 0) return;
                if (confirm(t('solodungeons.confirm_clear', '确定要清空当前路线吗？'))) {
                    // 将所有已选项放回待选列表
                    for (const route of selectedRoutes) {
                        if (route._type === 'dungeon') {
                            remainingDungeons.push(route);
                        } else {
                            remainingRunes.push(route);
                        }
                    }
                    selectedRoutes = [];
                    recalculateAndRender();
                    updateRouteListTotalDistance();
                }
            });
        }

        // 初始化路线选择下拉框
        refreshRouteSelect();

        // 步进限制选择器
        const stepLimitSelect = document.getElementById('routeStepLimitSelect');
        if (stepLimitSelect) {
            // 恢复 localStorage 保存的值
            const savedLimit = localStorage.getItem('solodungeons_step_limit');
            if (savedLimit !== null) {
                stepLimitSelect.value = savedLimit;
                _stepLimit = savedLimit === '' ? null : parseInt(savedLimit, 10);
            }

            stepLimitSelect.addEventListener('change', function() {
                _stepLimit = this.value === '' ? null : parseInt(this.value, 10);
                localStorage.setItem('solodungeons_step_limit', this.value);
                // 清除详细寻路缓存
                if (_activePathDetail) {
                    _activePathDetail.trajectories = null;
                    _activePathDetail.totalDistance = null;
                }
                // 重新计算评分（使用新的步进限制）
                recalculateAndRender();
            });

            // 返回原位 checkbox
            const returnCheckbox = document.getElementById('returnToOriginCheckbox');
            if (returnCheckbox) {
                // 恢复保存的状态
                const savedReturn = localStorage.getItem('solodungeons_return_to_origin');
                _returnToOrigin = savedReturn === '1';
                returnCheckbox.checked = _returnToOrigin;

                returnCheckbox.addEventListener('change', function() {
                    _returnToOrigin = this.checked;
                    localStorage.setItem('solodungeons_return_to_origin', _returnToOrigin ? '1' : '');
                    renderRouteList();
                });
            }
        }

        // ===== Filter Popup 逻辑 =====
        (function initFilterPopup() {
            const filterBtn  = document.getElementById('sdtFilterBtn');
            const popup      = document.getElementById('sdtFilterPopup');
            const badge      = document.getElementById('sdtFilterBadge');
            const resetLink  = document.getElementById('sdtFilterReset');
            const applyBtn   = document.getElementById('sdtFilterApply');
            if (!filterBtn || !popup) return;

            // 双滑块辅助：更新填充条和标签
            function updateSlider(minId, maxId, fillId, minLabelId, maxLabelId, unit, forceMin, forceMax) {
                const minEl  = document.getElementById(minId);
                const maxEl  = document.getElementById(maxId);
                const fillEl = document.getElementById(fillId);
                const minLbl = document.getElementById(minLabelId);
                const maxLbl = document.getElementById(maxLabelId);
                if (!minEl || !maxEl) return;

                let lo = parseFloat(minEl.value);
                let hi = parseFloat(maxEl.value);
                if (lo > hi) {
                    // 防止交叉
                    if (document.activeElement === minEl) { lo = hi; minEl.value = lo; }
                    else { hi = lo; maxEl.value = hi; }
                }

                const totalMin = parseFloat(minEl.min);
                const totalMax = parseFloat(minEl.max);
                const range = totalMax - totalMin || 1;
                const leftPct  = ((lo - totalMin) / range) * 100;
                const rightPct = ((hi - totalMin) / range) * 100;
                if (fillEl) {
                    fillEl.style.left  = leftPct  + '%';
                    fillEl.style.width = (rightPct - leftPct) + '%';
                }
                const fmt = v => (unit === '%') ? ((v > 0 ? '+' : '') + v + '%') : String(v);
                if (minLbl) minLbl.textContent = fmt(lo);
                if (maxLbl) maxLbl.textContent = fmt(hi);
            }

            // 注册滑块事件
            ['sdtRewardMin','sdtRewardMax'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', () => updateSlider('sdtRewardMin','sdtRewardMax','sdtRewardFill','sdtRewardMinLabel','sdtRewardMaxLabel','%'));
            });
            ['sdtDiffMin','sdtDiffMax'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', () => updateSlider('sdtDiffMin','sdtDiffMax','sdtDiffFill','sdtDiffMinLabel','sdtDiffMaxLabel','%'));
            });
            ['sdtAttemptsMin','sdtAttemptsMax'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', () => updateSlider('sdtAttemptsMin','sdtAttemptsMax','sdtAttemptsFill','sdtAttemptsMinLabel','sdtAttemptsMaxLabel',''));
            });
            ['sdtRoomsMin','sdtRoomsMax'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', () => updateSlider('sdtRoomsMin','sdtRoomsMax','sdtRoomsFill','sdtRoomsMinLabel','sdtRoomsMaxLabel',''));
            });

            // 初始化填充条
            updateSlider('sdtRewardMin','sdtRewardMax','sdtRewardFill','sdtRewardMinLabel','sdtRewardMaxLabel','%');
            updateSlider('sdtDiffMin','sdtDiffMax','sdtDiffFill','sdtDiffMinLabel','sdtDiffMaxLabel','%');
            updateSlider('sdtAttemptsMin','sdtAttemptsMax','sdtAttemptsFill','sdtAttemptsMinLabel','sdtAttemptsMaxLabel','');
            updateSlider('sdtRoomsMin','sdtRoomsMax','sdtRoomsFill','sdtRoomsMinLabel','sdtRoomsMaxLabel','');

            // 更新 badge
            function updateBadge() {
                const active = isDungeonFilterActive();
                badge.style.display = active ? '' : 'none';
                filterBtn.classList.toggle('active', active);
                // 计算激活项数
                let count = 0;
                if (_dungeonFilter.rewardMin > -28 || _dungeonFilter.rewardMax < 50) count++;
                if (_dungeonFilter.diffMin > -20 || _dungeonFilter.diffMax < 20) count++;
                if (_dungeonFilter.attemptsMin > 0 || _dungeonFilter.attemptsMax < 12) count++;
                if (_dungeonFilter.roomsMin > 0 || _dungeonFilter.roomsMax < 10) count++;
                badge.textContent = count;
            }

            // 打开/关闭 popup（position: fixed + 视口计算，避免出滚动区）
            filterBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (popup.classList.contains('open')) {
                    popup.classList.remove('open');
                    return;
                }
                // 计算按钮的视口位置，决定 popup 弹出方向
                const btnRect = filterBtn.getBoundingClientRect();
                const POPUP_HEIGHT = 320; // 估算 popup 高度
                const VIEWPORT_MARGIN = 8;
                // 默认向下；按钮下方空间不够时改为向上
                const preferAbove = (btnRect.bottom + POPUP_HEIGHT + VIEWPORT_MARGIN > window.innerHeight);
                popup.style.top  = preferAbove
                    ? (btnRect.top - POPUP_HEIGHT - VIEWPORT_MARGIN) + 'px'
                    : (btnRect.bottom + VIEWPORT_MARGIN) + 'px';
                popup.style.left = btnRect.right > 315
                    ? (btnRect.right - 300) + 'px'  // 右侧空间不够，向左对齐
                    : btnRect.left + 'px';
                popup.classList.add('open');
            });

            // 点击 popup 外部关闭
            document.addEventListener('click', function(e) {
                if (!popup.contains(e.target) && e.target !== filterBtn && !filterBtn.contains(e.target)) {
                    popup.classList.remove('open');
                }
            });

            // Reset
            if (resetLink) {
                resetLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    document.getElementById('sdtRewardMin').value   = -20;
                    document.getElementById('sdtRewardMax').value   = 50;
                    document.getElementById('sdtDiffMin').value     = -20;
                    document.getElementById('sdtDiffMax').value     = 20;
                    document.getElementById('sdtAttemptsMin').value = 1;
                    document.getElementById('sdtAttemptsMax').value = 12;
                    document.getElementById('sdtRoomsMin').value = 5;
                    document.getElementById('sdtRoomsMax').value = 10;
                    updateSlider('sdtRewardMin','sdtRewardMax','sdtRewardFill','sdtRewardMinLabel','sdtRewardMaxLabel','%');
                    updateSlider('sdtDiffMin','sdtDiffMax','sdtDiffFill','sdtDiffMinLabel','sdtDiffMaxLabel','%');
                    updateSlider('sdtAttemptsMin','sdtAttemptsMax','sdtAttemptsFill','sdtAttemptsMinLabel','sdtAttemptsMaxLabel','');
                    updateSlider('sdtRoomsMin','sdtRoomsMax','sdtRoomsFill','sdtRoomsMinLabel','sdtRoomsMaxLabel','');
                    _dungeonFilter = { rewardMin:-20, rewardMax:50, diffMin:-20, diffMax:20, attemptsMin:1, attemptsMax:12, roomsMin:5, roomsMax:10 };
                    remainingDungeons = applyDungeonFilter(_allDungeons);
                    updateBadge();
                    recalculateAndRender();
                    popup.classList.remove('open');
                });
            }

            // Apply
            if (applyBtn) {
                applyBtn.addEventListener('click', function() {
                    _dungeonFilter.rewardMin   = parseInt(document.getElementById('sdtRewardMin').value, 10);
                    _dungeonFilter.rewardMax   = parseInt(document.getElementById('sdtRewardMax').value, 10);
                    _dungeonFilter.diffMin     = parseInt(document.getElementById('sdtDiffMin').value, 10);
                    _dungeonFilter.diffMax     = parseInt(document.getElementById('sdtDiffMax').value, 10);
                    _dungeonFilter.attemptsMin = parseInt(document.getElementById('sdtAttemptsMin').value, 10);
                    _dungeonFilter.attemptsMax = parseInt(document.getElementById('sdtAttemptsMax').value, 10);
                    _dungeonFilter.roomsMin    = parseInt(document.getElementById('sdtRoomsMin').value, 10);
                    _dungeonFilter.roomsMax    = parseInt(document.getElementById('sdtRoomsMax').value, 10);

                    // 过滤并重新计算评分（已选路线不受影响，待选列表重新过滤）
                    remainingDungeons = applyDungeonFilter(_allDungeons).filter(
                        d => !selectedRoutes.some(r => generateItemKey(r) === generateItemKey(d))
                    );
                    updateBadge();
                    recalculateAndRender();
                    popup.classList.remove('open');
                });
            }
        })();

        // 语言切换时重新渲染 UI
        document.addEventListener('languageChanged', function() {
            // 更新路线选择下拉列表
            refreshRouteSelect();
            // 更新已选路线列表（包含返回原位项）
            renderRouteList();
            // 更新详细寻路面板（如果有激活状态）
            if (!_activePathDetail) return;
            // 路线列表可能已重新渲染，从 selectedRoutes 中重新获取当前条目
            if (_activePathDetail.index >= 0) {
                const route = selectedRoutes[_activePathDetail.index];
                if (route) {
                    // 复用缓存的路径数据，避免重复 pathfinding
                    renderPathDetail(_activePathDetail.startPos, _activePathDetail.endPos, route, _activePathDetail.index);
                }
            } else {
                // 返回原位项
                renderPathDetail(_activePathDetail.startPos, _activePathDetail.endPos, { _type: 'return', _key: '__return_to_origin__' }, -1);
            }
        });

        // 点击"非已选路线"区域时清除详细寻路面板
        document.addEventListener('click', function(e) {
            if (!_activePathDetail) return;
            const routeList = document.getElementById('solodungeonsRouteList');
            const pathDetailPanel = document.getElementById('routePathDetailPanel');
            // 如果点击不在路线列表也不在详细寻路面板内，则清除
            if (routeList && !routeList.contains(e.target) &&
                pathDetailPanel && !pathDetailPanel.contains(e.target)) {
                clearPathDetailPanel();
            }
        });
    });

    // 辅助函数：根据 ID 和类型查找数据项
    function findItemById(id, type) {
        // 从当前 DOM 中的数据行获取信息
        const outputDiv = document.getElementById('solodungeonsOutput');
        const rows = outputDiv.querySelectorAll(`.solodungeons-listview-body tr[data-id="${id}"]`);
        console.log('[SoloDungeons] findItemById query for id="' + id + '":', rows.length, 'rows found');
        if (rows.length === 0) return null;

        const row = rows[0];
        const dataStr = row.dataset.data;
        if (!dataStr) return null;

        try {
            const item = JSON.parse(decodeURIComponent(dataStr));
            console.log('[SoloDungeons] findItemById found item, keys:', Object.keys(item), ', item:', item);
            return { ...item, _type: type };
        } catch (e) {
            console.error('[SoloDungeons] Parse error:', e);
            return null;
        }
    }

    // ------------------------------------------------------------------
    // 动态计算 solodungeons-tab 高度，精确减去底部固定 Tab 条高度
    // ------------------------------------------------------------------
    function updateSoloTabHeight() {
        const tabBar = document.querySelector('.tab-container');
        const soloTab = document.getElementById('solodungeons-tab');
        console.log('[updateSoloTabHeight] tabBar:', tabBar, 'soloTab:', soloTab);
        if (!tabBar || !soloTab) return;
        const tabH  = tabBar.offsetHeight;
        // soloTab 距视口顶部的距离（含 margin/padding/定位偏移）
        const soloTabTop = soloTab.getBoundingClientRect().top;
        const availableH = window.innerHeight - soloTabTop - tabH;
        console.log(`[updateSoloTabHeight] window.innerHeight=${window.innerHeight}, soloTabTop=${soloTabTop}, tabH=${tabH}, availableH=${availableH}`);
        soloTab.style.height = availableH + 'px';
        console.log(`[updateSoloTabHeight] soloTab.style.height set to: ${soloTab.style.height}`);
    }

    // DOM 就绪后立即执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateSoloTabHeight);
    } else {
        updateSoloTabHeight();
    }

    // 窗口缩放时重新计算
    window.addEventListener('resize', updateSoloTabHeight);

    // 切换到副本及符文 Tab 时重新计算（Tab 文字变化可能导致 Tab 条高度变化）
    document.querySelector('.tab-container')?.addEventListener('click', function(e) {
        const tab = e.target.closest('.tab');
        if (tab && tab.dataset.tab === 'solodungeons-tab') {
            requestAnimationFrame(updateSoloTabHeight);
        }
    });
})();
