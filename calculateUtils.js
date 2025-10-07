import { Decimal } from './decimal.mjs';

class CalculateUtils {

    getBodyBonus(bodyType) {
        if (bodyType === null || typeof bodyType === 'undefined' || typeof bodyType !== 'string') {
            return null;
        }
        switch (bodyType.toLowerCase()) {
            case 'rocky':
                return 'battling';
            case 'icy':
                return 'gathering';
            case 'gas':
                return 'crafting';
            case 'crystal':
                return 'exploring';
            default:
                return null;
        }
    }

    formatPercent(value) {
        let num = typeof value === 'string' 
            ? parseFloat(value.replace('%', '')) 
            : Number(value);
        if (isNaN(num)) num = 0;
        const rounded = Math.round(num * 100) / 100;
        let str = rounded.toString();
        if (str.includes('.')) {
            str = str.replace(/\.?0+$/, '');
        }
        return str;
    }

    calculateModuleBoost(moduleLevel, moduleEfficiency, moduleTier) {
        if (typeof moduleLevel !== 'number' || moduleLevel < 0 || !isFinite(moduleLevel) ||
            typeof moduleEfficiency !== 'number' || moduleEfficiency < 0 || !isFinite(moduleEfficiency) ||
            typeof moduleTier !== 'number' || moduleTier < 0 || !isFinite(moduleTier)) {
            throw new Error("`moduleLevel`, `moduleEfficiency` or `moduleTier` must be a finite number >= 0.");            
        }

        return Math.floor(moduleLevel * (1 + moduleTier / 100) * (1 + moduleEfficiency / 100));
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
        this.BaseBodyType = BaseBodyType;
        this.PvPTileBonus = PvPTileBonus;
        this.isPremium = isPremium;
        this.CraftingCurrentExp = CraftingCurrentExp;
        this.CraftingNextLevelExp = CraftingNextLevelExp;
        this.GlobalBoosts = GlobalBoosts;
        this.verbose = verbose;

        this.Craftron3000TotalEfficiency = this.BaseCalculator.calculateModuleBoost(
                                                this.Craftron3000Level, 
                                                this.ModuleEfficiency, 
                                                this.Craftron3000Tier
                                            );

        this.calcLevelCurrent = this.CraftLevel ? this.CraftLevel : 0;
        this.calcLevelCurrentExp = this.CraftingCurrentExp ? this.CraftingCurrentExp : 0;
    }

