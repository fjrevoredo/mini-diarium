/**
 * Worktree terminal helpers.
 *
 * The kdco notify plugin imports `canUseCmuxWorkflow` from this module. The
 * full worktree plugin is not vendored into this repository, so this module
 * provides only the cmux detection helper that the notify plugin needs.
 *
 * @module worktree/terminal
 */

export type ResolveExecutable = (command: string) => string | null | undefined
export type EnvironmentVariables = Record<string, string | undefined>

/**
 * Environment variables that cmux exports inside every terminal it manages.
 * Their presence means the process runs inside a cmux workspace.
 */
const CMUX_ENVIRONMENT_KEYS = [
	"CMUX_WORKSPACE_ID",
	"CMUX_SURFACE_ID",
	"CMUX_TAB_ID",
	"CMUX_PANEL_ID",
	"CMUX_SOCKET_PATH",
] as const

/**
 * Check whether the cmux workflow is available.
 *
 * Returns `true` when the process runs inside a cmux-managed terminal (cmux
 * exports `CMUX_*` environment variables) or when the cmux CLI is resolvable
 * on `PATH`.
 *
 * @param env - Environment variables to inspect (defaults to `process.env`)
 * @param resolveExecutable - Resolves a command name to an absolute path
 * @param cmuxCommand - Command name to resolve (defaults to `cmux`)
 */
export function canUseCmuxWorkflow(
	env: EnvironmentVariables = process.env,
	resolveExecutable: ResolveExecutable = (command) => Bun.which(command),
	cmuxCommand: string = "cmux",
): boolean {
	if (CMUX_ENVIRONMENT_KEYS.some((key) => Boolean(env[key]))) {
		return true
	}

	return Boolean(resolveExecutable(cmuxCommand))
}
