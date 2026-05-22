# ast-grep Workflow Reference

## Structural Search Progression

### 1. Parse first when uncertain

Example pattern:

```text
function $NAME($$$) { $$$ }
```

Use `ast_gparse` if you are unsure how ast-grep interprets it.

### 2. Test against example code

Example code:

```ts
async function load() {
  await fetchData()
}
```

Use `ast_grep_test` to validate either:
- a simple pattern
- an inline YAML rule

### 3. Choose simple search vs advanced scan

Use `ast_grep_search` for simple patterns such as:

```text
console.log($MSG)
```

Use `ast_grep_scan` for relational/composite YAML rules such as:

```yaml
id: await-in-loop
language: typescript
rule:
  pattern: await $PROMISE
  inside:
    any:
      - kind: for_statement
      - kind: while_statement
    stopBy: end
```

### 4. Replace only after confidence exists

If a rewrite will affect multiple files, confirm the search or scan surface first, then use `ast_grep_replace`.

## Common Escalation Rules

### Pattern looks regex-like
Use `grep` instead.

### Pattern is structurally simple
Use `ast_grep_search`.

### Pattern needs nesting, order, exclusion, or relations
Use `ast_grep_scan`.

### Search returns nothing and confidence is low
Go back to `ast_gparse` and `ast_grep_test`.
