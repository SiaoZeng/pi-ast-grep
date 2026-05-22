import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findSgCliPathSync } from "../src/ast-grep/binary-path.js";
import { runSg, runSgDebugQuery, runSgScan, runSgTestPattern, runSgTestRule } from "../src/ast-grep/cli.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_DIR = resolve(__dirname, "fixtures/sg-project");
const TS_FIXTURE = resolve(FIXTURE_DIR, "sample.ts");

const previousOffline = process.env["PI_OFFLINE"];

describe("sg binary integration", () => {
	beforeAll(() => {
		// given a hermetic offline-disabled environment so resolution can use
		// the locally-installed @ast-grep/cli package instead of GitHub
		delete process.env["PI_OFFLINE"];
	});

	afterAll(() => {
		if (previousOffline === undefined) {
			delete process.env["PI_OFFLINE"];
		} else {
			process.env["PI_OFFLINE"] = previousOffline;
		}
	});

	it("#given a resolvable sg binary #when checking #then it is present", () => {
		// when
		const path = findSgCliPathSync();

		// then
		expect(path, "sg binary must be resolvable for integration tests").not.toBeNull();
	});

	it("#given a typescript fixture with console.log #when ast_grep_search runs #then it returns a structural match", async () => {
		// given
		const path = findSgCliPathSync();
		if (!path) {
			expect.fail("sg binary unavailable; integration test cannot run");
		}

		// when
		const result = await runSg({
			pattern: "console.log($MSG)",
			lang: "typescript",
			paths: [TS_FIXTURE],
		});

		// then
		expect(result.error).toBeUndefined();
		expect(result.matches.length).toBeGreaterThanOrEqual(1);
		const firstMatch = result.matches[0];
		if (!firstMatch) {
			expect.fail("expected at least one match");
		}
		expect(firstMatch.file).toContain("sample.ts");
		expect(firstMatch.text).toContain("console.log");
		expect(typeof firstMatch.range.start.line).toBe("number");
		expect(typeof firstMatch.range.start.column).toBe("number");
	}, 15_000);

	it("#given a function pattern #when ast_grep_search runs #then it returns the structural match", async () => {
		// given
		const path = findSgCliPathSync();
		if (!path) {
			expect.fail("sg binary unavailable; integration test cannot run");
		}

		// when
		const result = await runSg({
			pattern: "function $NAME($$$) { $$$ }",
			lang: "typescript",
			paths: [TS_FIXTURE],
		});

		// then
		expect(result.error).toBeUndefined();
		expect(result.matches.length).toBeGreaterThanOrEqual(1);
	}, 15_000);

	it("#given a glob filter #when ast_grep_search runs #then it respects the glob", async () => {
		// given
		const path = findSgCliPathSync();
		if (!path) {
			expect.fail("sg binary unavailable; integration test cannot run");
		}

		// when
		const result = await runSg({
			pattern: "console.log($MSG)",
			lang: "typescript",
			paths: [FIXTURE_DIR],
			globs: ["*.ts"],
		});

		// then
		expect(result.error).toBeUndefined();
		expect(result.matches.length).toBeGreaterThanOrEqual(1);
		for (const match of result.matches) {
			expect(match.file.endsWith(".ts")).toBe(true);
		}
	}, 15_000);

	it("#given a no-match pattern #when ast_grep_search runs #then it returns empty matches without error", async () => {
		// given
		const path = findSgCliPathSync();
		if (!path) {
			expect.fail("sg binary unavailable; integration test cannot run");
		}

		// when
		const result = await runSg({
			pattern: "thisIdentifierDoesNotExistAnywhere($$$)",
			lang: "typescript",
			paths: [TS_FIXTURE],
		});

		// then
		expect(result.error).toBeUndefined();
		expect(result.matches).toHaveLength(0);
		expect(result.totalMatches).toBe(0);
	}, 15_000);

	it("#given a dry-run replace #when ast_grep_replace runs #then it returns matches but does not mutate the file", async () => {
		// given
		const path = findSgCliPathSync();
		if (!path) {
			expect.fail("sg binary unavailable; integration test cannot run");
		}
		const { readFileSync } = await import("node:fs");
		const before = readFileSync(TS_FIXTURE, "utf-8");

		// when
		const result = await runSg({
			pattern: "console.log($MSG)",
			rewrite: "logger.info($MSG)",
			lang: "typescript",
			paths: [TS_FIXTURE],
			updateAll: false,
		});

		// then
		expect(result.error).toBeUndefined();
		expect(result.matches.length).toBeGreaterThanOrEqual(1);
		const after = readFileSync(TS_FIXTURE, "utf-8");
		expect(after).toBe(before);
	}, 15_000);

	it("#given a debug query #when ast_gparse helper runs #then it returns only the query debug output", async () => {
		// given
		const path = findSgCliPathSync();
		if (!path) {
			expect.fail("sg binary unavailable; integration test cannot run");
		}

		// when
		const result = await runSgDebugQuery({
			pattern: "function $NAME($$$) { $$$ }",
			lang: "typescript",
			format: "ast",
		});

		// then
		expect(result.error).toBeUndefined();
		expect(result.output).toContain("Debug AST:");
		expect(result.output).toContain("function_declaration");
		expect(result.output).not.toContain("sample.ts:");
	}, 15_000);

	it("#given example code and a simple pattern #when ast_grep_test pattern helper runs #then it returns stdin-backed match results", async () => {
		// given
		const path = findSgCliPathSync();
		if (!path) {
			expect.fail("sg binary unavailable; integration test cannot run");
		}

		// when
		const result = await runSgTestPattern({
			code: 'console.log("hi")\n',
			pattern: "console.log($MSG)",
			lang: "typescript",
		});

		// then
		expect(result.error).toBeUndefined();
		expect(result.matches.length).toBe(1);
		expect(result.matches[0]?.file).toBe("STDIN");
	}, 15_000);

	it("#given example code and an inline rule #when ast_grep_test rule helper runs #then it returns stdin-backed match results", async () => {
		// given
		const path = findSgCliPathSync();
		if (!path) {
			expect.fail("sg binary unavailable; integration test cannot run");
		}
		const rule = [
			"id: find-await-in-loop",
			"language: typescript",
			"rule:",
			"  pattern: await $PROMISE",
			"  inside:",
			"    any:",
			"      - kind: for_statement",
			"      - kind: while_statement",
			"    stopBy: end",
		].join("\n");

		// when
		const result = await runSgTestRule({
			code: "while (foo) { await bar() }\n",
			rule,
			lang: "typescript",
		});

		// then
		expect(result.error).toBeUndefined();
		expect(result.matches.length).toBe(1);
		expect(result.matches[0]?.file).toBe("STDIN");
	}, 15_000);

	it("#given malformed inline rule text #when ast_grep_test rule helper runs #then it surfaces the parse error", async () => {
		// given
		const path = findSgCliPathSync();
		if (!path) {
			expect.fail("sg binary unavailable; integration test cannot run");
		}
		const rule = [
			"id: broken-rule",
			"language: typescript",
			"rule:",
			"  all:",
			"    - kind: function_declaration",
			"    - has:",
			"        pattern await $EXPR",
		].join("\n");

		// when
		const result = await runSgTestRule({
			code: "async function x(){ await y() }\n",
			rule,
			lang: "typescript",
		});

		// then
		expect(result.error).toContain("Cannot parse rule INLINE_RULES");
		expect(result.matches).toHaveLength(0);
	}, 15_000);

	it("#given inline rules and repository paths #when ast_grep_scan runs #then it returns repository matches", async () => {
		// given
		const path = findSgCliPathSync();
		if (!path) {
			expect.fail("sg binary unavailable; integration test cannot run");
		}
		const rule = ["id: find-console-log", "language: typescript", "rule:", "  pattern: console.log($MSG)"].join("\n");

		// when
		const result = await runSgScan({
			inlineRules: rule,
			paths: [FIXTURE_DIR],
			globs: ["*.ts"],
		});

		// then
		expect(result.error).toBeUndefined();
		expect(result.matches.length).toBeGreaterThanOrEqual(1);
		expect(result.matches[0]?.file).toContain("sample.ts");
	}, 15_000);

	it("#given metadata-enabled scan #when ast_grep_scan runs #then metadata fields are preserved", async () => {
		// given
		const path = findSgCliPathSync();
		if (!path) {
			expect.fail("sg binary unavailable; integration test cannot run");
		}
		const rule = [
			"id: find-console-log",
			"language: typescript",
			"message: avoid console log",
			"severity: warning",
			"metadata:",
			"  category: logging",
			"rule:",
			"  pattern: console.log($MSG)",
		].join("\n");

		// when
		const result = await runSgScan({
			inlineRules: rule,
			paths: [FIXTURE_DIR],
			includeMetadata: true,
		});

		// then
		expect(result.error).toBeUndefined();
		expect(result.matches.length).toBeGreaterThanOrEqual(1);
		expect(result.matches[0]?.ruleId).toBe("find-console-log");
		expect(result.matches[0]?.severity).toBe("warning");
		expect(result.matches[0]?.message).toBe("avoid console log");
		expect(result.matches[0]?.metadata?.["category"]).toBe("logging");
	}, 15_000);
});
