// SPDX-License-Identifier: MIT
// Small pure text primitives; no dependency or build step.
const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escape(s) { return s.replace(/[&<>"']/g, c => entities[c]); }
export function slug(s) {
  return s.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[A-Z]/g, c => c.toLowerCase())
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64).replace(/-$/, '') || 'untitled';
}
export function unique(s, used) {
  let t = s, k = 2;
  while (used.has(t)) t = s + '-' + k++;
  used.add(t);
  return t;
}
export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const months = 'January February March April May June July August September October November December'.split(' ');
export function dateText(d) { return d === undefined ? '' : +d.slice(8) + ' ' + months[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4); }
export function stringify(v) {
  switch (typeof v) {
    case 'string': return v;
    case 'number': case 'boolean': return String(v);
    default: return Array.isArray(v) ? v.map(stringify).join(', ') : '';
  }
}
export const truth = v => Array.isArray(v) ? v.length !== 0 : v !== undefined && v !== null && v !== false && v !== '' && v !== 0;
