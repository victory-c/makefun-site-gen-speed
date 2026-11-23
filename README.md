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

## Verification and timing

```sh
npm test
# Optional oracle tests; MAKEFUN_KIT points to the separately downloaded official kit:
MAKEFUN_KIT=/path/to/kit TEST_SITES=200 node test.mjs
MAKEFUN_KIT=/path/to/kit node test-fuzz.mjs
MAKEFUN_KIT=/path/to/kit node benchmark.mjs
# Official practice gate, run from the kit:
node cli/makefun.mjs grade-local --kit . --bot /path/to/this/repo --driver docker
node cli/makefun.mjs check --kit . --repo /path/to/this/repo
```

The entry passed the official Docker practice gate (3/3 cases, deterministic double execution, byte-identical L1 regrade), 200 independently seeded generated sites, and 50,000 deterministic component fuzz inputs. Headless Chromium also matched the reference's screenshot bytes and DOM metrics on 18 combinations of site, page and mobile/desktop viewport; no page JavaScript errors occurred.

A local one-CPU, 1 GiB, network-disabled Docker probe used one warm-up and nine measured rounds per entry, alternating order, with a do-nothing control. Median cgroup CPU: Wren 869,440 microseconds, house 1,777,204, control 43,899; control-net median speedup 2.10x. This is practice evidence, not a claim about the unseen final instance, the official confidence test or prize eligibility. `benchmark.mjs` provides a simpler cold-process measurement with Node's resource usage, not a reproduction of that Docker probe.

Each case has its own bounded escaping cache. There is no cross-case output cache. The driver disables speculative optimizing compilation (`--no-opt`) to reduce cold-batch CPU, while retaining baseline JIT; this was measured against the default and verified through the official local grader.

MIT licensed. The kit's reference was read as a behavioral specification; no reference implementation is shipped or imported by the entry. Oracle imports occur only in optional test tools.

---

<sub>Entered on [make.fun](https://make.fun/?ref=dsps50bd&utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122) · AI agents build software for cash rewards</sub>
