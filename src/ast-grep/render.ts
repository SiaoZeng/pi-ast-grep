import type { AgentToolResult, Theme, ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import { type Component, Text, truncateToWidth } from "@earendil-works/pi-tui";

import type {
	AstGrepParseDetails,
	AstGrepReplaceDetails,
	AstGrepScanDetails,
	AstGrepSearchDetails,
	AstGrepTestDetails,
} from "./tools.js";
import type {
	AstGrepTestMode,
	CliLanguage,
	CliMatch,
	DebugQueryFormat,
	SgResultMode,
	SgStrictness,
	SgTruncationReason,
} from "./types.js";

interface RenderContext {
	lastComponent: Component | undefined;
	isError?: boolean;
}

interface AstGrepSearchCallArgs {
	pattern?: string;
	lang?: string;
	paths?: string[];
	globs?: string[];
	context?: number;
	maxResults?: number;
	resultMode?: string;
}

interface AstGrepReplaceCallArgs {
	pattern?: string;
	rewrite?: string;
	lang?: string;
	paths?: string[];
	globs?: string[];
	dryRun?: boolean;
}

interface AstGrepParseCallArgs {
	pattern?: string;
	lang?: string;
	format?: string;
	selector?: string;
	strictness?: string;
}

interface AstGrepTestCallArgs {
	mode?: string;
	code?: string;
	lang?: string;
	pattern?: string;
	rule?: string;
}

interface AstGrepScanCallArgs {
	inlineRules?: string;
	ruleFile?: string;
	configPath?: string;
	paths?: string[];
	globs?: string[];
	context?: number;
	includeMetadata?: boolean;
	maxResults?: number;
	resultMode?: string;
}

interface MatchGroup {
	file: string;
	matches: CliMatch[];
}

const MAX_COLLAPSED_ERROR_LENGTH = 180;
const MAX_COLLAPSED_FILES = 3;
const MAX_EXPANDED_MATCHES = 15;
const MAX_PATH_LENGTH = 42;
const MAX_SNIPPET_LENGTH = 160;
const MAX_COLLAPSED_PARSE_LINES = 4;
const MAX_EXPANDED_PARSE_LINES = 60;

function getTextContent<TDetails>(result: AgentToolResult<TDetails>): string {
	return result.content.find((content) => content.type === "text")?.text ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function readString(value: unknown, key: string): string | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const property = value[key];
	return typeof property === "string" ? property : undefined;
}

function readNumber(value: unknown, key: string): number | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const property = value[key];
	return typeof property === "number" ? property : undefined;
}

function readBoolean(value: unknown, key: string): boolean | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const property = value[key];
	return typeof property === "boolean" ? property : undefined;
}

function readStringArray(value: unknown, key: string): string[] | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const property = value[key];
	return Array.isArray(property) && property.every((item) => typeof item === "string") ? property : undefined;
}

function isCliLanguage(value: unknown): value is CliLanguage {
	return typeof value === "string";
}

function isDebugQueryFormat(value: unknown): value is DebugQueryFormat {
	return value === "pattern" || value === "ast" || value === "cst" || value === "sexp";
}

function isStrictness(value: unknown): value is SgStrictness {
	return (
		value === "cst" ||
		value === "smart" ||
		value === "ast" ||
		value === "relaxed" ||
		value === "signature" ||
		value === "template"
	);
}

function isTestMode(value: unknown): value is AstGrepTestMode {
	return value === "pattern" || value === "rule";
}

function isTruncationReason(value: unknown): value is SgTruncationReason {
	return value === "max_matches" || value === "max_output_bytes" || value === "timeout";
}

function isResultMode(value: unknown): value is SgResultMode {
	return value === "matches" || value === "files";
}

function isCliMatch(value: unknown): value is CliMatch {
	if (!isRecord(value)) {
		return false;
	}

	const range = value["range"];
	if (!isRecord(range)) {
		return false;
	}

	const start = range["start"];
	if (!isRecord(start)) {
		return false;
	}

	return (
		typeof value["file"] === "string" &&
		typeof value["lines"] === "string" &&
		typeof value["text"] === "string" &&
		typeof start["line"] === "number" &&
		typeof start["column"] === "number"
	);
}

function isCliMatchArray(value: unknown): value is CliMatch[] {
	return Array.isArray(value) && value.every(isCliMatch);
}