    static fromAPIJSON (data, verbose = false) {
        if (typeof data !== 'object' || data === null) {
            throw new Error("`data` must be a non-null object.");
        }

        let petLevel = data.pet_slots?.array?.find(el => el.pet?.name?.toLowerCase() === 'cat')?.pet?.level ?? 0;

        let pvpTileBonus = (data.battlefield ?? []).reduce(
        (sum, el) => sum + (el.rewards?.bonus?.toLowerCase() === 'crafting' ? el.rewards.amount ?? 0 : 0),
        0
        );

        let globalBoosts = (data.globalBoosts ?? []).find(b => b.name?.toLowerCase() === 'xp')?.value ?? 0;
        return new Craftron3000Calculator(
            data.levels.crafting_level ? data.levels.crafting_level : 0,
            petLevel ? petLevel : 0,
            data.skills.crafting_base_xp_boost ? data.skills.crafting_base_xp_boost : 0,
            data.base?.modules?.[5]?.level ?? 0,
            data.base?.modules?.[5]?.tier ?? 0,
            data.skills.base_module_efficiency_boost ? data.skills.base_module_efficiency_boost : 0,
            data.base?.bodyType ? data.base.bodyType : null,
            pvpTileBonus,
            data.premium ? data.premium : false,
            data.levels.crafting_current_xp ? data.levels.crafting_current_xp : 0,
            data.levels.crafting_target_xp ? data.levels.crafting_target_xp : 0,
            globalBoosts,
            verbose
        );
    }

/*     multiplierFromAllFactors(CraftLevelFactor = this.calcLevelCurrent) {
        let extraMultiplier = new Decimal('0.0');
        let boostDetails = {};


        // 加算区（固定百分比加成）
        extraMultiplier += CraftLevelFactor * 0.01;
        boostDetails.CraftLevel = `${CraftLevelFactor}%`;

        const petLevel = this.PetLevel || 0;

        extraMultiplier += petLevel * 0.03;        
        boostDetails.PetLevel = `${petLevel * 3}%`;

        const globalBoosts = this.GlobalBoosts || 0;
        extraMultiplier += globalBoosts * 0.01;
        boostDetails.GlobalBoosts = `${globalBoosts}%`;

        // 乘算区
        const techLevel = this.TechnologyLevel || 0;
        extraMultiplier *= (1 + techLevel * 0.01);
        boostDetails.TechnologyLevel = `${techLevel}%`;

        extraMultiplier = decimalFn(extraMultiplier);

        const pvpBonus = this.PvPTileBonus || 0;
        extraMultiplier *= (1 + pvpBonus * 0.01);
        boostDetails.PvPTileBonus = `${pvpBonus}%`;

        extraMultiplier = decimalFn(extraMultiplier);

        const premiumBonus = this.isPremium ? 10 : 0;
        extraMultiplier *= (1 + (this.isPremium ? 0.1 : 0.0));
        boostDetails.Premium = `${premiumBonus}%`;

        extraMultiplier = decimalFn(extraMultiplier);

        const craftronEff = this.Craftron3000TotalEfficiency || 0;
        extraMultiplier *= (1 + craftronEff * 0.01);
        boostDetails.Craftron3000 = `${craftronEff}%`;

        extraMultiplier = decimalFn(extraMultiplier);

        const bodyIsCrafting = this.BaseCalculator.getBodyBonus(this.BaseBodyType) === 'crafting';
        const bodyBonus = bodyIsCrafting ? 10 : 0;
        extraMultiplier *= (1 + (bodyIsCrafting ? 0.1 : 0.0));
        boostDetails.BodyType = `${bodyBonus}%`;

        const rate = 1 + (extraMultiplier);

        return { rate, boostDetails };
    } */

// 假设你已引入 Decimal：const Decimal = require('decimal.js'); 或全局可用

    multiplierFromAllFactors(CraftLevelFactor = this.calcLevelCurrent) {
        // 初始化为 Decimal('0')
        let extraMultiplier = new Decimal('0');
        const boostDetails = {};

        // --- 加算区（线性加成）---

        // CraftLevelFactor 是数值，但我们要用 Decimal 处理
        const craftLevelDec = new Decimal(CraftLevelFactor || 0);
        extraMultiplier = extraMultiplier.plus(craftLevelDec.times('0.01'));
        boostDetails.CraftLevel = `${CraftLevelFactor}%`;

        const petLevel = new Decimal(this.PetLevel || 0);
        extraMultiplier = extraMultiplier.plus(petLevel.times('0.03'));
        boostDetails.PetLevel = `${petLevel.times(3).toString()}%`;

        const globalBoosts = new Decimal(this.GlobalBoosts || 0);
        extraMultiplier = extraMultiplier.plus(globalBoosts.times('0.01'));
        boostDetails.GlobalBoosts = `${globalBoosts.toString()}%`;

        // --- 乘算区（百分比增益）---

        const techLevel = new Decimal(this.TechnologyLevel || 0);
        const techMultiplier = new Decimal('1').plus(techLevel.times('0.01'));
        extraMultiplier = extraMultiplier.times(techMultiplier);
        boostDetails.TechnologyLevel = `${techLevel.toString()}%`;

        const pvpBonus = new Decimal(this.PvPTileBonus || 0);
        const pvpMultiplier = new Decimal('1').plus(pvpBonus.times('0.01'));
        extraMultiplier = extraMultiplier.times(pvpMultiplier);
        boostDetails.PvPTileBonus = `${pvpBonus.toString()}%`;

        const premiumBonus = this.isPremium ? new Decimal('10') : new Decimal('0');
        const premiumMultiplier = this.isPremium ? new Decimal('1.1') : new Decimal('1');
        extraMultiplier = extraMultiplier.times(premiumMultiplier);
        boostDetails.Premium = `${premiumBonus.toString()}%`;

        const craftronEff = new Decimal(this.Craftron3000TotalEfficiency || 0);
        const craftronMultiplier = new Decimal('1').plus(craftronEff.times('0.01'));
        extraMultiplier = extraMultiplier.times(craftronMultiplier);
        boostDetails.Craftron3000 = `${craftronEff.toString()}%`;

        const bodyIsCrafting = this.BaseCalculator.getBodyBonus(this.BaseBodyType) === 'crafting';
        const bodyBonus = bodyIsCrafting ? new Decimal('10') : new Decimal('0');
        const bodyMultiplier = bodyIsCrafting ? new Decimal('1.1') : new Decimal('1');
        extraMultiplier = extraMultiplier.times(bodyMultiplier);
        boostDetails.BodyType = `${bodyBonus.toString()}%`;

        // 最终 rate = 1 + extraMultiplier
        //const rate = new Decimal('1').plus(extraMultiplier);
        const rateDecimal = new Decimal('1').plus(extraMultiplier);
        console.log(`Calculated rate (Decimal): ${rateDecimal.toString()}`);
        const rate = parseFloat(rateDecimal.toFixed(4));
        console.log(`Converted rate (float): ${rate}`);

        return {
            rate,              // Decimal 实例
            boostDetails       // 用于 UI 显示的字符串描述
        };
    }

