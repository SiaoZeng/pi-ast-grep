import { describe, expect, it } from "vitest";

import {
	buildSgArgs,
	buildSgDebugQueryArgs,
	buildSgScanArgs,
	buildSgTestPatternArgs,
	buildSgTestRuleArgs,
} from "../src/ast-grep/cli.js";
import type {
	RunSgDebugQueryOptions,
	RunSgOptions,
	RunSgScanOptions,
	RunSgTestPatternOptions,
	RunSgTestRuleOptions,
} from "../src/ast-grep/types.js";

const pattern = "console.log($MSG)";
const rewrite = "logger.info($MSG)";

describe("buildSgArgs", () => {
	it("#given search options #when building args #then returns compact JSON search argv", () => {
		const options: RunSgOptions = { pattern, lang: "typescript", paths: ["src"] };
		const args = buildSgArgs(options, false);
		expect(args).toEqual(["run", "-p", pattern, "--lang", "typescript", "--json=compact", "--", "src"]);
	});

	it("#given context option #when building args #then inserts context before paths", () => {
		const options: RunSgOptions = { pattern, lang: "typescript", context: 3, paths: ["src"] };
		const args = buildSgArgs(options, false);
		expect(args).toEqual(["run", "-p", pattern, "--lang", "typescript", "--json=compact", "-C", "3", "--", "src"]);
	});

	it("#given rewrite dry pass #when building args #then includes rewrite without update all", () => {
		const options: RunSgOptions = { pattern, rewrite, lang: "typescript", paths: ["src"] };
		const args = buildSgArgs(options, false);
		expect(args).toEqual([
			"run",
			"-p",
			pattern,
			"--lang",
			"typescript",
			"--json=compact",
			"-r",
			rewrite,
			"--",
			"src",
		]);
		expect(args).not.toContain("--update-all");
	});

	it("#given rewrite update pass #when building args #then includes update all", () => {
		const options: RunSgOptions = { pattern, rewrite, lang: "typescript", paths: ["src"] };
		const args = buildSgArgs(options, true);
		expect(args).toEqual([
			"run",
			"-p",
			pattern,
			"--lang",
			"typescript",
			"--json=compact",
			"-r",
			rewrite,
			"--update-all",
			"--",
			"src",
		]);
	});

	it("#given globs #when building args #then repeats globs flags", () => {
		const options: RunSgOptions = {
			pattern,
			lang: "typescript",
			globs: ["**/*.ts", "!**/*.test.ts"],
			paths: ["src"],
		};
		const args = buildSgArgs(options, false);
		expect(args).toEqual([
			"run",
			"-p",
			pattern,
			"--lang",
			"typescript",
			"--json=compact",
			"--globs",
			"**/*.ts",
			"--globs",
			"!**/*.test.ts",
			"--",
			"src",
		]);
	});

	it("#given undefined paths #when building args #then defaults to current directory", () => {
		const options: RunSgOptions = { pattern, lang: "typescript" };
		const args = buildSgArgs(options, false);
		expect(args.at(-1)).toBe(".");
		expect(args.at(-2)).toBe("--");
	});

	it("#given empty paths #when building args #then defaults to current directory", () => {
		const options: RunSgOptions = { pattern, lang: "typescript", paths: [] };
		const args = buildSgArgs(options, false);
		expect(args.at(-1)).toBe(".");
		expect(args.at(-2)).toBe("--");
	});

	it("#given files result mode #when building args #then uses files-with-matches", () => {
		const options: RunSgOptions = { pattern, lang: "typescript", resultMode: "files", paths: ["src"] };
		const args = buildSgArgs(options, false);
		expect(args).toEqual(["run", "-p", pattern, "--lang", "typescript", "--files-with-matches", "--", "src"]);
	});

	it("#given limited search #when building stream args #then uses json stream mode", () => {
		const options: RunSgOptions = { pattern, lang: "typescript", maxResults: 2, paths: ["src"] };
		const args = buildSgArgs(options, false, "stream");
		expect(args).toEqual(["run", "-p", pattern, "--lang", "typescript", "--json=stream", "--", "src"]);
	});

	it("#given write pass options #when building args #then omits compact JSON flag", () => {
		const options: RunSgOptions = {
			pattern,
			rewrite,
			lang: "typescript",
			paths: ["src"],
			updateAll: true,
		};
		const args = buildSgArgs(options, false);
		expect(args).toEqual(["run", "-p", pattern, "--lang", "typescript", "-r", rewrite, "--", "src"]);
		expect(args).not.toContain("--json=compact");
	});
});

