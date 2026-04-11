/**
 * Pathfinder Module - 星图寻路算法
 * 
 * 提供从起点到终点的最短路径计算，支持：
 * - 初始星系网格点 (250, 250) 间隔
 * - 传送门空间站（零距离传送）
 * - Dijkstra 最短路径算法
 * - KDTree 最近点搜索
 */

/**
 * 坐标解析器 - 支持多种坐标格式
 */
class CoordinateParser {
    static parse(input) {
        if (typeof input === "object") {
            if (Array.isArray(input)) {
                if (input.length !== 2)
                    throw new Error("Array must have two elements.");
                return { x: Number(input[0]), y: Number(input[1]) };
            } else if (input !== null && "x" in input && "y" in input) {
                return { x: Number(input.x), y: Number(input.y) };
            } else if (
                input !== null &&
                "coordinate_x" in input &&
                "coordinate_y" in input
            ) {
                return `[${input.coordinate_x},${input.coordinate_y}]`;
            } else {
                throw new Error("Object must contain x and y properties.");
            }
        }

        if (typeof input !== "string") {
            throw new Error("Unsupported input type.");
        }

        // 统一处理字符串
        const normalized = this.#normalizeString(input);
        const match = normalized.match(/(-?\d+(\.\d+)?)[,.;\s](-?\d+(\.\d+)?)/);
        if (match) {
            return {
                x: Number(match[1]),
                y: Number(match[3]),
            };
        }

        // 处理 x=100,y=200 格式
        const objMatch = normalized.match(
            /x\s*[=:]?\s*(-?\d+(\.\d+)?)[,;]\s*y\s*[=:]?\s*(-?\d+(\.\d+)?)/
        );
        if (objMatch) {
            return {
                x: Number(objMatch[1]),
                y: Number(objMatch[3]),
            };
        }

        throw new Error("Unable to parse coordinate string: " + input);
    }

    // 统一字符串标准化处理
    static #normalizeString(str) {
        // 全角转半角
        str = str.replace(/[\uFF01-\uFF5E]/g, (ch) =>
            String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
        );
        str = str.replace(/\u3000/g, " "); // 全角空格

        // 全角逗号分号替换为半角
        str = str.replace(/[，、；]/g, (s) => {
            if (s === "，") return ",";
            return ";";
        });

        // 替换其他分隔符为统一格式
        str = str.replace(/[;、]/g, ","); // 全部变成逗号

        // 把空白替换为逗号
        str = str.replace(/\s+/g, ",");

        // 可能出现连续逗号，合并之
        str = str.replace(/,+/g, ",");

        // 去掉前后逗号
        str = str.replace(/^,|,$/g, "");

        return str.toLowerCase();
    }

    static isValidCoordinator(input) {
        return (
            input &&
            typeof input === "object" &&
            typeof input.x === "number" &&
            typeof input.y === "number"
        );
    }

    static normalize(input) {
        return this.isValidCoordinator(input) ? input : this.parse(input);
    }
}

/**
 * 寻路网格 - 核心寻路算法
 */
class PathfinderGrid {
    constructor(maxX = 2000, maxY = 2000, options = {}) {
        const step = options.step || 250;
        const gap = options.gap || 750;
        this.unitDistance = options.unitDistance || 10;

        this.initialPoints = [];

        // 生成初始网格点
        for (let x = step; x <= maxX; x += gap) {
            for (let y = step; y <= maxY; y += gap) {
                this.initialPoints.push({ x, y });
            }
        }

        this.portedSpaceStations = new Set();
        this.kdTree = this.#buildKDTree(this.initialPoints);
    }

