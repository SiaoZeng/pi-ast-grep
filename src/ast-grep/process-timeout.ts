import type { ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

import { SearchTimeoutError } from "./errors.js";

export interface ProcessOutput {
	stdout: string;
	stderr: string;
	exitCode: number;
}

export interface LineLimitedProcessOutput extends ProcessOutput {
	totalLineCount: number;
}

function attachTimeout(proc: ChildProcess, timeoutMs: number, reject: (error: Error) => void): () => void {
	let timeoutHandle: NodeJS.Timeout | null = setTimeout(() => {
		proc.kill("SIGTERM");
		hardKillHandle = setTimeout(() => {
			if (proc.exitCode === null) {
				proc.kill("SIGKILL");
			}
		}, 1000);
		reject(new SearchTimeoutError(timeoutMs));
	}, timeoutMs);
	let hardKillHandle: NodeJS.Timeout | null = null;

	return () => {
		if (timeoutHandle !== null) {
			clearTimeout(timeoutHandle);
			timeoutHandle = null;
		}
		if (hardKillHandle !== null) {
			clearTimeout(hardKillHandle);
			hardKillHandle = null;
		}
	};
}

export async function collectProcessOutputWithTimeout(proc: ChildProcess, timeoutMs: number): Promise<ProcessOutput> {
	let stdout = "";
	let stderr = "";

	proc.stdout?.setEncoding("utf-8");
	proc.stderr?.setEncoding("utf-8");

	proc.stdout?.on("data", (chunk: string) => {
		stdout += chunk;
	});
	proc.stderr?.on("data", (chunk: string) => {
		stderr += chunk;
	});

	const exitCode = await new Promise<number>((resolve, reject) => {
		const cleanup = attachTimeout(proc, timeoutMs, reject);

		proc.once("close", (code) => {
			cleanup();
			resolve(code ?? 0);
		});

		proc.once("error", (err) => {
			cleanup();
			reject(err);
		});
	});

	return { stdout, stderr, exitCode };
}

export async function collectProcessOutputByLineLimitWithTimeout(
	proc: ChildProcess,
	timeoutMs: number,
	lineLimit?: number,
): Promise<LineLimitedProcessOutput> {
	let stderr = "";
	const stdoutLines: string[] = [];
	let totalLineCount = 0;

	proc.stdout?.setEncoding("utf-8");
	proc.stderr?.setEncoding("utf-8");
	proc.stderr?.on("data", (chunk: string) => {
		stderr += chunk;
	});

	const rl = proc.stdout ? createInterface({ input: proc.stdout }) : null;
	if (rl) {
		rl.on("line", (line) => {
			totalLineCount++;
			if (lineLimit === undefined || stdoutLines.length < lineLimit) {
				stdoutLines.push(line);
			}
		});
	}

	const exitCode = await new Promise<number>((resolve, reject) => {
		const cleanup = attachTimeout(proc, timeoutMs, reject);

		proc.once("close", (code) => {
			cleanup();
			rl?.close();
			resolve(code ?? 0);
		});

		proc.once("error", (err) => {
			cleanup();
			rl?.close();
			reject(err);
		});
	});

	return { stdout: stdoutLines.join("\n"), stderr, exitCode, totalLineCount };
}
