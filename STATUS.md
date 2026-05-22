# Status Report

## Current State

`pi-ast-grep` is no longer a thin search/replace wrapper. The fork now provides a first-class structural search workflow for Pi.

Implemented surfaces:

- `ast_gparse`
- `ast_grep_test`
- `ast_grep_search`
- `ast_grep_scan`
- `ast_grep_replace`

Bundled guidance resources:

- skill: `ast-grep-guidance`
- prompt template: `/ast-grep-workflow`

## Delivered Capabilities

### Query development and validation

- query debug via `sg run --debug-query`
- example-code validation for simple patterns
- example-code validation for inline YAML rules

### Repository execution

- simple structural search
- advanced inline-rule scanning
- rule-file scanning
- `sgconfig.yml` / config-path scanning
- structural replace with preview-first flow

### Output control

- `maxResults`
- `resultMode="files"`
- stream-aware counting for bounded result collection
- diff-style replace preview when replacement data is available

### Binary and runtime hardening

- configurable binary path via `PI_AST_GREP_PATH`
- alias support via `AST_GREP_BIN`
- PATH lookup for both `sg` and `ast-grep`
- explicit opt-in auto-download via `PI_AST_GREP_ALLOW_DOWNLOAD=1`
- downloaded binary version validation
- safer auto language detection that fails closed on ambiguous extensions
- `--` path separation to avoid flag injection through positional paths

### Packaging

- package exports extensions, skills, and prompts
- `.npmignore` added
- `pi-package` keyword added
- `npm pack --dry-run` is clean

## Verification

Fresh verification on `main`:

```bash
npm run check
npm test
npm run test:integration
npm pack --dry-run
```

Latest verified integration state:

- `npm run check` passed
- `npm test` passed
- `npm run test:integration` passed
- `npm pack --dry-run` passed

## Remaining Gaps

The fork is functionally release-ready for local first-class use.

Remaining work is mostly about confidence and policy, not core capability:

- real Windows runtime proof on a Windows host or CI job
- cryptographic checksum or signature verification for the opt-in download path
- optional additional command-level UX polish

## Branch Status

The first-class line has been merged into `main`.

Local and fork remote:

- branch: `main`
- merge commit: `ff4d5de`

## Summary

The fork now supports a complete parse -> test -> search -> scan -> replace workflow inside Pi and is suitable as the current product baseline.
