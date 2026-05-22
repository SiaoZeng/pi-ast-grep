import { StringEnum } from "@earendil-works/pi-ai";
import type { defineTool as DefineToolType } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// Inlined identity so this extension has no runtime dep on a
// specific coding-agent fork (pi-mono vs senpi vs ...).
const defineTool: typeof DefineToolType = (t) => t;

import { runSg, runSgDebugQuery, runSgScan, runSgTestPattern, runSgTestRule } from "./cli.js";
import { CLI_LANGUAGES, detectCliLanguageFromPath } from "./languages.js";
import { getPatternHint } from "./pattern-hints.js";
import {
	renderParseCall,
	renderParseResult,
	renderReplaceCall,
	renderReplaceResult,
	renderScanCall,
	renderScanResult,
	renderSearchCall,
	renderSearchResult,
	renderTestCall,
	renderTestResult,
} from "./render.js";
import { formatReplaceResult, formatSearchResult } from "./result-formatter.js";
import {
	AST_GREP_TEST_MODES,
	type AstGrepTestMode,
	type CliLanguage,
	DEBUG_QUERY_FORMATS,
	type DebugQueryFormat,
	type RunSgDebugQueryOptions,
	type RunSgOptions,
	type RunSgScanOptions,
	type RunSgTestPatternOptions,
	type RunSgTestRuleOptions,
	SG_RESULT_MODES,
	SG_STRICTNESS_LEVELS,
	type SgResult,
	type SgResultMode,
	type SgStrictness,
	type SgTruncationReason,
} from "./types.js";

function isCliLanguage(value: unknown): value is CliLanguage {
	return typeof value === "string" && CLI_LANGUAGES.some((language) => language === value);
}

function invalidLanguageResult(language: unknown): {
	content: Array<{ type: "text"; text: string }>;
	details: undefined;
} {
	return {
		content: [{ type: "text", text: `Unsupported language: ${String(language)}` }],
		details: undefined,
	};
}

function inferCliLanguageFromPaths(paths: string[] | undefined): CliLanguage | null {
	if (!paths || paths.length !== 1) {
		return null;
	}
	return detectCliLanguageFromPath(paths[0] ?? "");
}

const SearchParams = Type.Object({
	pattern: Type.String({
		description: "AST pattern with meta-variables ($VAR, $$$). Must be a complete AST node.",
	}),
	lang: Type.Optional(
		StringEnum(CLI_LANGUAGES, { description: "Target language; auto-detected for single-file paths when omitted" }),
	),
	paths: Type.Optional(
		Type.Array(Type.String(), {
			description: "Paths to search (default: current working directory)",
		}),
	),
	globs: Type.Optional(
		Type.Array(Type.String(), {
			description: "Include/exclude globs (prefix ! to exclude)",
		}),
	),
	context: Type.Optional(Type.Number({ description: "Number of context lines around each match" })),
	maxResults: Type.Optional(Type.Number({ description: "Maximum number of results to return" })),
	resultMode: Type.Optional(StringEnum(SG_RESULT_MODES, { description: "Return full matches or matched files only" })),
});

const ReplaceParams = Type.Object({
	pattern: Type.String({ description: "AST pattern to match" }),
	rewrite: Type.String({ description: "Replacement pattern (can use $VAR from pattern)" }),
	lang: Type.Optional(
		StringEnum(CLI_LANGUAGES, { description: "Target language; auto-detected for single-file paths when omitted" }),
	),
	paths: Type.Optional(Type.Array(Type.String(), { description: "Paths to search" })),
	globs: Type.Optional(Type.Array(Type.String(), { description: "Include/exclude globs" })),
	dryRun: Type.Optional(Type.Boolean({ description: "Preview changes without applying (default: true)" })),
});

const ParseParams = Type.Object({
	pattern: Type.String({ description: "AST pattern query to inspect" }),
	lang: StringEnum(CLI_LANGUAGES, { description: "Target language" }),
	format: Type.Optional(
		StringEnum(DEBUG_QUERY_FORMATS, { description: "Debug output format: pattern, ast, cst, or sexp" }),
	),
	selector: Type.Optional(Type.String({ description: "Optional AST kind selector for sub-pattern extraction" })),
	strictness: Type.Optional(
		StringEnum(SG_STRICTNESS_LEVELS, { description: "Optional ast-grep strictness for query parsing" }),
	),
});