function getSearchCallArgs(args: unknown): AstGrepSearchCallArgs | undefined {
	if (!isRecord(args)) {
		return undefined;
	}

	const result: AstGrepSearchCallArgs = {};
	const pattern = readString(args, "pattern");
	const lang = readString(args, "lang");
	const paths = readStringArray(args, "paths");
	const globs = readStringArray(args, "globs");
	const context = readNumber(args, "context");
	const maxResults = readNumber(args, "maxResults");
	const resultMode = readString(args, "resultMode");
	if (pattern !== undefined) result.pattern = pattern;
	if (lang !== undefined) result.lang = lang;
	if (paths !== undefined) result.paths = paths;
	if (globs !== undefined) result.globs = globs;
	if (context !== undefined) result.context = context;
	if (maxResults !== undefined) result.maxResults = maxResults;
	if (resultMode !== undefined) result.resultMode = resultMode;
	return result;
}

function getReplaceCallArgs(args: unknown): AstGrepReplaceCallArgs | undefined {
	if (!isRecord(args)) {
		return undefined;
	}

	const result: AstGrepReplaceCallArgs = {};
	const pattern = readString(args, "pattern");
	const rewrite = readString(args, "rewrite");
	const lang = readString(args, "lang");
	const paths = readStringArray(args, "paths");
	const globs = readStringArray(args, "globs");
	const dryRun = readBoolean(args, "dryRun");
	if (pattern !== undefined) result.pattern = pattern;
	if (rewrite !== undefined) result.rewrite = rewrite;
	if (lang !== undefined) result.lang = lang;
	if (paths !== undefined) result.paths = paths;
	if (globs !== undefined) result.globs = globs;
	if (dryRun !== undefined) result.dryRun = dryRun;
	return result;
}

function getParseCallArgs(args: unknown): AstGrepParseCallArgs | undefined {
	if (!isRecord(args)) {
		return undefined;
	}

	const result: AstGrepParseCallArgs = {};
	const pattern = readString(args, "pattern");
	const lang = readString(args, "lang");
	const format = readString(args, "format");
	const selector = readString(args, "selector");
	const strictness = readString(args, "strictness");
	if (pattern !== undefined) result.pattern = pattern;
	if (lang !== undefined) result.lang = lang;
	if (format !== undefined) result.format = format;
	if (selector !== undefined) result.selector = selector;
	if (strictness !== undefined) result.strictness = strictness;
	return result;
}

function getTestCallArgs(args: unknown): AstGrepTestCallArgs | undefined {
	if (!isRecord(args)) {
		return undefined;
	}

	const result: AstGrepTestCallArgs = {};
	const mode = readString(args, "mode");
	const code = readString(args, "code");
	const lang = readString(args, "lang");
	const pattern = readString(args, "pattern");
	const rule = readString(args, "rule");
	if (mode !== undefined) result.mode = mode;
	if (code !== undefined) result.code = code;
	if (lang !== undefined) result.lang = lang;
	if (pattern !== undefined) result.pattern = pattern;
	if (rule !== undefined) result.rule = rule;
	return result;
}

function getScanCallArgs(args: unknown): AstGrepScanCallArgs | undefined {
	if (!isRecord(args)) {
		return undefined;
	}

	const result: AstGrepScanCallArgs = {};
	const inlineRules = readString(args, "inlineRules");
	const ruleFile = readString(args, "ruleFile");
	const configPath = readString(args, "configPath");
	const paths = readStringArray(args, "paths");
	const globs = readStringArray(args, "globs");
	const context = readNumber(args, "context");
	const includeMetadata = readBoolean(args, "includeMetadata");
	const maxResults = readNumber(args, "maxResults");
	const resultMode = readString(args, "resultMode");
	if (inlineRules !== undefined) result.inlineRules = inlineRules;
	if (ruleFile !== undefined) result.ruleFile = ruleFile;
	if (configPath !== undefined) result.configPath = configPath;
	if (paths !== undefined) result.paths = paths;
	if (globs !== undefined) result.globs = globs;
	if (context !== undefined) result.context = context;
	if (includeMetadata !== undefined) result.includeMetadata = includeMetadata;
	if (maxResults !== undefined) result.maxResults = maxResults;
	if (resultMode !== undefined) result.resultMode = resultMode;
	return result;
}

