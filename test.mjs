// SPDX-License-Identifier: MIT
// Optional differential suite. The official kit is an external test oracle only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { run } from './solve.js';
import { front } from './front.js';
import { compile } from './template.js';
import { markdown } from './markdown.js';
import { slug } from './text.js';
let checks = 0;
const same = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
same(slug('Ｗｉｄｅ café 東京'), 'wide-cafe', 'Unicode slug');
same(front('---\ntitle: a\ntitle: b\n---\nx').error, 'key "title" is given twice', 'duplicate key');
same(front('---\ntitle: a\ndate: 2025-02-29\n---').error, 'key "date": not a date from 1970-01-01 to 2099-12-31 (YYYY-MM-DD)', 'leap day');
same(front('---\ntitle: ""\n---').data.title, '', 'empty quoted title');
same(markdown('## A\n## A\n\nhello & <world>', x => x), {
  html: '<h2 id="a">A</h2>\n<h2 id="a-2">A</h2>\n<p>hello &amp; &lt;world&gt;</p>\n',
  toc: [{ level: 2, id: 'a', html: 'A' }, { level: 2, id: 'a-2', html: 'A' }], excerpt: 'hello &amp; &lt;world&gt;'
}, 'headings and escaping');
const t = compile('page', 'before\n  {% if page.ok %}\n{{ page.title }}\n{% else %}\nnone\n{% endif %}\nafter');
same(t([{ page: { ok: true, title: '<a>' } }], new Map()), 'before\n&lt;a&gt;\nafter', 'standalone tags');
const loop = compile('page', '{% for loop in xs %}{{loop.index}}{% endfor %}');
same(loop([{ xs: [42, 43] }], new Map()), '12', 'loop shadows binding');
const cycle = compile('page', 'a{% include "page" %}');
same(cycle([{}], new Map([['page', cycle]])), 'a'.repeat(9), 'include cap');
const kit = process.env.MAKEFUN_KIT;
if (kit) {
  const load = p => import(pathToFileURL(resolve(kit, p)).href);
  const { build } = await load('program/generator/vendor/makefun-site/index.js');
  const { generate } = await load('program/generator/subject/sites.mjs');
  const { streamFor } = await load('program/generator/rng.ts');
  const cases = JSON.parse(readFileSync(resolve(kit, 'practice/input/cases.json')));
  const expected = JSON.parse(readFileSync(resolve(kit, 'practice/reference/expected.json'))).cases;
  for (let i = 0; i < cases.length; i++) same(run(cases[i].input), expected[i].output, cases[i].id);
  const count = +(process.env.TEST_SITES ?? 30);
  for (let i = 0; i < count; i++) {
    const seed = createHash('sha256').update('wren-differential-' + i).digest('hex');
    const site = generate(streamFor(seed, 'case', i), i);
    same(run(site), build(site), 'generated site ' + i);
    if ((i + 1) % 25 === 0) console.log('differential sites:', i + 1);
  }
  // Deliberately exercise invalid templates and malformed headers beyond the generator's distribution.
  const badTemplates = ['{{', '{{{', '{%', '{{ x-y }}', '{% endif %}', '{% endfor %}', '{% if a %}', '{% for x in a %}',
    '{% else %}', '{% if a %}{% else %}{% else %}', '{% include "BAD" %}', '{% what %}', '{% if a-b %}', '{% for x in a-b %}'];
  const headers = ['title: a', 'title: "a\\n"', 'title: [x]', 'title: "a"b"', 'title: "unfinished', 'title: a\nunknown: x',
    'title: a\nslug: invalid--slug', 'title: a\nlayout: BAD', 'title: a\ndraft: True', 'title: a\ntags: [a,,b]',
    'title: a\ndate: 2000-02-29', 'title: a\ndate: 2100-01-01', 'title: a\nsummary:', 'title: a\n title: b', '', '#comment'];
  const sample = { site: { title: 'Test', base_url: '/base///', per_page: 2, recent: 3 }, templates: { page: '{{{ page.content }}}', post: '{{page.title}}', index: '{{pager.total}}', tags: '' }, files: [] };
  for (const bad of badTemplates) {
    const x = { ...sample, templates: { ...sample.templates, broken: bad } };
    same(run(x), build(x), 'invalid template ' + bad);
  }
  for (const h of headers) {
    const x = { ...sample, files: [{ path: 'a.md', content: '---\n' + h + '\n---\nbody' }] };
    same(run(x), build(x), 'header ' + h);
  }
}
console.log('PASS:', checks, 'assertions');
