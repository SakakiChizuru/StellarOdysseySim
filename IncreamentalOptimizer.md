# For Incremental Allocation Optimize:

- **Code added in optimizer.js:**

```javascript

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

```

- **Element Added/Adjusted in index.html**

```html

                            <div class="form-group" style="display: flex; flex-direction: row; flex-wrap: wrap; align-items:baseline; margin-left: -250px;">
                                <button id="optimizerBtn" type="button" style="margin-right: 10px;">简单计算优化</button>
                                <button id="longOptimizerBtn" type="button" style="margin-right: 10px;" title="Optimize by searching through multiple values of HTK and HTD. It is not advised to use more than 5000 fights">复杂计算优化</button>
                                <button id="importOptimizedBtn" type="button" style="visibility: hidden;">填充到玩家数据</button>
                                <br style="flex-basis: 100%; height: 0;">
                                <button id="incrementalOptimizerBtn" type="button" style="margin-right: 10px;">增量（加点）建议</button>
                                <input type="checkbox" id="incrementalTop5Mode" name="incrementalTop5Mode" style="margin-right: 5px;"></input>
                                <label for="incrementalTop5Mode" style="margin-right: 10px;">最优5模式（共计算8次）</label>
                            </div>


```

Adjust and Added the control pannel:
- Optimized layout for buttons.
- Added a '**incrementalOptimizerBtn**' Button for Increamental Optimizer.
- Added a '**incrementalTop5Mode**' CheckBox for switching optimize mode(Single/Best 5 of 8).


```html

						<div id="optimizerResult" style="display: flex; flex-direction: row; gap: 2em; margin-top: 1em;">
                            <div id="optimizerResultInfo" class="form-row">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.2em 1.2em; width: 180px; font-size: 1em;">
                                    <div><b>力量</b><br><span id="opt_power">-</span></div>
                                    <div><b>精准</b><br><span id="opt_precision">-</span></div>
                                    <div><b>闪避</b><br><span id="opt_evasion">-</span></div>
                                    <div><b>船体</b><br><span id="opt_hull">-</span></div>
                                </div>
                                <div style="font-size: 0.98em;">
                                    <div><b>胜率：</b> <span id="opt_win_chance">-</span></div>
                                    <div><b>货币／小时：</b> <span id="opt_credits_hour">-</span></div>
                                    <div><b>货币／天：</b> <span id="opt_credits_day">-</span></div>
                                    <div><b>经验／小时：</b> <span id="opt_exp_hour">-</span></div>
                                    <div><b>经验／天：</b> <span id="opt_exp_day">-</span></div>
                                </div>
                            </div>
                            <div id="IncrementalOptimizeInfo" class="form-row" style="display:none; flex-direction: column;align-items: center;width: 100%;font-size: 1.1em;align-content: center;justify-content: center; ">
                                <div id="opt_result">-</div>
                            </div>
                        </div>

```

Added '**IncrementalOptimizeInfo**' and '**opt\_result**', default '**display: none;**'.
Embered original 'opt\_*' spans into a 'form-row' class div, for layout use.
  
