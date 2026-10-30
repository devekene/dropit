#!/usr/bin/env node
// Advisory only: line count is a signal, not a quality gate.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOTS = ['apps/web/src', 'packages/ui/src'];
const SKIP = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '__generated__']);
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.scss']);
const REVIEW_AT = 500;
let flagged = 0;
async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { await walk(full); continue; }
    if (!entry.isFile() || !EXT.has(path.extname(entry.name)) || /\.(generated|gen|d)\.ts$/.test(entry.name)) continue;
    const source = await readFile(full, 'utf8');
    const lines = source === '' ? 0 : source.split('\n').length - Number(source.endsWith('\n'));
    if (lines > REVIEW_AT) { console.warn(`REVIEW ${full}: ${lines} lines — check cohesion and responsibility boundaries`); flagged++; }
  }
}
for (const root of ROOTS) await walk(root);
console.log(`${flagged} files flagged for optional cohesion review. No line-count failures.`);
