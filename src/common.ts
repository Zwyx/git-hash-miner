export const PATTERN_LENGTH = 10;
export const PATTERN_PLACEHOLDER = "git-miner-hex-number";

export const paddedHex = (hex: number) =>
	`${"0".repeat(PATTERN_LENGTH)}${hex.toString(16)}`.substr(
		hex.toString(16).length,
		PATTERN_LENGTH
	);

export const genCommit = (commit: string, hex: number) =>
	commit.replace(PATTERN_PLACEHOLDER, paddedHex(hex));