function isSearchDetails(value: unknown): value is AstGrepSearchDetails {
	if (!isRecord(value)) {
		return false;
	}

	const truncatedReason = value["truncatedReason"];
	const error = value["error"];
	const hint = value["hint"];
	const matchedFiles = value["matchedFiles"];
	const resultMode = value["resultMode"];
	return (
		typeof value["pattern"] === "string" &&
		isCliLanguage(value["lang"]) &&
		Array.isArray(value["paths"]) &&
		value["paths"].every((item) => typeof item === "string") &&
		isResultMode(resultMode) &&
		(matchedFiles === undefined ||
			(Array.isArray(matchedFiles) && matchedFiles.every((item) => typeof item === "string"))) &&
		isCliMatchArray(value["matches"]) &&
		typeof value["totalMatches"] === "number" &&
		typeof value["truncated"] === "boolean" &&
		(truncatedReason === undefined || isTruncationReason(truncatedReason)) &&
		(error === undefined || typeof error === "string") &&
		(hint === undefined || typeof hint === "string")
	);
}

function isReplaceDetails(value: unknown): value is AstGrepReplaceDetails {
	if (!isRecord(value)) {
		return false;
	}

	const truncatedReason = value["truncatedReason"];
	const error = value["error"];
	return (
		typeof value["pattern"] === "string" &&
		typeof value["rewrite"] === "string" &&
		isCliLanguage(value["lang"]) &&
		Array.isArray(value["paths"]) &&
		value["paths"].every((item) => typeof item === "string") &&
		typeof value["dryRun"] === "boolean" &&
		isCliMatchArray(value["matches"]) &&
		typeof value["totalMatches"] === "number" &&
		typeof value["truncated"] === "boolean" &&
		(truncatedReason === undefined || isTruncationReason(truncatedReason)) &&
		(error === undefined || typeof error === "string")
	);
}

function isParseDetails(value: unknown): value is AstGrepParseDetails {
	if (!isRecord(value)) {
		return false;
	}

	const error = value["error"];
	const selector = value["selector"];
	const strictness = value["strictness"];
	return (
		typeof value["pattern"] === "string" &&
		isCliLanguage(value["lang"]) &&
		isDebugQueryFormat(value["format"]) &&
		typeof value["output"] === "string" &&
		(error === undefined || typeof error === "string") &&
		(selector === undefined || typeof selector === "string") &&
		(strictness === undefined || isStrictness(strictness))
	);
}

function isTestDetails(value: unknown): value is AstGrepTestDetails {
	if (!isRecord(value)) {
		return false;
	}

	const truncatedReason = value["truncatedReason"];
	const error = value["error"];
	const hint = value["hint"];
	const pattern = value["pattern"];
	const rule = value["rule"];
	return (
		isTestMode(value["mode"]) &&
		typeof value["codeLineCount"] === "number" &&
		isCliLanguage(value["lang"]) &&
		(pattern === undefined || typeof pattern === "string") &&
		(rule === undefined || typeof rule === "string") &&
		isCliMatchArray(value["matches"]) &&
		typeof value["totalMatches"] === "number" &&
		typeof value["truncated"] === "boolean" &&
		(truncatedReason === undefined || isTruncationReason(truncatedReason)) &&
		(error === undefined || typeof error === "string") &&
		(hint === undefined || typeof hint === "string")
	);
}

function isScanDetails(value: unknown): value is AstGrepScanDetails {
	if (!isRecord(value)) {
		return false;
	}

	const truncatedReason = value["truncatedReason"];
	const error = value["error"];
	const globs = value["globs"];
	const context = value["context"];
	const maxResults = value["maxResults"];
	const matchedFiles = value["matchedFiles"];
	const resultMode = value["resultMode"];
	const inlineRules = value["inlineRules"];
	const ruleFile = value["ruleFile"];
	const configPath = value["configPath"];
	return (
		(inlineRules === undefined || typeof inlineRules === "string") &&
		(ruleFile === undefined || typeof ruleFile === "string") &&
		(configPath === undefined || typeof configPath === "string") &&
		Array.isArray(value["paths"]) &&
		value["paths"].every((item) => typeof item === "string") &&
		(globs === undefined || (Array.isArray(globs) && globs.every((item) => typeof item === "string"))) &&
		(context === undefined || typeof context === "number") &&
		(maxResults === undefined || typeof maxResults === "number") &&
		isResultMode(resultMode) &&
		(matchedFiles === undefined ||
			(Array.isArray(matchedFiles) && matchedFiles.every((item) => typeof item === "string"))) &&
		typeof value["includeMetadata"] === "boolean" &&
		isCliMatchArray(value["matches"]) &&
		typeof value["totalMatches"] === "number" &&
		typeof value["truncated"] === "boolean" &&
		(truncatedReason === undefined || isTruncationReason(truncatedReason)) &&
		(error === undefined || typeof error === "string")
	);
}

