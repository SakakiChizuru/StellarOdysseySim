import { Battle } from "./battle.js";
import { Mob } from "./mob.js";
import { Player } from "./player.js";
import { CloneModifiers } from "./dataclasses.js";
import { millify } from "./utils.js";

class Optimizer {
	constructor(
		player,
		mob,
		list_modifiers = null,
		n_fights = 5000,
		reputation = 0
	) {
		this.player = player;
		this.list_modifiers = list_modifiers;
		this.mob = mob;
		this.n_fights = n_fights;
		this.reputation = reputation;
	}

	distribute_points(n_points) {
		// Distribute n points in k categories, only keeping those close to a 1:4:4:3 ratio within a given tolerance.
		const k = 4;
		const ratio = [1, 4, 4, 3];
		const ratio_sum = ratio.reduce((a, b) => a + b, 0);
		const ideal = ratio.map((r) => Math.round((n_points * r) / ratio_sum));
		const tolerance = 3;
		const results = [];
		function helper(remaining, parts) {
			if (parts.length === k - 1) {
				const last = remaining;
				const lcl = parts.concat([last]);
				if (
					lcl.every((val, i) => Math.abs(val - ideal[i]) <= tolerance)
				) {
					results.push(lcl);
				}
				return;
			}
			for (let i = 0; i <= remaining; i++) {
				helper(remaining - i, parts.concat([i]));
			}
		}
		helper(n_points, []);
		return results;
	}

	optimize() {
		let hits_to_die;
		let hits_to_kill;

		if (this.player.n_clones < 5) {
			hits_to_die = 5;
			hits_to_kill = 7;
		} else {
			hits_to_die = 4;
			hits_to_kill = 8;
		}

		const total_hp_to_have = (hits_to_die - 1) * this.mob.dmg + 1;
		const remaining_hp = Math.max(
			0.0,
			total_hp_to_have - this.player.shield_def
		);
		const needed_hull = Math.ceil(remaining_hp / 7.0);

		let weapon1 = this.player.weapon_ele1,
			weapon2 = this.player.weapon_ele2;
		if (weapon1 && (!weapon2 || weapon2 === "None") && weapon1 !== "None")
			weapon2 = weapon1;
		if (weapon2 && (!weapon1 || weapon1 === "None") && weapon2 !== "None")
			weapon1 = weapon2;
		let shield1 = this.player.shield_ele1,
			shield2 = this.player.shield_ele2;
		if (shield1 && (!shield2 || shield2 === "None") && shield1 !== "None")
			shield2 = shield1;
		if (shield2 && (!shield1 || shield1 === "None") && shield2 !== "None")
			shield1 = shield2;
		const modifications = [weapon1, weapon2, shield1, shield2];
		const target_weaknesses = this.mob.weaknesses || [];
		let total_damage_modifier = 0.0;
		for (const mod of modifications) {
			if (mod && target_weaknesses.includes(mod)) {
				total_damage_modifier += 0.15;
			}
		}

		const total_attack_to_have = this.mob.hp / hits_to_kill + 1;
		const needed_pow = Math.ceil(
			Math.max(
				0.0,
				(total_attack_to_have -
					this.player.n_clones *
						this.player.weapon_dmg *
						(1 + total_damage_modifier)) /
					(7.0 * this.player.n_clones * (1 + total_damage_modifier))
			)
		);

		// 2025-06-06 Added available points
		const nb_points = Math.floor(
			this.player.pow +
				this.player.pre +
				this.player.eva +
				this.player.hull +
				this.player.availablePoints
		);

		const available_points = nb_points - needed_pow - needed_hull;

		const lcl_result = [];

		for (let p = 0; p <= available_points; p++) {
			const power = needed_pow;
			const precision = p;
			const evasion = available_points - p;
			const hull = needed_hull;
			const tmp_player = new Player({
				power,
				precision,
				evasion,
				hull,
				weapon_dmg: this.player.weapon_dmg,
				shield_def: this.player.shield_def,
				n_clones: this.player.n_clones,
				vip_status: this.player.vip_status,
				weapon_ele1: this.player.weapon_ele1,
				weapon_ele2: this.player.weapon_ele2,
				shield_ele1: this.player.shield_ele1,
				shield_ele2: this.player.shield_ele2,
				// 2025-06-06 Added available points
				available: this.player.availablePoints,
			});
			const battle = new Battle({
				player: tmp_player,
				mob: this.mob,
				list_modifiers: this.list_modifiers,
			});
			const win_chance = battle.repeat_fights(this.n_fights);
			lcl_result.push({
				stats: [power, precision, evasion, hull],
				win_chance,
			});
		}
		const opt_results = lcl_result.sort(
			(a, b) => b.win_chance - a.win_chance
		);

		if (opt_results.length === 0) {
			return null;
		}
		return {
			bestStats: opt_results[0].stats,
			winChance: opt_results[0].win_chance,
		};
	}

