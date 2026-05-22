---
name: ast-grep-guidance
description: Guidance for choosing and sequencing pi-ast-grep tools. Use when a task needs structural code search, rule authoring, pattern debugging, example-based validation, advanced YAML rules, or safe structural replacement in Pi.
---

# ast-grep Guidance

## Purpose

This skill teaches the correct workflow for structural search and rewrite inside Pi.

Use this skill when plain text search is not enough, when an ast-grep query is uncertain, or when the model needs to decide between:
- `grep`
- `ast_gparse`
- `ast_grep_test`
- `ast_grep_search`
- `ast_grep_scan`
- `ast_grep_replace`

## Tool Choice Rules

### Use `grep` when
- the user asked for plain text search
- the query is regex-oriented
- the query is cross-language text search
- the structure of the code does not matter

### Use `ast_gparse` when
- the structural query might be malformed
- the model needs to inspect how ast-grep parses the pattern
- a search produced no matches and the pattern may be wrong

### Use `ast_grep_test` when
- the model has example code and wants to validate a pattern first
- a YAML rule should be tested before scanning the repository
- the query is complex enough that a preflight validation step is safer than broad search

### Use `ast_grep_search` when
- the query is a simple ast-grep pattern
- repository-wide matching is needed
- YAML rule power is not required

### Use `ast_grep_scan` when
- the query needs inline YAML rules
- relational rules are required (`inside`, `has`, `follows`, `precedes`)
- composite logic is required (`all`, `any`, `not`)
- rule metadata matters

### Use `ast_grep_replace` when
- the rewrite is structural and repeated across files
- the model has already established confidence via parse/test/search/scan
- dry-run should happen first unless the task is already verified

## Default Workflow

For uncertain or non-trivial structural queries, use this order:

1. `ast_gparse`
2. `ast_grep_test`
3. `ast_grep_search` or `ast_grep_scan`
4. `ast_grep_replace`

## Failure Recovery

### If `ast_grep_search` returns no matches
- inspect the query with `ast_gparse`
- test the pattern against a small code sample with `ast_grep_test`
- if the task is more relational than atomic, escalate to `ast_grep_scan`

### If `ast_grep_test` fails on a YAML rule
- simplify the rule
- test sub-rules separately
- inspect the target pattern shape with `ast_gparse`
- then rebuild the full YAML rule

### If the query looks regex-like
Do not force ast-grep. Use `grep` unless the task truly requires AST structure.

## Rule Authoring Guidance

Prefer this progression:

- start with the smallest valid structure
- verify against example code
- only then add relational constraints
- only then scan the repository

Examples and deeper workflow notes are in [references/workflow.md](references/workflow.md).
