import { Battle } from './battle.js';
import { Mob } from './mob.js';
import { Player } from './player.js';
import { CloneModifiers } from './dataclasses.js';
import { millify } from './utils.js';

class Optimizer {
    constructor(player, mob, list_modifiers = null, n_fights = 5000, reputation = 0) {
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
        const ideal = ratio.map(r => Math.round(n_points * r / ratio_sum));
        const tolerance = 3;
        const results = [];
        function helper(remaining, parts) {
            if (parts.length === k - 1) {
                const last = remaining;
                const lcl = parts.concat([last]);
                if (lcl.every((val, i) => Math.abs(val - ideal[i]) <= tolerance)) {
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
                available: this.player.availablePoints
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

    findBestBuild(htd, htk, target = 'credits', verbose = false) {
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
                available: this.player.availablePoints
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

    iterateThroughBuilds(target = 'credits', verbose = false) {
        const range_htk = Array.from({length: 7}, (_, i) => i + 4); // range(4,11)
        const range_htd = Array.from({length: 4}, (_, i) => i + 3); // range(3,7)

        let best_build = [0, 0, 0, 0];
        let best_res = 0;
        let best_htk = 0;
        let best_htd = 0;
        let best_win_chance = 0;

        for (const htk of range_htk) {
            for (const htd of range_htd) {
                const [build, res, win_chance] = this.findBestBuild(htd, htk, target);
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
                    console.log('--------------------------------');
                }
            }
        }

        if (verbose) {
            console.log('\nOverall best build:');
            console.log(`htk: ${best_htk}, htd: ${best_htd}`);
            console.log(`${best_build}: ${millify(best_res)}`);
        }

        return [best_build, best_res, best_win_chance, best_htk, best_htd];
    }
}

export { Optimizer };
