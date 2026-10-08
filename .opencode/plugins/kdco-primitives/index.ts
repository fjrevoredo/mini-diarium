/**
 * Shared primitives for kdco registry plugins.
 *
 * This module provides common utilities extracted from multiple plugin files
 * to eliminate duplication and ensure consistent behavior across plugins.
 *
 * @module kdco-primitives
 */

// Project identification
export { getProjectId } from "./get-project-id"

// Logging
export { logWarn } from "./log-warn"
// Concurrency
export { Mutex } from "./mutex"
// Shell escaping
export { assertShellSafe, escapeAppleScript, escapeBash, escapeBatch } from "./shell"
// Temp directory
export { getTempDir } from "./temp"
// Terminal detection
export { isInsideTmux } from "./terminal-detect"
// Types
export type { OpencodeClient } from "./types"
// Timeout handling
export { TimeoutError, withTimeout } from "./with-timeout"

/**
 * OpenCode V2 loads every entry under `.opencode/plugins/` as a plugin,
 * including a directory that contains an `index` file. This module is a shared
 * utility library, not a plugin, so it exposes a no-op plugin definition to
 * satisfy the V2 loader.
 */
export default {
	id: "kdco.primitives",
	setup() {
		// Intentionally empty: this module only provides shared utilities.
	},
}
