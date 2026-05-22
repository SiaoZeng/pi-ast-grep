import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
	findSgCliPathSync,
	getConfiguredSgCliPathError,
	getConfiguredSgCliPathOverride,
	resetResolvedPathForTests,
} from "../src/ast-grep/binary-path.js";

const originalConfiguredPath = process.env["PI_AST_GREP_PATH"];
const originalAltConfiguredPath = process.env["AST_GREP_BIN"];

function restoreEnv(): void {
	if (originalConfiguredPath === undefined) delete process.env["PI_AST_GREP_PATH"];
	else process.env["PI_AST_GREP_PATH"] = originalConfiguredPath;
	if (originalAltConfiguredPath === undefined) delete process.env["AST_GREP_BIN"];
	else process.env["AST_GREP_BIN"] = originalAltConfiguredPath;
}

afterEach(() => {
	restoreEnv();
	resetResolvedPathForTests();
});

describe("configured sg binary path", () => {
	it("#given explicit PI_AST_GREP_PATH #when reading override #then returns configured path", () => {
		// given
		process.env["PI_AST_GREP_PATH"] = "/tmp/custom-sg";
		delete process.env["AST_GREP_BIN"];

		// when / then
		expect(getConfiguredSgCliPathOverride()).toBe("/tmp/custom-sg");
	});

	it("#given valid configured path #when resolving binary #then it takes precedence", () => {
		// given
		const require = createRequire(import.meta.url);
		const cliPackageJsonPath = require.resolve("@ast-grep/cli/package.json");
		const cliDirectory = dirname(cliPackageJsonPath);
		const binaryName = process.platform === "win32" ? "sg.exe" : "sg";
		const configuredPath = join(cliDirectory, binaryName);
		process.env["PI_AST_GREP_PATH"] = configuredPath;
		delete process.env["AST_GREP_BIN"];

		// when
		const resolved = findSgCliPathSync();

		// then
		expect(getConfiguredSgCliPathError()).toBeNull();
		expect(resolved).toBe(configuredPath);
	});

	it("#given invalid configured path #when validating override #then returns explicit error", () => {
		// given
		process.env["PI_AST_GREP_PATH"] = "/definitely/not/a/real/sg";
		delete process.env["AST_GREP_BIN"];

		// when
		const error = getConfiguredSgCliPathError();
		const resolved = findSgCliPathSync();

		// then
		expect(error).toContain("Configured ast-grep path does not exist");
		expect(resolved).toBeNull();
	});
});