const TestParams = Type.Object({
	mode: StringEnum(AST_GREP_TEST_MODES, { description: "Validation mode: simple pattern or inline YAML rule" }),
	code: Type.String({ description: "Example source code to validate against" }),
	lang: StringEnum(CLI_LANGUAGES, { description: "Target language for example code and pattern mode" }),
	pattern: Type.Optional(Type.String({ description: "AST pattern to validate when mode=pattern" })),
	rule: Type.Optional(Type.String({ description: "Inline YAML ast-grep rule to validate when mode=rule" })),
});

const ScanParams = Type.Object({
	inlineRules: Type.Optional(
		Type.String({ description: "Inline YAML ast-grep rules to execute across repository paths" }),
	),
	ruleFile: Type.Optional(Type.String({ description: "Path to a single ast-grep rule file" })),
	configPath: Type.Optional(Type.String({ description: "Path to sgconfig.yml for project rule discovery" })),
	paths: Type.Optional(
		Type.Array(Type.String(), { description: "Paths to scan (default: current working directory)" }),
	),
	globs: Type.Optional(Type.Array(Type.String(), { description: "Include/exclude globs (prefix ! to exclude)" })),
	context: Type.Optional(Type.Number({ description: "Number of context lines around each match" })),
	includeMetadata: Type.Optional(Type.Boolean({ description: "Include rule metadata from scan output when present" })),
	maxResults: Type.Optional(Type.Number({ description: "Maximum number of results to return" })),
	resultMode: Type.Optional(StringEnum(SG_RESULT_MODES, { description: "Return full matches or matched files only" })),
});

export interface AstGrepSearchDetails {
	pattern: string;
	lang: CliLanguage;
	paths: string[];
	globs?: string[];
	maxResults?: number;
	resultMode: SgResultMode;
	matchedFiles?: string[];
	matches: SgResult["matches"];
	totalMatches: number;
	truncated: boolean;
	truncatedReason?: SgTruncationReason;
	error?: string;
	hint?: string;
}

export interface AstGrepReplaceDetails {
	pattern: string;
	rewrite: string;
	lang: CliLanguage;
	paths: string[];
	globs?: string[];
	dryRun: boolean;
	matches: SgResult["matches"];
	totalMatches: number;
	truncated: boolean;
	truncatedReason?: SgTruncationReason;
	error?: string;
}

export interface AstGrepParseDetails {
	pattern: string;
	lang: CliLanguage;
	format: DebugQueryFormat;
	selector?: string;
	strictness?: SgStrictness;
	output: string;
	error?: string;
}

export interface AstGrepTestDetails {
	mode: AstGrepTestMode;
	codeLineCount: number;
	lang: CliLanguage;
	pattern?: string;
	rule?: string;
	matches: SgResult["matches"];
	totalMatches: number;
	truncated: boolean;
	truncatedReason?: SgTruncationReason;
	error?: string;
	hint?: string;
}

export interface AstGrepScanDetails {
	inlineRules?: string;
	ruleFile?: string;
	configPath?: string;
	paths: string[];
	globs?: string[];
	context?: number;
	includeMetadata: boolean;
	maxResults?: number;
	resultMode: SgResultMode;
	matchedFiles?: string[];
	matches: SgResult["matches"];
	totalMatches: number;
	truncated: boolean;
	truncatedReason?: SgTruncationReason;
	error?: string;
}