    // 核心通用坐标解析
    #parsePoint(input) {
        return CoordinateParser.parse(input);
    }

    #parseMultiplyPoints(...args) {
        if (args.length === 1) {
            if (Array.isArray(args[0])) {
                return args[0].map((ele) => this.#parsePoint(ele));
            } else if (typeof args[0] === "object") {
                return Object.values(args[0]).map((value) =>
                    this.#parsePoint(value)
                );
            }
        } else if (
            args.length === 4 &&
            args.every((a) => typeof a === "number")
        ) {
            return [
                { x: args[0], y: args[1] },
                { x: args[2], y: args[3] },
            ];
        } else if (args.length === 2) {
            return [this.#parsePoint(args[0]), this.#parsePoint(args[1])];
        } else {
            throw new Error("Invalid arguments for two points");
        }
    }

    /**
     * 计算两点之间的距离（光年）
     * @param {...any} args - 两个点，支持多种格式
     * @returns {number} 距离（光年）
     */
    calculateDistance(...args) {
        const [p1, p2] = this.#parseMultiplyPoints(...args);
        return Math.hypot(p1.x - p2.x, p1.y - p2.y) * this.unitDistance;
    }

    #addPortedSpaceStation(...args) {
        if (args.length === 0) return;
        const point = this.#parsePoint(...args);
        if (point.x < 0 || point.x > 2000 || point.y < 0 || point.y > 2000) {
            throw new Error(`坐标超出范围: (${point.x}, ${point.y})`);
        }
        this.portedSpaceStations.add(point);
    }

    /**
     * 添加传送门空间站
     * @param {Array} stationInfos - 空间站信息数组
     */
    addPortedSpaceStations(stationInfos) {
        if (Array.isArray(stationInfos)) {
            stationInfos.forEach((info) => {
                if (info.space_portal && info.space_portal == true) {
                    const coordPoints = {
                        x: info.system.coordinate_x,
                        y: info.system.coordinate_y
                    };
                    this.#addPortedSpaceStation(coordPoints);
                }
            });
        }
    }

    /**
     * 清除所有空间站
     */
    clearSpaceStations() {
        this.portedSpaceStations = new Set();
    }

    /**
     * 查找最近的点（初始网格点或空间站）
     * @param {any} input - 目标坐标
     * @returns {Object} 最近点信息
     */
    findNearestPoint(input) {
        const target = this.#parsePoint(input);
        const kdResult = this.#searchKDTree(target);
        const starterSystemOnly = {
            nearest: kdResult.point,
            distance: kdResult.distance * this.unitDistance,
        };

        let best = { point: kdResult.point, distance: kdResult.distance };
        for (const station of this.portedSpaceStations) {
            const d = Math.hypot(target.x - station.x, target.y - station.y);
            if (d < best.distance) {
                best = { point: station, distance: d };
            }
        }
        const withSpaceStation = {
            nearest: best.point,
            distance: best.distance * this.unitDistance,
        };

        return { starterSystemOnly, withSpaceStation };
    }

    /**
     * 查找最短路径
     * 
     * 核心逻辑（3种方案取最优）：
     * 1. 网格点网络：起点 → 最近网格点 [飞行] → 网格点跳转 [0距离] → 最近网格点 → 终点 [飞行]
     * 2. 空间站网络：起点 → 最近空间站 [飞行] → 空间站跳转 [0距离] → 最近空间站 → 终点 [飞行]
     * 3. 直接飞行：起点 → 终点 [飞行]
     * 
     * 两个0距离网络完全隔离，不能互通。
     * 
     * @param {any} startInput - 起点坐标
     * @param {any} endInput - 终点坐标
     * @returns {Object} 包含 starterSystemOnly 和 withSpaceStation 两种路径结果
     */
    findShortestPath(startInput, endInput) {
        const start = this.#parsePoint(startInput);
        const end = this.#parsePoint(endInput);

        const starterPath = this.#runShortestPath(start, end, true);
        const fullPath = this.#runShortestPath(start, end, false);

        return {
            starterSystemOnly: starterPath,
            withSpaceStation: fullPath,
        };
    }

    /**
     * 重构后的最短路径算法
     * 
     * @param {Object} start - 起点坐标
     * @param {Object} end - 终点坐标
     * @param {boolean} starterOnly - 是否只使用网格点网络
     * @returns {Object} { distance, path, trajectories }
     */
    #runShortestPath(start, end, starterOnly) {
        // 方案C：直接飞行
        const directDistance = Math.hypot(end.x - start.x, end.y - start.y) * this.unitDistance;
        
        // 方案A：网格点网络
        const starterResult = this.#calcNetworkPath(start, end, 'starter', starterOnly);
        
        // 方案B：空间站网络（如果不禁用）
        const stationResult = starterOnly ? null : this.#calcNetworkPath(start, end, 'station', false);
        
        // 比较所有方案
        const candidates = [
            { type: 'direct', distance: directDistance, path: [start, end] },
            { type: 'starter-network', ...starterResult },
        ];
        if (stationResult) {
            candidates.push({ type: 'station-network', ...stationResult });
        }
        
        // 选择最短方案
        const best = candidates.reduce((a, b) => a.distance <= b.distance ? a : b);
        
        // 构建轨迹
        const trajectories = this.#buildTrajectories(best.path, best.type, starterOnly);
        
        return {
            distance: best.distance,
            path: best.path,
            trajectories,
        };
    }

    /**
     * 计算网络路径的总距离和路径点
     * 
     * @param {Object} start - 起点
     * @param {Object} end - 终点
     * @param {'starter'|'station'} networkType - 网络类型
     * @param {boolean} starterOnly - 是否只使用网格点（用于网格点网络）
     * @returns {Object} { distance, path }
     */
    #calcNetworkPath(start, end, networkType, starterOnly) {
        let networkNodes, isOnNetworkFn;
        
        if (networkType === 'starter') {
            networkNodes = this.initialPoints;
            isOnNetworkFn = (p) => this.isStarter(p);
        } else {
            networkNodes = Array.from(this.portedSpaceStations);
            isOnNetworkFn = (p) => this.isStation(p);
        }
        
        if (networkNodes.length === 0) {
            return { distance: Infinity, path: [] };
        }
        
        // STEP1: 找起点最近的入口节点 + 距离
        let entryNode = null, entryDist = Infinity;
        for (const node of networkNodes) {
            const d = Math.hypot(node.x - start.x, node.y - start.y) * this.unitDistance;
            if (d < entryDist) {
                entryDist = d;
                entryNode = node;
            }
        }
        
        // STEP2: 找离终点最近的出口节点 + 距离
        let exitNode = null, exitDist = Infinity;
        for (const node of networkNodes) {
            const d = Math.hypot(node.x - end.x, node.y - end.y) * this.unitDistance;
            if (d < exitDist) {
                exitDist = d;
                exitNode = node;
            }
        }
        
        // 如果起点/终点已经在网络上，对应距离为0
        if (isOnNetworkFn(start)) {
            // 起点在网络上，找离起点最近的网络节点（可能是自己）
            entryDist = 0;
            entryNode = this.#findNearestNode(start, networkNodes);
        }
        if (isOnNetworkFn(end)) {
            exitDist = 0;
            exitNode = this.#findNearestNode(end, networkNodes);
        }
        
        // STEP3: 在网络内跳转（0距离）
        const networkPath = this.#findNetworkPath(entryNode, exitNode, networkType, starterOnly);
        
        // 总距离
        const totalDist = entryDist + exitDist; // 网络内跳转 = 0
        
        // 完整路径：起点 → 入口 → 网络路径 → 出口 → 终点
        const fullPath = [start];
        if (entryNode && (entryDist > 0 || !this.#pointsEqual(entryNode, start))) {
            fullPath.push(entryNode);
        }
        // 插入网络路径（跳过重复的端点）
        for (const node of networkPath) {
            if (!this.#pointsEqual(node, fullPath[fullPath.length - 1])) {
                fullPath.push(node);
            }
        }
        if (exitNode && !this.#pointsEqual(exitNode, fullPath[fullPath.length - 1])) {
            fullPath.push(exitNode);
        }
        if (!this.#pointsEqual(end, fullPath[fullPath.length - 1])) {
            fullPath.push(end);
        }
        
        return { distance: totalDist, path: fullPath };
    }

    /**
     * 在网络内找两点之间的路径
     * 
     * @param {Object} start - 网络起点
     * @param {Object} end - 网络终点
     * @param {'starter'|'station'} networkType - 网络类型
     * @param {boolean} starterOnly - 是否只使用网格点
     * @returns {Array} 网络内的路径点数组
     */
    #findNetworkPath(start, end, networkType, starterOnly) {
        // 如果是网格点网络：网格点之间0距离
        // 如果是空间站网络：空间站之间0距离
        // 两个网络完全隔离
        
        // 这里使用简化逻辑：对于0距离网络，两点之间可以"直接跳转"
        // 返回路径为 [start, end]（中间可能有其他节点用于展示）
        
        // 简单情况：起点=终点
        if (this.#pointsEqual(start, end)) {
            return [start];
        }
        
        // 对于0距离网络，我们可以在任意两个节点间跳转
        // 为了展示目的，可以选择经过其他节点，但实际上0距离怎么走都一样
        
        // 简单实现：直接返回 [start, end]
        // 如果需要更详细的路径，可以在将来扩展
        return [start, end];
    }

    /**
     * 查找最近的节点
     */
    #findNearestNode(point, nodes) {
        let nearest = null, minDist = Infinity;
        for (const node of nodes) {
            const d = Math.hypot(node.x - point.x, node.y - point.y);
            if (d < minDist) {
                minDist = d;
                nearest = node;
            }
        }
        return nearest;
    }

    /**
     * 比较两个点是否相等
     */
    #pointsEqual(a, b) {
        return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
    }

    /**
     * 构建轨迹数组
     */
    #buildTrajectories(path, pathType, starterOnly) {
        const trajectories = [];
        
        for (let i = 0; i < path.length - 1; i++) {
            const from = path[i];
            const to = path[i + 1];
            
            // 判断这一跳的类型
            let hopType, dist;
            if (pathType === 'direct') {
                hopType = 'direct';
                dist = Math.hypot(to.x - from.x, to.y - from.y) * this.unitDistance;
            } else if (pathType === 'starter-network') {
                hopType = this.#classifyHop(from, to, 'starter');
                // 网格点之间0距离
                dist = (hopType === 'starter-jump') ? 0 : 
                    Math.hypot(to.x - from.x, to.y - from.y) * this.unitDistance;
            } else if (pathType === 'station-network') {
                hopType = this.#classifyHop(from, to, 'station');
                // 空间站之间0距离
                dist = (hopType === 'station-jump') ? 0 : 
                    Math.hypot(to.x - from.x, to.y - from.y) * this.unitDistance;
            } else {
                hopType = 'flight';
                dist = Math.hypot(to.x - from.x, to.y - from.y) * this.unitDistance;
            }
            
            // 跳过距离为0的轨迹（除非是明确标注的网络跳转）
            if (dist > 0 || hopType === 'starter-jump' || hopType === 'station-jump') {
                trajectories.push({ from, to, distance: dist, hopType });
            }
        }
        
        return trajectories;
    }

    /**
     * 分类单跳的类型
     */
    #classifyHop(from, to, networkType) {
        if (networkType === 'starter') {
            if (this.isStarter(from) && this.isStarter(to)) return 'starter-jump';
        } else if (networkType === 'station') {
            if (this.isStation(from) && this.isStation(to)) return 'station-jump';
        }
        return 'flight';
    }

    /**
     * 检查点是否是初始星系
     * @param {any} p - 坐标
     * @returns {boolean}
     */
    isStarter(p) {
        const pReal = CoordinateParser.normalize(p);
        return this.initialPoints.some(
            (pt) => pt.x === pReal.x && pt.y === pReal.y
        );
    }

    /**
     * 检查点是否是空间站
     * @param {any} p - 坐标
     * @returns {boolean}
     */
    isStation(p) {
        const pReal = CoordinateParser.normalize(p);
        return Array.from(this.portedSpaceStations).some(
            (pt) => pt.x === pReal.x && pt.y === pReal.y
        );
    }

    #buildKDTree(points, depth = 0) {
        if (points.length === 0) return null;
        const axis = depth % 2 ? "y" : "x";
        points.sort((a, b) => a[axis] - b[axis]);
        const median = Math.floor(points.length / 2);
        return {
            point: points[median],
            left: this.#buildKDTree(points.slice(0, median), depth + 1),
            right: this.#buildKDTree(points.slice(median + 1), depth + 1),
            axis,
        };
    }

    #searchKDTree(target) {
        let best = { point: null, distance: Infinity };
        const search = (node) => {
            if (!node) return;
            const d = Math.hypot(
                target.x - node.point.x,
                target.y - node.point.y
            );
            if (d < best.distance) best = { point: node.point, distance: d };
            const diff = target[node.axis] - node.point[node.axis];
            const primary = diff < 0 ? node.left : node.right;
            const secondary = diff < 0 ? node.right : node.left;
            search(primary);
            if (Math.abs(diff) < best.distance) search(secondary);
        };
        search(this.kdTree);
        return best;
    }

    /**
     * 查找所有在半径内的初始网格点（KD-tree 范围搜索）
     * @param {Object} center - 圆心 {x, y}
     * @param {number} radius - 半径（单位：坐标单位，非光年）
     * @returns {Array} [{ point, distance }, ...]
     */
    #findPointsInRadius(center, radius) {
        const results = [];
        const search = (node) => {
            if (!node) return;
            // 计算当前节点边界（简化：检查是否可能与圆相交）
            // KD-tree 节点边界近似：沿当前分割轴的距离
            const diff = center[node.axis] - node.point[node.axis];
            // 先搜索更近的一侧
            const primary = diff < 0 ? node.left : node.right;
            const secondary = diff < 0 ? node.right : node.left;
            // 如果 primary 侧完全在圆外，跳过
            const primaryBound = diff < 0 ? center[node.axis] - radius : center[node.axis] + radius;
            const mustSearchPrimary = diff < 0
                ? node.point[node.axis] >= center[node.axis] - radius
                : node.point[node.axis] <= center[node.axis] + radius;
            const mustSearchSecondary = Math.abs(diff) < radius;

            if (mustSearchPrimary) search(primary);
            if (mustSearchSecondary) search(secondary);
        };
        search(this.kdTree);

        // 手动检查每个找到的点是否真的在圆内（因为 KD-tree 不精确）
        for (const node of this.#collectAllNodes(this.kdTree)) {
            const d = Math.hypot(center.x - node.point.x, center.y - node.point.y);
            if (d <= radius) {
                results.push({ point: node.point, distance: d });
            }
        }
        return results;
    }

    /** 收集 KD-tree 所有节点 */
    #collectAllNodes(node) {
        if (!node) return [];
        return [node, ...this.#collectAllNodes(node.left), ...this.#collectAllNodes(node.right)];
    }

    /**
     * 步进限制寻路
     * 
     * 核心逻辑：
     * 1. 先用 findShortestPath 找最优方案（S/P/D）
     * 2. 只拆分"飞行段"：按 stepLimit 贪心拆分
     * 3. 0距离段直接保留，不拆分
     * 
     * @param {any} startInput - 起点
     * @param {any} endInput - 终点
     * @param {number|null} stepLimit - 每跳最大距离（光年），null 表示无限制
     * @returns {Object} { distance, path, trajectories, reached }
     */
    findStepLimitedPath(startInput, endInput, stepLimit = null) {
        const start = this.#parsePoint(startInput);
        const end = this.#parsePoint(endInput);

        // 无限制 → 退化到标准最短路径
        if (stepLimit === null || stepLimit === undefined) {
            const result = this.findShortestPath(start, end).withSpaceStation;
            return { ...result, reached: true };
        }

        // 特殊情况：起点=终点
        if (start.x === end.x && start.y === end.y) {
            return { distance: 0, path: [start], trajectories: [], reached: true };
        }

        // 计算三种方案的距离
        const directDist = this.#calcDirectDistance(start, end);
        const starterDist = this.#calcNetworkDistance(start, end, 'starter', true);
        const stationDist = this.#calcNetworkDistance(start, end, 'station', false);

        // 选择最优方案
        let bestType, bestPath, bestTrajectories;
        
        if (starterDist <= directDist && starterDist <= stationDist) {
            bestType = 'starter-network';
            bestTrajectories = this.#splitPathForStepLimit(
                this.#buildNetworkTrajectories(start, end, 'starter', true),
                stepLimit
            );
        } else if (stationDist <= directDist && stationDist <= starterDist) {
            bestType = 'station-network';
            bestTrajectories = this.#splitPathForStepLimit(
                this.#buildNetworkTrajectories(start, end, 'station', false),
                stepLimit
            );
        } else {
            bestType = 'direct';
            bestTrajectories = this.#splitPathForStepLimit([
                { from: start, to: end, distance: directDist, hopType: 'direct-flight' }
            ], stepLimit);
        }

        // 构建路径点
        const path = [start];
        let totalDist = 0;
        for (const t of bestTrajectories) {
            if (!this.#pointsEqual(path[path.length - 1], t.from)) {
                path.push(t.from);
            }
            path.push(t.to);
            totalDist += t.distance;
        }

        return { 
            distance: totalDist, 
            path: this.#deduplicatePath(path),
            trajectories: bestTrajectories,
            reached: true,
            planType: bestType
        };
    }

    /**
     * 计算直接飞行距离
     */
    #calcDirectDistance(start, end) {
        return Math.hypot(end.x - start.x, end.y - start.y) * this.unitDistance;
    }

    /**
     * 计算网络方案的总距离（不包含出口到终点的段）
     */
    #calcNetworkDistance(start, end, networkType, starterOnly) {
        let networkNodes;
        if (networkType === 'starter') {
            networkNodes = this.initialPoints;
        } else {
            networkNodes = Array.from(this.portedSpaceStations);
        }

        if (networkNodes.length === 0) return Infinity;

        // 找最近的入口和出口
        let entryDist = Infinity, entryNode = null;
        for (const node of networkNodes) {
            const d = Math.hypot(node.x - start.x, node.y - start.y) * this.unitDistance;
            if (d < entryDist) {
                entryDist = d;
                entryNode = node;
            }
        }

        let exitDist = Infinity, exitNode = null;
        for (const node of networkNodes) {
            const d = Math.hypot(node.x - end.x, node.y - end.y) * this.unitDistance;
            if (d < exitDist) {
                exitDist = d;
                exitNode = node;
            }
        }

        // 如果起点/终点已经在网络上
        if (networkType === 'starter' && this.isStarter(start)) {
            entryDist = 0;
        }
        if (networkType === 'starter' && this.isStarter(end)) {
            exitDist = 0;
        }
        if (networkType === 'station' && this.isStation(start)) {
            entryDist = 0;
        }
        if (networkType === 'station' && this.isStation(end)) {
            exitDist = 0;
        }

        // 网络内跳转 = 0距离
        return entryDist + exitDist;
    }

    /**
     * 构建网络方案的轨迹（未拆分）
     */
    #buildNetworkTrajectories(start, end, networkType, starterOnly) {
        const trajectories = [];
        const isStarterNet = (networkType === 'starter');
        const isStationNet = (networkType === 'station');

        let networkNodes = isStarterNet ? this.initialPoints : Array.from(this.portedSpaceStations);
        if (networkNodes.length === 0) return [];

        // 找入口节点
        let entryDist = Infinity, entryNode = null;
        for (const node of networkNodes) {
            const d = Math.hypot(node.x - start.x, node.y - start.y) * this.unitDistance;
            if (d < entryDist) {
                entryDist = d;
                entryNode = node;
            }
        }

        // 找出口节点
        let exitDist = Infinity, exitNode = null;
        for (const node of networkNodes) {
            const d = Math.hypot(node.x - end.x, node.y - end.y) * this.unitDistance;
            if (d < exitDist) {
                exitDist = d;
                exitNode = node;
            }
        }

        // 如果起点就是网络节点，跳过入口段
        if (isStarterNet && this.isStarter(start)) {
            entryDist = 0;
            entryNode = this.#findNearestNode(start, networkNodes);
        }
        if (isStationNet && this.isStation(start)) {
            entryDist = 0;
            entryNode = this.#findNearestNode(start, networkNodes);
        }
        if (isStarterNet && this.isStarter(end)) {
            exitDist = 0;
            exitNode = this.#findNearestNode(end, networkNodes);
        }
        if (isStationNet && this.isStation(end)) {
            exitDist = 0;
            exitNode = this.#findNearestNode(end, networkNodes);
        }

        // 起点 → 入口
        if (entryDist > 0) {
            trajectories.push({
                from: start,
                to: entryNode,
                distance: entryDist,
                hopType: isStarterNet ? 'starter-entry' : 'station-entry'
            });
        }

        // 入口 ↔ 出口（0距离）
        if (!this.#pointsEqual(entryNode, exitNode)) {
            trajectories.push({
                from: entryNode,
                to: exitNode,
                distance: 0,
                hopType: isStarterNet ? 'starter-jump' : 'station-jump'
            });
        }

        // 出口 → 终点
        if (exitDist > 0) {
            trajectories.push({
                from: exitNode,
                to: end,
                distance: exitDist,
                hopType: isStarterNet ? 'starter-exit' : 'station-exit'
            });
        }

        return trajectories;
    }

    /**
     * 将飞行段按步进限制拆分
     * 
     * @param {Array} trajectories - 原始轨迹数组
     * @param {number} stepLimit - 每跳最大距离（光年）
     * @returns {Array} 拆分后的轨迹数组
     */
    #splitPathForStepLimit(trajectories, stepLimit) {
        const result = [];

        for (const seg of trajectories) {
            // 0距离段直接保留
            if (seg.distance === 0) {
                result.push(seg);
                continue;
            }

            // 拆分飞行段
            const subHops = this.#splitSegment(seg.from, seg.to, seg.distance, stepLimit, seg.hopType);
            result.push(...subHops);
        }

        return result;
    }

    /**
     * 将一段飞行拆分为多段
     * 策略：圆形内贪心搜索，每跳在 stepLimit 半径内选择到终点最近的整数坐标点
     */
    #splitSegment(from, to, totalDist, stepLimit, hopType) {
        const result = [];
        
        // 起点终点取整
        const fromPt = { x: Math.round(from.x), y: Math.round(from.y) };
        const toPt = { x: Math.round(to.x), y: Math.round(to.y) };
        
        let current = { ...fromPt };
        const radius = stepLimit / this.unitDistance; // 转换为坐标单位

        while (true) {
            const distToGoal = Math.hypot(toPt.x - current.x, toPt.y - current.y);
            
            // 如果可以直接到达终点
            if (distToGoal * this.unitDistance <= stepLimit + 0.001) {
                const finalDist = distToGoal * this.unitDistance;
                if (finalDist > 0.001) {
                    result.push({
                        from: { ...current },
                        to: { ...toPt },
                        distance: finalDist,
                        hopType: hopType
                    });
                }
                break;
            }
            
            // 在圆形内找所有整数坐标点，选择到终点最近的
            let bestNext = null;
            let bestDistToGoal = Infinity;
            
            // 搜索范围：以 current 为中心，radius 为半径的正方形
            const minX = Math.floor(current.x - radius);
            const maxX = Math.ceil(current.x + radius);
            const minY = Math.floor(current.y - radius);
            const maxY = Math.ceil(current.y + radius);
            
            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    // 跳过当前点
                    if (x === current.x && y === current.y) continue;
                    
                    const dist = Math.hypot(x - current.x, y - current.y);
                    
                    // 必须在圆内（距离 <= radius）
                    if (dist > radius + 0.001) continue;
                    
                    // 计算到终点的距离
                    const distGoal = Math.hypot(toPt.x - x, toPt.y - y);
                    
                    // 选择到终点最近的点
                    if (distGoal < bestDistToGoal) {
                        bestDistToGoal = distGoal;
                        bestNext = { x, y };
                    }
                }
            }
            
            if (bestNext) {
                const hopDist = Math.hypot(bestNext.x - current.x, bestNext.y - current.y) * this.unitDistance;
                result.push({
                    from: { ...current },
                    to: bestNext,
                    distance: hopDist,
                    hopType: hopType + '-segment'
                });
                current = bestNext;
            } else {
                // 没有找到合适的点，直接飞向终点
                const finalDist = distToGoal * this.unitDistance;
                result.push({
                    from: { ...current },
                    to: { ...toPt },
                    distance: finalDist,
                    hopType: hopType
                });
                break;
            }
        }

        return result;
    }

    /**
     * 去重路径点
     */
    #deduplicatePath(path) {
        const result = [path[0]];
        for (let i = 1; i < path.length; i++) {
            if (!this.#pointsEqual(path[i], result[result.length - 1])) {
                result.push(path[i]);
            }
        }
        return result;
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CoordinateParser, PathfinderGrid };
}

