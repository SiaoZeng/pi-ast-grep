export const CLI_LANGUAGES = [
	"bash",
	"c",
	"cpp",
	"csharp",
	"css",
	"elixir",
	"go",
	"haskell",
	"html",
	"java",
	"javascript",
	"json",
	"kotlin",
	"lua",
	"nix",
	"php",
	"python",
	"ruby",
	"rust",
	"scala",
	"solidity",
	"swift",
	"typescript",
	"tsx",
	"yaml",
] as const;

export const DEFAULT_TIMEOUT_MS = 300_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 1 * 1024 * 1024;
export const DEFAULT_MAX_MATCHES = 500;

export const LANG_EXTENSIONS: Record<string, string[]> = {
	bash: [".bash", ".sh", ".zsh", ".bats"],
	c: [".c", ".h"],
	cpp: [".cpp", ".cc", ".cxx", ".hpp", ".hxx", ".h"],
	csharp: [".cs"],
	css: [".css"],
	elixir: [".ex", ".exs"],
	go: [".go"],
	haskell: [".hs", ".lhs"],
	html: [".html", ".htm"],
	java: [".java"],
	javascript: [".js", ".jsx", ".mjs", ".cjs"],
	json: [".json"],
	kotlin: [".kt", ".kts"],
	lua: [".lua"],
	nix: [".nix"],
	php: [".php"],
	python: [".py", ".pyi"],
	ruby: [".rb", ".rake"],
	rust: [".rs"],
	scala: [".scala", ".sc"],
	solidity: [".sol"],
	swift: [".swift"],
	typescript: [".ts", ".cts", ".mts"],
	tsx: [".tsx"],
	yaml: [".yml", ".yaml"],
};

export function detectCliLanguageFromPath(filePath: string): (typeof CLI_LANGUAGES)[number] | null {
	const normalized = filePath.toLowerCase();
	const matches = CLI_LANGUAGES.filter((language) => {
		const exts = LANG_EXTENSIONS[language] ?? [];
		return exts.some((ext) => normalized.endsWith(ext));
	});
	if (matches.length !== 1) {
		return null;
	}
	return matches[0] ?? null;
}
