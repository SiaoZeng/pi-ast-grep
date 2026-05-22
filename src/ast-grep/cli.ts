import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { getAstGrepPath, getConfiguredSgCliPathError, getSgCliPath } from "./binary-path.js";
import { ensureAstGrepBinary } from "./downloader.js";
import { SearchTimeoutError } from "./errors.js";
import {
	createSgFileListResultFromStdout,
	createSgResultFromStdout,
	createSgResultFromStreamStdout,
} from "./json-output.js";
import { DEFAULT_TIMEOUT_MS, detectCliLanguageFromPath } from "./languages.js";
import { collectProcessOutputByLineLimitWithTimeout, collectProcessOutputWithTimeout } from "./process-timeout.js";
import type {
	CliLanguage,
	RunSgDebugQueryOptions,
	RunSgOptions,
	RunSgScanOptions,
	RunSgTestPatternOptions,
	RunSgTestRuleOptions,
	SgDebugQueryResult,
	SgResult,
} from "./types.js";

const INSTALL_HINT = [
	"ast-grep (sg) binary not found.",
	"",
	"Install options:",
	"  npm install -g @ast-grep/cli",
	"  cargo install ast-grep --locked",
	"  brew install ast-grep",
].join("\n");

const AUTO_DOWNLOAD_FAILED_HINT = [
	"ast-grep CLI binary not found.",
	"",
	"Auto-download failed. Manual install options:",
	"  npm install -g @ast-grep/cli",
	"  cargo install ast-grep --locked",
	"  brew install ast-grep",
].join("\n");

function isEnoentError(err: unknown): boolean {
	const errorCode = typeof err === "object" && err !== null && "code" in err ? err.code : undefined;
	const message = err instanceof Error ? err.message : String(err);
	return errorCode === "ENOENT" || message.includes("ENOENT") || message.includes("not found");
}

function ensureRuleLanguage(rule: string, lang: CliLanguage): string {
	const hasTopLevelLanguage = /^language\s*:/m.test(rule);
	if (hasTopLevelLanguage) {
		return rule;
	}
	return `language: ${lang}\n${rule}`;
}

export function buildSgArgs(
	options: RunSgOptions,
	includeUpdateAll: boolean,
	jsonStyle: "compact" | "stream" = "compact",
): string[] {
	const isWritePass = options.updateAll === true && !includeUpdateAll;
	const lang = options.lang ?? detectCliLanguageFromPath(options.paths?.[0] ?? "") ?? "__MISSING_LANG__";
	const args = ["run", "-p", options.pattern, "--lang", lang];

	if (!isWritePass) {
		if (options.resultMode === "files") {
			args.push("--files-with-matches");
		} else {
			args.push(`--json=${jsonStyle}`);
		}
	}

	if (options.rewrite) {
		args.push("-r", options.rewrite);
		if (includeUpdateAll) {
			args.push("--update-all");
		}
	}

	if (options.context && options.context > 0) {
		args.push("-C", String(options.context));
	}

	if (options.globs) {
		for (const glob of options.globs) {
			args.push("--globs", glob);
		}
	}

	const paths = options.paths && options.paths.length > 0 ? options.paths : ["."];
	args.push("--", ...paths);

	return args;
}

export function buildSgDebugQueryArgs(options: RunSgDebugQueryOptions): string[] {
	const format = options.format ?? "ast";
	const args = ["run", "-p", options.pattern, "--lang", options.lang, `--debug-query=${format}`, "--stdin"];

	if (options.selector) {
		args.push("--selector", options.selector);
	}

	if (options.strictness) {
		args.push("--strictness", options.strictness);
	}

	return args;
}

export function buildSgTestPatternArgs(options: RunSgTestPatternOptions): string[] {
	return ["run", "-p", options.pattern, "--lang", options.lang, "--stdin", "--json=compact"];
}

export function buildSgTestRuleArgs(options: RunSgTestRuleOptions): string[] {
	return ["scan", "--inline-rules", ensureRuleLanguage(options.rule, options.lang), "--stdin", "--json=compact"];
}