    renderBoostsAsHTML() {

        const { rate, boostDetails } = this.multiplierFromAllFactors();
        const totalBonusPercent = (rate - 1) * 100;
        const totalDisplay = this.BaseCalculator.formatPercent(totalBonusPercent);

        const labelMap = {
            CraftLevel: '制作等级：',
            PetLevel: '宠物：',
            GlobalBoosts: '全局加成：',
            PvPTileBonus: 'PVP：',
            TechnologyLevel: '科技：',
            Premium: '会员：',
            Craftron3000: '模块加成：',
            BodyType: '基地类型：'
        };

        const order = [
            'CraftLevel',
            'PetLevel',
            'GlobalBoosts',
            'PvPTileBonus',
            'TechnologyLevel',
            'Premium',
            'Craftron3000',
            'BodyType'
        ];

        const items = order.map(key => {
            const label = labelMap[key] || key + '：';
            const rawValue = boostDetails[key] !== undefined ? boostDetails[key] : '0%';
            const value = this.BaseCalculator.formatPercent(rawValue) + '%';
            return { label, value };
        });

        // 构建每行两个单元格
        const rows = [];
        for (let i = 0; i < items.length; i += 2) {
            const left = items[i];
            const right = items[i + 1] || null;

            const leftCell = `
                <div class="boost-item" style="width: 50%;">
                    <span class="boost-label">${left.label}</span>
                    <span class="boost-value">${left.value}</span>
                </div>
            `;

            const rightCell = right ? `
                <div class="boost-item" style="width: 50%;">
                    <span class="boost-label">${right.label}</span>
                    <span class="boost-value">${right.value}</span>
                </div>
            ` : '<div class="boost-item empty"></div>';

            rows.push(`<div class="boost-row">${leftCell}${rightCell}</div>`);
        }

        const detailHTML = rows.join('\n');

        return `
            <div><b>总计经验加成：</b> ${totalDisplay}%</div>
            ${detailHTML}
        `;
    }

    calcAmountForExp(exp, rate) {
        if (typeof exp !== 'number' || exp < 0 || !isFinite(exp) ||
            typeof rate !== 'number' || rate <= 0 || !isFinite(rate)) {
            throw new Error("`exp` or `rate` must be a finite number >= 0.");
        }

        let e = new Decimal(exp);
        let r = new Decimal(rate);
        let expDecimal = e.dividedBy(r);
        return expDecimal.ceil().toNumber();
        // return Math.ceil(exp / rate);
    }