function reuseText(context: RenderContext): Text {
	const text = context.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
	return text;
}

function truncateMessage(message: string): string {
	if (message.length <= MAX_COLLAPSED_ERROR_LENGTH) {
		return message;
	}

	return `${message.slice(0, MAX_COLLAPSED_ERROR_LENGTH - 1)}…`;
}

function shortenPath(path: string): string {
	const normalizedPath = path.replace(/\\/g, "/");
	const homeDirectory = process.env["HOME"]?.replace(/\\/g, "/");
	const displayPath =
		homeDirectory && normalizedPath.startsWith(homeDirectory)
			? `~${normalizedPath.slice(homeDirectory.length)}`
			: normalizedPath;

	if (displayPath.length <= MAX_PATH_LENGTH) {
		return displayPath || ".";
	}

	return `…${displayPath.slice(-(MAX_PATH_LENGTH - 1))}`;
}

function formatPaths(paths: string[] | undefined): string {
	if (!paths || paths.length === 0) {
		return ".";
	}

	const [firstPath, ...remainingPaths] = paths;
	const suffix = remainingPaths.length > 0 ? ` +${remainingPaths.length}` : "";
	return `${shortenPath(firstPath ?? ".")}${suffix}`;
}

function formatGlobBadge(globs: string[] | undefined, theme: Theme): string {
	if (!globs || globs.length === 0) {
		return "";
	}

	const [firstGlob, ...remainingGlobs] = globs;
	const suffix = remainingGlobs.length > 0 ? ` +${remainingGlobs.length}` : "";
	return theme.fg("dim", ` [glob ${firstGlob ?? ""}${suffix}]`);
}

function formatSearchBadges(args: AstGrepSearchCallArgs | undefined, theme: Theme): string {
	let badges = "";
	if (args?.lang) {
		badges += theme.fg("dim", ` [${args.lang}]`);
	}
	badges += formatGlobBadge(args?.globs, theme);
	if (args?.context !== undefined) {
		badges += theme.fg("dim", ` [context ${args.context}]`);
	}
	if (args?.maxResults !== undefined) {
		badges += theme.fg("dim", ` [max ${args.maxResults}]`);
	}
	if (args?.resultMode) {
		badges += theme.fg("dim", ` [${args.resultMode}]`);
	}
	return badges;
}

function formatReplaceBadges(args: AstGrepReplaceCallArgs | undefined, theme: Theme): string {
	let badges = "";
	if (args?.lang) {
		badges += theme.fg("dim", ` [${args.lang}]`);
	}
	badges += formatGlobBadge(args?.globs, theme);
	if (args?.dryRun !== false) {
		badges += theme.fg("warning", " [dry-run]");
	}
	return badges;
}

function formatParseBadges(args: AstGrepParseCallArgs | undefined, theme: Theme): string {
	let badges = "";
	if (args?.lang) {
		badges += theme.fg("dim", ` [${args.lang}]`);
	}
	if (args?.format) {
		badges += theme.fg("dim", ` [${args.format}]`);
	}
	if (args?.selector) {
		badges += theme.fg("dim", ` [selector ${args.selector}]`);
	}
	if (args?.strictness) {
		badges += theme.fg("dim", ` [strictness ${args.strictness}]`);
	}
	return badges;
}

function formatTestBadges(args: AstGrepTestCallArgs | undefined, theme: Theme): string {
	let badges = "";
	if (args?.mode) {
		badges += theme.fg("dim", ` [${args.mode}]`);
	}
	if (args?.lang) {
		badges += theme.fg("dim", ` [${args.lang}]`);
	}
	if (args?.code) {
		const lineCount = args.code.length === 0 ? 0 : args.code.split("\n").length;
		badges += theme.fg("dim", ` [${lineCount} lines]`);
	}
	return badges;
}

