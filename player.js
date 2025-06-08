import { Element } from './dataclasses.js';

class Player {
    constructor({ power, precision, evasion, hull, weapon_dmg, shield_def, n_clones, vip_status, weapon_ele1 = null, weapon_ele2 = null, shield_ele1 = null, shield_ele2 = null, available = null }) {

        this.pow = power;
        this.pre = precision;
        this.eva = evasion;
        this.hull = hull;
        this.availablePoints = available || 0;
        this.weapon_dmg = weapon_dmg;
        this.shield_def = shield_def;
        this.n_clones = n_clones;
        this.weapon_ele1 = weapon_ele1;
        this.weapon_ele2 = weapon_ele2;
        this.shield_ele1 = shield_ele1;
        this.shield_ele2 = shield_ele2;
        this.vip_status = vip_status;

        this.hp = (7.0 * hull) + shield_def;
        this.dmg = ((7.0 * this.pow) + weapon_dmg) * this.n_clones;
    }
}

export { Player }; 