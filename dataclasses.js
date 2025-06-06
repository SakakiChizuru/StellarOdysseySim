// Enums and data structures translated from Python

// Element Enum
const Element = Object.freeze({
    CHEMICAL: 'Chemical',
    ELECTROMAGNETIC: 'Electromagnetic',
    ENERGY: 'Energy',
    EXPLOSIVE: 'Explosive',
    INCENDIARY: 'Incendiary',
    KINETIC: 'Kinetic',
});

// MobName Enum
const MobName = Object.freeze({
    BRUTES: 'Brutes',
    DUSTERS: 'Dusters',
    MACHINERS: 'Machiners',
    TOXOIDS: 'Toxoids',
    SCORCHERS: 'Scorchers',
    GLACIALS: 'Glacials',
    SPECTRES: 'Spectres',
    MINERS: 'Miners',
});

class MobProperties {
    constructor(weaknesses, mob_class) {
        this.weaknesses = weaknesses;
        this.mob_class = mob_class;
    }
}

const mob_properties = {
    [MobName.BRUTES]: new MobProperties([Element.EXPLOSIVE, Element.KINETIC], 'Battling'),
    [MobName.DUSTERS]: new MobProperties([Element.CHEMICAL, Element.ELECTROMAGNETIC], 'Battling'),
    [MobName.MACHINERS]: new MobProperties([Element.ELECTROMAGNETIC, Element.ENERGY], 'Battling'),
    [MobName.TOXOIDS]: new MobProperties([Element.CHEMICAL, Element.INCENDIARY], 'Exploring'),
    [MobName.SCORCHERS]: new MobProperties([Element.CHEMICAL, Element.KINETIC], 'Exploring'),
    [MobName.GLACIALS]: new MobProperties([Element.EXPLOSIVE, Element.INCENDIARY], 'Exploring'),
    [MobName.SPECTRES]: new MobProperties([Element.ELECTROMAGNETIC, Element.ENERGY], 'Gathering'),
    [MobName.MINERS]: new MobProperties([Element.EXPLOSIVE, Element.KINETIC], 'Gathering'),
};

class CloneModifiers {
    constructor(bonus_crit_chance = 0.0, bonus_crit_damage = 0.0, dual_shot_chance = 0.0) {
        this.bonus_crit_chance = bonus_crit_chance;
        this.bonus_crit_damage = bonus_crit_damage;
        this.dual_shot_chance = dual_shot_chance;
    }
}

export { Element, MobName, MobProperties, mob_properties, CloneModifiers }; 