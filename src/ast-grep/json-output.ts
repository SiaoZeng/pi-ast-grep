import { DEFAULT_MAX_MATCHES, DEFAULT_MAX_OUTPUT_BYTES } from "./languages.js";
import type { CliMatch, SgResult } from "./types.js";

export function createSgResultFromStdout(stdout: string): SgResult {
	if (!stdout.trim()) {
		return { matches: [], totalMatches: 0, truncated: false };
	}

	const outputTruncated = stdout.length >= DEFAULT_MAX_OUTPUT_BYTES;
	const outputToProcess = outputTruncated ? stdout.substring(0, DEFAULT_MAX_OUTPUT_BYTES) : stdout;

	let matches: CliMatch[] = [];
	try {
		const parsed: unknown = JSON.parse(outputToProcess);
		matches = isCliMatchArray(parsed) ? parsed : [];
	} catch {
		if (!outputTruncated) {
			return { matches: [], totalMatches: 0, truncated: false };
		}

		try {
			let salvagedTruncatedJson = false;
			const lastValidIndex = outputToProcess.lastIndexOf("}");
			if (lastValidIndex > 0) {
				const bracketIndex = outputToProcess.lastIndexOf("},", lastValidIndex);
				if (bracketIndex > 0) {
					const truncatedJson = `${outputToProcess.substring(0, bracketIndex + 1)}]`;
					const parsed: unknown = JSON.parse(truncatedJson);
					if (isCliMatchArray(parsed)) {
						matches = parsed;
						salvagedTruncatedJson = true;
					}
				}
			}

			if (!salvagedTruncatedJson) {
				return {
					matches: [],
					totalMatches: 0,
					truncated: true,
					truncatedReason: "max_output_bytes",
					error: "Output too large and could not be parsed",
				};
			}
		} catch {
			return {
				matches: [],
				totalMatches: 0,
				truncated: true,
				truncatedReason: "max_output_bytes",
				error: "Output too large and could not be parsed",
			};
		}
	}

	const totalMatches = matches.length;
	const matchesTruncated = totalMatches > DEFAULT_MAX_MATCHES;
	const finalMatches = matchesTruncated ? matches.slice(0, DEFAULT_MAX_MATCHES) : matches;

	const truncatedReason = outputTruncated ? "max_output_bytes" : matchesTruncated ? "max_matches" : undefined;
	const result: SgResult = {
		matches: finalMatches,
		totalMatches,
		truncated: outputTruncated || matchesTruncated,
		resultMode: "matches",
	};
	if (truncatedReason !== undefined) result.truncatedReason = truncatedReason;
	return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberPair(value: unknown): value is { start: number; end: number } {
	return isRecord(value) && typeof value["start"] === "number" && typeof value["end"] === "number";
}

function isPosition(value: unknown): value is { line: number; column: number } {
	return isRecord(value) && typeof value["line"] === "number" && typeof value["column"] === "number";
}

function isCliMatch(value: unknown): value is CliMatch {
	if (!isRecord(value)) {
		return false;
	}
	const range = value["range"];
	const charCount = value["charCount"];
	if (!isRecord(range) || !isRecord(charCount)) {
		return false;
	}
	const byteOffset = range["byteOffset"];
	return (
		typeof value["text"] === "string" &&
		typeof value["file"] === "string" &&
		typeof value["lines"] === "string" &&
		typeof charCount["leading"] === "number" &&
		typeof charCount["trailing"] === "number" &&
		typeof value["language"] === "string" &&
		isRecord(byteOffset) &&
		isNumberPair(byteOffset) &&
		isPosition(range["start"]) &&
		isPosition(range["end"])
	);
}

export function createSgResultFromStreamStdout(
	stdout: string,
	maxResults = DEFAULT_MAX_MATCHES,
	totalMatchesOverride?: number,
): SgResult {
	if (!stdout.trim()) {
		return { matches: [], totalMatches: 0, truncated: false, resultMode: "matches" };
	}

	const lines = stdout.split("\n").filter((line) => line.trim().length > 0);
	const matches: CliMatch[] = [];
	let totalMatches = 0;

	for (const line of lines) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			continue;
		}
		if (!isCliMatch(parsed)) {
			continue;
		}
		totalMatches++;
		if (matches.length < maxResults) {
			matches.push(parsed);
		}
	}

	const finalTotalMatches = totalMatchesOverride ?? totalMatches;
	const truncated = finalTotalMatches > matches.length;
	const result: SgResult = {
		matches,
		totalMatches: finalTotalMatches,
		truncated,
		resultMode: "matches",
	};
	if (truncated) result.truncatedReason = "max_matches";
	return result;
}

export function createSgFileListResultFromStdout(
	stdout: string,
	maxResults = DEFAULT_MAX_MATCHES,
	totalMatchesOverride?: number,
): SgResult {
	if (!stdout.trim()) {
		return { matches: [], matchedFiles: [], totalMatches: 0, truncated: false, resultMode: "files" };
	}

	const lines = stdout
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	const matchedFiles = lines.slice(0, maxResults);
	const totalMatches = lines.length;
	const finalTotalMatches = totalMatchesOverride ?? totalMatches;
	const truncated = finalTotalMatches > matchedFiles.length;
	const result: SgResult = {
		matches: [],
		matchedFiles,
		totalMatches: finalTotalMatches,
		truncated,
		resultMode: "files",
	};
	if (truncated) result.truncatedReason = "max_matches";
	return result;
}

function isCliMatchArray(value: unknown): value is CliMatch[] {
	return Array.isArray(value) && value.every(isCliMatch);
}
