"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const worker_threads_1 = require("worker_threads");
const Common_1 = require("./Common");
const { workingCommit, target, hexStart, hexEnd } = worker_threads_1.workerData;
for (let hex = hexStart; hex <= hexEnd; hex++) {
    const hash = crypto_1.default
        .createHash("sha1")
        .update((0, Common_1.genCommit)(workingCommit, hex))
        .digest("hex");
    if (hash.startsWith(target)) {
        worker_threads_1.parentPort && worker_threads_1.parentPort.postMessage({ hex, hash });
    }
}
//# sourceMappingURL=worker.js.map