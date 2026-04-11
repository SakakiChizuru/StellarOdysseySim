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

    #calculateSegmentDistance(from, to, starterOnly) {
        if (this.isStarter(from) && this.isStarter(to)) return 0;
        if (!starterOnly && this.isStation(from) && this.isStation(to))
            return 0;
        return Math.hypot(from.x - to.x, from.y - to.y) * this.unitDistance;
    }

    #runShortestPath(start, end, starterOnly) {
        const nodes = [start, end, ...this.initialPoints];
        if (!starterOnly) nodes.push(...this.portedSpaceStations);

        const edges = new Map();

        for (let i = 0; i < nodes.length; i++) {
            edges.set(i, []);
            for (let j = 0; j < nodes.length; j++) {
                if (i === j) continue;

                let dist;
                if (this.isStarter(nodes[i]) && this.isStarter(nodes[j])) {
                    dist = 0;
                } else if (
                    !starterOnly &&
                    this.isStation(nodes[i]) &&
                    this.isStation(nodes[j])
                ) {
                    dist = 0;
                } else {
                    dist =
                        Math.hypot(
                            nodes[i].x - nodes[j].x,
                            nodes[i].y - nodes[j].y
                        ) * this.unitDistance;
                }
                edges.get(i).push({ to: j, cost: dist });
            }
        }

        const { distance, path } = this.#dijkstra(edges, 0, 1, nodes);
        const pathPoints = path.map((idx) => nodes[idx]);

        const trajectories = [];
        for (let i = 0; i < pathPoints.length - 1; i++) {
            const from = pathPoints[i];
            const to = pathPoints[i + 1];
            const segDistance = this.#calculateSegmentDistance(
                from,
                to,
                starterOnly
            );

            trajectories.push({ from, to, distance: segDistance });
        }

        return { distance, path: pathPoints, trajectories };
    }

    #dijkstra(edges, startIdx, endIdx, nodes) {
        const dist = Array(nodes.length).fill(Infinity);
        const prev = Array(nodes.length).fill(null);
        const visited = new Set();
        dist[startIdx] = 0;

        while (visited.size < nodes.length) {
            let u = -1,
                minDist = Infinity;
            for (let i = 0; i < nodes.length; i++) {
                if (!visited.has(i) && dist[i] < minDist) {
                    minDist = dist[i];
                    u = i;
                }
            }
            if (u === -1) break;

            visited.add(u);
            for (const edge of edges.get(u)) {
                if (dist[u] + edge.cost < dist[edge.to]) {
                    dist[edge.to] = dist[u] + edge.cost;
                    prev[edge.to] = u;
                }
            }
        }

        const path = [];
        for (let at = endIdx; at !== null; at = prev[at]) {
            path.push(at);
        }
        path.reverse();

        return { distance: dist[endIdx], path };
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
     * 步进限制寻路（贪心算法）
     * 寻路规则：
     * 1. 初始星系间互相跳跃视为"0距离"
     * 2. 拥有"传送门"的空间站之间相互跳跃视为"0距离"
     * 3. 每跳最大距离 ≤ stepLimit，尽可能远地朝向终点
     * @param {any} startInput - 起点
     * @param {any} endInput - 终点
     * @param {number|null} stepLimit - 每跳最大距离（光年），null 表示无限制（用 Dijkstra）
     * @returns {Object} { distance, path, trajectories }
     */
    findStepLimitedPath(startInput, endInput, stepLimit = null) {
        const start = this.#parsePoint(startInput);
        const end = this.#parsePoint(endInput);

        // 无限制 → 退化到标准 Dijkstra
        if (stepLimit === null || stepLimit === undefined) {
            const result = this.findShortestPath(start, end).withSpaceStation;
            return { ...result, reached: true };
        }

        const pathPoints = [start];
        const trajectories = [];
        let totalDist = 0;
        const visited = new Set();
        const key = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;
        visited.add(key(start));
        const MAX_ITERATIONS = 500;
        let iter = 0;
        let current = start;

        // 步骤1: 如果起点不在零距离网络上，先跳到最近的网络节点（0距离）
        const nearestToStart = this.#findNearestNetworkNode(current);
        if (nearestToStart && !(nearestToStart.x === current.x && nearestToStart.y === current.y)) {
            const d = Math.hypot(nearestToStart.x - current.x, nearestToStart.y - current.y);
            trajectories.push({ from: current, to: nearestToStart, distance: 0 });
            totalDist += 0;
            pathPoints.push(nearestToStart);
            visited.add(key(nearestToStart));
            current = nearestToStart;
        }

        // 步骤2: 通过零距离网络移动到尽可能接近终点的位置
        let currentToEnd = Math.hypot(end.x - current.x, end.y - current.y) * this.unitDistance;
        let changed = true;
        const maxNetworkHops = 50; // 限制网络跳转次数
        let networkHops = 0;

        // 反复在零距离网络上移动，直到无法再接近终点
        while (changed && networkHops < maxNetworkHops) {
            changed = false;
            networkHops++;

            // 收集当前可跳转的零距离节点（同一网络上任意距离）
            const zeroDistCandidates = [];

            // 初始星系网络（所有初始网格点互连）
            for (const pt of this.initialPoints) {
                const k = key(pt);
                if (!visited.has(k)) {
                    zeroDistCandidates.push({ point: pt, onNetwork: 'starter', distFromCurrent: 0 });
                }
            }

            // 空间站网络（同上，传送门节点互连）
            for (const station of this.portedSpaceStations) {
                const k = key(station);
                if (!visited.has(k)) {
                    zeroDistCandidates.push({ point: station, onNetwork: 'station', distFromCurrent: 0 });
                }
            }

            // 找能最接近终点的零距离节点
            let best = null;
            for (const cand of zeroDistCandidates) {
                const distToEnd = Math.hypot(end.x - cand.point.x, end.y - cand.point.y) * this.unitDistance;
                if (!best || distToEnd < best.distToEnd) {
                    best = { ...cand, distToEnd };
                }
            }

            // 如果找到更接近终点的零距离节点，跳过去
            if (best && best.distToEnd < currentToEnd) {
                trajectories.push({ from: current, to: best.point, distance: 0, network: best.onNetwork });
                pathPoints.push(best.point);
                visited.add(key(best.point));
                current = best.point;
                currentToEnd = best.distToEnd;
                changed = true;
            }
        }

        // 步骤3: 如果现在终点在步进范围内，直接跳过去
        if (Math.hypot(end.x - current.x, end.y - current.y) * this.unitDistance <= stepLimit) {
            const d = Math.hypot(end.x - current.x, end.y - current.y) * this.unitDistance;
            trajectories.push({ from: current, to: end, distance: d });
            totalDist += d;
            pathPoints.push(end);
            return { distance: totalDist, path: pathPoints, trajectories, reached: true };
        }

        // 步骤4: 使用贪心算法继续跳跃，每次选择能最接近终点的点
        while ((Math.abs(current.x - end.x) > 0.001 || Math.abs(current.y - end.y) > 0.001) && iter < MAX_ITERATIONS) {
            iter++;

            const reachable = [];

            // 收集半径内可达的网格点
            const maxDist = stepLimit / this.unitDistance;
            const ptsInRadius = this.#findPointsInRadius(current, maxDist);
            for (const { point, distance } of ptsInRadius) {
                const k = key(point);
                if (!visited.has(k)) {
                    reachable.push({ point, distFromCurrent: distance * this.unitDistance, onNetwork: 'starter' });
                }
            }

            // 收集可达的空间站
            for (const station of this.portedSpaceStations) {
                const k = key(station);
                if (visited.has(k)) continue;
                const d = Math.hypot(current.x - station.x, current.y - station.y);
                if (d <= maxDist) {
                    reachable.push({ point: station, distFromCurrent: d * this.unitDistance, onNetwork: 'station' });
                }
            }

            // 如果终点在范围内，直接到达
            const distToEnd = Math.hypot(end.x - current.x, end.y - current.y) * this.unitDistance;
            if (distToEnd <= stepLimit) {
                trajectories.push({ from: current, to: end, distance: distToEnd });
                totalDist += distToEnd;
                pathPoints.push(end);
                return { distance: totalDist, path: pathPoints, trajectories, reached: true };
            }

            // 如果没有可达点，直接用直线（因为所有坐标都是可达的）
            if (reachable.length === 0) {
                trajectories.push({ from: current, to: end, distance: distToEnd });
                totalDist += distToEnd;
                pathPoints.push(end);
                return { distance: totalDist, path: pathPoints, trajectories, reached: true };
            }

            // 选择最优下一跳：离终点最近的点
            let best = null;
            for (const cand of reachable) {
                const remainingDist = Math.hypot(end.x - cand.point.x, end.y - cand.point.y) * this.unitDistance;
                if (!best || remainingDist < best.remainingDist) {
                    best = { ...cand, remainingDist };
                }
            }

            if (!best) break;

            trajectories.push({ from: current, to: best.point, distance: best.distFromCurrent });
            totalDist += best.distFromCurrent;
            pathPoints.push(best.point);
            visited.add(key(best.point));
            current = best.point;
        }

        return { distance: totalDist, path: pathPoints, trajectories, reached: true };
    }

    /**
     * 找到距离指定坐标最近的零距离网络节点（初始星系或空间站）
     * @param {Object} pos - 坐标 {x, y}
     * @returns {Object|null} 最近的网络节点
     */
    #findNearestNetworkNode(pos) {
        let nearest = null;
        let minDist = Infinity;

        // 检查初始星系
        for (const pt of this.initialPoints) {
            const d = Math.hypot(pt.x - pos.x, pt.y - pos.y);
            if (d < minDist) {
                minDist = d;
                nearest = pt;
            }
        }

        // 检查空间站
        for (const station of this.portedSpaceStations) {
            const d = Math.hypot(station.x - pos.x, station.y - pos.y);
            if (d < minDist) {
                minDist = d;
                nearest = station;
            }
        }

        return nearest;
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
