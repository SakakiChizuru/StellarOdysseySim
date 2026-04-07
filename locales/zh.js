/**
 * locales/zh.js - 中文语言包
 */
const zh = {
    // ── 通用 ──────────────────────────────────────────
    'app.title': '恒星奥德赛加点配置模拟器',
    'app.heading': '恒星奥德赛模拟优化器',

    // ── Tab 标签 ──────────────────────────────────────
    'tab.battling': '战斗',
    'tab.gathering': '采集',
    'tab.universemap': '星图/寻路',
    'tab.calcutils': '计算工具',
    'tab.probabilities': '概率',

    // ── 玩家区块 ──────────────────────────────────────
    'block.player': '玩家',
    'label.available': '剩余点数：',
    'label.power': '威力：',
    'label.precision': '命中：',
    'label.evasion': '闪避：',
    'label.hull': '舰体：',
    'label.weapon_dmg': '武器伤害：',
    'label.shield_def': '护盾防御：',
    'label.weapon_ele1': '武器改造1：',
    'label.weapon_ele2': '武器改造2：',
    'label.shield_ele1': '护盾改造1：',
    'label.shield_ele2': '护盾改造2：',
    'label.n_clones': '克隆数量：',
    'label.vip_status': 'VIP 属性',
    'label.modifyAllClones': '同时修改所有克隆',

    // ── 武器/护盾元素选项 ─────────────────────────────
    'ele.none': '无',
    'ele.Chemical': '化学',
    'ele.Electromagnetic': '电磁',
    'ele.Energy': '能量',
    'ele.Explosive': '爆炸',
    'ele.Incendiary': '燃烧',
    'ele.Kinetic': '动能',

    // ── 科技加成区块 ──────────────────────────────────
    'block.tech': '科技加成',
    'label.battling_weapon_boost': '武器增幅（威力）:',
    'label.battling_hull_boost': '舰体增幅:',
    'label.battling_precision_boost': '命中增幅:',
    'label.battling_evasion_boost': '闪避增幅:',

    // ── 敌人区块 ──────────────────────────────────────
    'block.enemy': '敌人',
    'label.mob_name': '敌人名称：',
    'label.mob_level': '等级：',

    // ── 敌人名称选项 ──────────────────────────────────
    'mob.Brutes': '蛮兵',
    'mob.Dusters': '尘暴兵',
    'mob.Machiners': '机械师',
    'mob.Toxoids': '毒蚀体',
    'mob.Scorchers': '灼烧者',
    'mob.Glacials': '冰川族',
    'mob.Spectres': '幽灵',
    'mob.Miners': '矿工',

    // ── 舰队BUFF区块 ──────────────────────────────────
    'block.fleetbuff': '舰队BUFF',
    'label.battle_boost': '战斗加成等级:',
    'label.battle_boost_with_pct': '战斗加成等级({pct}%):',
    'label.income_boost': '收入加成等级：',
    'label.income_boost_with_pct': '收入加成等级({pct}%):',
    'label.reputation': '声望：',

    // ── 克隆体区块（JS动态生成） ───────────────────────
    'clone.label': '克隆体 {n}',
    'clone.crit': '暴击率',
    'clone.critdmg': '暴击伤害',
    'clone.dual': '双重射击',

    // ── 导入数据区块 ──────────────────────────────────
    'block.import': '导入数据',
    'label.api_key': 'API Key（游戏设置API Key里Generate后粘贴）：',
    'btn.import': '导入',
    'btn.importing': '导入中...',
    'tooltip.import': 'Import your player, mob and clone stats using your API key. This will automatically fill in all your current stats. Your API key is located in Settings',

    // ── 战斗模拟器区块 ────────────────────────────────
    'block.simulator': '战斗模拟器',
    'label.n_fights': '模拟战斗次数：',
    'btn.simulate': '开始模拟',
    'tooltip.simulator': 'Run a battle simulation with the current configuration. The simulation will execute the specified number of battles (up to 1,000,000) to calculate win probability and resource gains.',

    // ── 战斗结果 ──────────────────────────────────────
    'result.winrate': '胜率：',
    'result.credits_hour': '货币／小时：',
    'result.credits_day': '货币／天：',
    'result.exp_hour': '经验／小时：',
    'result.exp_day': '经验／天：',
    'result.per_hour': '／小时',
    'result.per_day': '／天',

    // ── 优化器区块 ────────────────────────────────────
    'block.optimizer': '优化模拟',
    'label.targeted_opt': '针对性优化:',
    'label.opt_credits': '货币',
    'label.opt_exp': '经验',
    'label.fill_after': '优化后填充属性',
    'label.htk': '击杀所需命中数（HTK）:',
    'label.htd': '死亡所需被击数（HTD）:',
    'label.optimizer_n_fights': '模拟战斗次数：',
    'btn.opt_simple': '简单计算优化',
    'btn.opt_complex': '复杂计算优化',
    'btn.opt_fill': '填充到玩家数据',
    'btn.opt_incremental': '增量（加点）建议',
    'label.top5mode': '最优5模式 ⓘ',
    'label.top5mode_title': '在尽可能保证满足10条最优解的情况下进行计算，但是总共计算不会超过50次。',
    'tooltip.optimizer': 'Find the optimal stat distribution for your current configuration. The optimizer will test various stat combinations using the specified number of simulations (up to 1,000,000). Higher values provide more accurate results but significantly increase computation time and may temporarily freeze the interface. Consider starting with a lower number and increasing it if needed.',
    'tooltip.htk': 'Hits to kill: The number of hits needed to defeat the mob',
    'tooltip.htd': 'Hits to die: The number of hits the mob needs to defeat your clones',

    // ── 优化器结果区块 ────────────────────────────────
    'opt.power': '力量',
    'opt.precision': '精准',
    'opt.evasion': '闪避',
    'opt.hull': '船体',
    'opt.winrate': '胜率：',
    'opt.credits_hour': '货币／小时：',
    'opt.credits_day': '货币／天：',
    'opt.exp_hour': '经验／小时：',
    'opt.exp_day': '经验／天：',

    // ── TOP5 表头 ─────────────────────────────────────
    'top5.rank': '#',
    'top5.power': '力量',
    'top5.precision': '精准',
    'top5.evasion': '闪避',
    'top5.hull': '船体',
    'top5.d_power': '▲力量',
    'top5.d_precision': '▲精准',
    'top5.d_evasion': '▲闪避',
    'top5.d_hull': '▲船体',
    'top5.winrate': '胜率',
    'top5.apply': '应用',

    // ── 资源计算器（采集Tab） ─────────────────────────
    'block.resources': '资源计算器',
    'label.resources_per_action': '资源／行动：',
    'label.rare_resources_per_action': '稀有资源／行动：',
    'label.number_of_drones': '无人机数量：',
    'label.dodge_percentage': '额外闪避（装备）：',
    'label.rare_drop_increase': '额外稀有资源掉落（装备）：',
    'label.maneuverability': '平均机动性（无人机升级）：',
    'btn.calculate': '计算',
    'result.resources_hour': '资源／小时：',
    'result.rare_resources_hour': '稀有资源／小时：',
    'result.hours_to_32m': '收集32M资源所需时间：',
    'result.days_to_800k': '收集800k稀有资源所需时间：',
    'tooltip.resources': '根据当前设置计算资源收集率和达到特定目标所需的时间。\n•\u2018资源\u2019和\u2018稀有资源\u2019指的是你当前在当前星球上在每个行动中收集的物品。\n•\u2018额外闪避\u2019和\u2018额外稀有资源掉落\u2019仅取决于激光和探测器的改造\n•\u2018平均机动性\u2019是指所有无人机的平均机动性能。',
    'resources.more_precise': '如需更精确的资源计算',
    'resources.visit': '请访问:',

    // ── 星图区块 ──────────────────────────────────────
    'block.discovered': '已发现星系',
    'label.systems_api_key': 'API Key:',
    'map.no_systems': '目前尚无公开发现的星系',
    'map.systems_count': '目前有 {n} 个公开的星系',
    'map.distance': '你当前已旅行 {d} 光年',
    'map.distance_zero': '你当前已旅行0光年',
    'map.show_public': '显示公开星系',
    'map.show_position': '显示当前位置（定位）',
    'map.show_journey': '显示玩家旅行路径',
    'map.show_stations': '显示玩家舰队空间站',
    'map.show_boost': '显示空间站范围内探索增幅星系',
    'btn.load_map': '载入星图',
    'btn.loading_map': '载入中...',

    // ── 路径计算 ──────────────────────────────────────
    'block.pathfinder': '路径计算',
    'label.start_at_self': '以自身为起点',
    'label.starter_point': '起始点',
    'label.destination': '目标点',
    'btn.find_path': '计算路径',
    'btn.clear_path': '清除结果',
    'path.list_header': '路径列表',
    'path.segment': '第 {n} 段',
    'path.from': '起点:',
    'path.to': '终点:',
    'path.initial': '(初始)',
    'path.station': '(空间站)',
    'path.total': '总路程: {d} 光年',
    'path.step_tooltip': '第 {n} 步, 距离 {d} 光年',
    'path.ly': '光年',

    // Canvas tooltip (space station)
    'ss.system': '星系: {name} ({x}, {y})',
    'ss.range_level': '范围增幅等级: {n}',
    'ss.explore_level': '探索增幅等级: {n}',
    'ss.astro_level': '天文增幅等级: {n}',
    'ss.portal_level': '传送增幅等级: {n}',
    'ss.has_portal': '是否有传送门: {v}',
    'ss.yes': '是',
    'ss.no': '否',

    // ── 计算工具 Tab ──────────────────────────────────
    'block.craftron': '创制者 3000(Craftron 3000) 计算',
    'label.current_data': '当前数据以及加成：',
    'btn.import_data': '导入数据',
    'block.levelup': '升级计算：',
    'label.from_level': '当前等级：',
    'label.target_level': '目标等级：',
    'btn.calc_levelup': '计算',
    'btn.reset_levelup': '重置',
    'block.scrap': '数量计算升级：',
    'label.metal_scrap': '金属碎片数量：',
    'btn.calc_scrap': '计算',
    'btn.reset_scrap': '重置',

    // Craftron boost labels
    'boost.CraftLevel': '制作等级：',
    'boost.PetLevel': '宠物：',
    'boost.GlobalBoosts': '全局加成：',
    'boost.PvPTileBonus': 'PVP：',
    'boost.TechnologyLevel': '科技：',
    'boost.Premium': '会员：',
    'boost.Craftron3000': '模块加成：',
    'boost.BodyType': '基地类型：',
    'boost.total': '总计经验加成：',

    // Craftron result templates
    'craftron.levelup_total': '从等级 {from} 升级到 {to} 需要最少: <b>{total}</b> 个金属碎片',
    'craftron.levelup_detail_title': '以下是每个等级的详细需求:',
    'craftron.levelup_item': '从 {from} 升级到 {to} 需要 <b>{amount}</b> 个金属碎片 (总加成为：{pct}%)',
    'craftron.scrap_result': '使用 {amount} 个金属碎片可以从当前等级 {from} 升级到 <b>{to}</b> 级{overflow}',
    'craftron.overflow': '，并有 <b>{exp}</b> 点溢出经验（可能会有几个金属碎片的经验出入）。',
    'craftron.scrap_detail_title': '以下是每个等级的详细需求:',
    'craftron.scrap_item': '从 {from} 升级到 {to} 需要 <b>{amount}</b> 个金属碎片 (总加成为：{pct}%)',

    // ── 概率 Tab ──────────────────────────────────────
    'block.probability': '星系概率计算器',
    'label.inhabited': '星系状态：',
    'opt.inhabited.any': '任意',
    'opt.inhabited.yes': '星系有人居住',
    'opt.inhabited.no': '星系无人居住',
    'label.n_nodes': '节点数量：',
    'label.n_gatherable': '采集节点数量：',
    'label.n_categories': '不同类别数量：',
    'prob.exactly': '精确',
    'prob.at_least': '至少',
    'prob.any': '任意',
    'prob.quality_label': '采集节点 {n} 质量：',

    // ── 状态/按钮文本 ─────────────────────────────────
    'status.calculating': '正在计算...',
    'status.calculating_top5': '正在计算[{n}/10]...',

    // ── Alert 提示 ────────────────────────────────────
    'alert.input_api_key': '请输入你的 API key',
    'alert.input_api_key_short': '请输入API Key',
    'alert.load_map_first': '请先载入星图!',
    'alert.input_coord': '请正确输入坐标!',
    'alert.opt_error': '优化失败: {msg}',
    'alert.import_player_first': '请先导入玩家数据',
    'alert.invalid_level_range': '请输入有效的等级范围，且目标等级必须大于当前等级',
    'alert.invalid_scrap': '请输入有效的金属碎片数量',
    'alert.import_error': '导入数据时出错: {msg}',
    'alert.copy_success': '目标坐标[{x},{y}]复制{result}!',
    'alert.copy_ok': '成功',
    'alert.copy_fail': '失败',

    // ── 页脚 ──────────────────────────────────────────
    'footer.text': 'Stellar Odyssey 模拟器 © 2025 | 非官方工具，仅供娱乐',
};

export default zh;
