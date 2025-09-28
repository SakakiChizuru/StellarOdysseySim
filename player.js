import { Element } from "./dataclasses.js";

class Player {
	constructor({
		power,
		precision,
		evasion,
		hull,
		available,
		weapon_dmg,
		shield_def,
		n_clones,
		vip_status,
		weapon_ele1 = null,
		weapon_ele2 = null,
		shield_ele1 = null,
		shield_ele2 = null,
		battle_boost = 0.0,
		battling_weapon_boost = 0.0,
		battling_hull_boost = 0.0,
		battling_precision_boost = 0.0,
		battling_evasion_boost = 0.0 
	}) {
		this.pow = power;
		this.pre_before_boost = precision;
		this.eva_before_boost = evasion;
		this.hull = hull;
		this.available = available;
		this.weapon_dmg = weapon_dmg;
		this.shield_def = shield_def;
		this.n_clones = n_clones;
		this.weapon_ele1 = weapon_ele1;
		this.weapon_ele2 = weapon_ele2;
		this.shield_ele1 = shield_ele1;
		this.shield_ele2 = shield_ele2;
		this.vip_status = vip_status;
		this.battle_boost = battle_boost;

        this.battling_weapon_boost = battling_weapon_boost;
        this.battling_hull_boost = battling_hull_boost;
        this.battling_precision_boost = battling_precision_boost;
        this.battling_evasion_boost = battling_evasion_boost;

		this.pre = Math.floor(precision * (1.0 + battle_boost) * (1.0 + battling_precision_boost));
        this.eva = Math.floor(evasion * (1.0 + battle_boost) * (1.0 + battling_evasion_boost));
        this.hp = Math.floor(((7.0 * this.hull * (1.0 + battling_hull_boost)) + shield_def) * (1.0 + battle_boost));
        this.dmg = Math.floor((((7.0 * this.pow * (1.0 + battling_weapon_boost)) + weapon_dmg) * this.n_clones) * (1.0 + battle_boost));
	}

	serialize() {
		return {
			power: this.pow,
			precision: this.pre_before_boost,
			evasion: this.eva_before_boost,
			hull: this.hull,
			available: this.available,
			weapon_dmg: this.weapon_dmg,
			shield_def: this.shield_def,
			n_clones: this.n_clones,
			vip_status: this.vip_status,
			weapon_ele1: this.weapon_ele1,
			weapon_ele2: this.weapon_ele2,
			shield_ele1: this.shield_ele1,
			shield_ele2: this.shield_ele2,
			battle_boost: this.battle_boost,
			battling_weapon_boost: this.battling_weapon_boost,
            battling_hull_boost: this.battling_hull_boost,
            battling_precision_boost: this.battling_precision_boost,
            battling_evasion_boost: this.battling_evasion_boost,
		};
	}
}

export { Player };