if (typeof window !== 'undefined') {
    window.CoordinateParser = CoordinateParser;
    window.PathfinderGrid = PathfinderGrid;
}

/**
 * PathfinderService - 全局单例，管理共享的 PathfinderGrid 实例
 *
 * 初始化优先级规则：
 * - T0 级（战斗/采集/星图/计算工具/概率）是主要初始化途径
 * - T0 级 TAB 的导入功能强制重新初始化（会覆盖之前的数据）
 * - 非 T0 模块遵循：T0 未初始化时自己初始化；有则复用
 * - 星图 TAB 是 Pathfinder Grid 的主要初始化途径
 */
const PathfinderService = (() => {
    /** @type {PathfinderGrid|null} */
    let _grid = null;
    let _initialized = false;

    function _getGrid() {
        if (!_grid) {
            _grid = new PathfinderGrid();
        }
        return _grid;
    }

    /**
     * 用 User API 返回的原始数据初始化空间站。
     * 
     * 这是 T0 级模块（主要是星图 TAB）调用的主要入口。
     * T0 级导入功能强制重新初始化，会清除之前的空间站数据。
     * 
     * @param {Array} squadronSpaceStations - userData.data.squadronSpaceStations
     * @param {boolean} [force=false] - T0 级模块设置 true 强制重新初始化
     */
    function initFromUserData(squadronSpaceStations, force = false) {
        const grid = _getGrid();
        
        // T0 级模块强制重新初始化，非 T0 级模块只有未初始化时才执行
        if (_initialized && !force) {
            console.log('[PathfinderService] Already initialized, skipping (use force=true to override).');
            return;
        }
        
        grid.clearSpaceStations();
        if (Array.isArray(squadronSpaceStations) && squadronSpaceStations.length > 0) {
            grid.addPortedSpaceStations(squadronSpaceStations);
        }
        _initialized = true;
        // 同步写全局，供其他仍引用旧变量的代码使用
        if (typeof window !== 'undefined') {
            window.stellarOdysseyPathfinderGrid = grid;
        }
        console.log('[PathfinderService]', force ? 'Force reinitialized' : 'Initialized', 'with', grid.portedSpaceStations.size, 'space station(s).');
    }

    /**
     * 确保已初始化（用于非 T0 级模块，如副本 TAB）。
     * 原则：T0 未初始化时自己初始化；有则复用（不会强制覆盖）。
     * @param {string} [apiKey] - 可选，T0 未初始化时用于请求 User API
     * @returns {Promise<PathfinderGrid>}
     */
    async function ensureInitialized(apiKey) {
        // 已初始化，直接复用（非 T0 模块永不强制覆盖）
        if (_initialized) return _getGrid();

        // T0 级模块（星图）可能已通过 initFromUserData 初始化过，检查全局变量
        if (typeof window !== 'undefined' && window.stellarOdysseyPathfinderGrid) {
            _grid = window.stellarOdysseyPathfinderGrid;
            _initialized = true;
            return _getGrid();
        }

        // T0 未初始化，自己初始化（非 T0 模块的兜底逻辑）
        // 先尝试从全局缓存获取 user data
        if (typeof window !== 'undefined' && window.stellarOdysseyUserData) {
            const ud = window.stellarOdysseyUserData;
            if (ud.data && ud.data.squadronSpaceStations) {
                initFromUserData(ud.data.squadronSpaceStations, false); // 非强制
                return _getGrid();
            }
        }

        // 没有缓存，用 apiKey 请求一次 User API
        if (!apiKey) {
            console.warn('[PathfinderService] No API key provided, using grid without space stations.');
            _initialized = true;
            if (typeof window !== 'undefined') {
                window.stellarOdysseyPathfinderGrid = _getGrid();
            }
            return _getGrid();
        }

        try {
            const response = await fetch('https://api.stellarodyssey.app/api/public/user', {
                headers: {
                    'Accept': 'application/json',
                    'sodyssey-api-key': apiKey
                }
            });

            if (response.ok) {
                const userData = await response.json();
                // 保存到全局缓存（如果尚未缓存）
                if (typeof window !== 'undefined' && !window.stellarOdysseyUserData) {
                    window.stellarOdysseyUserData = userData;
                }
                const stations = userData.data && userData.data.squadronSpaceStations;
                initFromUserData(stations || [], false); // 非强制
            } else {
                console.warn('[PathfinderService] User API returned', response.status, '- using grid without space stations.');
                _initialized = true;
                if (typeof window !== 'undefined') {
                    window.stellarOdysseyPathfinderGrid = _getGrid();
                }
            }
        } catch (e) {
            console.warn('[PathfinderService] Failed to fetch user data:', e);
            _initialized = true;
            if (typeof window !== 'undefined') {
                window.stellarOdysseyPathfinderGrid = _getGrid();
            }
        }
        return _getGrid();
    }

    /**
     * 重置状态（用于测试或强制重新加载）
     */
    function reset() {
        _initialized = false;
        if (_grid) _grid.clearSpaceStations();
    }

    /**
     * 获取当前 grid（可能未含空间站）
     */
    function getGrid() {
        return _getGrid();
    }

    /**
     * 当前是否已完成初始化
     */
    function isInitialized() {
        return _initialized;
    }

    return { ensureInitialized, initFromUserData, getGrid, reset, isInitialized };
})();

if (typeof window !== 'undefined') {
    window.PathfinderService = PathfinderService;
}
