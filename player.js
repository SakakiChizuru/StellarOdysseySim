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
	}) {
		this.pow = power;
		this.pre_before_boost = precision;
		this.pre = Math.floor(precision * (1.0 + battle_boost));
		this.eva_before_boost = evasion;
		this.eva = Math.floor(evasion * (1.0 + battle_boost));
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

		this.hp = Math.floor((7.0 * hull + shield_def) * (1.0 + battle_boost));
		this.dmg = Math.floor(
			(7.0 * this.pow + weapon_dmg) * this.n_clones * (1.0 + battle_boost)
        );
	}
}

export { Player };
