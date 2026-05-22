import { describe, expect, it } from "vitest";

import {
	buildSgArgs,
	buildSgDebugQueryArgs,
	buildSgTestPatternArgs,
	buildSgTestRuleArgs,
} from "../src/ast-grep/cli.js";
import type {
	RunSgDebugQueryOptions,
	RunSgOptions,
	RunSgTestPatternOptions,
	RunSgTestRuleOptions,
} from "../src/ast-grep/types.js";

const pattern = "console.log($MSG)";
const rewrite = "logger.info($MSG)";

describe("buildSgArgs", () => {
	it("#given search options #when building args #then returns compact JSON search argv", () => {
		// given
		const options: RunSgOptions = { pattern, lang: "typescript", paths: ["src"] };

		// when
		const args = buildSgArgs(options, false);

		// then
		expect(args).toEqual(["run", "-p", pattern, "--lang", "typescript", "--json=compact", "src"]);
	});

	it("#given context option #when building args #then inserts context before paths", () => {
		// given
		const options: RunSgOptions = { pattern, lang: "typescript", context: 3, paths: ["src"] };

		// when
		const args = buildSgArgs(options, false);

		// then
		expect(args).toEqual(["run", "-p", pattern, "--lang", "typescript", "--json=compact", "-C", "3", "src"]);
	});

	it("#given rewrite dry pass #when building args #then includes rewrite without update all", () => {
		// given
		const options: RunSgOptions = { pattern, rewrite, lang: "typescript", paths: ["src"] };

		// when
		const args = buildSgArgs(options, false);

		// then
		expect(args).toEqual(["run", "-p", pattern, "--lang", "typescript", "--json=compact", "-r", rewrite, "src"]);
		expect(args).not.toContain("--update-all");
	});

	it("#given rewrite update pass #when building args #then includes update all", () => {
		// given
		const options: RunSgOptions = { pattern, rewrite, lang: "typescript", paths: ["src"] };

		// when
		const args = buildSgArgs(options, true);

		// then
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
			"src",
		]);
	});

	it("#given globs #when building args #then repeats globs flags", () => {
		// given
		const options: RunSgOptions = {
			pattern,
			lang: "typescript",
			globs: ["**/*.ts", "!**/*.test.ts"],
			paths: ["src"],
		};

		// when
		const args = buildSgArgs(options, false);

		// then
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
			"src",
		]);
	});

	it("#given undefined paths #when building args #then defaults to current directory", () => {
		// given
		const options: RunSgOptions = { pattern, lang: "typescript" };

		// when
		const args = buildSgArgs(options, false);

		// then
		expect(args.at(-1)).toBe(".");
	});

	it("#given empty paths #when building args #then defaults to current directory", () => {
		// given
		const options: RunSgOptions = { pattern, lang: "typescript", paths: [] };

		// when
		const args = buildSgArgs(options, false);

		// then
		expect(args.at(-1)).toBe(".");
	});

	it("#given write pass options #when building args #then omits compact JSON flag", () => {
		// given
		const options: RunSgOptions = {
			pattern,
			rewrite,
			lang: "typescript",
			paths: ["src"],
			updateAll: true,
		};

		// when
		const args = buildSgArgs(options, false);

		// then
		expect(args).toEqual(["run", "-p", pattern, "--lang", "typescript", "-r", rewrite, "src"]);
		expect(args).not.toContain("--json=compact");
	});
});

describe("buildSgDebugQueryArgs", () => {
	it("#given debug query options #when building args #then uses stdin and explicit format", () => {
		// given
		const options: RunSgDebugQueryOptions = {
			pattern: "function $NAME($$$) { $$$ }",
			lang: "typescript",
			format: "cst",
			selector: "function_declaration",
			strictness: "ast",
		};

		// when
		const args = buildSgDebugQueryArgs(options);

		// then
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
		// given
		const options: RunSgDebugQueryOptions = {
			pattern: "console.log($MSG)",
			lang: "typescript",
		};

		// when
		const args = buildSgDebugQueryArgs(options);

		// then
		expect(args).toEqual(["run", "-p", "console.log($MSG)", "--lang", "typescript", "--debug-query=ast", "--stdin"]);
	});
});

describe("buildSgTestPatternArgs", () => {
	it("#given test pattern options #when building args #then uses stdin compact-json run mode", () => {
		// given
		const options: RunSgTestPatternOptions = {
			code: 'console.log("hi")',
			pattern: "console.log($MSG)",
			lang: "typescript",
		};

		// when
		const args = buildSgTestPatternArgs(options);

		// then
		expect(args).toEqual(["run", "-p", "console.log($MSG)", "--lang", "typescript", "--stdin", "--json=compact"]);
	});
});

describe("buildSgTestRuleArgs", () => {
	it("#given test rule options #when building args #then uses scan inline-rules over stdin", () => {
		// given
		const options: RunSgTestRuleOptions = {
			code: 'console.log("hi")',
			rule: ["id: find-console-log", "language: typescript", "rule:", "  pattern: console.log($MSG)"].join("\n"),
			lang: "typescript",
		};

		// when
		const args = buildSgTestRuleArgs(options);

		// then
		expect(args).toEqual(["scan", "--inline-rules", options.rule, "--stdin", "--json=compact"]);
	});
});