    calcAmountToExp(amount, rate) {
        if (typeof amount !== 'number' || amount < 0 || !isFinite(amount) ||
            typeof rate !== 'number' || rate <= 0 || !isFinite(rate)) {
            throw new Error("`amount` or `rate` must be a finite number >= 0.");
        }

        let a = new Decimal(amount);
        let r = new Decimal(rate);
        let expDecimal = a.times(r);
        return expDecimal.floor().toNumber();
        // return Math.floor(amount * rate);
    }

    calculateLevelNeeds(level = this.calcLevelCurrent, currentLevelExp = this.calcLevelCurrentExp) {        
        // FIXED: Use the passed level instead of this.CraftLevel
        const currentlevel_needs = this.BaseCalculator.expCalculate(level, level + 1, 3, this.verbose).levelExps[0].needExp;
        const currentlevel_remains = currentlevel_needs - currentLevelExp;
        const needs = {
            level, 
            amount: this.calcAmountForExp(currentlevel_remains, this.multiplierFromAllFactors(level).rate),
        };
        return needs;
    }

    calculateInputLevelRangeNeeds(from, to, currentLevelExp = this.calcLevelCurrentExp) {
        if (typeof from !== 'number' || from < 1 || !isFinite(from) ||
            typeof to !== 'number' || to < from || !isFinite(to)) {
            throw new Error("`from` must be a finite number >= 1 and `to` must be a finite number >= `from`.");
        }
        
        const results = [];
        let totalAmount = 0;

        // ✅ FIXED: should be level < to (upgrade from `from` to `to` means levels: from → from+1 → ... → to)
        for (let level = from; level < to; level++) {
            const levelNeeds = this.calculateLevelNeeds(level, (level === from) ? currentLevelExp : 0);
            results.push(levelNeeds);
            totalAmount += levelNeeds.amount;
        }
        
        return { results, totalNeeds: totalAmount };
    }

    calculateMaxLevelFromQuantity(Q, from = 1, currentLevelExp = 0) {
        if (Q < 0 || !isFinite(Q)) {
            throw new Error("Quantity Q must be a non-negative finite number.");
        }
        if (from < 1 || !Number.isInteger(from)) {
            throw new Error("from must be an integer >= 1.");
        }
        if (currentLevelExp < 0 || !isFinite(currentLevelExp)) {
            throw new Error("currentLevelExp must be a non-negative finite number.");
        }

        let level = from;
        let remainingQty = Q;
        let accumulatedExp = currentLevelExp;
        const levelUpConsumptions = [];

        while (true) {
            const expResult = this.BaseCalculator.expCalculate(level, level + 1, 3);
            const needExpTotal = expResult.levelExps[0]?.needExp;

            if (typeof needExpTotal !== 'number' || needExpTotal <= 0) {
                // 无法继续升级，兑换剩余材料
                const exchangeRate = this.multiplierFromAllFactors(level).rate;
                const finalGainedExp = this.calcAmountToExp(remainingQty, exchangeRate);
                accumulatedExp += finalGainedExp;
                break;
            }

            if (accumulatedExp >= needExpTotal) {
                accumulatedExp -= needExpTotal;
                level++;
                continue;
            }

            const exchangeRate = this.multiplierFromAllFactors(level).rate;

            if (typeof exchangeRate !== 'number' || exchangeRate <= 0) {
                throw new Error(`Invalid exchange rate returned for level ${level}: ${exchangeRate}`);
            }

            const needExp = needExpTotal - accumulatedExp;
            const minQty = this.calcAmountForExp(needExp, exchangeRate);

            if (remainingQty < minQty) {
                // 不够升级，但兑换剩余材料
                const finalGainedExp = this.calcAmountToExp(remainingQty, exchangeRate);
                accumulatedExp += finalGainedExp;
                break;
            }

            remainingQty -= minQty;
            const gainedExp = this.calcAmountToExp(minQty, exchangeRate);
            accumulatedExp += gainedExp;

            levelUpConsumptions.push({
                level: level,
                consumedQty: minQty
            });

            // 注意：不手动 level++，靠循环开头自动检测是否可连升
        }

        return {
            level,
            overflowExp: accumulatedExp,
            levelUpConsumptions
        };
    }

}

export { CalculateUtils };
export { Craftron3000Calculator };