```javascript

            async function runIncrementalOptimizer(isSingleMode = true) {
                console.log(isSingleMode? "SingleMode":"Top5 Mode");
                // 重置进度条
                const progressBar = document.getElementById('optimizerProgressBar');
                const progressText = document.getElementById('optimizerProgressText');
                progressBar.style.width = '0%';
                progressText.textContent = '0%';

                // 读取基础数据（保持原有代码）
                const power = parseInt(form.power.value) || 0;
                const precision = parseInt(form.precision.value) || 0;
                const evasion = parseInt(form.evasion.value) || 0;
                const hull = parseInt(form.hull.value) || 0;
                const available = parseInt(form.available.value) || 0;
                const weapon_dmg = parseInt(form.weapon_dmg.value) || 0;
                const shield_def = parseInt(form.shield_def.value) || 0;
                const n_clones = parseInt(form.n_clones.value) || 1;
                const weapon_ele1 = form.weapon_ele1.value || null;
                const weapon_ele2 = form.weapon_ele2.value || null;
                const shield_ele1 = form.shield_ele1.value || null;
                const shield_ele2 = form.shield_ele2.value || null;
                const vip_status = form.vip_status.checked;

                const base = {
                    pow: power,
                    pre: precision,
                    eva: evasion,
                    hull: hull
                };

                // 克隆修饰符
                const list_modifiers = cloneModifiers.map(mod =>
                    new CloneModifiers(
                        (parseFloat(mod.crit) || 0) / 100,
                        (parseFloat(mod.critdmg) || 0) / 100,
                        (parseFloat(mod.dual) || 0) / 100
                    )
                );

                // 敌人信息
                const mob_name = form.mob_name.value;
                const mob_level = parseInt(form.mob_level.value) || 1;
                let mob_enum_key = Object.keys(MobName).find(key => MobName[key] === mob_name);
                const mob = new Mob(MobName[mob_enum_key], mob_level);

                // 玩家对象
                const player = new Player({
                    power, precision, evasion, hull, weapon_dmg, shield_def, n_clones, vip_status,
                    weapon_ele1, weapon_ele2, shield_ele1, shield_ele2, available
                });

                // 战斗次数和声望
                const optimizerFightsInput = document.getElementById('optimizer_n_fights');
                const n_fights = parseInt(optimizerFightsInput.value);
                const reputation = parseFloat(form.reputation?.value || 0) / 100;

                // 优化器实例
                const optimizer = new Optimizer(player, mob, list_modifiers, n_fights, reputation);

                // 目标类型
                const target = document.querySelector('input[name="optimize_target"]:checked').value;

                const updateProgress = (current, total) => {
                    const progress = (current / total) * 100;
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `${Math.round(progress)}%`;
                    return new Promise(resolve => setTimeout(resolve, 0));
                };

                if (!isSingleMode) {
                    // TOP5模式，多次获取
                    const topResults = [];

                    for (let i = 0; i < 8; i++) {
                        const result = await optimizer.findBestIncremental(target, true, updateProgress);
                        topResults.push(result);
                    }

                    // 去重合并，取前5
                    const uniqueBuilds = new Map();
                    for (const r of topResults) {
                        const key = r.build.join(',');
                        if (!uniqueBuilds.has(key)) {
                            uniqueBuilds.set(key, r);
                        }
                    }

                    const bestList = Array.from(uniqueBuilds.values())
                        .sort((a, b) => b.win_chance - a.win_chance)
                        .slice(0, 5);

                    return {
                        bestList,
                        baseStats: base
                    };
                } else {
                    // 单次模式，直接返回单条结果
                    const result = await optimizer.findBestIncremental(target, true, updateProgress);

                    return {
                        bestStats: result.build,
                        baseStats: base,
                        winChance: result.win_chance,
                        resource: result.resource
                    };
                }
            }


        function displayOptimizerResult(result, isSingleMode = true) {
            const optResultContainer = document.getElementById('opt_result');

            if (!isSingleMode) {
                // TOP5MODE 显示表格
                optResultContainer.innerHTML = '';

                const table = document.createElement('table');
                table.style.fontFamily = '"Rajdhani", Tahoma, Arial, sans-serif';
                table.style.margin = '0 auto';
                table.style.textAlign = 'center';
                table.style.width = '100%';
                table.style.borderCollapse = 'collapse';

                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                ['排名', '力量', '精准', '闪避', '船体', '▲力量', '▲精准', '▲闪避', '▲船体', '胜率'].forEach(text => {
                    const th = document.createElement('th');
                    th.textContent = text;
                    th.style.border = '1px solid #ccc';
                    th.style.padding = '4px';
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                //console.log(result);
                const baseStats = ['pow', 'pre', 'eva', 'hull'].map(k => result.baseStats[k]);
                result.bestList.forEach((r, idx) => {
                    const tr = document.createElement('tr');
                    const tdRank = document.createElement('td');
                    tdRank.textContent = (idx + 1).toString();
                    tdRank.style.border = '1px solid #ccc';
                    tdRank.style.padding = '4px';
                    tr.appendChild(tdRank);

                    r.build.forEach(val => {
                        const td = document.createElement('td');
                        td.textContent = val;
                        td.style.border = '1px solid #ccc';
                        td.style.padding = '4px';
                        tr.appendChild(td);
                    });

                    r.build.forEach((val, idx) => {
                        const td = document.createElement('td');
                        const increasement = val - baseStats[idx];
                        td.innerHTML = increasement > 0 ? `[<font color="Lime">+${increasement}</font>]` : '(0)';
                        td.style.border = '1px solid #ccc';
                        td.style.padding = '4px';
                        tr.appendChild(td);
                    })

                    const tdWinChance = document.createElement('td');
                    tdWinChance.textContent = (r.win_chance * 100).toFixed(2) + '%';
                    tdWinChance.style.border = '1px solid #ccc';
                    tdWinChance.style.padding = '4px';
                    tr.appendChild(tdWinChance);

                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);

                optResultContainer.appendChild(table);

            } else {
                const base = result.baseStats;

                console.log(result);
                // SINGLEMODE 显示单条结果
                const IncrementalOptimizeResult = {
                    power: result.bestStats[0],
                    precision: result.bestStats[1],
                    evasion: result.bestStats[2],
                    hull: result.bestStats[3]
                };

                const IncrementalOptimizeIncresement = {
                    power: IncrementalOptimizeResult.power - base.pow,
                    precision: IncrementalOptimizeResult.precision - base.pre,
                    evasion: IncrementalOptimizeResult.evasion - base.eva,
                    hull: IncrementalOptimizeResult.hull - base.hull
                };

                document.getElementById('opt_power').innerHTML = `${IncrementalOptimizeResult.power} (<font color=${IncrementalOptimizeIncresement.power > 0 ? "'Lime'" : "'white'"}>${IncrementalOptimizeIncresement.power > 0 ? '+' : ''}${IncrementalOptimizeIncresement.power}</font>)`;
                document.getElementById('opt_precision').innerHTML = `${IncrementalOptimizeResult.precision} (<font color=${IncrementalOptimizeIncresement.precision > 0 ? "'Lime'" : "'white'"}>${IncrementalOptimizeIncresement.precision > 0 ? '+' : ''}${IncrementalOptimizeIncresement.precision}</font>)`;
                document.getElementById('opt_evasion').innerHTML = `${IncrementalOptimizeResult.evasion} (<font color=${IncrementalOptimizeIncresement.evasion > 0 ? "'Lime'" : "'white'"}>${IncrementalOptimizeIncresement.evasion > 0 ? '+' : ''}${IncrementalOptimizeIncresement.evasion}</font>)`;
                document.getElementById('opt_hull').innerHTML = `${IncrementalOptimizeResult.hull} (<font color=${IncrementalOptimizeIncresement.hull > 0 ? "'Lime'" : "'white'"}>${IncrementalOptimizeIncresement.hull > 0 ? '+' : ''}${IncrementalOptimizeIncresement.hull}</font>)`;
                
                document.getElementById('opt_win_chance').textContent = `${(result.winChance * 100).toFixed(2)}%`;
                document.getElementById('opt_credits_hour').textContent = `${millify(result.resource.credits_hourly)}／小时`;
                document.getElementById('opt_credits_day').textContent = `${millify(result.resource.credits_daily)}／天`;
                document.getElementById('opt_exp_hour').textContent = `${millify(result.resource.exp_hourly)}／小时`;
                document.getElementById('opt_exp_day').textContent = `${millify(result.resource.exp_daily)}／天`;

            }
        }

            incrementalOptimizerBtn.addEventListener('click', async () => {
                try {
                    // 读取是否选中TOP5模式
                    const isSingleMode = !document.getElementById('incrementalTop5Mode').checked;

                    // 切换显示样式
                    const top5Div = document.getElementById('IncrementalOptimizeInfo');
                    const optResultDiv = document.getElementById('optimizerResult');

                    document.getElementById('opt_result').textContent = '正在计算...';

                    if (!isSingleMode) {
                        top5Div.style.display = 'flex';
                        optResultDiv.style.display = 'none';
                    } else {
                        top5Div.style.display = 'none';
                        optResultDiv.style.display = 'flex';
                    }

                    // 运行优化器，传入模式
                    const result = await runIncrementalOptimizer(isSingleMode);

                    // 显示结果，传入模式
                    displayOptimizerResult(result, isSingleMode);

                } catch (error) {
                    console.error('优化过程中出错:', error);
                    alert('优化失败: ' + error.message);
                }
            });


```

Handler of button, calling of Increamental optimize and echo the result.