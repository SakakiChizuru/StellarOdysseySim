class CalculateUtils {

    getBodyBonus(bodyType) {
        if (bodyType === null || typeof bodyType === 'undefined' || typeof bodyType !== 'string') {
            return null;
        }
        switch (bodyType.toLowerCase()) {
            case 'rocky':
                return '';
        }
    }

    // EXP calculation function
    expCalculate(from, to = null, mode = 1, verbose = false) {

        // Validate parameters
        if (typeof from !== 'number' || from < 1 || !isFinite(from)) {
            throw new Error("`from` must be a finite number >= 1.");
        }

        if (to === null || typeof to === 'undefined' || to <= from) {
            to = from + 1;
        }

        // Constants: rate and base EXP
        const rate = 1.15;
        const baseExp = 100;

        // Parse mode parameter: number or character
        let numericMode;
        if (typeof mode === 'number') {
            numericMode = [1,2,3,4].includes(mode) ? mode : 1;
        } else if (typeof mode === 'string') {
            // Mode map: b=battle g=gather c=craft e=explore
            const modeMap = { 'b': 1, 'g': 2, 'c': 3, 'e': 4 };
            numericMode = modeMap[mode.toLowerCase()] || 1;
        } else {
            numericMode = 1;
        }

        // Determine rounding method: craft uses floor, others use round
        const roundFn = (numericMode === 3) ? Math.floor : Math.round;

        // Start from L1->L2=100 and calculate step by step
        // Calculate until reaching `from` and skip record
        let prev = baseExp; 
        let currentLevel = 2;

        while (currentLevel < from) {
            prev = roundFn(prev * rate);
            currentLevel++;
        }

        // Result object: includes all required values in the range and total
        /*
         * Example result structure:
         * {
         *   levelExps: [
         *     { next: 6, needExp: 1234 },
         *     { next: 7, needExp: 2345 }
         *   ],
         *   total: 3579
         * }
        */
        const result = {
            levelExps: [],
            total: 0
        };

        // Calculate from `from` to `to`, and record each level exp
        for (let next = from + 1; next <= to; next++) {
            prev = roundFn(prev * rate);
            result.levelExps.push({ next, needExp: prev });
            result.total += prev;

            if (verbose) {
                console.log(`Lv${next - 1} → Lv${next}: ${prev}`);
            }
        }

        if (verbose) {
            console.log(`Total EXP from Lv${from} to Lv${to}: ${result.total}`);
        }

        return result;
    }
}

class Craftron3000Calculator {
    constructor(
        CraftLevel, PetLevel, TechnologyLevel, 
        Craftron3000Level, Craftron3000Tier,
        ModuleEfficiency, BaseBodyType,
        PvPTileBonus,
        isPremium,
        CraftingCurrentExp = 0, CraftingNextLevelExp = 0,
        GlobalBoosts = 0,
        verbose = false
    ) {
        this.BaseCalculator = new CalculateUtils();
        this.CraftLevel = CraftLevel;
        this.PetLevel = PetLevel;
        this.TechnologyLevel = TechnologyLevel;
        this.Craftron3000Level = Craftron3000Level;
        this.Craftron3000Tier = Craftron3000Tier;
        this.ModuleEfficiency = ModuleEfficiency;

        this.Craftron3000TotalEfficiency = (this.Craftron3000Level * 
                                        (1 + this.Craftron3000Tier / 100) * 
                                        (1 + this.ModuleEfficiency / 100)) 
                                        / 100;

        this.BaseBodyType = BaseBodyType;
        this.PvPTileBonus = PvPTileBonus;
        this.isPremium = isPremium;
        this.CraftingCurrentExp = CraftingCurrentExp;
        this.CraftingNextLevelExp = CraftingNextLevelExp;
        this.GlobalBoosts = GlobalBoosts;
        this.verbose = verbose;

    }

    multiplierFromAllFactors() {
        let extraMultiplier = 0.0;
        extraMultiplier += this.CraftLevel * 0.01;
        extraMultiplier += this.PetLevel * 0.03;
        extraMultiplier += this.TechnologyLevel * 0.01;
        extraMultiplier += this.Craftron3000TotalEfficiency;
        extraMultiplier += this.BaseBodyType * 0.02;
        extraMultiplier += this.PvPTileBonus * 0.01;
        extraMultiplier += this.isPremium ? 0.10 : 0.0;
        extraMultiplier += this.GlobalBoosts;
        return 1 + extraMultiplier;
    }

    calculateCurrentLevel() {
        const currentlevel_needs = (this.CraftingNextLevelExp == 0) ? 
                                    this.BaseCalculator.expCalculate(this.CraftLevel, null, 3, this.verbose).levelExps[0].needExp : 
                                    this.CraftingNextLevelExp;
        const currentlevel_remains = currentlevel_needs - this.CraftingCurrentExp;

    }
}

export { CalculateUtils };
export { Craftron3000Calculator};