export function buildSgScanArgs(options: RunSgScanOptions, jsonStyle: "compact" | "stream" = "compact"): string[] {
	const args = ["scan"];
	if (options.inlineRules !== undefined) {
		args.push("--inline-rules", options.inlineRules);
	} else if (options.ruleFile !== undefined) {
		args.push("--rule", options.ruleFile);
	} else if (options.configPath !== undefined) {
		args.push("--config", options.configPath);
	}
	if (options.resultMode === "files") {
		args.push("--files-with-matches");
	} else {
		args.push(`--json=${jsonStyle}`);
	}
	if (options.includeMetadata) {
		args.push("--include-metadata");
	}
	if (options.context && options.context > 0) {
		args.push("-C", String(options.context));
	}
	if (options.maxResults && options.maxResults > 0) {
		args.push("--max-results", String(options.maxResults));
	}
	if (options.globs) {
		for (const glob of options.globs) {
			args.push("--globs", glob);
		}
	}
	const paths = options.paths && options.paths.length > 0 ? options.paths : ["."];
	args.push("--", ...paths);
	return args;
}

async function spawnSg(cliPath: string, args: string[], timeoutMs: number, stdinText?: string) {
	const proc = spawn(cliPath, args, { stdio: ["pipe", "pipe", "pipe"] });
	if (stdinText !== undefined) {
		proc.stdin?.end(stdinText);
	} else {
		proc.stdin?.end();
	}
	return collectProcessOutputWithTimeout(proc, timeoutMs);
}

async function spawnSgWithLineLimit(
	cliPath: string,
	args: string[],
	timeoutMs: number,
	lineLimit?: number,
	stdinText?: string,
) {
	const proc = spawn(cliPath, args, { stdio: ["pipe", "pipe", "pipe"] });
	if (stdinText !== undefined) {
		proc.stdin?.end(stdinText);
	} else {
		proc.stdin?.end();
	}
	return collectProcessOutputByLineLimitWithTimeout(proc, timeoutMs, lineLimit);
}

function normalizeSgErrorResult(error: string): SgResult {
	return {
		matches: [],
		totalMatches: 0,
		truncated: false,
		error,
	};
}

function createSgResultFromMode(
	stdout: string,
	resultMode: "matches" | "files",
	maxResults?: number,
	totalMatchesOverride?: number,
): SgResult {
	if (resultMode === "files") {
		return createSgFileListResultFromStdout(stdout, maxResults, totalMatchesOverride);
	}
	if (maxResults !== undefined && maxResults > 0) {
		return createSgResultFromStreamStdout(stdout, maxResults, totalMatchesOverride);
	}
	return createSgResultFromStdout(stdout);
}

async function resolveCliPath(): Promise<string | null> {
	const configuredPathError = getConfiguredSgCliPathError();
	if (configuredPathError) {
		return null;
	}

	let cliPath = getSgCliPath();

	if (!cliPath || !existsSync(cliPath)) {
		const downloadedPath = await getAstGrepPath();
		if (downloadedPath && existsSync(downloadedPath)) {
			cliPath = downloadedPath;
		} else {
			return null;
		}
	}

	return cliPath;
}

function resolveInstallOrConfigError(): string {
	return getConfiguredSgCliPathError() ?? INSTALL_HINT;
}

function resolveRunLanguage(options: RunSgOptions): CliLanguage | null {
	if (options.lang) {
		return options.lang;
	}
	if (options.paths && options.paths.length === 1) {
		return detectCliLanguageFromPath(options.paths[0] ?? "");
	}
	return null;
}

