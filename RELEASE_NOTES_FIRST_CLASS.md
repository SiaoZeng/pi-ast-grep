# Release Notes — First-Class Fork Update

## Scope

This document summarizes the cumulative changes in this fork relative to:

- upstream repository: `code-yeongyu/pi-ast-grep`
- upstream branch: `main`

Compared range at the time of writing:

- `upstream/main..main`

This is not a small patch release. It is a product-level expansion of the original extension into a more complete structural-search workflow for Pi.

## High-Level Summary

The upstream project already provided a solid base for AST-aware search and replace inside Pi. This fork expands that base into a first-class workflow covering:

- query inspection
- example-based validation
- simple repository search
- advanced rule-based repository scanning
- structural replacement
- guidance for the model on when to use which surface
- output scaling controls for large repositories
- binary path configurability and safer runtime behavior
- improved package/distribution hygiene

In short:

- upstream: useful AST-aware extension
- this fork: broader, workflow-complete structural-search product for Pi

## Delta vs Upstream

### New user-facing capabilities

#### 1. `ast_gparse`
A new query-debug tool for inspecting how ast-grep parses a structural pattern.

Use cases:
- understand why a pattern does not match
- inspect AST/CST/sexp/pattern views before searching a repository
- debug structural syntax instead of iterating blindly

#### 2. `ast_grep_test`
A new validation surface for testing:
- simple patterns against example code
- inline YAML rules against example code

Use cases:
- validate a rule before broad repository search
- test relational/composite rules on a small sample first
- reduce false starts and wasted search iterations

#### 3. `ast_grep_scan`
A new advanced repository scan surface.

Supported sources:
- inline YAML rules
- single rule file via `ruleFile`
- project config via `configPath` / `sgconfig.yml`

Supported rule styles:
- atomic rules
- relational rules
- composite rules
- reusable rule-file and project-rule workflows

This closes one of the biggest gaps between the original extension and real ast-grep power.

### Workflow guidance added

The fork now ships a guidance layer, not just tools.

Added package resources:
- skill: `ast-grep-guidance`
- prompt template: `/ast-grep-workflow`

These resources teach the intended workflow:
- `grep` for plain text
- `ast_gparse` for query inspection
- `ast_grep_test` for validation
- `ast_grep_search` for simple structural search
- `ast_grep_scan` for advanced YAML/rule workflows
- `ast_grep_replace` for structural rewrite after confidence exists

This is a major behavioral improvement for model-driven usage.

### Search and scan scaling controls

The fork adds controls that make the extension more usable on larger repositories and in token-constrained agent flows.

Added:
- `maxResults`
- `resultMode="files"`
- stream-aware parsing for bounded result collection

Effects:
- lower context footprint
- cheaper discovery path when file lists are sufficient
- better behavior when a full match dump would be too large

### Replace UX improvements

Structural replacement now supports a clearer diff-style preview when ast-grep returns replacement data.

Instead of only showing the matched line, the formatter can show a before/after shape for replacements, which is much more useful during dry-run review.

### Safe auto language detection

For `ast_grep_search` and `ast_grep_replace`, `lang` can now be omitted when:
- exactly one file path is provided, and
- the file extension maps unambiguously to one supported language

Important behavior:
- detection fails closed on ambiguous extensions (for example `.h`)
- the tool does not silently guess when ambiguity exists

### Binary path configuration and runtime hardening

Added:
- `PI_AST_GREP_PATH`
- `AST_GREP_BIN` alias

This lets operators force a known binary path instead of relying on PATH/package/cache discovery.

Additional runtime hardening:
- path/argv separation via `--` before positional paths to avoid option injection through path arguments
- alias resolution for both `sg` and `ast-grep`
- clearer configuration error behavior for invalid binary overrides

### Download / provenance behavior changes

The fork changes the binary download posture significantly.

Upstream-style implicit fallback behavior has been tightened.

Current behavior in this fork:
- auto-download is explicit opt-in via `PI_AST_GREP_ALLOW_DOWNLOAD=1`
- downloaded binaries are validated against expected `--version` output
- version fallback was updated to the newer ast-grep baseline (`0.42.3`)

This is safer than the original implicit fallback, though it is still not full cryptographic verification.

### Packaging and distribution improvements

