#!/usr/bin/env node
/*
  Replace GitBook embeds with Mintlify-compatible <iframe> blocks across MD/MDX files.

  Handles:
  - Blocks: `{% embed url="..." %} optional caption text {% endembed %}`
  - One-liners: `{% embed url="..." %}`

  Output example (single line, preserving leading indentation):
    <iframe className="w-full aspect-video rounded-xl" src="URL" title="Embedded content" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>

  Usage: node scripts/replace-embeds.mjs [rootDir]
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

function htmlEscapeAttribute(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function parseEmbedAttrs(attrText) {
  // Supports url="..." and caption="..."; ignores others
  const attrs = {};
  const regex = /(\w+)\s*=\s*("([\s\S]*?)"|'([\s\S]*?)')/g;
  let m;
  while ((m = regex.exec(attrText)) !== null) {
    const key = m[1];
    const val = (m[3] ?? m[4] ?? '').trim();
    attrs[key] = val;
  }
  return attrs;
}

function buildIframe(url, titleFallback, indent) {
  const title = titleFallback && titleFallback.length > 0 ? titleFallback : 'Embedded content';
  const src = url.trim();
  const attrs = `className="w-full aspect-video rounded-xl" src="${htmlEscapeAttribute(src)}" title="${htmlEscapeAttribute(title)}" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen`;
  return `${indent}<iframe ${attrs}></iframe>`;
}

function processContent(text) {
  let changed = false;
  let blocks = 0;
  let singles = 0;

  // 1) Replace full embed blocks with optional inner caption
  const blockRegex = /^(\s*)\{\%\s*embed\b([^%]*)\%\}([\s\S]*?)^(\s*)\{\%\s*endembed\s*\%\}/gmi;
  text = text.replace(blockRegex, (full, indent, attrText, inner, _indentEnd) => {
    const attrs = parseEmbedAttrs(attrText || '');
    const url = attrs.url || '';
    const caption = (attrs.caption && attrs.caption.trim().length > 0) ? attrs.caption.trim() : inner.replace(/^[\n\r\s]+|[\n\r\s]+$/g, '').trim();
    if (!url) return full;
    changed = true;
    blocks += 1;
    return buildIframe(url, caption, indent);
  });

  // 2) Replace standalone embed starts (no matching end)
  const singleRegex = /^(\s*)\{\%\s*embed\b([^%]*)\%\}\s*$/gmi;
  text = text.replace(singleRegex, (full, indent, attrText) => {
    const attrs = parseEmbedAttrs(attrText || '');
    const url = attrs.url || '';
    const caption = (attrs.caption && attrs.caption.trim().length > 0) ? attrs.caption.trim() : '';
    if (!url) return full;
    changed = true;
    singles += 1;
    return buildIframe(url, caption, indent);
  });

  return { text, changed, blocks, singles };
}

function main() {
  const targetDir = rootDir;
  const files = collectFiles(targetDir, ['.md', '.mdx']);
  let filesChanged = 0;
  let totalBlocks = 0;
  let totalSingles = 0;
  for (const file of files) {
    let s;
    try {
      s = fs.readFileSync(file, 'utf8');
    } catch (e) {
      console.error('Failed to read', file, e.message);
      continue;
    }
    const { text, changed, blocks, singles } = processContent(s);
    if (changed) {
      try {
        fs.writeFileSync(file, text, 'utf8');
        filesChanged += 1;
        totalBlocks += blocks;
        totalSingles += singles;
        console.log(`Updated: ${file} (blocks: ${blocks}, singles: ${singles})`);
      } catch (e) {
        console.error('Failed to write', file, e.message);
      }
    }
  }
  console.log(`\nDone. Files changed: ${filesChanged}. Embed blocks replaced: ${totalBlocks}. Standalone embeds replaced: ${totalSingles}.`);
}

main();


