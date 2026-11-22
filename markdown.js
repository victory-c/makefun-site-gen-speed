// SPDX-License-Identifier: MIT
import { escape, slug, unique } from './text.js';
const escapes = new Set('\\`*_[]()#+-.!>');
function close(s, start, token) {
  for (let j = start; j < s.length; j++) {
    if (s[j] === '\\' && escapes.has(s[j + 1])) { j++; continue; }
    if (token === '*') {
      if (s[j] === '*' && s[j + 1] === '*') { j++; continue; }
      if (s[j] === '*') return j;
    } else if (s.startsWith(token, j)) return j;
  }
  return -1;
}
export function inline(s, link) {
  if (!/[\\`*\[]/.test(s)) return escape(s);
  let out = '', i = 0;
  const special = /[\\`*\[]/g;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && escapes.has(s[i + 1])) { out += escape(s[i + 1]); i += 2; }
    else if (c === '`') {
      const end = s.indexOf('`', i + 1);
      if (end > i + 1) { out += '<code>' + escape(s.slice(i + 1, end)) + '</code>'; i = end + 1; }
      else { out += '`'; i++; }
    } else if (c === '*') {
      const width = s[i + 1] === '*' ? 2 : 1;
      const end = close(s, i + width, width === 2 ? '**' : '*');
      if (end > i + width) {
        const tag = width === 2 ? 'strong' : 'em';
        out += '<' + tag + '>' + inline(s.slice(i + width, end), link) + '</' + tag + '>';
        i = end + width;
      } else { out += '*'.repeat(width); i += width; }
    } else if (c === '[') {
      const bracket = close(s, i + 1, ']');
      const end = bracket >= 0 && s[bracket + 1] === '(' ? s.indexOf(')', bracket + 2) : -1;
      const target = end < 0 ? '' : s.slice(bracket + 2, end);
      if (target && !/\s/.test(target)) {
        out += '<a href="' + escape(link(target)) + '">' + inline(s.slice(i + 1, bracket), link) + '</a>';
        i = end + 1;
      } else { out += '['; i++; }
    } else {
      // Bulk-copy ordinary text instead of invoking a regexp per character.
      special.lastIndex = i + 1;
      const next = special.exec(s);
      const end = next ? next.index : s.length;
      out += escape(s.slice(i, end)); i = end;
    }
  }
  return out;
}
const blank = /^[ \t]*$/;
const fence = /^```([A-Za-z0-9_+-]*)[ \t]*$/;
const hr = /^(---|\*\*\*)[ \t]*$/;
const bullet = /^[-*] (.*)$/;
const ordered = /^(\d{1,9})\. (.*)$/;
const trim = s => s.replace(/^[ \t]+|[ \t]+$/g, '');
function heading(s) {
  const m = /^(#{1,6})[ \t]+(.*?)[ \t]*$/.exec(s);
  return m && m[2] ? m : null;
}
export function markdown(body, link) {
  const lines = body.split('\n'), ids = new Set(), toc = [];
  let html = '', excerpt, p = 0;
  while (p < lines.length) {
    const line = lines[p++];
    if (blank.test(line)) continue;
    let m;
    if ((m = fence.exec(line))) {
      let code = '';
      while (p < lines.length && !/^```[ \t]*$/.test(lines[p])) code += escape(lines[p++]) + '\n';
      p++;
      html += '<pre><code' + (m[1] ? ' class="language-' + m[1] + '"' : '') + '>' + code + '</code></pre>\n';
    } else if ((m = heading(line))) {
      const level = m[1].length, id = unique(slug(m[2]), ids), text = inline(m[2], link);
      html += `<h${level} id="${id}">${text}</h${level}>\n`;
      if (level === 2 || level === 3) toc.push({ level, id, html: text });
    } else if (hr.test(line)) html += '<hr>\n';
    else if (line[0] === '>') {
      const parts = [trim(line.replace(/^> ?/, ''))];
      while (p < lines.length && lines[p][0] === '>') parts.push(trim(lines[p++].replace(/^> ?/, '')));
      const text = parts.filter(Boolean).join('\n');
      html += '<blockquote>\n' + (text ? '<p>' + inline(text, link) + '</p>\n' : '') + '</blockquote>\n';
    } else if (bullet.test(line) || ordered.test(line)) {
      const isOrdered = !bullet.test(line), pattern = isOrdered ? ordered : bullet;
      m = pattern.exec(line);
      const start = isOrdered ? +m[1] : 1, tag = isOrdered ? 'ol' : 'ul';
      let item = trim(m[isOrdered ? 2 : 1]), items = '';
      while (p < lines.length) {
        if ((m = pattern.exec(lines[p]))) {
          items += '<li>' + inline(item, link) + '</li>\n';
          item = trim(m[isOrdered ? 2 : 1]); p++;
        } else if (/^ {2,}\S/.test(lines[p])) item += '\n' + trim(lines[p++]);
        else break;
      }
      items += '<li>' + inline(item, link) + '</li>\n';
      html += '<' + tag + (isOrdered && start !== 1 ? ' start="' + start + '"' : '') + '>\n' + items + '</' + tag + '>\n';
    } else {
      let text = trim(line);
      while (p < lines.length && !blank.test(lines[p]) && !fence.test(lines[p]) && !hr.test(lines[p]) && !heading(lines[p])) text += '\n' + trim(lines[p++]);
      const rendered = inline(text, link);
      if (excerpt === undefined) excerpt = rendered;
      html += '<p>' + rendered + '</p>\n';
    }
  }
  return { html, toc, excerpt: excerpt ?? '' };
}