describe("buildSgDebugQueryArgs", () => {
	it("#given debug query options #when building args #then uses stdin and explicit format", () => {
		const options: RunSgDebugQueryOptions = {
			pattern: "function $NAME($$$) { $$$ }",
			lang: "typescript",
			format: "cst",
			selector: "function_declaration",
			strictness: "ast",
		};
		const args = buildSgDebugQueryArgs(options);
		expect(args).toEqual([
			"run",
			"-p",
			"function $NAME($$$) { $$$ }",
			"--lang",
			"typescript",
			"--debug-query=cst",
			"--stdin",
			"--selector",
			"function_declaration",
			"--strictness",
			"ast",
		]);
	});

	it("#given missing format #when building args #then defaults to ast", () => {
		const options: RunSgDebugQueryOptions = {
			pattern: "console.log($MSG)",
			lang: "typescript",
		};
		const args = buildSgDebugQueryArgs(options);
		expect(args).toEqual(["run", "-p", "console.log($MSG)", "--lang", "typescript", "--debug-query=ast", "--stdin"]);
	});
});

describe("buildSgTestPatternArgs", () => {
	it("#given test pattern options #when building args #then uses stdin compact-json run mode", () => {
		const options: RunSgTestPatternOptions = {
			code: 'console.log("hi")',
			pattern: "console.log($MSG)",
			lang: "typescript",
		};
		const args = buildSgTestPatternArgs(options);
		expect(args).toEqual(["run", "-p", "console.log($MSG)", "--lang", "typescript", "--stdin", "--json=compact"]);
	});
});

describe("buildSgTestRuleArgs", () => {
	it("#given test rule options #when building args #then injects top-level language and uses scan inline-rules over stdin", () => {
		const options: RunSgTestRuleOptions = {
			code: 'console.log("hi")',
			rule: ["id: find-console-log", "rule:", "  pattern: console.log($MSG)"].join("\n"),
			lang: "typescript",
		};
		const args = buildSgTestRuleArgs(options);
		expect(args).toEqual([
			"scan",
			"--inline-rules",
			["language: typescript", options.rule].join("\n"),
			"--stdin",
			"--json=compact",
		]);
	});
});

describe("buildSgScanArgs", () => {
	it("#given scan options #when building args #then uses inline-rules compact-json path scanning", () => {
		const options: RunSgScanOptions = {
			inlineRules: ["id: find-console-log", "language: typescript", "rule:", "  pattern: console.log($MSG)"].join(
				"\n",
			),
			paths: ["src"],
			globs: ["**/*.ts"],
			context: 2,
			includeMetadata: true,
		};
		const args = buildSgScanArgs(options);
		expect(args).toEqual([
			"scan",
			"--inline-rules",
			options.inlineRules,
			"--json=compact",
			"--include-metadata",
			"-C",
			"2",
			"--globs",
			"**/*.ts",
			"--",
			"src",
		]);
	});

	it("#given files mode and max results #when building scan args #then uses files-with-matches and max-results", () => {
		const options: RunSgScanOptions = {
			inlineRules: ["id: find-console-log", "language: typescript", "rule:", "  pattern: console.log($MSG)"].join(
				"\n",
			),
			paths: ["src"],
			resultMode: "files",
			maxResults: 3,
		};
		const args = buildSgScanArgs(options);
		expect(args).toEqual([
			"scan",
			"--inline-rules",
			options.inlineRules,
			"--files-with-matches",
			"--max-results",
			"3",
			"--",
			"src",
		]);
	});

	it("#given rule file source #when building scan args #then uses --rule", () => {
		const options: RunSgScanOptions = {
			ruleFile: "/tmp/rule.yml",
			paths: ["src"],
		};
		const args = buildSgScanArgs(options);
		expect(args).toEqual(["scan", "--rule", "/tmp/rule.yml", "--json=compact", "--", "src"]);
	});

	it("#given config path source #when building scan args #then uses --config", () => {
		const options: RunSgScanOptions = {
			configPath: "/tmp/sgconfig.yml",
			paths: ["src"],
		};
		const args = buildSgScanArgs(options);
		expect(args).toEqual(["scan", "--config", "/tmp/sgconfig.yml", "--json=compact", "--", "src"]);
	});
});
