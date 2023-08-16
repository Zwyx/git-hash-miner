#!/usr/bin/env ts-node

// Hit F5 in VS Code to run the program (see `.vscode/launch.json`)

import { execSync } from "child_process";
import { cpus } from "os";
import { argv, exit } from "process";
import readline from "readline";
import { Worker } from "worker_threads";
import {
	PATTERN_LENGTH,
	PATTERN_PLACEHOLDER,
	genCommit,
	paddedHex,
} from "./Common";

const startDate = Date.now();

const autoAmend = argv[2] === "--auto-amend" || argv[2] === "-a";
const target = autoAmend ? argv[3] : argv[2];

if (!target) {
	console.error("Usage: gmr [--auto-amend|-a] <target>");
	exit(1);
}

const targetHexMatch = target.match(/^[0-9a-f]+$/);

if (!targetHexMatch) {
	console.error(`Invalid target: '${target}'`);
	exit(1);
}

if (target.length >= PATTERN_LENGTH) {
	console.error(
		`Target length is ${target.length}, pattern length is ${PATTERN_LENGTH}. This doesn't give enough chance to find the target; the target length should be at least one character shorter than the pattern length. Either choose a smaller target, or tweak the code to change the length of the pattern.`,
	);
	exit(1);
}

const stagedFiles = execSync("git diff --staged --", { encoding: "utf8" });

if (stagedFiles) {
	console.error(
		"The repository contains staged files, which would prevent 'git commit --amend' to work as expected.",
	);
	exit(1);
}

const commitObject = execSync("git cat-file commit HEAD", { encoding: "utf8" });

if (!commitObject.endsWith("\n")) {
	console.error(
		"The commit message doesn't end with a new line. Edit it first, then restart this tool.",
	);
	exit(1);
}

const matchSignature = commitObject.match(
	/gpgsig.*-----END PGP SIGNATURE-----/s,
);

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

const matchCommitter = commit.match(
	/^committer (.*?)( [0-9a-f]+)? <.* (\d{10} [+-]\d{4})$/m,
);

if (!matchCommitter || matchCommitter.length !== 4) {
	console.error("Can't find committer name and date.");
	exit(1);
}

const committerName = matchCommitter[1];
const committerHex = matchCommitter[2] ? matchCommitter[2].substring(1) : "";
const commitDate = matchCommitter[3];

console.info(`Committer name:   ${committerName}`);
console.info(
	`Committer hex:    ${
		committerHex ? `${committerHex} (to be replaced)` : "[None]"
	}`,
);
console.info(`Commit date:      ${commitDate}`);

const newCommit = commit.replace(
	new RegExp(
		`committer ${committerName}${committerHex ? ` ${committerHex}` : ""}`,
	),
	`committer ${committerName} ${PATTERN_PLACEHOLDER}`,
);

const newCommitSize =
	newCommit.length - PATTERN_PLACEHOLDER.length + PATTERN_LENGTH;

const workingCommit = `commit ${newCommitSize}\0${newCommit}`;

const cpusCount = cpus().length;
const hexMax = parseInt(`0x${"f".repeat(PATTERN_LENGTH)}`, 16);
const hexStep = Math.ceil(hexMax / cpusCount);

const workers: Worker[] = [];

console.info(
	`\nStart searching for a hash starting with '${target}', using ${cpusCount} worker${
		cpusCount !== 1 ? "s" : ""
	}:`,
);

let found = false;

for (let cpu = 0; cpu < cpusCount; cpu++) {
	const hexStart = cpu * hexStep;
	const hexEnd = (cpu + 1) * hexStep;

	console.info(
		`  Worker ${cpu} computing from ${paddedHex(hexStart)} to ${paddedHex(
			hexEnd,
		)}`,
	);

	const worker = new Worker(`${__dirname}/worker.js`, {
		workerData: { workingCommit, target, hexStart, hexEnd },
	});

	worker.on("message", ({ hex, hash }) => {
		// Ensure only one worker will have his finding committed
		if (!found) {
			found = true;

			workers.forEach((workerToTerminate) => workerToTerminate.terminate());

			console.info(`\nFound in ${(Date.now() - startDate) / 1000}s!\n`);
			console.info(`Hex number: ${paddedHex(hex)}`);
			console.info(`New commit hash: ${hash}`);
			console.info("New commit:");
			console.info("–".repeat(50));
			console.info(`${genCommit(newCommit, hex)}${"–".repeat(50)}`);

			const gitCommand = `GIT_COMMITTER_NAME="${committerName} ${paddedHex(
				hex,
			)}" GIT_COMMITTER_DATE="${commitDate}" git commit --amend --no-edit --no-gpg-sign -c HEAD`;

			console.info("Git command:");
			console.info(`'${gitCommand}'`);

			const amendCommit = () =>
				console.info(execSync(gitCommand, { encoding: "utf8" }));

			if (autoAmend) {
				amendCommit();
			} else {
				const readlineInterface = readline.createInterface({
					input: process.stdin,
					output: process.stdout,
				});

				readlineInterface.question("Amend commit? [y/N] ", (answer) => {
					readlineInterface.close();

					if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
						amendCommit();
					} else {
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