export async function runSg(options: RunSgOptions, hasRetriedDownload = false): Promise<SgResult> {
	const resolvedLang = resolveRunLanguage(options);
	if (!resolvedLang) {
		return normalizeSgErrorResult(
			"lang is required unless exactly one scannable file path allows safe auto-detection",
		);
	}

	const shouldSeparateWritePass = !!(options.rewrite && options.updateAll);

	const readOptions = shouldSeparateWritePass
		? { ...options, updateAll: false, lang: resolvedLang }
		: { ...options, lang: resolvedLang };
	const shouldUseStream =
		readOptions.resultMode === "files" || (readOptions.maxResults !== undefined && readOptions.maxResults > 0);
	const args = buildSgArgs(readOptions, !shouldSeparateWritePass, shouldUseStream ? "stream" : "compact");

	const cliPath = await resolveCliPath();
	if (!cliPath) {
		return {
			matches: [],
			totalMatches: 0,
			truncated: false,
			error: resolveInstallOrConfigError(),
		};
	}

	const timeout = DEFAULT_TIMEOUT_MS;

	let stdout: string;
	let stderr: string;
	let exitCode: number;
	let totalLineCountOverride: number | undefined;

	try {
		const output =
			shouldUseStream && readOptions.maxResults !== undefined && readOptions.maxResults > 0
				? await spawnSgWithLineLimit(cliPath, args, timeout, readOptions.maxResults)
				: await spawnSg(cliPath, args, timeout);
		stdout = output.stdout;
		stderr = output.stderr;
		exitCode = output.exitCode;
		totalLineCountOverride =
			"totalLineCount" in output && typeof output.totalLineCount === "number" ? output.totalLineCount : undefined;
	} catch (error) {
		if (error instanceof SearchTimeoutError) {
			return {
				matches: [],
				totalMatches: 0,
				truncated: true,
				truncatedReason: "timeout",
				error: error.message,
			};
		}

		if (isEnoentError(error)) {
			const downloadedPath = await ensureAstGrepBinary();
			if (downloadedPath && !hasRetriedDownload) {
				return runSg(options, true);
			}
			return {
				matches: [],
				totalMatches: 0,
				truncated: false,
				error: AUTO_DOWNLOAD_FAILED_HINT,
			};
		}

		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			matches: [],
			totalMatches: 0,
			truncated: false,
			error: `Failed to spawn ast-grep: ${errorMessage}`,
		};
	}

	if (exitCode !== 0 && stdout.trim() === "") {
		if (stderr.includes("No files found")) {
			return { matches: [], totalMatches: 0, truncated: false, resultMode: options.resultMode ?? "matches" };
		}
		if (stderr.trim()) {
			return normalizeSgErrorResult(stderr.trim());
		}
		return { matches: [], totalMatches: 0, truncated: false, resultMode: options.resultMode ?? "matches" };
	}

	const jsonResult = createSgResultFromMode(
		stdout,
		readOptions.resultMode ?? "matches",
		readOptions.maxResults,
		totalLineCountOverride,
	);

	if (shouldSeparateWritePass && jsonResult.matches.length > 0) {
		const writeArgs = buildSgArgs(options, false, "compact");
		const separatorIndex = writeArgs.lastIndexOf("--");
		if (separatorIndex >= 0) {
			writeArgs.splice(separatorIndex, 0, "--update-all");
		} else {
			writeArgs.push("--update-all");
		}

		try {
			const writeOutput = await spawnSg(cliPath, writeArgs, timeout);
			if (writeOutput.exitCode !== 0) {
				const errorDetail = writeOutput.stderr.trim() || `ast-grep exited with code ${writeOutput.exitCode}`;
				return { ...jsonResult, error: `Replace failed: ${errorDetail}` };
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return { ...jsonResult, error: `Replace failed: ${errorMessage}` };
		}
	}

	return jsonResult;
}

export async function runSgDebugQuery(
	options: RunSgDebugQueryOptions,
	hasRetriedDownload = false,
): Promise<SgDebugQueryResult> {
	const args = buildSgDebugQueryArgs(options);
	const cliPath = await resolveCliPath();
	if (!cliPath) {
		return { output: "", error: resolveInstallOrConfigError() };
	}

	try {
		const output = await spawnSg(cliPath, args, DEFAULT_TIMEOUT_MS, "");
		const stdout = output.stdout.trim();
		const stderr = output.stderr.trim();
		if (stderr.startsWith("Debug ") && stdout.length === 0) {
			return { output: stderr };
		}
		if (output.exitCode !== 0) {
			const error = stderr || `ast-grep exited with code ${output.exitCode}`;
			return { output: stdout, error };
		}
		return { output: stdout };
	} catch (error) {
		if (error instanceof SearchTimeoutError) {
			return { output: "", error: error.message };
		}

		if (isEnoentError(error)) {
			const downloadedPath = await ensureAstGrepBinary();
			if (downloadedPath && !hasRetriedDownload) {
				return runSgDebugQuery(options, true);
			}
			return { output: "", error: AUTO_DOWNLOAD_FAILED_HINT };
		}

		const errorMessage = error instanceof Error ? error.message : String(error);
		return { output: "", error: `Failed to spawn ast-grep: ${errorMessage}` };
	}
}

