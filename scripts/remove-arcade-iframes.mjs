#!/usr/bin/env node
/*
  Replace iframes pointing to app.arcade.software with their raw URLs.
  Example:
    <iframe src="https://app.arcade.software/share/xyz" ...></iframe>
  becomes:
    https://app.arcade.software/share/xyz

  Preserves leading indentation and removes surrounding whitespace-only lines left by the iframe block.

  Usage: node scripts/remove-arcade-iframes.mjs [rootDir]
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
  let replaced = 0;

  // Match entire iframe line(s), capturing leading indentation and src
  const iframeRegex = /^(\s*)<iframe\b[^>]*\ssrc=["'](https?:\/\/app\.arcade\.software\/[^"]+)["'][\s\S]*?<\/iframe>\s*$/gmi;
  text = text.replace(iframeRegex, (_full, indent, url) => {
    changed = true;
    replaced += 1;
    return `${indent}${url}`;
  });

  return { text, changed, replaced };
}

function main() {
  const targetDir = rootDir;
  const files = collectFiles(targetDir, ['.md', '.mdx']);
  let filesChanged = 0;
  let total = 0;
  for (const file of files) {
    let s;
    try {
      s = fs.readFileSync(file, 'utf8');
    } catch (e) {
      console.error('Failed to read', file, e.message);
      continue;
    }
    const { text, changed, replaced } = processContent(s);
    if (changed) {
      try {
        fs.writeFileSync(file, text, 'utf8');
        filesChanged += 1;
        total += replaced;
        console.log(`Updated: ${file} (arcade iframes removed: ${replaced})`);
      } catch (e) {
        console.error('Failed to write', file, e.message);
      }
    }
  }
  console.log(`\nDone. Files changed: ${filesChanged}. Arcade iframes removed: ${total}.`);
}

main();


