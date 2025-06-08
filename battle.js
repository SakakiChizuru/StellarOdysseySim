import { CloneSquad } from './cloneSquad.js';
import { Mob } from './mob.js';
import { Player } from './player.js';
import { Clone } from './clone.js';
import { CloneModifiers } from './dataclasses.js';
import { millify } from './utils.js';

class Battle {
    constructor({ player, mob, list_modifiers = null, verbose = false }) {
        this.player = player;
        this.clone_squad = new CloneSquad(this.player, list_modifiers);
        this.mob = mob;
        this.verbose = verbose;

        this.battle_is_over = false;
        this.current_round = 0;
        this.round_limit = 500;
        this.elemental_bonus_damage = 0.15;

        // Calculate total damage modifier once
        let weapon1 = player.weapon_ele1, weapon2 = player.weapon_ele2;
        if ((weapon1 && (!weapon2 || weapon2 === 'None')) && weapon1 !== 'None') weapon2 = weapon1;
        if ((weapon2 && (!weapon1 || weapon1 === 'None')) && weapon2 !== 'None') weapon1 = weapon2;
        let shield1 = player.shield_ele1, shield2 = player.shield_ele2;
        if ((shield1 && (!shield2 || shield2 === 'None')) && shield1 !== 'None') shield2 = shield1;
        if ((shield2 && (!shield1 || shield1 === 'None')) && shield2 !== 'None') shield1 = shield2;
        const modifications = [weapon1, weapon2, shield1, shield2];
        const target_weaknesses = mob.weaknesses || [];
        this.total_damage_modifier = 0.0;
        for (const mod of modifications) {
            if (mod && target_weaknesses.includes(mod)) {
                this.total_damage_modifier += this.elemental_bonus_damage;
            }
        }

        // Cache frequently used values
        this.mob_hp = mob.hp;
        this.mob_pre = mob.pre;
        this.mob_eva = mob.eva;
        this.credits_base = 300.0 * (1.0 + 0.1 * mob.lvl) * (player.vip_status ? 1.1 : 1.0);
        this.exp_base = Math.floor((20.0 + Math.floor(0.1 * mob.lvl)) * (player.vip_status ? 1.1 : 1.0));

    }

    fight() {
        while (!this.battle_is_over) {
            this.do_one_round();
            if (this.current_round > this.round_limit) {
                break;
            }
        }
        if (this.current_round > this.round_limit) {
            return `Fight did not end after ${this.round_limit} rounds, so mob wins!`;
        }
        if (this.mob.current_hp === 0.0) {
            return `Clones won after ${this.current_round} rounds.`;
        } else {
            return `Mob won after ${this.current_round} rounds.`;
        }
    }

    do_one_attack(attacker, target) {
        const attacker_hit_chance = attacker.pre / (attacker.pre + target.eva);
        let curr_dmg = attacker.dmg;
        const rng_attack = Math.random();
        if (rng_attack < attacker_hit_chance) {
            if (attacker instanceof Clone) {
                const rng_crit = Math.random();
                if (rng_crit < attacker.crit_chance) {
                    curr_dmg *= (1 + attacker.crit_dmg);
                }
                curr_dmg *= (1 + this.total_damage_modifier);
            }
            attacker.hit_counter += 1;
            target.current_hp = Math.max(0.0, target.current_hp - curr_dmg);
            if (this.verbose) {
                console.log(`${attacker.name.value} attacks ${target.name.value} for ${curr_dmg.toFixed(2)} damage. ${target.name.value} is left with ${target.current_hp.toFixed(2)} HP.`);
            }
        } else if (this.verbose) {
            console.log(`${attacker.name.value} missed while attacking ${target.name.value}.`);
        }

        if (attacker instanceof Clone && attacker.dual_shot_chance > 0.0 && Math.random() < attacker.dual_shot_chance) {
            const rng_attack = Math.random();
            if (rng_attack < attacker_hit_chance) {
                curr_dmg = attacker.dmg;
                if (Math.random() < attacker.crit_chance) {
                    curr_dmg *= (1 + attacker.crit_dmg);
                }
                curr_dmg *= (1 + this.total_damage_modifier);
                attacker.hit_counter += 1;
                target.current_hp = Math.max(0.0, target.current_hp - curr_dmg);
                if (this.verbose) {
                    console.log(`${attacker.name.value} DUAL attacks ${target.name.value} for ${curr_dmg.toFixed(2)} damage. ${target.name.value} is left with ${target.current_hp.toFixed(2)} HP.`);
                }
            } else if (this.verbose) {
                console.log(`${attacker.name.value} missed DUAL attack to ${target.name.value}.`);
            }
        }
    }

    do_one_round() {
        if (this.verbose) {
            console.log(`\nRound ${this.current_round}`);
        }
        
        // mob attacks first
        for (const clone of this.clone_squad.squad) {
            if (clone.current_hp === 0.0) continue;
            this.do_one_attack(this.mob, clone);
        }
        
        // then clones attack
        for (const clone of this.clone_squad.squad) {
            if (clone.current_hp === 0.0) {
                if (this.verbose) {
                    console.log(`${clone.name.value} is exhausted.`);
                }
                continue;
            }
            if (this.mob.current_hp === 0.0) break;
            this.do_one_attack(clone, this.mob);
        }
        
        this.battle_is_over = this.mob.current_hp === 0.0 || this.clone_squad.squad.every(clone => clone.current_hp === 0.0);
        this.current_round += 1;
    }

    reset() {
        this.mob.current_hp = this.mob_hp;
        this.mob.hit_counter = 0;
        for (const clone of this.clone_squad.squad) {
            clone.current_hp = clone.hp;
            clone.hit_counter = 0;
        }
        this.battle_is_over = false;
        this.current_round = 0;
    }

    repeat_fights(fights) {
        let wins = 0;
        for (let i = 0; i < fights; i++) {
            const fight = this.fight();
            if (fight.startsWith('Clones')) {
                wins += 1;
            }
            this.reset();
        }
        return wins / fights;
    }

    get_revenue_print(win_chance = 1.0) {
        const revenue_per_hour = this.get_revenue('hourly', win_chance);
        const revenue_per_day = 24.0 * revenue_per_hour;
        return `Credits per hour: ${millify(revenue_per_hour)}/h\nCredits per day: ${millify(revenue_per_day)}/day`;
    }

    get_revenue(revenue_type, win_chance = 1.0, income_boost = 0.0, reputation = 0.0) {
        const tot_credits = this.credits_base * (1.0 + income_boost + reputation);
        if (revenue_type === 'hourly') {
            return tot_credits * 600 * win_chance;  // 10 * 60
        } else if (revenue_type === 'daily') {
            return tot_credits * 14400 * win_chance;  // 10 * 60 * 24
        }
        return 0.0;
    }

    get_experience(exp_type, win_chance = 1.0, reputation = 0.0) {
        const exp = Math.floor(this.exp_base * (1 + reputation));
        if (exp_type === 'hourly') {
            return exp * 600 * win_chance;  // 10 * 60
        } else if (exp_type === 'daily') {
            return exp * 14400 * win_chance;  // 10 * 60 * 24
        }
        return 0.0;
    }

}

export { Battle }; 