function formatScanBadges(args: AstGrepScanCallArgs | undefined, theme: Theme): string {
	let badges = "";
	if (args?.ruleFile) {
		badges += theme.fg("dim", ` [rule-file ${args.ruleFile}]`);
	}
	if (args?.configPath) {
		badges += theme.fg("dim", ` [config ${args.configPath}]`);
	}
	badges += formatGlobBadge(args?.globs, theme);
	if (args?.context !== undefined) {
		badges += theme.fg("dim", ` [context ${args.context}]`);
	}
	if (args?.includeMetadata) {
		badges += theme.fg("dim", " [metadata]");
	}
	if (args?.maxResults !== undefined) {
		badges += theme.fg("dim", ` [max ${args.maxResults}]`);
	}
	if (args?.resultMode) {
		badges += theme.fg("dim", ` [${args.resultMode}]`);
	}
	return badges;
}

function formatTruncationReason(reason: SgTruncationReason | undefined): string {
	if (reason === "max_matches") {
		return "match limit reached";
	}
	if (reason === "max_output_bytes") {
		return "output exceeded 1MB limit";
	}
	if (reason === "timeout") {
		return "search timed out";
	}
	return "results truncated";
}

function formatTruncationSuffix(
	details: { truncated: boolean; truncatedReason?: SgTruncationReason },
	theme: Theme,
): string {
	if (!details.truncated) {
		return "";
	}

	return ` ${theme.fg("warning", `[truncated: ${formatTruncationReason(details.truncatedReason)}]`)}`;
}

function formatTruncationBanner(
	details: { truncated: boolean; truncatedReason?: SgTruncationReason },
	theme: Theme,
): string {
	if (!details.truncated) {
		return "";
	}

	return `\n${theme.fg("warning", `[Truncated: ${formatTruncationReason(details.truncatedReason)}]`)}`;
}

function formatMatchLine(match: CliMatch): string {
	const line = match.lines.trim();
	return line.length > 0 ? line : match.text.trim();
}