export const ast_grep_search = defineTool({
	name: "ast_grep_search",
	label: "AST Grep Search",
	description:
		"Search code patterns across the filesystem using AST-aware matching. " +
		"Use meta-variables: $VAR (single node), $$$ (multiple nodes). " +
		"Patterns must be complete AST nodes (valid code). " +
		"Examples: 'console.log($MSG)', 'def $FUNC($$$):', 'function $NAME($$$) { $$$ }'.",
	promptSnippet: "Search code by AST structure across 25 languages using $VAR and $$$ meta-variables (NOT regex).",
	promptGuidelines: [
		"Use ast_grep_search instead of grep when the pattern depends on code structure (function/class/import/call shape).",
		"Use grep instead of ast_grep_search for plain text or cross-language regex search.",
		"Run multiple ast_grep_search calls in parallel when checking different patterns.",
	],
	parameters: SearchParams,
	async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
		const paths = params.paths && params.paths.length > 0 ? params.paths : [ctx.cwd];
		const inferredLang = inferCliLanguageFromPaths(paths);
		const lang = params.lang ?? inferredLang;
		if (!isCliLanguage(lang)) {
			return {
				content: [
					{
						type: "text",
						text: "Error: lang is required unless exactly one scannable file path allows safe auto-detection",
					},
				],
				details: undefined,
			};
		}

		const options: RunSgOptions = {
			pattern: params.pattern,
			lang,
			paths,
		};
		if (params.globs !== undefined) options.globs = params.globs;
		if (params.context !== undefined) options.context = params.context;
		if (params.maxResults !== undefined) options.maxResults = params.maxResults;
		if (params.resultMode !== undefined) options.resultMode = params.resultMode;
		const result = await runSg(options);

		const text = formatSearchResult(result);
		const hint =
			result.matches.length === 0 && !result.error ? (getPatternHint(params.pattern, lang) ?? undefined) : undefined;
		const finalText = hint ? `${text}\n\n${hint}` : text;

		const details: AstGrepSearchDetails = {
			pattern: params.pattern,
			lang,
			paths,
			resultMode: result.resultMode ?? params.resultMode ?? "matches",
			matches: result.matches,
			totalMatches: result.totalMatches,
			truncated: result.truncated,
		};
		if (params.globs !== undefined) details.globs = params.globs;
		if (params.maxResults !== undefined) details.maxResults = params.maxResults;
		if (result.matchedFiles !== undefined) details.matchedFiles = result.matchedFiles;
		if (result.truncatedReason !== undefined) details.truncatedReason = result.truncatedReason;
		if (result.error !== undefined) details.error = result.error;
		if (hint !== undefined) details.hint = hint;

		return {
			content: [{ type: "text", text: finalText }],
			details,
		};
	},
	renderCall: renderSearchCall,
	renderResult: renderSearchResult,
});

export const ast_grep_replace = defineTool({
	name: "ast_grep_replace",
	label: "AST Grep Replace",
	description:
		"Replace code patterns across the filesystem with AST-aware rewriting. " +
		"Dry-run by default. Use meta-variables in `rewrite` to preserve matched content. " +
		"Example: pattern='console.log($MSG)' rewrite='logger.info($MSG)'.",
	promptSnippet: "Rewrite code by AST pattern across 25 languages. Dry-run by default; pass dryRun=false to apply.",
	promptGuidelines: [
		"Use ast_grep_replace dryRun=true first to preview changes; only set dryRun=false after confirming match list.",
		"Use ast_grep_replace instead of edit when the rewrite spans many files with the same structural pattern.",
	],
	parameters: ReplaceParams,
	executionMode: "sequential",
	async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
		const paths = params.paths && params.paths.length > 0 ? params.paths : [ctx.cwd];
		const inferredLang = inferCliLanguageFromPaths(paths);
		const lang = params.lang ?? inferredLang;
		if (!isCliLanguage(lang)) {
			return {
				content: [
					{
						type: "text",
						text: "Error: lang is required unless exactly one scannable file path allows safe auto-detection",
					},
				],
				details: undefined,
			};
		}

		const dryRun = params.dryRun !== false;
		const options: RunSgOptions = {
			pattern: params.pattern,
			rewrite: params.rewrite,
			lang,
			paths,
			updateAll: !dryRun,
		};
		if (params.globs !== undefined) options.globs = params.globs;
		const result = await runSg(options);

		const text = formatReplaceResult(result, dryRun);

		const details: AstGrepReplaceDetails = {
			pattern: params.pattern,
			rewrite: params.rewrite,
			lang,
			paths,
			dryRun,
			matches: result.matches,
			totalMatches: result.totalMatches,
			truncated: result.truncated,
		};
		if (params.globs !== undefined) details.globs = params.globs;
		if (result.truncatedReason !== undefined) details.truncatedReason = result.truncatedReason;
		if (result.error !== undefined) details.error = result.error;

		return {
			content: [{ type: "text", text }],
			details,
		};
	},
	renderCall: renderReplaceCall,
	renderResult: renderReplaceResult,
});

