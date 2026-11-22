// SPDX-License-Identifier: MIT
import { front } from './front.js';
import { compile } from './template.js';
import { markdown } from './markdown.js';
import { slug, unique, compare, dateText, escape } from './text.js';
const directory = p => p.slice(0, Math.max(0, p.lastIndexOf('/')));
export function run(input) {
  const base = input.site.base_url.replace(/\/+$/, ''), templates = new Map(), report = [], broken = new Set();
  const escaped = new Map();
  const escapeValue = text => {
    const cached = escaped.get(text);
    if (cached !== undefined) return cached;
    const result = escape(text);
    if (escaped.size < 8192 && text.length < 4096) escaped.set(text, result);
    return result;
  };
  for (const name of Object.keys(input.templates).sort()) {
    try { templates.set(name, compile(name, input.templates[name], escapeValue)); }
    catch (e) { report.push(e.message); }
  }
  const sources = [], statics = [], bySource = new Map(), occupied = new Map();
  for (const f of input.files.slice().sort((a, b) => compare(a.path, b.path))) {
    if (!f.path.endsWith('.md')) { statics.push(f); continue; }
    const parsed = front(f.content.replace(/\r\n?/g, '\n'));
    const d = parsed.data, post = f.path.startsWith('posts/');
    let error = parsed.error, layout;
    if (!error) {
      if (f.path.startsWith('tags/')) error = "tags/ is the generator's own";
      else if (f.path.startsWith('page/')) error = "page/ is the generator's own";
      else if (post && !Object.hasOwn(d, 'date')) error = 'a post needs a date';
      else {
        layout = d.layout ?? (post ? 'post' : 'page');
        if (!templates.has(layout)) error = `layout "${layout}" is no template that parses`;
      }
    }
    if (error) { report.push(`refused ${f.path}: ${error}`); continue; }
    if (d.draft === true) { report.push('draft ' + f.path); continue; }
    const dir = post ? 'posts' : directory(f.path);
    if (!occupied.has(dir)) occupied.set(dir, new Set(dir ? [] : ['posts', 'tags', 'page']));
    const id = unique(d.slug ?? slug(d.title), occupied.get(dir));
    const outDir = dir ? dir + '/' + id : id;
    const s = { path: f.path, data: d, body: parsed.body, post, layout, slug: id, outDir, url: base + '/' + outDir + '/' };
    sources.push(s); bySource.set(f.path, s);
  }
  const staticPaths = new Set(statics.map(f => f.path));
  for (const s of sources) {
    const dir = directory(s.path);
    const resolve = target => {
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target) || target[0] === '/' || target[0] === '#') return target;
      const hash = target.indexOf('#'), rel = hash < 0 ? target : target.slice(0, hash), fragment = hash < 0 ? '' : target.slice(hash);
      const parts = dir ? dir.split('/') : [];
      let valid = !!rel;
      for (const bit of rel.split('/')) {
        if (!bit || bit === '.') continue;
        if (bit === '..') { if (!parts.length) { valid = false; break; } parts.pop(); }
        else parts.push(bit);
      }
      const path = parts.join('/');
      if (valid && bySource.has(path)) return bySource.get(path).url + fragment;
      if (valid && staticPaths.has(path)) return base + '/' + path + fragment;
      broken.add(`broken-link ${s.path} -> ${target}`); return target;
    };
    Object.assign(s, markdown(s.body, resolve));
  }
  const posts = sources.filter(s => s.post).sort((a, b) => compare(b.data.date, a.data.date) || compare(a.slug, b.slug));
  const tagsBySlug = new Map();
  const sourceTags = s => {
    const found = new Set(), refs = [];
    for (const name of s.data.tags ?? []) {
      const id = slug(name);
      if (found.has(id)) continue;
      found.add(id);
      let tag = tagsBySlug.get(id);
      if (!tag) {
        tag = { name, slug: id, url: s.post ? base + '/tags/' + id + '/' : '', posts: [] };
        if (s.post) tagsBySlug.set(id, tag);
      }
      if (s.post) tag.posts.push(s);
      refs.push({ name: tag.name, slug: id, url: tag.url });
    }
    s.tagRefs = refs;
  };
  posts.forEach(sourceTags);
  for (const s of sources) if (!s.post) sourceTags(s);
  const tags = [...tagsBySlug.values()].sort((a, b) => b.posts.length - a.posts.length || compare(a.slug, b.slug));
  for (const s of sources) {
    s.card = { title: s.data.title, url: s.url, date: s.data.date ?? '', date_long: dateText(s.data.date), summary: s.data.summary ?? '',
      excerpt: s.excerpt, reading_minutes: Math.max(1, Math.ceil((s.body.match(/\S+/g)?.length ?? 0) / 200)), tags: s.tagRefs };
  }
  const linkCard = s => s ? { title: s.card.title, url: s.url, date: s.card.date, date_long: s.card.date_long } : null;
  const neighbors = new Map(posts.map((s, i) => [s, [linkCard(posts[i - 1]), linkCard(posts[i + 1])]]));
  const common = { site: { title: input.site.title, base_url: base }, tags: tags.map(t => ({ name: t.name, slug: t.slug, url: t.url, count: t.posts.length })),
    recent: posts.slice(0, input.site.recent).map(s => s.card) };
  const output = {};
  const render = (name, vars) => templates.get(name)([common, vars], templates);
  for (const s of sources) {
    const ns = neighbors.get(s) ?? [null, null];
    output[s.outDir + '/index.html'] = render(s.layout, { page: { ...s.card, slug: s.slug, content: s.html, toc: s.toc, newer: ns[0], older: ns[1], is_post: s.post } });
  }
  const pages = Math.max(1, Math.ceil(posts.length / input.site.per_page));
  const indexUrl = k => base + (k === 1 ? '/' : '/page/' + k + '/');
  if (templates.has('index')) for (let k = 1; k <= pages; k++) {
    const per = input.site.per_page;
    output[k === 1 ? 'index.html' : 'page/' + k + '/index.html'] = render('index', { posts: posts.slice((k - 1) * per, k * per).map(s => s.card),
      pager: { number: k, total: pages, url: indexUrl(k), newer_url: k === 1 ? '' : indexUrl(k - 1), older_url: k === pages ? '' : indexUrl(k + 1) } });
  }
  if (templates.has('tag')) for (const t of tags) output['tags/' + t.slug + '/index.html'] = render('tag', { tag: { name: t.name, slug: t.slug, url: t.url, count: t.posts.length, posts: t.posts.map(s => s.card) } });
  if (templates.has('tags')) output['tags/index.html'] = render('tags', {});
  for (const f of statics) {
    if (Object.hasOwn(output, f.path)) report.push(`shadowed ${f.path}: a built page has its path`);
    else output[f.path] = f.content;
  }
  output['build-report.txt'] = [...report, ...broken].sort().join('\n');
  if (output['build-report.txt']) output['build-report.txt'] += '\n';
  output['build-report.txt'] += `built ${sources.length - posts.length} pages, ${posts.length} posts, ${tags.length} tags and ${statics.length} static files\n`;
  return output;
}