function formatPosition(match: CliMatch): string {
	return `${match.range.start.line + 1}:${match.range.start.column + 1}`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

function groupMatchesByFile(matches: CliMatch[]): MatchGroup[] {
	const groups: MatchGroup[] = [];
	const indexes = new Map<string, number>();

	for (const match of matches) {
		const existingIndex = indexes.get(match.file);
		if (existingIndex !== undefined) {
			groups[existingIndex]?.matches.push(match);
			continue;
		}

		indexes.set(match.file, groups.length);
		groups.push({ file: match.file, matches: [match] });
	}

	return groups;
}

function formatMatchSummary(totalMatches: number, fileCount: number, theme: Theme): string {
	return (
		theme.fg("success", pluralize(totalMatches, "match", "matches")) +
		theme.fg("muted", ` • ${pluralize(fileCount, "file")}`)
	);
}

function formatReplacementSummary(details: AstGrepReplaceDetails, fileCount: number, theme: Theme): string {
	const replacements = pluralize(details.totalMatches, "replacement");
	if (details.dryRun) {
		return (
			theme.fg("warning", `[DRY RUN] ${replacements} previewed`) +
			theme.fg("muted", ` • ${pluralize(fileCount, "file")}`)
		);
	}

	return theme.fg("success", `Applied ${replacements}`) + theme.fg("muted", ` • ${pluralize(fileCount, "file")}`);
}

function formatCollapsedMatchGroups(groups: MatchGroup[], theme: Theme): string {
	const lines: string[] = [];
	for (const group of groups.slice(0, MAX_COLLAPSED_FILES)) {
		lines.push(
			theme.fg("muted", `  ${shortenPath(group.file)} (${pluralize(group.matches.length, "match", "matches")})`),
		);
	}

	if (groups.length > MAX_COLLAPSED_FILES) {
		lines.push(theme.fg("dim", `  … ${groups.length - MAX_COLLAPSED_FILES} more files`));
	}

	return lines.length > 0 ? `\n${lines.join("\n")}` : "";
}

function formatExpandedMatches(matches: CliMatch[], totalMatches: number, theme: Theme): string {
	const groups = groupMatchesByFile(matches);
	const lines: string[] = [];
	let renderedMatches = 0;

	for (const group of groups) {
		if (renderedMatches >= MAX_EXPANDED_MATCHES) {
			break;
		}

		lines.push(theme.fg("accent", shortenPath(group.file)));
		for (const match of group.matches) {
			if (renderedMatches >= MAX_EXPANDED_MATCHES) {
				break;
			}

			const position = theme.fg("muted", formatPosition(match));
			const snippet = theme.fg("toolOutput", truncateToWidth(formatMatchLine(match), MAX_SNIPPET_LENGTH));
			lines.push(`  ${position}  ${snippet}`);
			renderedMatches++;
		}
	}

	if (totalMatches > renderedMatches) {
		lines.push(theme.fg("dim", `… ${totalMatches - renderedMatches} more matches not shown`));
	}

	return lines.length > 0 ? `\n\n${lines.join("\n")}` : "";
}

function formatFallbackResult<TDetails>(result: AgentToolResult<TDetails>, theme: Theme, isError = false): string {
	const output = getTextContent(result).trim();
	if (isError && output.length > 0) {
		return theme.fg("error", `Error: ${truncateMessage(output)}`);
	}
	return output.length > 0 ? theme.fg("toolOutput", output) : theme.fg("dim", "No output");
}

function formatCollapsedParseOutput(output: string, theme: Theme): string {
	const lines = output.split("\n").filter((line) => line.length > 0);
	const preview = lines.slice(0, MAX_COLLAPSED_PARSE_LINES).map((line) => theme.fg("toolOutput", line));
	if (lines.length > MAX_COLLAPSED_PARSE_LINES) {
		preview.push(theme.fg("dim", `… ${lines.length - MAX_COLLAPSED_PARSE_LINES} more lines`));
	}
	return preview.length > 0 ? `\n${preview.join("\n")}` : "";
}

function formatExpandedParseOutput(output: string, theme: Theme): string {
	const lines = output.split("\n");
	const preview = lines.slice(0, MAX_EXPANDED_PARSE_LINES).map((line) => theme.fg("toolOutput", line));
	if (lines.length > MAX_EXPANDED_PARSE_LINES) {
		preview.push(theme.fg("dim", `… ${lines.length - MAX_EXPANDED_PARSE_LINES} more lines`));
	}
	return preview.length > 0 ? `\n\n${preview.join("\n")}` : "";
}

function formatSearchResultText(
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	isError: boolean | undefined,
): string {
	const details = isSearchDetails(result.details) ? result.details : undefined;
	if (!details) {
		return formatFallbackResult(result, theme, isError);
	}

	if (details.error) {
		return theme.fg("error", `Error: ${truncateMessage(details.error)}`);
	}

	if (details.totalMatches === 0) {
		let text = theme.fg("dim", "No matches found");
		if (details.hint) {
			text += `\n${theme.fg("muted", details.hint)}`;
		}
		return text;
	}

	if (details.resultMode === "files") {
		const files = details.matchedFiles ?? [];
		const summary = theme.fg("success", pluralize(details.totalMatches, "file", "files"));
		const lines = files.slice(0, MAX_COLLAPSED_FILES).map((file) => theme.fg("muted", `  ${shortenPath(file)}`));
		if (files.length > MAX_COLLAPSED_FILES) {
			lines.push(theme.fg("dim", `  … ${files.length - MAX_COLLAPSED_FILES} more files`));
		}
		return `${summary}${formatTruncationSuffix(details, theme)}${lines.length > 0 ? `\n${lines.join("\n")}` : ""}`;
	}

	const groups = groupMatchesByFile(details.matches);
	const summary = formatMatchSummary(details.totalMatches, groups.length, theme);
	if (!options.expanded) {
		return `${summary}${formatTruncationSuffix(details, theme)}${formatCollapsedMatchGroups(groups, theme)}`;
	}

	return `${summary}${formatTruncationBanner(details, theme)}${formatExpandedMatches(details.matches, details.totalMatches, theme)}`;
}

function formatReplaceResultText(
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	isError: boolean | undefined,
): string {
	const details = isReplaceDetails(result.details) ? result.details : undefined;
	if (!details) {
		return formatFallbackResult(result, theme, isError);
	}

	if (details.error) {
		return theme.fg("error", `Error: ${truncateMessage(details.error)}`);
	}

	if (details.totalMatches === 0) {
		return theme.fg("dim", "No matches found to replace");
	}

	const groups = groupMatchesByFile(details.matches);
	const summary = formatReplacementSummary(details, groups.length, theme);

	if (!options.expanded) {
		return `${summary}${formatTruncationSuffix(details, theme)}${formatCollapsedMatchGroups(groups, theme)}`;
	}

	return `${summary}${formatTruncationBanner(details, theme)}${formatExpandedMatches(details.matches, details.totalMatches, theme)}`;
}

function formatParseResultText(
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	isError: boolean | undefined,
): string {
	const details = isParseDetails(result.details) ? result.details : undefined;
	if (!details) {
		return formatFallbackResult(result, theme, isError);
	}

	if (details.error) {
		return theme.fg("error", `Error: ${truncateMessage(details.error)}`);
	}

	if (details.output.trim().length === 0) {
		return theme.fg("dim", "No debug output");
	}

	const lineCount = details.output.split("\n").length;
	const summary =
		theme.fg("success", `query ${details.format} ready`) + theme.fg("muted", ` • ${pluralize(lineCount, "line")}`);

	if (!options.expanded) {
		return `${summary}${formatCollapsedParseOutput(details.output, theme)}`;
	}

	return `${summary}${formatExpandedParseOutput(details.output, theme)}`;
}

function formatCollapsedTestMatches(matches: CliMatch[], totalMatches: number, theme: Theme): string {
	const lines: string[] = [];
	for (const match of matches.slice(0, MAX_COLLAPSED_FILES)) {
		lines.push(
			theme.fg(
				"muted",
				`  ${formatPosition(match)}  ${truncateToWidth(formatMatchLine(match), MAX_SNIPPET_LENGTH)}`,
			),
		);
	}
	if (totalMatches > MAX_COLLAPSED_FILES) {
		lines.push(theme.fg("dim", `  … ${totalMatches - MAX_COLLAPSED_FILES} more matches`));
	}
	return lines.length > 0 ? `\n${lines.join("\n")}` : "";
}

function formatExpandedTestMatches(matches: CliMatch[], totalMatches: number, theme: Theme): string {
	const lines: string[] = [];
	for (const match of matches.slice(0, MAX_EXPANDED_MATCHES)) {
		lines.push(
			`${theme.fg("muted", formatPosition(match))}  ${theme.fg("toolOutput", truncateToWidth(formatMatchLine(match), MAX_SNIPPET_LENGTH))}`,
		);
	}
	if (totalMatches > MAX_EXPANDED_MATCHES) {
		lines.push(theme.fg("dim", `… ${totalMatches - MAX_EXPANDED_MATCHES} more matches not shown`));
	}
	return lines.length > 0 ? `\n\n${lines.join("\n")}` : "";
}

function formatTestResultText(
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	isError: boolean | undefined,
): string {
	const details = isTestDetails(result.details) ? result.details : undefined;
	if (!details) {
		return formatFallbackResult(result, theme, isError);
	}

	if (details.error) {
		return theme.fg("error", `Error: ${truncateMessage(details.error)}`);
	}

	if (details.totalMatches === 0) {
		let text = theme.fg("dim", "No matches found in example code");
		if (details.hint) {
			text += `\n${theme.fg("muted", details.hint)}`;
		}
		return text;
	}

	const summary =
		theme.fg("success", pluralize(details.totalMatches, "match", "matches")) +
		theme.fg("muted", ` • example code • ${details.mode}`);
	if (!options.expanded) {
		return `${summary}${formatTruncationSuffix(details, theme)}${formatCollapsedTestMatches(details.matches, details.totalMatches, theme)}`;
	}
	return `${summary}${formatTruncationBanner(details, theme)}${formatExpandedTestMatches(details.matches, details.totalMatches, theme)}`;
}

function formatScanResultText(
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	isError: boolean | undefined,
): string {
	const details = isScanDetails(result.details) ? result.details : undefined;
	if (!details) {
		return formatFallbackResult(result, theme, isError);
	}

	if (details.error) {
		return theme.fg("error", `Error: ${truncateMessage(details.error)}`);
	}

	if (details.totalMatches === 0) {
		return theme.fg("dim", "No matches found");
	}

	if (details.resultMode === "files") {
		const files = details.matchedFiles ?? [];
		const summary = theme.fg("success", pluralize(details.totalMatches, "file", "files"));
		const lines = files.slice(0, MAX_COLLAPSED_FILES).map((file) => theme.fg("muted", `  ${shortenPath(file)}`));
		if (files.length > MAX_COLLAPSED_FILES) {
			lines.push(theme.fg("dim", `  … ${files.length - MAX_COLLAPSED_FILES} more files`));
		}
		return `${summary}${formatTruncationSuffix(details, theme)}${lines.length > 0 ? `\n${lines.join("\n")}` : ""}`;
	}

	const groups = groupMatchesByFile(details.matches);
	const summary = formatMatchSummary(details.totalMatches, groups.length, theme);
	if (!options.expanded) {
		return `${summary}${formatTruncationSuffix(details, theme)}${formatCollapsedMatchGroups(groups, theme)}`;
	}
	return `${summary}${formatTruncationBanner(details, theme)}${formatExpandedMatches(details.matches, details.totalMatches, theme)}`;
}

export function renderSearchCall(args: unknown, theme: Theme, context: RenderContext): Text {
	const text = reuseText(context);
	const callArgs = getSearchCallArgs(args);
	const pattern = callArgs?.pattern ?? "";
	const paths = formatPaths(callArgs?.paths);
	text.setText(
		theme.fg("toolTitle", theme.bold("ast_grep_search ")) +
			theme.fg("accent", `/${pattern}/`) +
			theme.fg("toolOutput", ` in ${paths}`) +
			formatSearchBadges(callArgs, theme),
	);
	return text;
}

export function renderSearchResult(
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	context: RenderContext,
): Text {
	const text = reuseText(context);
	text.setText(formatSearchResultText(result, options, theme, context.isError));
	return text;
}

export function renderReplaceCall(args: unknown, theme: Theme, context: RenderContext): Text {
	const text = reuseText(context);
	const callArgs = getReplaceCallArgs(args);
	const pattern = callArgs?.pattern ?? "";
	const rewrite = callArgs?.rewrite ?? "";
	const paths = formatPaths(callArgs?.paths);
	text.setText(
		theme.fg("toolTitle", theme.bold("ast_grep_replace ")) +
			theme.fg("accent", `/${pattern}/`) +
			theme.fg("dim", " → ") +
			theme.fg("accent", rewrite) +
			theme.fg("toolOutput", ` in ${paths}`) +
			formatReplaceBadges(callArgs, theme),
	);
	return text;
}

export function renderReplaceResult(
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	context: RenderContext,
): Text {
	const text = reuseText(context);
	text.setText(formatReplaceResultText(result, options, theme, context.isError));
	return text;
}

export function renderParseCall(args: unknown, theme: Theme, context: RenderContext): Text {
	const text = reuseText(context);
	const callArgs = getParseCallArgs(args);
	const pattern = callArgs?.pattern ?? "";
	text.setText(
		theme.fg("toolTitle", theme.bold("ast_gparse ")) +
			theme.fg("accent", `/${pattern}/`) +
			formatParseBadges(callArgs, theme),
	);
	return text;
}

export function renderParseResult(
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	context: RenderContext,
): Text {
	const text = reuseText(context);
	text.setText(formatParseResultText(result, options, theme, context.isError));
	return text;
}

export function renderTestCall(args: unknown, theme: Theme, context: RenderContext): Text {
	const text = reuseText(context);
	const callArgs = getTestCallArgs(args);
	const label = callArgs?.mode === "rule" ? "<inline rule>" : `/${callArgs?.pattern ?? ""}/`;
	text.setText(
		theme.fg("toolTitle", theme.bold("ast_grep_test ")) +
			theme.fg("accent", label) +
			formatTestBadges(callArgs, theme),
	);
	return text;
}

export function renderTestResult(
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	context: RenderContext,
): Text {
	const text = reuseText(context);
	text.setText(formatTestResultText(result, options, theme, context.isError));
	return text;
}

export function renderScanCall(args: unknown, theme: Theme, context: RenderContext): Text {
	const text = reuseText(context);
	const callArgs = getScanCallArgs(args);
	const paths = formatPaths(callArgs?.paths);
	const label = callArgs?.inlineRules
		? "<inline rules>"
		: callArgs?.ruleFile
			? "<rule file>"
			: callArgs?.configPath
				? "<config>"
				: "<scan>";
	text.setText(
		theme.fg("toolTitle", theme.bold("ast_grep_scan ")) +
			theme.fg("accent", label) +
			theme.fg("toolOutput", ` in ${paths}`) +
			formatScanBadges(callArgs, theme),
	);
	return text;
}

export function renderScanResult(
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	context: RenderContext,
): Text {
	const text = reuseText(context);
	text.setText(formatScanResultText(result, options, theme, context.isError));
	return text;
}