	async findBestIncremental(
		target = "credits",
		verbose = false,
		progressCallback = null
	) {
		const base = {
			pow: this.player.pow,
			pre: this.player.pre,
			eva: this.player.eva,
			hull: this.player.hull,
		};
		const availablePoints = this.player.availablePoints;
		const totalPoints =
			base.pow + base.pre + base.eva + base.hull + availablePoints;

		const normalizeBuild = (build) => {
			const keys = ["pow", "pre", "eva", "hull"];
			const corrected = [...build];

			for (let i = 0; i < 4; i++) {
				corrected[i] = Math.max(corrected[i], base[keys[i]]);
			}

			let currentTotal = corrected.reduce((a, b) => a + b, 0);
			let diff = totalPoints - currentTotal;

			while (diff !== 0) {
				const idx = Math.floor(Math.random() * 4);
				if (diff > 0) {
					corrected[idx]++;
					diff--;
				} else if (corrected[idx] > base[keys[idx]]) {
					corrected[idx]--;
					diff++;
				}
			}

			return corrected;
		};

		const evaluate = async (build) => {
			const [power, precision, evasion, hull] = build;
			const tmp_player = new Player({
				power,
				precision,
				evasion,
				hull,
				weapon_dmg: this.player.weapon_dmg,
				shield_def: this.player.shield_def,
				n_clones: this.player.n_clones,
				vip_status: this.player.vip_status,
				weapon_ele1: this.player.weapon_ele1,
				weapon_ele2: this.player.weapon_ele2,
				shield_ele1: this.player.shield_ele1,
				shield_ele2: this.player.shield_ele2,
				available: availablePoints,
			});

			const battle = new Battle({
				player: tmp_player,
				mob: this.mob,
				list_modifiers: this.list_modifiers,
			});

			const win_chance = battle.repeat_fights(this.n_fights);

			const income_boost =
				parseFloat(this.form?.income_boost?.value || 0) / 100;
			const reputation =
				parseFloat(this.form?.reputation?.value || 0) / 100;

			const resource = {
				credits_hourly: battle.get_revenue(
					"hourly",
					win_chance,
					income_boost,
					reputation
				),
				credits_daily: battle.get_revenue(
					"daily",
					win_chance,
					income_boost,
					reputation
				),
				exp_hourly: battle.get_experience(
					"hourly",
					win_chance,
					reputation
				),
				exp_daily: battle.get_experience(
					"daily",
					win_chance,
					reputation
				),
			};

			return {
				resource,
				win_chance,
				build,
				fitness:
					target === "credits"
						? resource.credits_hourly
						: resource.exp_hourly,
			};
		};

		const getInitialSolution = () => {
			const perAttr = Math.floor(availablePoints / 4);
			const remainder = availablePoints % 4;
			return normalizeBuild([
				base.pow + perAttr + (remainder > 0 ? 1 : 0),
				base.pre + perAttr + (remainder > 1 ? 1 : 0),
				base.eva + perAttr + (remainder > 2 ? 1 : 0),
				base.hull + perAttr,
			]);
		};

		const runOptimization = async () => {
			const populationSize = 10;
			const mutationRate = 0.2;
			const crossoverRate = 0.7;
			const generations = 100;
			const maxTabuSize = 200;

			let tabuList = new Set();
			let population = [];

			for (let i = 0; i < populationSize; i++) {
				const build = getInitialSolution();
				for (let j = 0; j < availablePoints; j++) {
					const a = Math.floor(Math.random() * 4);
					const b = Math.floor(Math.random() * 4);
					if (a !== b && build[a] > base[Object.keys(base)[a]]) {
						build[a]--;
						build[b]++;
					}
				}
				population.push({ build: normalizeBuild(build) });
			}

			let best = null;
			const initialResults = await Promise.all(
				population.map((p) => evaluate(p.build))
			);
			population = initialResults;
			for (const p of population)
				if (!best || p.fitness > best.fitness) best = p;

			let temperature = 1.0;
			const coolingRate = 0.98;

			for (let gen = 0; gen < generations; gen++) {
				const newPopulation = [];
				const candidates = [];

				while (candidates.length < populationSize) {
					const parent1 =
						population[Math.floor(Math.random() * populationSize)];
					const parent2 =
						population[Math.floor(Math.random() * populationSize)];

					let child = [...parent1.build];

					if (Math.random() < crossoverRate) {
						const cp = Math.floor(Math.random() * 4);
						child = [
							...parent1.build.slice(0, cp),
							...parent2.build.slice(cp),
						];
					}

					if (Math.random() < mutationRate) {
						const i = Math.floor(Math.random() * 4);
						const j = Math.floor(Math.random() * 4);
						if (i !== j && child[i] > base[Object.keys(base)[i]]) {
							const jumpOptions = [1, 2, 5, 10];
							const delta =
								jumpOptions[
									Math.floor(
										Math.random() * jumpOptions.length
									)
								];
							const actualDelta = Math.min(
								delta,
								child[i] - base[Object.keys(base)[i]]
							);
							child[i] -= actualDelta;
							child[j] += actualDelta;
						}
					}

					child = normalizeBuild(child);

					const key = child.join(",");
					if (tabuList.has(key)) continue;

					candidates.push(child);
					tabuList.add(key);
					if (tabuList.size > maxTabuSize) {
						const first = tabuList.values().next().value;
						tabuList.delete(first);
					}
				}

				const evaluated = await Promise.all(
					candidates.map((c) => evaluate(c))
				);
				for (const res of evaluated) {
					if (
						res.fitness > best.fitness ||
						Math.random() <
							Math.exp((res.fitness - best.fitness) / temperature)
					) {
						best = res;
					}
				}

				population = evaluated;
				temperature *= coolingRate;

				if (verbose) {
					console.log(
						`第 ${gen + 1} 代 Generation ${
							gen + 1
						}: 最佳胜率 Best Win Chance ${(
							best.win_chance * 100
						).toFixed(2)}%`
					);
				}

				if (progressCallback)
					await progressCallback(gen + 1, generations);
			}

			if (verbose) {
				console.log(`优化完成 Optimization Finished.`);
				console.log(`最佳分配 Best Build: [${best.build.join(", ")}]`);
				console.log(
					`胜率 Win Chance: ${(best.win_chance * 100).toFixed(2)}%`
				);
				console.log(`资源 Resource:`, best.resource);
			}

			return best;
		};

		if (availablePoints <= 0) {
			return await evaluate([base.pow, base.pre, base.eva, base.hull]);
		}

		return await runOptimization();
	}