export const ast_grep_test = defineTool({
	name: "ast_grep_test",
	label: "AST Grep Test",
	description:
		"Validate an ast-grep pattern or inline YAML rule against explicit example code before repository-wide search. " +
		"Use mode=pattern for simple patterns and mode=rule for inline ast-grep YAML rules.",
	promptSnippet: "Validate a structural query against example code before broad search or replace.",
	promptGuidelines: [
		"Use ast_grep_test after ast_gparse when a structural query is still uncertain.",
		"Use mode=pattern for simple ast-grep patterns and mode=rule for relational or composite YAML rules.",
		"Prefer ast_grep_test before repository-wide ast_grep_search or later ast_grep_scan calls.",
	],
	parameters: TestParams,
	async execute(_toolCallId, params) {
		if (!isCliLanguage(params.lang)) {
			return invalidLanguageResult(params.lang);
		}

		const codeLineCount = params.code.length === 0 ? 0 : params.code.split("\n").length;

		if (params.mode === "pattern") {
			if (!params.pattern) {
				return {
					content: [{ type: "text", text: "Error: pattern is required when mode=pattern" }],
					details: {
						mode: params.mode,
						codeLineCount,
						lang: params.lang,
						matches: [],
						totalMatches: 0,
						truncated: false,
						error: "pattern is required when mode=pattern",
					} satisfies AstGrepTestDetails,
				};
			}

			const options: RunSgTestPatternOptions = {
				code: params.code,
				pattern: params.pattern,
				lang: params.lang,
			};
			const result = await runSgTestPattern(options);
			const hint =
				result.matches.length === 0 && !result.error
					? (getPatternHint(params.pattern, params.lang) ?? undefined)
					: undefined;
			const details: AstGrepTestDetails = {
				mode: params.mode,
				codeLineCount,
				lang: params.lang,
				pattern: params.pattern,
				matches: result.matches,
				totalMatches: result.totalMatches,
				truncated: result.truncated,
			};
			if (result.truncatedReason !== undefined) details.truncatedReason = result.truncatedReason;
			if (result.error !== undefined) details.error = result.error;
			if (hint !== undefined) details.hint = hint;
			const text = result.error
				? `Error: ${result.error}`
				: result.matches.length === 0
					? hint
						? `No matches found in example code\n\n${hint}`
						: "No matches found in example code"
					: formatSearchResult(result);
			return { content: [{ type: "text", text }], details };
		}

		if (!params.rule) {
			return {
				content: [{ type: "text", text: "Error: rule is required when mode=rule" }],
				details: {
					mode: params.mode,
					codeLineCount,
					lang: params.lang,
					matches: [],
					totalMatches: 0,
					truncated: false,
					error: "rule is required when mode=rule",
				} satisfies AstGrepTestDetails,
			};
		}

		const options: RunSgTestRuleOptions = {
			code: params.code,
			rule: params.rule,
			lang: params.lang,
		};
		const result = await runSgTestRule(options);
		const details: AstGrepTestDetails = {
			mode: params.mode,
			codeLineCount,
			lang: params.lang,
			rule: params.rule,
			matches: result.matches,
			totalMatches: result.totalMatches,
			truncated: result.truncated,
		};
		if (result.truncatedReason !== undefined) details.truncatedReason = result.truncatedReason;
		if (result.error !== undefined) details.error = result.error;
		const text = result.error
			? `Error: ${result.error}`
			: result.matches.length === 0
				? "No matches found in example code"
				: formatSearchResult(result);
		return { content: [{ type: "text", text }], details };
	},
	renderCall: renderTestCall,
	renderResult: renderTestResult,
});

