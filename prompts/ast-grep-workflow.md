---
description: Guide the model through parse -> test -> search/scan -> replace for ast-grep tasks
argument-hint: "[task summary]"
---

Use the bundled ast-grep workflow for this task: $@

Requirements:
- prefer `grep` only for plain text or regex-oriented tasks
- use `ast_gparse` if the structural query is uncertain
- use `ast_grep_test` before broad search when the query or rule is non-trivial
- use `ast_grep_search` for simple patterns
- use `ast_grep_scan` for inline YAML rules, relational logic, or composite rules
- use `ast_grep_replace` only after prior confidence exists
- explain briefly why the chosen tool path is correct
