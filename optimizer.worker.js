import { Optimizer } from "./optimizer.js";
import { Player } from "./player.js";
import { Mob } from "./mob.js";

//Not tested if need this import:
import { CloneModifiers } from "./dataclasses.js";

self.onmessage = async (event) => {
	const { optimizerData, target, htd, htk } = event.data;

	try {
		// Deserialize datas.
		const optimizer = Optimizer.deserialize(optimizerData);

		// Execute opitimize
		const [build, res, win_chance] = optimizer.findBestBuild(
			htd,
			htk,
			target
		);

		// Return result
		self.postMessage({
			build,
			res,
			win_chance,
			htd,
			htk,
		});
	} catch (error) {
		console.error("Worker error:", error);
		self.postMessage({ error: error.message });
	}
};