export const ast_grep_scan = defineTool({
	name: "ast_grep_scan",
	label: "AST Grep Scan",
	description:
		"Run advanced ast-grep rules across repository paths using inline YAML, a rule file, or a project config. " +
		"Use this for relational or composite structural queries that exceed simple pattern search.",
	promptSnippet: "Run advanced ast-grep rules across repository files using inline YAML, rule files, or sgconfig.",
	promptGuidelines: [
		"Use ast_grep_scan instead of ast_grep_search when the query needs relational or composite YAML rules.",
		"Prefer validating complex rules with ast_grep_test before broad repository scans.",
		"Provide exactly one scan source: inlineRules, ruleFile, or configPath.",
	],
	parameters: ScanParams,
	async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
		const sourceCount = [params.inlineRules, params.ruleFile, params.configPath].filter(
			(value) => typeof value === "string" && value.length > 0,
		).length;
		if (sourceCount !== 1) {
			return {
				content: [{ type: "text", text: "Error: exactly one of inlineRules, ruleFile, or configPath is required" }],
				details: {
					paths: params.paths && params.paths.length > 0 ? params.paths : [ctx.cwd],
					includeMetadata: params.includeMetadata === true,
					resultMode: params.resultMode ?? "matches",
					matches: [],
					totalMatches: 0,
					truncated: false,
					error: "exactly one of inlineRules, ruleFile, or configPath is required",
				} satisfies AstGrepScanDetails,
			};
		}

		const paths = params.paths && params.paths.length > 0 ? params.paths : [ctx.cwd];
		const options: RunSgScanOptions = { paths };
		if (params.inlineRules !== undefined) options.inlineRules = params.inlineRules;
		if (params.ruleFile !== undefined) options.ruleFile = params.ruleFile;
		if (params.configPath !== undefined) options.configPath = params.configPath;
		if (params.globs !== undefined) options.globs = params.globs;
		if (params.context !== undefined) options.context = params.context;
		if (params.includeMetadata !== undefined) options.includeMetadata = params.includeMetadata;
		if (params.maxResults !== undefined) options.maxResults = params.maxResults;
		if (params.resultMode !== undefined) options.resultMode = params.resultMode;
		const result = await runSgScan(options);
		const details: AstGrepScanDetails = {
			paths,
			includeMetadata: params.includeMetadata === true,
			resultMode: result.resultMode ?? params.resultMode ?? "matches",
			matches: result.matches,
			totalMatches: result.totalMatches,
			truncated: result.truncated,
		};
		if (params.inlineRules !== undefined) details.inlineRules = params.inlineRules;
		if (params.ruleFile !== undefined) details.ruleFile = params.ruleFile;
		if (params.configPath !== undefined) details.configPath = params.configPath;
		if (params.globs !== undefined) details.globs = params.globs;
		if (params.context !== undefined) details.context = params.context;
		if (params.maxResults !== undefined) details.maxResults = params.maxResults;
		if (result.matchedFiles !== undefined) details.matchedFiles = result.matchedFiles;
		if (result.truncatedReason !== undefined) details.truncatedReason = result.truncatedReason;
		if (result.error !== undefined) details.error = result.error;
		const text = result.error
			? `Error: ${result.error}`
			: result.totalMatches === 0
				? "No matches found"
				: formatSearchResult(result);
		return {
			content: [{ type: "text", text }],
			details,
		};
	},
	renderCall: renderScanCall,
	renderResult: renderScanResult,
});

export const ast_gparse = defineTool({
	name: "ast_gparse",
	label: "AST Grep Parse",
	description:
		"Inspect how ast-grep parses a query pattern using the CLI debug-query surface. " +
		"Useful when a structural search pattern is not matching as expected.",
	promptSnippet: "Inspect an ast-grep query pattern as pattern/AST/CST/S-expression before searching.",
	promptGuidelines: [
		"Use ast_gparse before broad ast_grep_search calls when a structural pattern is uncertain.",
		"Prefer format=ast for named-node debugging, format=cst for punctuation-sensitive debugging, and format=sexp for compact tree inspection.",
	],
	parameters: ParseParams,
	async execute(_toolCallId, params) {
		if (!isCliLanguage(params.lang)) {
			return invalidLanguageResult(params.lang);
		}

		const format = params.format ?? "ast";
		const options: RunSgDebugQueryOptions = {
			pattern: params.pattern,
			lang: params.lang,
			format,
		};
		if (params.selector !== undefined) options.selector = params.selector;
		if (params.strictness !== undefined) options.strictness = params.strictness;
		const result = await runSgDebugQuery(options);

		const details: AstGrepParseDetails = {
			pattern: params.pattern,
			lang: params.lang,
			format,
			output: result.output,
		};
		if (params.selector !== undefined) details.selector = params.selector;
		if (params.strictness !== undefined) details.strictness = params.strictness;
		if (result.error !== undefined) details.error = result.error;

		return {
			content: [{ type: "text", text: result.error ? `Error: ${result.error}` : result.output }],
			details,
		};
	},
	renderCall: renderParseCall,
	renderResult: renderParseResult,
});
