import crypto from "crypto";
import { parentPort, workerData } from "worker_threads";
import { genCommit } from "./common";

const { workingCommit, target, hexStart, hexEnd } = workerData;

for (let hex = hexStart; hex <= hexEnd; hex++) {
	const hash = crypto
		.createHash("sha1")
		.update(genCommit(workingCommit, hex))
		.digest("hex");

	if (hash.startsWith(target)) {
		parentPort && parentPort.postMessage({ hex, hash });
	}
}