async function runSgJsonWithStdin(args: string[], code: string, hasRetriedDownload = false): Promise<SgResult> {
	const cliPath = await resolveCliPath();
	if (!cliPath) {
		return {
			matches: [],
			totalMatches: 0,
			truncated: false,
			error: resolveInstallOrConfigError(),
		};
	}

	try {
		const output = await spawnSg(cliPath, args, DEFAULT_TIMEOUT_MS, code);
		const stdout = output.stdout.trim();
		const stderr = output.stderr.trim();
		if (output.exitCode !== 0 && stdout.length === 0) {
			return {
				matches: [],
				totalMatches: 0,
				truncated: false,
				error: stderr || `ast-grep exited with code ${output.exitCode}`,
			};
		}
		const result = createSgResultFromStdout(stdout);
		if (output.exitCode !== 0 && result.error === undefined) {
			result.error = stderr || `ast-grep exited with code ${output.exitCode}`;
		}
		return result;
	} catch (error) {
		if (error instanceof SearchTimeoutError) {
			return {
				matches: [],
				totalMatches: 0,
				truncated: true,
				truncatedReason: "timeout",
				error: error.message,
			};
		}
		if (isEnoentError(error)) {
			const downloadedPath = await ensureAstGrepBinary();
			if (downloadedPath && !hasRetriedDownload) {
				return runSgJsonWithStdin(args, code, true);
			}
			return {
				matches: [],
				totalMatches: 0,
				truncated: false,
				error: AUTO_DOWNLOAD_FAILED_HINT,
			};
		}
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			matches: [],
			totalMatches: 0,
			truncated: false,
			error: `Failed to spawn ast-grep: ${errorMessage}`,
		};
	}
}

export async function runSgTestPattern(options: RunSgTestPatternOptions): Promise<SgResult> {
	return runSgJsonWithStdin(buildSgTestPatternArgs(options), options.code);
}

export async function runSgTestRule(options: RunSgTestRuleOptions): Promise<SgResult> {
	return runSgJsonWithStdin(buildSgTestRuleArgs(options), options.code);
}

export async function runSgScan(options: RunSgScanOptions, hasRetriedDownload = false): Promise<SgResult> {
	const cliPath = await resolveCliPath();
	if (!cliPath) {
		return {
			matches: [],
			totalMatches: 0,
			truncated: false,
			error: resolveInstallOrConfigError(),
		};
	}

	try {
		const shouldUseStream =
			options.resultMode === "files" || (options.maxResults !== undefined && options.maxResults > 0);
		const output =
			shouldUseStream && options.maxResults !== undefined && options.maxResults > 0
				? await spawnSgWithLineLimit(
						cliPath,
						buildSgScanArgs(options, shouldUseStream ? "stream" : "compact"),
						DEFAULT_TIMEOUT_MS,
						options.maxResults,
					)
				: await spawnSg(
						cliPath,
						buildSgScanArgs(options, shouldUseStream ? "stream" : "compact"),
						DEFAULT_TIMEOUT_MS,
					);
		const stdout = output.stdout.trim();
		const stderr = output.stderr.trim();
		const totalLineCountOverride =
			"totalLineCount" in output && typeof output.totalLineCount === "number" ? output.totalLineCount : undefined;
		if (output.exitCode !== 0 && stdout.length === 0) {
			if (stderr.includes("No files found")) {
				return { matches: [], totalMatches: 0, truncated: false, resultMode: options.resultMode ?? "matches" };
			}
			return normalizeSgErrorResult(stderr || `ast-grep exited with code ${output.exitCode}`);
		}
		const result = createSgResultFromMode(
			stdout,
			options.resultMode ?? "matches",
			options.maxResults,
			totalLineCountOverride,
		);
		if (output.exitCode !== 0 && result.error === undefined) {
			result.error = stderr || `ast-grep exited with code ${output.exitCode}`;
		}
		return result;
	} catch (error) {
		if (error instanceof SearchTimeoutError) {
			return {
				matches: [],
				totalMatches: 0,
				truncated: true,
				truncatedReason: "timeout",
				error: error.message,
			};
		}
		if (isEnoentError(error)) {
			const downloadedPath = await ensureAstGrepBinary();
			if (downloadedPath && !hasRetriedDownload) {
				return runSgScan(options, true);
			}
			return {
				matches: [],
				totalMatches: 0,
				truncated: false,
				error: AUTO_DOWNLOAD_FAILED_HINT,
			};
		}
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			matches: [],
			totalMatches: 0,
			truncated: false,
			error: `Failed to spawn ast-grep: ${errorMessage}`,
		};
	}
}

export { AUTO_DOWNLOAD_FAILED_HINT, INSTALL_HINT };
