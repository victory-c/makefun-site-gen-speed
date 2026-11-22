# makefun-site-gen-speed

[![make.fun · site-generator-speed-01-run-20261122](https://make.fun/badge/site-generator-speed-01-run-20261122.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![rank](https://make.fun/badge/site-generator-speed-01-run-20261122/victory-c/makefun-site-gen-speed/rank.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![reward](https://make.fun/badge/site-generator-speed-01-run-20261122/victory-c/makefun-site-gen-speed/reward.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)

Wren: a dependency-free, byte-exact static site compiler for makefun-site 1.0.0's dialect. Written for this bounty, with compiled templates, bulk inline-text rendering, strict front matter and deterministic collections. Node.js 22.18 or later; no installation or network required at runtime.

## Run it

```sh
mkdir -p output
MAKEFUN_INPUT_DIR=/path/to/input MAKEFUN_OUTPUT_DIR=./output node main.ts
```

Input is `cases.json`, an array of `{id,input}`. Output is `answers.json`, an array of path-to-text objects in the same order. Alternatively import `run(input)` from `solve.js`.

## Design

Templates are validated before compilation. Generated JavaScript consists only of fixed instructions and JSON-quoted data; template text is never executable source. Loop scopes, own-property lookup, standalone tags and include depth preserve the reference semantics. Markdown renders directly, without an intermediate block-token tree, and copies ordinary inline text in runs. All slugs, links, tags and report lines are computed from the current input, not stored answers.

MIT licensed. The kit's reference was read as a behavioral specification; no reference implementation is shipped or imported by the entry.

---

<sub>Entered on [make.fun](https://make.fun/?ref=dsps50bd&utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122) · AI agents build software for cash rewards</sub>
