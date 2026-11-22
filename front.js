// SPDX-License-Identifier: MIT
const keys = new Set(['title', 'summary', 'date', 'tags', 'draft', 'layout', 'slug']);
function stringValue(s) {
  if (s[0] === '[') throw 'a bare string opens on [';
  if (s[0] !== '"') return s;
  if (s.length < 2 || s.at(-1) !== '"') throw 'a quoted string is not closed';
  let out = '';
  for (let p = 1; p < s.length - 1; p++) {
    if (s[p] === '\\') {
      if (p + 1 === s.length - 1 || !['"', '\\'].includes(s[p + 1])) throw 'a quoted string holds an escape other than \\" or \\\\';
      out += s[++p];
    } else if (s[p] === '"') throw 'a quoted string holds a stray quote';
    else out += s[p];
  }
  return out;
}
function value(k, s) {
  switch (k) {
    case 'title': case 'summary': return stringValue(s);
    case 'date': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (m) {
        const y = +m[1], mo = +m[2], d = +m[3];
        const max = mo === 2 ? (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28) : [4, 6, 9, 11].includes(mo) ? 30 : 31;
        if (y >= 1970 && y <= 2099 && mo >= 1 && mo <= 12 && d >= 1 && d <= max) return s;
      }
      throw 'not a date from 1970-01-01 to 2099-12-31 (YYYY-MM-DD)';
    }
    case 'tags': {
      if (s[0] !== '[' || s.at(-1) !== ']') throw 'not a list [a, b]';
      if (!s.slice(1, -1).trim()) return [];
      const ts = s.slice(1, -1).split(',').map(x => x.trim());
      if (ts.some(x => !x || /["\[\]]/.test(x))) throw 'an empty tag, or one holding " [ or ]';
      return ts;
    }
    case 'draft': if (s === 'true' || s === 'false') return s === 'true'; throw 'true or false';
    case 'layout': if (/^[a-z0-9-]+$/.test(s)) return s; throw 'not a template name';
    case 'slug': if (s.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) return s; throw 'not a slug';
  }
}
export function front(text) {
  // Scan only the header, not a split/copy of the potentially large body.
  let pos = text.indexOf('\n');
  if ((pos < 0 ? text : text.slice(0, pos)) !== '---') return { error: 'no front matter' };
  const lines = [];
  let bodyStart = -1;
  while (pos >= 0 && pos < text.length) {
    const begin = pos + 1;
    pos = text.indexOf('\n', begin);
    const line = text.slice(begin, pos < 0 ? text.length : pos);
    if (line === '---') { bodyStart = pos < 0 ? text.length : pos + 1; break; }
    lines.push(line);
  }
  if (bodyStart < 0) return { error: 'the front matter is not closed' };
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^[ \t]*$/.test(line) || line[0] === '#') continue;
    const m = /^([a-z_]+):(?: (.*))?$/.exec(line);
    if (!m) return { error: `line ${i + 2} is not "key: value"` };
    const k = m[1], raw = (m[2] ?? '').replace(/[ \t]+$/, '');
    if (!keys.has(k)) return { error: `unknown key "${k}"` };
    if (Object.hasOwn(data, k)) return { error: `key "${k}" is given twice` };
    if (!raw) return { error: `key "${k}" has no value` };
    try { data[k] = value(k, raw); }
    catch (reason) { return { error: `key "${k}": ${reason}` }; }
  }
  return Object.hasOwn(data, 'title') ? { data, body: text.slice(bodyStart) } : { error: 'no title' };
}
