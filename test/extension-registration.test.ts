import { Type } from "typebox";
import { describe, expect, it } from "vitest";

import { ast_gparse, ast_grep_replace, ast_grep_scan, ast_grep_search, ast_grep_test } from "../src/ast-grep/tools.js";

describe("ast_grep_search tool definition", () => {
	it("#given search tool #when inspecting metadata #then exposes expected name label and description", () => {
		// given / when
		const tool = ast_grep_search;

		// then
		expect(tool.name).toBe("ast_grep_search");
		expect(tool.label).toBe("AST Grep Search");
		expect(tool.description).toContain("AST");
		expect(tool.description).toContain("$VAR");
		expect(tool.description).toContain("$$$");
	});

	it("#given search parameters #when inspecting schema #then requires pattern only and keeps lang optional for safe auto-detection", () => {
		// given
		const objectSchema = Type.Object({});
		const parameters = ast_grep_search.parameters;

		// when / then
		expect(parameters.type).toBe(objectSchema.type);
		expect(parameters.required).toEqual(["pattern"]);
		expect(parameters.properties).toHaveProperty("pattern");
		expect(parameters.properties).toHaveProperty("lang");
		expect(parameters.properties).toHaveProperty("paths");
		expect(parameters.properties).toHaveProperty("globs");
		expect(parameters.required).not.toContain("paths");
		expect(parameters.required).not.toContain("globs");
	});
});

describe("ast_grep_replace tool definition", () => {
	it("#given replace tool #when inspecting metadata #then exposes expected name label and execution mode", () => {
		// given / when
		const tool = ast_grep_replace;

		// then
		expect(tool.name).toBe("ast_grep_replace");
		expect(tool.label).toBe("AST Grep Replace");
		expect(tool.executionMode).toBe("sequential");
	});

	it("#given replace parameters #when inspecting schema #then requires pattern and rewrite while keeping lang optional for safe auto-detection", () => {
		// given
		const objectSchema = Type.Object({});
		const parameters = ast_grep_replace.parameters;

		// when / then
		expect(parameters.type).toBe(objectSchema.type);
		expect(parameters.required).toEqual(["pattern", "rewrite"]);
		expect(parameters.properties).toHaveProperty("pattern");
		expect(parameters.properties).toHaveProperty("rewrite");
		expect(parameters.properties).toHaveProperty("lang");
		expect(parameters.properties).toHaveProperty("paths");
		expect(parameters.properties).toHaveProperty("globs");
		expect(parameters.properties).toHaveProperty("dryRun");
		expect(parameters.required).not.toContain("paths");
		expect(parameters.required).not.toContain("globs");
		expect(parameters.required).not.toContain("dryRun");
	});
});

describe("ast_grep_test tool definition", () => {
	it("#given test tool #when inspecting metadata #then exposes expected name label and validation framing", () => {
		// given / when
		const tool = ast_grep_test;

		// then
		expect(tool.name).toBe("ast_grep_test");
		expect(tool.label).toBe("AST Grep Test");
		expect(tool.description).toContain("Validate");
	});

	it("#given test parameters #when inspecting schema #then requires mode code and lang with optional pattern or rule", () => {
		// given
		const objectSchema = Type.Object({});
		const parameters = ast_grep_test.parameters;

		// when / then
		expect(parameters.type).toBe(objectSchema.type);
		expect(parameters.required).toEqual(["mode", "code", "lang"]);
		expect(parameters.properties).toHaveProperty("mode");
		expect(parameters.properties).toHaveProperty("code");
		expect(parameters.properties).toHaveProperty("lang");
		expect(parameters.properties).toHaveProperty("pattern");
		expect(parameters.properties).toHaveProperty("rule");
	});
});

describe("ast_grep_scan tool definition", () => {
	it("#given scan tool #when inspecting metadata #then exposes expected name label and scan framing", () => {
		// given / when
		const tool = ast_grep_scan;

		// then
		expect(tool.name).toBe("ast_grep_scan");
		expect(tool.label).toBe("AST Grep Scan");
		expect(tool.description).toContain("inline YAML");
	});

	it("#given scan parameters #when inspecting schema #then keeps scan source fields optional and exposes scan controls", () => {
		// given
		const objectSchema = Type.Object({});
		const parameters = ast_grep_scan.parameters;

		// when / then
		expect(parameters.type).toBe(objectSchema.type);
		expect(parameters.required).toBeUndefined();
		expect(parameters.properties).toHaveProperty("inlineRules");
		expect(parameters.properties).toHaveProperty("ruleFile");
		expect(parameters.properties).toHaveProperty("configPath");
		expect(parameters.properties).toHaveProperty("paths");
		expect(parameters.properties).toHaveProperty("globs");
		expect(parameters.properties).toHaveProperty("context");
		expect(parameters.properties).toHaveProperty("includeMetadata");
	});
});

describe("ast_gparse tool definition", () => {
	it("#given parse tool #when inspecting metadata #then exposes expected name label and debug-query framing", () => {
		// given / when
		const tool = ast_gparse;

		// then
		expect(tool.name).toBe("ast_gparse");
		expect(tool.label).toBe("AST Grep Parse");
		expect(tool.description).toContain("debug-query");
	});

	it("#given parse parameters #when inspecting schema #then requires pattern and lang with optional parse controls", () => {
		// given
		const objectSchema = Type.Object({});
		const parameters = ast_gparse.parameters;

		// when / then
		expect(parameters.type).toBe(objectSchema.type);
		expect(parameters.required).toEqual(["pattern", "lang"]);
		expect(parameters.properties).toHaveProperty("pattern");
		expect(parameters.properties).toHaveProperty("lang");
		expect(parameters.properties).toHaveProperty("format");
		expect(parameters.properties).toHaveProperty("selector");
		expect(parameters.properties).toHaveProperty("strictness");
		expect(parameters.required).not.toContain("format");
		expect(parameters.required).not.toContain("selector");
		expect(parameters.required).not.toContain("strictness");
	});
});
