// isolated test of the registry parser extracted from refdock-server.mjs
import fs from 'node:fs';

const src = fs.readFileSync('ref-dock/server/refdock-server.mjs', 'utf8');
const start = src.indexOf('// ---------- registry yaml');
const end = src.indexOf('// ---------- categories ----------');
const code = src.slice(start, end);

const text = fs.readFileSync('registry_references.yaml', 'utf8');
const fn = new Function('text', code + '\nreturn parseRegistry(text);');
const projects = fn(text);
console.log('parsed:', projects.length);
console.log(JSON.stringify(projects.slice(0, 3), null, 1));
console.log('categories:', [...new Set(projects.map((p) => p.category))].join(', '));
const bad = projects.filter((p) => !p.name || !p.repo || !p.path);
console.log('bad entries:', bad.length);
