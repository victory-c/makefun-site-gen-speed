// SPDX-License-Identifier: MIT
// Reproducible component fuzzing against an explicitly supplied, external kit.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inline, markdown } from './markdown.js';
import { front } from './front.js';
import { compile } from './template.js';
const kit = process.env.MAKEFUN_KIT;
if (!kit) throw new Error('Set MAKEFUN_KIT to the official unpacked kit');
const load = file => import(pathToFileURL(resolve(kit, 'program/generator/vendor/makefun-site', file)).href);
const md = await load('lib/markdown.js');
const fm = await load('lib/frontmatter.js');
const tpl = await load('lib/template.js');
const { escapeHtml } = await load('lib/text.js');
let seed = 42091;
const rand = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
const pick = xs => xs[rand(xs.length)];
const text = (atoms, max) => { let s = ''; for (let j = rand(max); j >= 0; j--) s += pick(atoms); return s; };
const link = s => '/resolved/' + s;
const atoms = ['word',' x ','\\','\\*','\\\\','`','**','***','*','[',']','(',')','[x](a.md)','[x](#part)','<','&','"',"'",'_','東京','\n','    ','\t'];
for (let i = 0; i < 20000; i++) {
  const s = text(atoms, 40);
  assert.equal(inline(s, link), md.inline(s, { link }), 'inline ' + JSON.stringify(s));
}
const blocks = ['# h','## h','## h','### x  ','####### x','#  ','```','```js','```BAD!','---','***','>','> x','> > nested','- a','* b','1. a','7. b','9999999999. x','   continued','  \tfoo','paragraph `code`','paragraph *em*','  ','=','東京','a\u00a0b'];
for (let i = 0; i < 10000; i++) {
  const s = text(blocks.map(x => x + '\n'), 25);
  assert.deepEqual(markdown(s, link), md.renderMarkdown(s, { link }), 'blocks ' + JSON.stringify(s));
}
const headers = ['title: a','title: ""','title: "bad\\q"','title: "a\\""','title: "a\\\\"','title: [a]','date: 2000-02-29','date: 2099-02-29','date: 1970-00-00','draft: false','draft: True','layout: a','slug: a--b','tags: []','tags: [ ]','tags: [ a , b ]','tags: [a,]','# x','  # x','unknown: a','title:','title:a','---','',' \t'];
for (let i = 0; i < 10000; i++) {
  const s = (rand(4) ? '---\n' : '') + text(headers.map(x => x + '\n'), 8) + (rand(4) ? '---\nbody' : '');
  assert.deepEqual(front(s), fm.parseFrontMatter(s), 'front ' + JSON.stringify(s));
}
const tokens = ['text','\n',' ', '{{a}}','{{{a}}}','{{x.title}}','{{loop.index}}','{{loop}}','{{a.length}}','{{a.0}}','{{constructor}}','{{a.constructor}}','{% if a %}','{% if not b %}','{% else %}','{% endif %}','{% for x in a %}','{% for loop in a %}','{% endfor %}','{% include "part" %}','{% wat %}','{%','{{','{{{'];
for (let i = 0; i < 10000; i++) {
  const s = text(tokens, 16);
  let a, b, ours, theirs;
  try { a = compile('test', s); } catch (e) { ours = e.message; }
  try { b = tpl.parseTemplate('test', s); } catch (e) { theirs = e.message; }
  assert.equal(ours, theirs, 'template parse ' + JSON.stringify(s));
  if (!ours) for (const v of [[], [{title:'<&>'},null], false, 0, '', {title:'value'}]) {
    const vars = { a: v, b: true, x: { title: 'root' } };
    const rt = new Map([['part',tpl.parseTemplate('part','{{x.title}}{{loop.index}}')]]);
    const ot = new Map([['part',compile('part','{{x.title}}{{loop.index}}')]]);
    assert.equal(a([vars],ot),tpl.renderNodes(b,{vars,parent:null},{templates:rt,escape:escapeHtml},0),'template render ' + JSON.stringify(s));
  }
}
console.log('PASS: 50000 deterministic component fuzz inputs');