Added / changed:
- `.npmignore`
- `pi-package` keyword
- package exports for:
  - extensions
  - skills
  - prompts
- clean `npm pack --dry-run` surface

This makes the fork more usable as an actual shareable Pi package rather than just a local extension directory.

## Internal / Architectural Changes

### CLI abstraction expanded

The CLI layer now handles a much broader set of cases:
- pattern search
- debug-query inspection
- test-mode validation
- advanced scan execution
- files-only result mode
- stream-based bounded parsing
- config/rule source selection
- binary path/config errors

### Type surface expanded

The shared type layer now models:
- debug-query formats
- test modes
- scan modes and sources
- result modes
- file-only result payloads
- replacement preview fields
- binary/runtime config effects

### Render layer expanded

The render layer now understands:
- parse flows
- test flows
- scan flows
- file-only result summaries
- richer replace previews
- metadata-aware scan output

### Tests expanded substantially

New coverage areas include:
- binary-path override handling
- manifest/package exports
- scan argument builders
- stream/file-mode result parsing
- rule-file/config scan paths
- auto language detection
- timeout handling
- diff-style replace previews

## Verification Snapshot

At the time this release note was written, the fork passed:

```bash
npm run check
npm test
npm run test:integration
npm pack --dry-run
```

That means the current fork `main` is locally verified as:
- typecheck-clean
- formatter/lint-clean
- unit/integration-test clean
- packageable

## Files Changed vs Upstream

Broadly, the fork changed these areas:

### Package / metadata
- `.gitignore`
- `.npmignore`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `STATUS.md`

### New package resources
- `skills/ast-grep-guidance/SKILL.md`
- `skills/ast-grep-guidance/references/workflow.md`
- `prompts/ast-grep-workflow.md`

### Core source changes
- `src/index.ts`
- `src/ast-grep/binary-path.ts`
- `src/ast-grep/cli.ts`
- `src/ast-grep/downloader.ts`
- `src/ast-grep/json-output.ts`
- `src/ast-grep/languages.ts`
- `src/ast-grep/process-timeout.ts`
- `src/ast-grep/render.ts`
- `src/ast-grep/result-formatter.ts`
- `src/ast-grep/tools.ts`
- `src/ast-grep/types.ts`

### Test coverage changes
- `test/binary-path.test.ts`
- `test/cli-args.test.ts`
- `test/downloader.test.ts`
- `test/extension-registration.test.ts`
- `test/language-support.test.ts`
- `test/package-manifest.test.ts`
- `test/render.test.ts`
- `test/result-formatter.test.ts`
- `test/sg-binary.integration.test.ts`
- `test/sg-compact-json-output.test.ts`
- `test/spawn-adapter.test.ts`

## Compatibility Notes

### Compatible
- Pi extension usage remains CLI-first
- existing `ast_grep_search` and `ast_grep_replace` workflows remain present
- the package still works without MCP

### Behavior changes to note
- binary auto-download is no longer an implicit fallback; it now requires explicit opt-in
- `lang` is optional only in safe, single-file, unambiguous cases
- `ast_grep_scan` should now be used for advanced YAML/rule workflows instead of overloading `ast_grep_search`

## Remaining Known Gaps

This fork is materially stronger than upstream in workflow completeness, but there are still a few open areas:

### 1. Real Windows runtime proof
The fork includes code-path hardening for Windows-related issues, but this release note does not claim full Windows runtime proof without a real Windows execution or CI job.

### 2. Cryptographic provenance verification
The downloader now requires explicit opt-in and validates version output, but it still does not implement checksum/signature verification.

### 3. Additional polish opportunities
Possible future work:
- even stronger command-level UX around `/ast-grep`
- broader CI/platform matrix
- stronger supply-chain verification model

## Recommended Interpretation

If you are comparing this fork to upstream, the main takeaway is:

- upstream remains a good minimal AST-aware Pi extension
- this fork pushes the project into a more complete structural-search product, especially for model-driven workflows

## Branch / Release Context

This release note reflects the fork after local release-candidate integration was merged into `main` and pushed.

Current fork baseline branch:
- `main`

## Bottom Line

This fork is now substantially beyond upstream in:
- workflow completeness
- rule execution breadth
- operator/model guidance
- scaling controls
- runtime configurability
- package readiness

It should be treated as a serious first-class fork baseline rather than a small extension variant.
