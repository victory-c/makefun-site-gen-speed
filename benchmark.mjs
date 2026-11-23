// SPDX-License-Identifier: MIT
// Advisory cold-process CPU benchmark. Official ranking uses the server's heat.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
if (process.argv[2] === '--child') {
  await import(pathToFileURL(process.argv[3]).href);
  const usage = process.resourceUsage();
  console.log(JSON.stringify({ cpu_us: usage.userCPUTime + usage.systemCPUTime }));
} else {
  const kit = process.env.MAKEFUN_KIT;
  if (!kit) throw new Error('Set MAKEFUN_KIT to the official unpacked kit');
  const count = +(process.env.BENCH_ROUNDS ?? 9);
  if (!Number.isInteger(count) || count < 3) throw new Error('BENCH_ROUNDS must be an integer >= 3');
  const scratch = mkdtempSync(join(tmpdir(), 'wren-bench-'));
  const entries = { wren: resolve(import.meta.dirname, 'main.ts'), house: resolve(kit, 'baselines/makefun-site/main.ts') };
  const times = { wren: [], house: [] };
  const answers = {};
  try {
    for (let round = 0; round <= count; round++) {
      for (const name of round % 2 ? ['house','wren'] : ['wren','house']) {
        const child = spawnSync(process.execPath, [import.meta.filename, '--child', entries[name]], {
          env: { ...process.env, MAKEFUN_INPUT_DIR: resolve(kit, 'practice/input'), MAKEFUN_OUTPUT_DIR: scratch },
          encoding: 'utf8', timeout: 30000
        });
        if (child.status) throw new Error(child.stderr || 'benchmark child failed');
        const measurement = JSON.parse(child.stdout);
        if (round) times[name].push(measurement.cpu_us);
        answers[name] = JSON.parse(readFileSync(join(scratch, 'answers.json')));
      }
    }
    if (!isDeepStrictEqual(answers.wren, answers.house)) throw new Error('Outputs differ');
    const median = xs => {
      const s = xs.slice().sort((a,b) => a-b), n = s.length;
      return n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2])/2;
    };
    console.log(JSON.stringify({ node: process.version, rounds: count, cpu_us: times,
      median_cpu_us: { wren: median(times.wren), house: median(times.house) },
      speedup: median(times.house) / median(times.wren), output_equal: true,
      note: 'Advisory local CPU measurement, not the official sandbox timing heat.' }, null, 2));
  } finally {
    // Only the temporary directory created by this benchmark is removed.
    rmSync(scratch, { recursive: true, force: true });
  }
}
