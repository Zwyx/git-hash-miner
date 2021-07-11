#!/usr/bin/env node
"use strict";
// Hit F5 in VS Code to run the program (see `.vscode/launch.json`)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const os_1 = require("os");
const process_1 = require("process");
const readline_1 = __importDefault(require("readline"));
const worker_threads_1 = require("worker_threads");
const Common_1 = require("./Common");
const startDate = Date.now();
const autoAmend = process_1.argv[2] === "--auto-amend" || process_1.argv[2] === "-a";
const target = autoAmend ? process_1.argv[3] : process_1.argv[2];
if (!target) {
    console.error("Usage: gmr [--auto-amend|-a] <target>");
    (0, process_1.exit)(1);
}
const targetHexMatch = target.match(/^[0-9a-f]+$/);
if (!targetHexMatch) {
    console.error(`Invalid target: '${target}'`);
    (0, process_1.exit)(1);
}
if (target.length >= Common_1.PATTERN_LENGTH) {
    console.error(`Target length is ${target.length}, pattern length is ${Common_1.PATTERN_LENGTH}. This doesn't give enough chance to find the target; the target length should be at least one character shorter than the pattern length. Either choose a smaller target, or tweak the code to change the length of the pattern.`);
    (0, process_1.exit)(1);
}
const stagedFiles = (0, child_process_1.execSync)("git diff --staged --", { encoding: "utf8" });
if (stagedFiles) {
    console.error("The repository contains staged files, which would prevent 'git commit --amend' to work as expected.");
    (0, process_1.exit)(1);
}
const commitObject = (0, child_process_1.execSync)("git cat-file commit HEAD", { encoding: "utf8" });
const matchSignature = commitObject.match(/gpgsig.*-----END PGP SIGNATURE-----/s);
const commitSignature = matchSignature ? matchSignature[0] : null;
const commit = commitSignature
    ? commitObject.replace(`${commitSignature}\n`, "")
    : commitObject;
console.info("Using commit:");
console.info("–".repeat(50));
console.info(`${commit}${"–".repeat(50)}`);
if (commitSignature) {
    console.info("Commit signature has been dropped.");
}
if (autoAmend) {
    console.info("Commit will be automatically amended if target is found.");
}
const matchCommitter = commit.match(/^committer (\w*)( [0-9a-f]+)? <.* (\d{10} [+-]\d{4})$/m);
if (!matchCommitter || matchCommitter.length !== 4) {
    console.error("Can't find committer name and date.");
    (0, process_1.exit)(1);
}
const committerName = matchCommitter[1];
const committerHex = matchCommitter[2] ? matchCommitter[2].substring(1) : "";
const commitDate = matchCommitter[3];
console.info(`Committer name:   ${committerName}`);
console.info(`Committer hex:    ${committerHex ? `${committerHex} (to be replaced)` : "[None]"}`);
console.info(`Commit date:      ${commitDate}`);
const newCommit = commit.replace(new RegExp(`committer ${committerName}${committerHex ? ` ${committerHex}` : ""}`), `committer ${committerName} ${Common_1.PATTERN_PLACEHOLDER}`);
const newCommitSize = newCommit.length - Common_1.PATTERN_PLACEHOLDER.length + Common_1.PATTERN_LENGTH;
const workingCommit = `commit ${newCommitSize}\0${newCommit}`;
const cpusCount = (0, os_1.cpus)().length;
const hexMax = parseInt(`0x${"f".repeat(Common_1.PATTERN_LENGTH)}`, 16);
const hexStep = Math.ceil(hexMax / cpusCount);
const workers = [];
console.info(`\nStart searching for a hash starting with '${target}', using ${cpusCount} worker${cpusCount !== 1 ? "s" : ""}:`);
let found = false;
for (let cpu = 0; cpu < cpusCount; cpu++) {
    const hexStart = cpu * hexStep;
    const hexEnd = (cpu + 1) * hexStep;
    console.info(`  Worker ${cpu} computing from ${(0, Common_1.paddedHex)(hexStart)} to ${(0, Common_1.paddedHex)(hexEnd)}`);
    const worker = new worker_threads_1.Worker(`${__dirname}/worker.js`, {
        workerData: { workingCommit, target, hexStart, hexEnd },
    });
    worker.on("message", ({ hex, hash }) => {
        // Ensure only one worker will have his finding committed
        if (!found) {
            found = true;
            workers.forEach(worker => worker.terminate());
            console.info(`\nFound in ${(Date.now() - startDate) / 1000}s!\n`);
            console.info(`Hex number: ${(0, Common_1.paddedHex)(hex)}`);
            console.info(`New commit hash: ${hash}`);
            console.info("New commit:");
            console.info("–".repeat(50));
            console.info(`${(0, Common_1.genCommit)(newCommit, hex)}${"–".repeat(50)}`);
            const gitCommand = `GIT_COMMITTER_NAME="${committerName} ${(0, Common_1.paddedHex)(hex)}" GIT_COMMITTER_DATE="${commitDate}" git commit --amend --no-edit --no-gpg-sign -c HEAD`;
            console.info("Git command:");
            console.info(`'${gitCommand}'`);
            const amendCommit = () => console.info((0, child_process_1.execSync)(gitCommand, { encoding: "utf8" }));
            if (autoAmend) {
                amendCommit();
            }
            else {
                const readlineInterface = readline_1.default.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
                readlineInterface.question("Amend commit? [y/N] ", answer => {
                    readlineInterface.close();
                    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
                        amendCommit();
                    }
                    else {
                        console.info("Nothing done");
                    }
                });
            }
        }
    });
    worker.on("exit", () => {
        const index = workers.indexOf(worker);
        index >= 0 && workers.splice(index, 1);
        if (!workers.length && !found) {
            console.info("\nNot found :-\\");
        }
    });
    workers.push(worker);
}
//# sourceMappingURL=index.js.map