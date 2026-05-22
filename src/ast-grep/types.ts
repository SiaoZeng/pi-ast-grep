import type { CLI_LANGUAGES } from "./languages.js";

export type CliLanguage = (typeof CLI_LANGUAGES)[number];

export const DEBUG_QUERY_FORMATS = ["pattern", "ast", "cst", "sexp"] as const;
export type DebugQueryFormat = (typeof DEBUG_QUERY_FORMATS)[number];

export const SG_STRICTNESS_LEVELS = ["cst", "smart", "ast", "relaxed", "signature", "template"] as const;
export type SgStrictness = (typeof SG_STRICTNESS_LEVELS)[number];

export const AST_GREP_TEST_MODES = ["pattern", "rule"] as const;
export type AstGrepTestMode = (typeof AST_GREP_TEST_MODES)[number];

export interface Position {
	line: number;
	column: number;
}

export interface Range {
	start: Position;
	end: Position;
}

export interface CliMatch {
	text: string;
	range: Range & {
		byteOffset: { start: number; end: number };
	};
	file: string;
	lines: string;
	charCount: { leading: number; trailing: number };
	language: string;
}

export type SgTruncationReason = "max_matches" | "max_output_bytes" | "timeout";

export interface SgResult {
	matches: CliMatch[];
	totalMatches: number;
	truncated: boolean;
	truncatedReason?: SgTruncationReason;
	error?: string;
}

export interface RunSgOptions {
	pattern: string;
	lang: CliLanguage;
	paths?: string[];
	globs?: string[];
	rewrite?: string;
	context?: number;
	updateAll?: boolean;
}

export interface RunSgDebugQueryOptions {
	pattern: string;
	lang: CliLanguage;
	format?: DebugQueryFormat;
	selector?: string;
	strictness?: SgStrictness;
}

export interface SgDebugQueryResult {
	output: string;
	error?: string;
}

export interface RunSgTestPatternOptions {
	code: string;
	pattern: string;
	lang: CliLanguage;
}

export interface RunSgTestRuleOptions {
	code: string;
	rule: string;
	lang: CliLanguage;
}
