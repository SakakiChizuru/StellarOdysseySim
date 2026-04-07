/**
 * locales/en.js - English Language Pack
 */
const en = {
    // ── General ──────────────────────────────────────────
    'app.title': 'Stellar Odyssey Build Simulator',
    'app.heading': 'Stellar Odyssey Sim & Optimizer',

    // ── Tab Labels ──────────────────────────────────────
    'tab.battling': 'Battling',
    'tab.gathering': 'Gathering',
    'tab.universemap': 'Universe Map / Path Finder',
    'tab.calcutils': 'Calc Tools',
    'tab.probabilities': 'Probability',

    // ── Player Block ──────────────────────────────────────
    'block.player': 'Player',
    'label.available': 'Available Points:',
    'label.power': 'Power:',
    'label.precision': 'Precision:',
    'label.evasion': 'Evasion:',
    'label.hull': 'Hull:',
    'label.weapon_dmg': 'Weapon Damage:',
    'label.shield_def': 'Shield Defense:',
    'label.weapon_ele1': 'Weapon Mod 1:',
    'label.weapon_ele2': 'Weapon Mod 2:',
    'label.shield_ele1': 'Shield Mod 1:',
    'label.shield_ele2': 'Shield Mod 2:',
    'label.n_clones': 'Clone Count:',
    'label.vip_status': 'VIP Status',
    'label.modifyAllClones': 'Modify All Clones',

    // ── Weapon/Shield Element Options ─────────────────────────────
    'ele.none': 'None',
    'ele.Chemical': 'Chemical',
    'ele.Electromagnetic': 'Electromagnetic',
    'ele.Energy': 'Energy',
    'ele.Explosive': 'Explosive',
    'ele.Incendiary': 'Incendiary',
    'ele.Kinetic': 'Kinetic',

    // ── Tech Boosts Block ──────────────────────────────────
    'block.tech': 'Tech Boosts',
    'label.battling_weapon_boost': 'Weapon Boost (Power):',
    'label.battling_hull_boost': 'Hull Boost:',
    'label.battling_precision_boost': 'Precision Boost:',
    'label.battling_evasion_boost': 'Evasion Boost:',

    // ── Enemy Block ──────────────────────────────────────
    'block.enemy': 'Enemy',
    'label.mob_name': 'Enemy Name:',
    'label.mob_level': 'Level:',

    // ── Enemy Name Options ──────────────────────────────────
    'mob.Brutes': 'Brutes',
    'mob.Dusters': 'Dusters',
    'mob.Machiners': 'Machiners',
    'mob.Toxoids': 'Toxoids',
    'mob.Scorchers': 'Scorchers',
    'mob.Glacials': 'Glacials',
    'mob.Spectres': 'Spectres',
    'mob.Miners': 'Miners',

    // ── Fleet BUFF Block ──────────────────────────────────
    'block.fleetbuff': 'Fleet BUFF',
    'label.battle_boost': 'Battle Boost Level:',
    'label.battle_boost_with_pct': 'Battle Boost Level ({pct}%):',
    'label.income_boost': 'Income Boost Level:',
    'label.income_boost_with_pct': 'Income Boost Level ({pct}%):',
    'label.reputation': 'Reputation:',

    // ── Clone Block (JS Dynamic Generation) ───────────────────────
    'clone.label': 'Clone {n}',
    'clone.crit': 'Crit Chance',
    'clone.critdmg': 'Crit Damage',
    'clone.dual': 'Dual Shot',

    // ── Import Data Block ──────────────────────────────────
    'block.import': 'Import Data',
    'label.api_key': 'API Key (Generate in game Settings, then paste):',
    'btn.import': 'Import',
    'btn.importing': 'Importing...',
    'tooltip.import': 'Import your player, mob and clone stats using your API key. This will automatically fill in all your current stats. Your API key is located in Settings',

    // ── Battle Simulator Block ────────────────────────────────
    'block.simulator': 'Battle Simulator',
    'label.n_fights': 'Simulation Count:',
    'btn.simulate': 'Start Simulation',
    'tooltip.simulator': 'Run a battle simulation with the current configuration. The simulation will execute the specified number of battles (up to 1,000,000) to calculate win probability and resource gains.',

    // ── Battle Results ──────────────────────────────────────
    'result.winrate': 'Win Rate:',
    'result.credits_hour': 'Credits/Hour:',
    'result.credits_day': 'Credits/Day:',
    'result.exp_hour': 'EXP/Hour:',
    'result.exp_day': 'EXP/Day:',
    'result.per_hour': '/Hour',
    'result.per_day': '/Day',

    // ── Optimizer Block ────────────────────────────────────
    'block.optimizer': 'Optimize Simulation',
    'label.targeted_opt': 'Optimize for:',
    'label.opt_credits': 'Credits',
    'label.opt_exp': 'EXP',
    'label.fill_after': 'Fill stats after optimization',
    'label.htk': 'Hits to Kill (HTK):',
    'label.htd': 'Hits to Die (HTD):',
    'label.optimizer_n_fights': 'Simulation Count:',
    'btn.opt_simple': 'Simple Optimize',
    'btn.opt_complex': 'Complex Optimize',
    'btn.opt_fill': 'Fill to Player Stats',
    'btn.opt_incremental': 'Incremental (Point) Suggestion',
    'label.top5mode': 'Top5 Mode ⓘ',
    'label.top5mode_title': 'Calculates up to 10 optimal builds, with a maximum of 50 attempts.',
    'tooltip.optimizer': 'Find the optimal stat distribution for your current configuration. The optimizer will test various stat combinations using the specified number of simulations (up to 1,000,000). Higher values provide more accurate results but significantly increase computation time and may temporarily freeze the interface. Consider starting with a lower number and increasing it if needed.',
    'tooltip.htk': 'Hits to kill: The number of hits needed to defeat the mob',
    'tooltip.htd': 'Hits to die: The number of hits the mob needs to defeat your clones',

    // ── Optimizer Results Block ────────────────────────────────
    'opt.power': 'Power',
    'opt.precision': 'Precision',
    'opt.evasion': 'Evasion',
    'opt.hull': 'Hull',
    'opt.winrate': 'Win Rate:',
    'opt.credits_hour': 'Credits/Hour:',
    'opt.credits_day': 'Credits/Day:',
    'opt.exp_hour': 'EXP/Hour:',
    'opt.exp_day': 'EXP/Day:',

    // ── TOP5 Table Headers ─────────────────────────────────────
    'top5.rank': '#',
    'top5.power': 'Power',
    'top5.precision': 'Precision',
    'top5.evasion': 'Evasion',
    'top5.hull': 'Hull',
    'top5.d_power': '▲Power',
    'top5.d_precision': '▲Precision',
    'top5.d_evasion': '▲Evasion',
    'top5.d_hull': '▲Hull',
    'top5.winrate': 'Win Rate',
    'top5.apply': 'Apply',

    // ── Resource Calculator (Gathering Tab) ─────────────────────────
    'block.resources': 'Resource Calculator',
    'label.resources_per_action': 'Resources/Action:',
    'label.rare_resources_per_action': 'Rare Resources/Action:',
    'label.number_of_drones': 'Drone Count:',
    'label.dodge_percentage': 'Extra Evasion (Equipment):',
    'label.rare_drop_increase': 'Extra Rare Drop (Equipment):',
    'label.maneuverability': 'Avg Maneuverability (Drone Upgrade):',
    'btn.calculate': 'Calculate',
    'result.resources_hour': 'Resources/Hour:',
    'result.rare_resources_hour': 'Rare Resources/Hour:',
    'result.hours_to_32m': 'Time to collect 32M resources:',
    'result.days_to_800k': 'Time to collect 800k rare resources:',
    'tooltip.resources': 'Calculate resource collection rate based on current settings.\n•"Resources" and "Rare Resources" refer to the items you collect per action on your current planet.\n•"Extra Evasion" and "Extra Rare Drop" depend only on laser and probe modifications.\n•"Average Maneuverability" is the average maneuverability of all drones.',
    'resources.more_precise': 'For more precise resource calculations',
    'resources.visit': 'visit:',

    // ── Universe Map Block ──────────────────────────────────────
    'block.discovered': 'Discovered Systems',
    'label.systems_api_key': 'API Key:',
    'map.no_systems': 'No publicly discovered systems yet',
    'map.systems_count': '{n} public systems found',
    'map.distance': 'You have traveled {d} light years',
    'map.distance_zero': 'You have traveled 0 light years',
    'map.show_public': 'Show Public Systems',
    'map.show_position': 'Show Current Position',
    'map.show_journey': 'Show Player Journey',
    'map.show_stations': 'Show Squadron Space Stations',
    'map.show_boost': 'Show Explore-Boosted Systems in Range',
    'btn.load_map': 'Load Map',
    'btn.loading_map': 'Loading...',

    // ── Path Calculation ──────────────────────────────────────
    'block.pathfinder': 'Path Finder',
    'label.start_at_self': 'Start from current position',
    'label.starter_point': 'Start Point',
    'label.destination': 'Destination',
    'btn.find_path': 'Find Path',
    'btn.clear_path': 'Clear Results',
    'path.list_header': 'Path List',
    'path.segment': 'Segment {n}',
    'path.from': 'From:',
    'path.to': 'To:',
    'path.initial': '(Starter)',
    'path.station': '(Space Station)',
    'path.total': 'Total: {d} light years',
    'path.step_tooltip': 'Step {n}, Distance {d} ly',
    'path.ly': 'ly',

    // Canvas tooltip (space station)
    'ss.system': 'System: {name} ({x}, {y})',
    'ss.range_level': 'Range Boost Level: {n}',
    'ss.explore_level': 'Explore Boost Level: {n}',
    'ss.astro_level': 'Astronomy Boost Level: {n}',
    'ss.portal_level': 'Portal Boost Level: {n}',
    'ss.has_portal': 'Has Portal: {v}',
    'ss.yes': 'Yes',
    'ss.no': 'No',

    // ── Calc Tools Tab ──────────────────────────────────
    'block.craftron': 'Craftron 3000 Calculator',
    'label.current_data': 'Current Data & Boosts:',
    'btn.import_data': 'Import Data',
    'block.levelup': 'Level-up Calculator:',
    'label.from_level': 'Current Level:',
    'label.target_level': 'Target Level:',
    'btn.calc_levelup': 'Calculate',
    'btn.reset_levelup': 'Reset',
    'block.scrap': 'Quantity Upgrade Calculator:',
    'label.metal_scrap': 'Metal Scrap Amount:',
    'btn.calc_scrap': 'Calculate',
    'btn.reset_scrap': 'Reset',

    // Craftron boost labels
    'boost.CraftLevel': 'Craft Level:',
    'boost.PetLevel': 'Pet:',
    'boost.GlobalBoosts': 'Global Boosts:',
    'boost.PvPTileBonus': 'PVP:',
    'boost.TechnologyLevel': 'Technology:',
    'boost.Premium': 'Premium:',
    'boost.Craftron3000': 'Module Boost:',
    'boost.BodyType': 'Base Type:',
    'boost.total': 'Total EXP Boost:',

    // Craftron result templates
    'craftron.levelup_total': 'Upgrading from level {from} to {to} requires at least: <b>{total}</b> Metal Scraps',
    'craftron.levelup_detail_title': 'Per-level breakdown:',
    'craftron.levelup_item': 'Level {from} → {to} requires <b>{amount}</b> scraps (Total boost: {pct}%)',
    'craftron.scrap_result': 'Using {amount} scraps, you can upgrade from level {from} to <b>{to}</b>{overflow}',
    'craftron.overflow': ', with <b>{exp}</b> overflow EXP (may be off by a few scraps).',
    'craftron.scrap_detail_title': 'Per-level breakdown:',
    'craftron.scrap_item': 'Level {from} → {to} requires <b>{amount}</b> scraps (Total boost: {pct}%)',

    // ── Probability Tab ──────────────────────────────────────
    'block.probability': 'Galaxy Probability Calculator',
    'label.inhabited': 'System State:',
    'opt.inhabited.any': 'Any',
    'opt.inhabited.yes': 'Inhabited',
    'opt.inhabited.no': 'Uninhabited',
    'label.n_nodes': 'Node Count:',
    'label.n_gatherable': 'Gatherable Node Count:',
    'label.n_categories': 'Category Count:',
    'prob.exactly': 'Exactly',
    'prob.at_least': 'At Least',
    'prob.any': 'Any',
    'prob.quality_label': 'Gatherable Node Quality:',

    // ── Status/Button Text ─────────────────────────────────
    'status.calculating': 'Calculating...',
    'status.calculating_top5': 'Calculating [{n}/10]...',

    // ── Alert Messages ────────────────────────────────────
    'alert.input_api_key': 'Please enter your API key',
    'alert.input_api_key_short': 'Please enter API Key',
    'alert.load_map_first': 'Please load the map first!',
    'alert.input_coord': 'Please enter valid coordinates!',
    'alert.opt_error': 'Optimization failed: {msg}',
    'alert.import_player_first': 'Please import player data first',
    'alert.invalid_level_range': 'Please enter a valid level range (target must be greater than current)',
    'alert.invalid_scrap': 'Please enter a valid metal scrap amount',
    'alert.import_error': 'Error importing data: {msg}',
    'alert.copy_success': 'Coordinate [{x},{y}] copy {result}!',
    'alert.copy_ok': 'succeeded',
    'alert.copy_fail': 'failed',

    // ── Footer ──────────────────────────────────────────
    'footer.text': 'Stellar Odyssey Simulator © 2025 | Unofficial tool, for entertainment only',
};

export default en;
