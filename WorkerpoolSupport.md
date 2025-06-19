#WorkerPool support

## Modification of .js files(and adds).
###Modification of `mob.js` `optimizer.js` `player.js` :

`serialize()` function in each js file and one more `static deserialize()` function in `optimizer.js` put in the end of each Class.

###Adds:

`workerpool.js` -> for Class WokerPool export.
`optimizer.woker.js` -> for opitimize Worker thread used by WorkerPool.

## Modification of index.html

### Added:

`Import { WorkerPool } from './workerpool.js' ` after the Imports at beginning of the `<script>` block.

### Replace in `function runOptimizer()` 

Fully replace `if (isLongOptimize)` statement `True` part with:

```Javascript
    //Create worker pool with working thread threshold;
    const pool = new WorkerPool(navigator.hardwareConcurrency || 8);
    const target = document.querySelector('input[name="optimize_target"]:checked').value;
    const range_htk = Array.from({length: 14}, (_, i) => i + 3);
    const range_htd = Array.from({length: 12}, (_, i) => i + 2);
    const totalTasks = range_htk.length * range_htd.length;
    let completedTasks = 0;
    
    const optimizer = new Optimizer(player, mob, list_modifiers, n_fights, reputation);
    const optimizerData = optimizer.serialize();
    
    const tasks = [];
    for (const htk of range_htk) {
        for (const htd of range_htd) {
            tasks.push({
                optimizerData,
                target,
                htd,
                htk
            });
        }
    }
    
    //Update progress with finished tasks count.
    const updateProgress = () => {
        completedTasks++;
        const progress = (completedTasks / totalTasks) * 100;
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
    };

    try {
        const results = await Promise.all(tasks.map(task => {
            return pool.runTask(task)
                .then(result => {
                    updateProgress();
                    return result;
                });
        }));
        
        let bestResult = results[0];
        for (const resultone of results) {
            if (resultone.res > bestResult.res) {
                bestResult = resultone;
            }
        }
        
        //bestResult construct from optimizer.js
        let {
            build: best_build,
            res: best_res,
            win_chance: best_win_chance,
            htd: best_htd,
            htk: best_htk
        } = bestResult;

        result = { bestStats: best_build, winChance: best_win_chance };

        document.getElementById('optimizer_htk').value = best_htk;
        document.getElementById('optimizer_htd').value = best_htd;
        
        const settings = JSON.parse(localStorage.getItem('stellarOdysseySettings') || '{}');
        settings.optimizer_htk = best_htk;
        settings.optimizer_htd = best_htd;
        localStorage.setItem('stellarOdysseySettings', JSON.stringify(settings));
    } catch (error) {
        console.error('Optimization error:', error);
    } finally {
        pool.terminate();
    }
```