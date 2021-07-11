"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.genCommit = exports.paddedHex = exports.PATTERN_PLACEHOLDER = exports.PATTERN_LENGTH = void 0;
exports.PATTERN_LENGTH = 10;
exports.PATTERN_PLACEHOLDER = "git-miner-hex-number";
const paddedHex = (hex) => `${"0".repeat(exports.PATTERN_LENGTH)}${hex.toString(16)}`.substr(hex.toString(16).length, exports.PATTERN_LENGTH);
exports.paddedHex = paddedHex;
const genCommit = (commit, hex) => commit.replace(exports.PATTERN_PLACEHOLDER, (0, exports.paddedHex)(hex));
exports.genCommit = genCommit;
//# sourceMappingURL=Common.js.map