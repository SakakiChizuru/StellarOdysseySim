import { MobName, mob_properties } from './dataclasses.js';

class Mob {
	constructor(name, lvl) {
		this.name = name;
		this.lvl = lvl;
		this.weaknesses = mob_properties[this.name].weaknesses;
		this.output_class = mob_properties[this.name].mob_class;

		if (this.lvl < 100) {
			this.dmg = Math.floor(7.0 * this.lvl);
			this.pre = Math.floor(1.0 * this.lvl);
			this.eva = Math.floor(1.0 * this.lvl);
		} else {
			this.dmg = Math.floor(7.0 * 1.1 * this.lvl);
			this.pre = Math.floor(1.0 * 1.5 * this.lvl);
			this.eva = Math.floor(1.0 * 1.5 * this.lvl);
		}

		if (this.lvl < 150) {
			this.hp = Math.floor(1300.0 * this.lvl);
		} else {
			this.hp = Math.floor(1300.0 * 1.2 * this.lvl);
		}

		this.current_hp = this.hp;
		this.hit_counter = 0;

		this.crit_chance = 0.0;
		this.crit_dmg = 0.0;
	}

	toString() {
		return `I am a ${this.name} mob of level ${
			this.lvl
		}. My weaknesses are ${this.weaknesses.join(", ")}.`;
    }
    
	serialize() {
		return {
			name: this.name,
			lvl: this.lvl,
			dmg: this.dmg,
			pre: this.pre,
			eva: this.eva,
			hp: this.hp,
			current_hp: this.current_hp,
			hit_counter: this.hit_counter,
			crit_chance: this.crit_chance,
			crit_dmg: this.crit_dmg,
			weaknesses: [...this.weaknesses],
			output_class: this.output_class,
		};
	}
}

export { Mob }; 
