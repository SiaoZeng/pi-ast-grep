# Mini Spec: `ast_gparse`

## Status

Draft

## Goal

Add a third pi-native tool, `ast_gparse`, that helps the model inspect how ast-grep parses a query pattern before running broader structural searches.

## Why

`pi-ast-grep` already supports structural search and replace, but it does not yet help the model debug a pattern when no match appears. The ast-grep CLI already exposes `sg run --debug-query[=<format>]`, so the missing capability is integration, not a new parsing engine.

This addresses the current root cause: the model can search and rewrite, but cannot inspect its own ast-grep query structure from inside pi.

## Scope

### In scope

- Add tool `ast_gparse`
- Wrap `sg run --debug-query`
- Support explicit language selection
- Support debug formats exposed by ast-grep CLI:
  - `pattern`
  - `ast`
  - `cst`
  - `sexp`
- Return parse/debug output as plain text
- Add pi renderers for tool call/result
- Add tests for tool registration, CLI args, render, and execution helper behavior
- Update README

### Out of scope

- Parsing arbitrary source files into ASTs outside ast-grep's query debug surface
- YAML rule testing
- Interactive AST browsing UI
- Inline-rules support in this slice

## User-visible behavior

The model can call:

```text
ast_gparse({
  pattern: "function $NAME($$$) { $$$ }",
  lang: "typescript",
  format: "ast"
})
```

and receive the ast-grep query debug output for that pattern.

## Tool contract

### Name

`ast_gparse`

### Parameters

- `pattern: string` — required
- `lang: CliLanguage` — required
- `format: "pattern" | "ast" | "cst" | "sexp"` — optional, default `ast`
- `selector: string` — optional
- `strictness: "cst" | "smart" | "ast" | "relaxed" | "signature" | "template"` — optional

### Result

Text output from `sg run --debug-query=<format>`.

### Error behavior

- same binary-resolution and install guidance as existing tools
- stderr-only failures should surface as tool errors
- timeout behavior should mirror existing CLI wrapper behavior

## Design

### CLI layer

Add a dedicated helper in `src/ast-grep/cli.ts` instead of overloading `runSg` JSON search handling.

Reason:
- `runSg` is match-oriented and assumes JSON search output
- `ast_gparse` is text-oriented and debug-output-oriented
- separate helper keeps search/replace code simple and avoids mixed parsing branches

### Render layer

Add dedicated render functions so the tool call/result stays concise in collapsed mode and readable in expanded mode.

### Documentation

README must document:
- when to use `ast_gparse`
- that it inspects the ast-grep query pattern
- supported formats

## Files expected to change

- `src/ast-grep/types.ts`
- `src/ast-grep/cli.ts`
- `src/ast-grep/tools.ts`
- `src/ast-grep/render.ts`
- `src/index.ts`
- `README.md`
- `test/cli-args.test.ts`
- `test/extension-registration.test.ts`
- `test/render.test.ts`
- new focused tests for parse helper behavior if needed

## Acceptance criteria

- `ast_gparse` is registered by the extension
- `npm run check` passes
- `npm test` passes
- `npm run test:integration` passes
- README describes `ast_gparse`
- tool uses ast-grep CLI locally, not MCP

## Rollback plan

If the slice must be reverted:

1. remove `ast_gparse` registration from `src/index.ts`
2. remove the helper and schemas
3. remove README/test updates
4. rerun `npm run check && npm test && npm run test:integration`
