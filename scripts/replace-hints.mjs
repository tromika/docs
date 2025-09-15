#!/usr/bin/env node
/*
  Replace GitBook hint blocks with Note tags across MD/MDX files.
  - `{% hint style="info" %}` (any style) -> `<Note>`
  - `{% endhint %}` -> `</Note>`

  Usage: node scripts/replace-hints.mjs [rootDir]
*/

import fs from 'fs';
import path from 'path';

const rootDir = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function collectFiles(dirPath, exts, collected = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(abs, exts, collected);
    } else {
      const lower = entry.name.toLowerCase();
      if (exts.some((e) => lower.endsWith(e))) collected.push(abs);
    }
  }
  return collected;
}

function processContent(text) {
  let changed = false;
  let startCount = 0;
  let endCount = 0;

  // Replace start tags, preserving leading indentation
  const startTag = /^(\s*)\{\%\s*hint\b[^%]*\%\}/gm;
  text = text.replace(startTag, (_m, indent) => {
    changed = true;
    startCount += 1;
    return `${indent}<Note>`;
  });

  // Replace end tags, preserving leading indentation
  const endTag = /^(\s*)\{\%\s*endhint\s*\%\}/gm;
  text = text.replace(endTag, (_m, indent) => {
    changed = true;
    endCount += 1;
    return `${indent}</Note>`;
  });

  return { text, changed, startCount, endCount };
}

function main() {
  const targetDir = rootDir;
  const files = collectFiles(targetDir, ['.md', '.mdx']);
  let filesChanged = 0;
  let totalStarts = 0;
  let totalEnds = 0;
  for (const file of files) {
    let s;
    try {
      s = fs.readFileSync(file, 'utf8');
    } catch (e) {
      console.error('Failed to read', file, e.message);
      continue;
    }
    const { text, changed, startCount, endCount } = processContent(s);
    if (changed) {
      try {
        fs.writeFileSync(file, text, 'utf8');
        filesChanged += 1;
        totalStarts += startCount;
        totalEnds += endCount;
        console.log(`Updated: ${file} (start: ${startCount}, end: ${endCount})`);
      } catch (e) {
        console.error('Failed to write', file, e.message);
      }
    }
  }
  console.log(`\nDone. Files changed: ${filesChanged}. Hint starts replaced: ${totalStarts}. Hint ends replaced: ${totalEnds}.`);
}

main();


