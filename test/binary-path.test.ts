import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
	findBinaryOnPath,
	findSgCliPathSync,
	getConfiguredSgCliPathError,
	getConfiguredSgCliPathOverride,
	resetResolvedPathForTests,
} from "../src/ast-grep/binary-path.js";

const originalConfiguredPath = process.env["PI_AST_GREP_PATH"];
const originalAltConfiguredPath = process.env["AST_GREP_BIN"];
const originalPath = process.env["PATH"];
let tempDirToCleanup: string | null = null;

function restoreEnv(): void {
	if (originalConfiguredPath === undefined) delete process.env["PI_AST_GREP_PATH"];
	else process.env["PI_AST_GREP_PATH"] = originalConfiguredPath;
	if (originalAltConfiguredPath === undefined) delete process.env["AST_GREP_BIN"];
	else process.env["AST_GREP_BIN"] = originalAltConfiguredPath;
	if (originalPath === undefined) delete process.env["PATH"];
	else process.env["PATH"] = originalPath;
}

afterEach(() => {
	if (tempDirToCleanup) {
		rmSync(tempDirToCleanup, { recursive: true, force: true });
		tempDirToCleanup = null;
	}
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

	it("#given PATH with only ast-grep alias #when searching on path #then alias is accepted", () => {
		// given
		const require = createRequire(import.meta.url);
		const cliPackageJsonPath = require.resolve("@ast-grep/cli/package.json");
		const cliDirectory = dirname(cliPackageJsonPath);
		const sourceBinaryName = process.platform === "win32" ? "ast-grep.exe" : "ast-grep";
		const sourceBinaryPath = join(cliDirectory, sourceBinaryName);
		tempDirToCleanup = mkdtempSync(join(tmpdir(), "pi-ast-grep-path-test-"));
		const aliasName = process.platform === "win32" ? "ast-grep.exe" : "ast-grep";
		const aliasPath = join(tempDirToCleanup, aliasName);
		symlinkSync(sourceBinaryPath, aliasPath);
		process.env["PATH"] = tempDirToCleanup;

		// when
		const resolved = findBinaryOnPath(["sg", "ast-grep"]);

		// then
		expect(resolved).toBe(aliasPath);
	});
});
