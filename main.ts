// SPDX-License-Identifier: MIT
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setFlagsFromString } from 'node:v8';
// This is a cold, three-site batch. Avoid speculative optimizing-compiler work
// whose CPU cost is not amortized before the process exits; keep baseline JIT.
setFlagsFromString('--no-incremental-marking --no-opt');
const { run } = await import('./solve.js');
const cases = JSON.parse(readFileSync(resolve(process.env.MAKEFUN_INPUT_DIR ?? '/input', 'cases.json'), 'utf8'));
const answers = cases.map(c => run(c.input));
writeFileSync(resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output', 'answers.json'), JSON.stringify(answers));