	findBestBuild(htd, htk, target = "credits", verbose = false) {
		const total_hp_to_have = (htd - 1) * this.mob.dmg + 1;
		const remaining_hp = Math.max(
			0.0,
			total_hp_to_have - this.player.shield_def
		);
		const needed_hull = Math.ceil(remaining_hp / 7.0);

		let total_damage_modifier = 0.0;

		let weapon1 = this.player.weapon_ele1,
			weapon2 = this.player.weapon_ele2;
		if (weapon1 && (!weapon2 || weapon2 === "None") && weapon1 !== "None")
			weapon2 = weapon1;
		if (weapon2 && (!weapon1 || weapon1 === "None") && weapon2 !== "None")
			weapon1 = weapon2;
		let shield1 = this.player.shield_ele1,
			shield2 = this.player.shield_ele2;
		if (shield1 && (!shield2 || shield2 === "None") && shield1 !== "None")
			shield2 = shield1;
		if (shield2 && (!shield1 || shield1 === "None") && shield2 !== "None")
			shield1 = shield2;
		const modifications = [weapon1, weapon2, shield1, shield2];
		const target_weaknesses = this.mob.weaknesses || [];
		for (const mod of modifications) {
			if (mod && target_weaknesses.includes(mod)) {
				total_damage_modifier += 0.15;
			}
		}

		const total_attack_to_have = this.mob.hp / htk + 1;
		const player_dmg =
			this.player.n_clones *
			this.player.weapon_dmg *
			(1 + total_damage_modifier);
		const needed_power = Math.ceil(
			Math.max(
				0.0,
				(total_attack_to_have - player_dmg) /
					(7.0 * this.player.n_clones * (1 + total_damage_modifier))
			)
		);

		// 2025-06-06 Added available points
		const nb_points = Math.floor(
			this.player.pow +
				this.player.pre +
				this.player.eva +
				this.player.hull +
				this.player.availablePoints
		);

		const available_points = nb_points - needed_power - needed_hull;

		let best_build = [0, 0, 0, 0];
		let best_res = 0;
		let best_win_chance = 0;

		if (available_points < 0) {
			return [best_build, best_res];
		}

		for (let p = 0; p <= available_points; p++) {
			const power = needed_power;
			const precision = p;
			const evasion = available_points - p;
			const hull = needed_hull;

			const tmp_player = new Player({
				power,
				precision,
				evasion,
				hull,
				weapon_dmg: this.player.weapon_dmg,
				shield_def: this.player.shield_def,
				n_clones: this.player.n_clones,
				vip_status: this.player.vip_status,
				weapon_ele1: this.player.weapon_ele1,
				weapon_ele2: this.player.weapon_ele2,
				shield_ele1: this.player.shield_ele1,
				shield_ele2: this.player.shield_ele2,
				// 2025-06-06 Added available points
				available: this.player.availablePoints,
			});

			const battle = new Battle({
				player: tmp_player,
				mob: this.mob,
				list_modifiers: this.list_modifiers,
			});
			const win_chance = battle.repeat_fights(this.n_fights);

			let res;
			if (target === "credits") {
				res = battle.get_revenue("hourly", win_chance);
			} else if (target === "exp") {
				res = battle.get_experience(
					"hourly",
					win_chance,
					this.player.reputation || 0
				);
			} else {
				throw new Error(`Invalid target ${target}`);
			}

			if (verbose) {
				console.log(
					`[${power},${precision},${evasion},${hull}]: ${millify(
						res
					)} with ${(100 * win_chance).toFixed(3)}% win chance`
				);
			}

			if (res > best_res) {
				best_res = res;
				best_build = [power, precision, evasion, hull];
				best_win_chance = win_chance;
			}
		}

		if (verbose) {
			console.log(`${best_build}: ${millify(best_res)}`);
		}
		return [best_build, best_res, best_win_chance];
	}

	iterateThroughBuilds(target = "credits", verbose = false) {
		const range_htk = Array.from({ length: 7 }, (_, i) => i + 4); // range(4,11)
		const range_htd = Array.from({ length: 4 }, (_, i) => i + 3); // range(3,7)

		let best_build = [0, 0, 0, 0];
		let best_res = 0;
		let best_htk = 0;
		let best_htd = 0;
		let best_win_chance = 0;

		for (const htk of range_htk) {
			for (const htd of range_htd) {
				const [build, res, win_chance] = this.findBestBuild(
					htd,
					htk,
					target
				);
				if (res > best_res) {
					best_res = res;
					best_build = build;
					best_htk = htk;
					best_htd = htd;
					best_win_chance = win_chance;
				}

				if (verbose) {
					console.log(`htk: ${htk}, htd: ${htd}`);
					console.log(`${build}: ${millify(res)}`);
					console.log("--------------------------------");
				}
			}
		}

		if (verbose) {
			console.log("\nOverall best build:");
			console.log(`htk: ${best_htk}, htd: ${best_htd}`);
			console.log(`${best_build}: ${millify(best_res)}`);
		}

		return [best_build, best_res, best_win_chance, best_htk, best_htd];
	}
}

export { Optimizer };
