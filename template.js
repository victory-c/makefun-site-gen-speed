// SPDX-License-Identifier: MIT
import { escape, stringify, truth } from './text.js';
const pathPattern = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
export function compile(name, source) {
  const fail = why => { throw new Error(`template "${name}": ${why}`); };
  const path = s => {
    if (!pathPattern.test(s)) fail(`${JSON.stringify(s)} is not a path`);
    return s.split('.');
  };
  // Tokenize before parsing so lexical errors retain their precedence.
  const tokens = [];
  let p = 0, literal = '';
  const flush = () => { if (literal) tokens.push(['text', literal]); literal = ''; };
  while (p < source.length) {
    const at = source.indexOf('{', p);
    if (at < 0 || at + 1 === source.length) { literal += source.slice(p); break; }
    const c = source[at + 1];
    literal += source.slice(p, at);
    if (c !== '{' && c !== '%') { literal += '{'; p = at + 1; continue; }
    if (c === '{') {
      const raw = source[at + 2] === '{', width = raw ? 3 : 2;
      const end = source.indexOf(raw ? '}}}' : '}}', at + width);
      if (end < 0) fail(`a ${raw ? '{{{' : '{{'} is not closed`);
      flush(); tokens.push([raw ? 'raw' : 'var', path(source.slice(at + width, end).trim())]);
      p = end + width;
    } else {
      const end = source.indexOf('%}', at + 2);
      if (end < 0) fail('a {% is not closed');
      const line = source.lastIndexOf('\n', at - 1) + 1;
      const nl = source.indexOf('\n', end + 2);
      const alone = /^[ \t]*$/.test(source.slice(line, at)) && /^[ \t]*$/.test(source.slice(end + 2, nl < 0 ? source.length : nl));
      if (alone) literal = literal.slice(0, literal.length - (at - line));
      flush(); tokens.push(['tag', source.slice(at + 2, end).trim()]);
      p = alone ? (nl < 0 ? source.length : nl + 1) : end + 2;
    }
  }
  flush();
  const root = [], stack = [];
  let dst = root;
  for (const [type, v] of tokens) {
    if (type !== 'tag') { dst.push({ type, v }); continue; }
    let m;
    if ((m = /^for ([A-Za-z_][A-Za-z0-9_]*) in (\S+)$/.exec(v))) {
      const n = { type: 'for', v: path(m[2]), binding: m[1], body: [], parent: dst };
      dst.push(n); stack.push(n); dst = n.body;
    } else if ((m = /^if (not )?(\S+)$/.exec(v))) {
      const n = { type: 'if', v: path(m[2]), negate: !!m[1], body: [], alt: null, parent: dst };
      dst.push(n); stack.push(n); dst = n.body;
    } else if (v === 'else') {
      const n = stack.at(-1);
      if (!n || n.type !== 'if' || n.alt !== null) fail('an else outside an if');
      dst = n.alt = [];
    } else if (v === 'endif' || v === 'endfor') {
      if (stack.at(-1)?.type !== v.slice(3)) fail(`an ${v} with no open ${v.slice(3)}`);
      dst = stack.pop().parent;
    } else if ((m = /^include "([a-z0-9-]+)"$/.exec(v))) dst.push({ type: 'include', v: m[1] });
    else fail(`{% ${v} %} is not a tag`);
  }
  if (stack.length) fail(`a ${stack.at(-1).type} is not closed`);
  return generate(root);
}
function lookup(scopes, keys) {
  let v;
  for (let i = scopes.length - 1; i >= 0; i--) {
    if (Object.hasOwn(scopes[i], keys[0])) { v = scopes[i][keys[0]]; break; }
  }
  for (let i = 1; i < keys.length; i++) {
    if (v === null || typeof v !== 'object' || !Object.hasOwn(v, keys[i])) return undefined;
    v = v[keys[i]];
  }
  return v;
}
function generate(nodes) {
  let seq = 0;
  const paths = new Map();
  const access = keys => {
    const key = JSON.stringify(keys);
    if (!paths.has(key)) paths.set(key, 'p' + paths.size);
    return `get(s,${paths.get(key)})`;
  };
  const emit = ns => ns.map(n => {
    const q = JSON.stringify(n.v), get = (n.type === 'text' || n.type === 'include') ? '' : access(n.v);
    if (n.type === 'text') return `o+=${q};`;
    if (n.type === 'var') return `o+=esc(str(${get}));`;
    if (n.type === 'raw') return `o+=str(${get});`;
    if (n.type === 'if') return `if(${n.negate ? '!' : ''}yes(${get})){${emit(n.body)}}else{${emit(n.alt ?? [])}}`;
    if (n.type === 'include') return `if(d<8&&t.has(${q}))o+=t.get(${q})(s,t,d+1);`;
    const k = seq++;
    // A computed property preserves the special case where the loop binding is named 'loop'.
    return `{const a${k}=${get};if(Array.isArray(a${k})){for(let i${k}=0;i${k}<a${k}.length;i${k}++){s.push({[${JSON.stringify(n.binding)}]:a${k}[i${k}],loop:{index:i${k}+1,first:i${k}===0,last:i${k}===a${k}.length-1,length:a${k}.length}});${emit(n.body)}s.pop();}}}`;
  }).join('');
  // Only parser-validated instructions and JSON-quoted data reach generated code.
  const code = emit(nodes);
  const constants = [...paths].map(([json, name]) => `const ${name}=${json};`).join('');
  return new Function('get', 'esc', 'str', 'yes', `${constants}return function(s,t,d=0){let o='';${code}return o;}`)(lookup, escape, stringify, truth);
}
