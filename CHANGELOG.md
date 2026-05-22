# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- configurable ast-grep binary path override via `PI_AST_GREP_PATH` (and `AST_GREP_BIN` alias), with explicit error reporting for invalid configured paths.
- scale controls for structural search and scan, including `maxResults` and `resultMode="files"` surfaces for cheaper repository discovery.
- bundled guidance resources: the `ast-grep-guidance` skill and `/ast-grep-workflow` prompt template for parse → test → search/scan → replace flows.
- `ast_grep_scan`, an advanced repository scan tool for running inline YAML ast-grep rules across project files.
- `ast_grep_test`, a validation tool for checking simple patterns or inline YAML rules against explicit example code before repository-wide search.
- `ast_gparse`, a pi-native wrapper around `sg run --debug-query`, for inspecting how ast-grep parses structural query patterns before broader searches.
- Initial release porting omo's `ast_grep_search` and `ast_grep_replace` tools
  as a pi-coding-agent extension.
- Auto-resolution of the `sg` binary across `@ast-grep/cli` npm package,
  platform-specific npm packages, Homebrew (`/opt/homebrew/bin/sg`,
  `/usr/local/bin/sg`), `PATH`, and a last-resort GitHub release download
  cached under `$XDG_CACHE_HOME/pi-ast-grep/bin/`.
- `PI_OFFLINE=1` environment gate that skips the network download path and
  surfaces manual install guidance instead.
- Custom TUI rendering: collapsed match counts, expanded match list with
  `file:line:col`, dry-run vs applied replace styling, truncation warnings,
  and infrastructure-error rendering.
- TypeBox tool schemas with `StringEnum` for the `lang` parameter so the tool
  surface stays compatible with Google's tool-calling API.
- `ast_grep_replace.executionMode = "sequential"` so the external `sg --update-all`
  process never races against pi's parallel tool execution.
