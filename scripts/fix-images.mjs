#!/usr/bin/env node
/*
  Fix images in MDX/MD docs:
  - Unwrap <figure>...</figure> blocks containing <img> and optional <figcaption>
  - Move figcaption text into a single alt attribute on the <img>
  - Deduplicate multiple alt attributes on <img>
  - Ensure exactly one alt attribute exists on each <img> (fallback to empty if none)

  Usage: node scripts/fix-images.mjs [rootDir]
*/

import fs from 'fs';
import path from 'path';

const rootDir = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/**
 * Recursively collect files with given extensions
 */
function collectFiles(dirPath, exts, collected = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    // skip dot-directories/files
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(abs, exts, collected);
    } else {
      const lower = entry.name.toLowerCase();
      if (exts.some((e) => lower.endsWith(e))) {
        collected.push(abs);
      }
    }
  }
  return collected;
}

function htmlEntityEscape(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function stripHtmlTags(text) {
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Ensure a single alt attribute on an <img> tag string. Insert or replace as needed.
 * Preserves other attributes/content and attempts to keep original formatting.
 */
function normalizeImgTag(imgTag, fallbackAlt = '') {
  // Extract attribute string between <img and closing
  const tagMatch = imgTag.match(/^<img\b([\s\S]*?)\/?\s*>$/i);
  const attrStringOriginal = tagMatch ? tagMatch[1] : imgTag.replace(/^<img\b/i, '').replace(/>\s*$/, '');

  const altAttrRegex = /\salt\s*=\s*("[\s\S]*?"|'[\s\S]*?')/g;
  const alts = [];
  let m;
  while ((m = altAttrRegex.exec(attrStringOriginal)) !== null) {
    const raw = m[1];
    const val = raw.substring(1, raw.length - 1).trim();
    if (val.length > 0) alts.push(val);
  }

  let chosenAlt = alts.length > 0 ? alts[0] : '';
  if (fallbackAlt && fallbackAlt.trim().length > 0) {
    if (!chosenAlt) {
      chosenAlt = fallbackAlt.trim();
    } else if (!chosenAlt.toLowerCase().includes(fallbackAlt.trim().toLowerCase())) {
      chosenAlt = `${chosenAlt} ${fallbackAlt.trim()}`.trim();
    }
  }

  // Remove alt attributes and stray slashes, normalize spacing
  let attrString = attrStringOriginal.replace(altAttrRegex, '');
  attrString = attrString.replace(/\s*\/\s*(?=>|$)/g, '');
  attrString = attrString.replace(/\s{2,}/g, ' ').trim();

  const attrsPart = attrString.length > 0 ? ` ${attrString}` : '';
  const altPart = ` alt=\"${htmlEntityEscape(chosenAlt || '')}\"`;
  return `<img${attrsPart}${altPart} />`;
}

/**
 * Process a single file's contents and return transformed text with stats
 */
function processFileContent(content) {
  let changed = false;
  let figureUnwrapped = 0;
  let imgsNormalized = 0;

  // 1) Unwrap <figure> blocks containing an <img>
  const figureRegex = /<figure\b[^>]*>([\s\S]*?)<\/figure>/g;
  content = content.replace(figureRegex, (full, inner) => {
    // Find the first <img ...>
    const imgRegex = /<img\b[\s\S]*?>/i;
    const imgMatch = inner.match(imgRegex);
    if (!imgMatch) {
      return full; // leave untouched if no img
    }

    const originalImgTag = imgMatch[0];

    // Find <figcaption>...</figcaption>
    const captionRegex = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i;
    const capMatch = inner.match(captionRegex);
    let caption = '';
    if (capMatch) {
      caption = stripHtmlTags(capMatch[1]).trim();
    }

    // Determine fallback alt: prefer caption
    const normalizedImg = normalizeImgTag(originalImgTag, caption);
    changed = true;
    figureUnwrapped += 1;

    // Preserve leading indentation from the original <img> if possible
    const indentMatch = full.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    return indent + normalizedImg;
  });

  // 2) Normalize any remaining <img> tags across the content
  const anyImgRegex = /<img\b[\s\S]*?>/gi;
  content = content.replace(anyImgRegex, (imgTag) => {
    const normalized = normalizeImgTag(imgTag, '');
    if (normalized !== imgTag) {
      changed = true;
      imgsNormalized += 1;
    }
    return normalized;
  });

  return { content, changed, figureUnwrapped, imgsNormalized };
}

function main() {
  const docsDir = rootDir;
  const files = collectFiles(docsDir, ['.mdx', '.md']);
  let totalChanged = 0;
  let totalFigures = 0;
  let totalImgs = 0;
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (e) {
      console.error('Failed to read', file, e.message);
      continue;
    }
    const { content: newText, changed, figureUnwrapped, imgsNormalized } = processFileContent(text);
    if (changed) {
      try {
        fs.writeFileSync(file, newText, 'utf8');
        totalChanged += 1;
        totalFigures += figureUnwrapped;
        totalImgs += imgsNormalized;
        console.log(`Updated: ${file} (figures: ${figureUnwrapped}, imgs: ${imgsNormalized})`);
      } catch (e) {
        console.error('Failed to write', file, e.message);
      }
    }
  }
  console.log(`\nDone. Files changed: ${totalChanged}. Figures unwrapped: ${totalFigures}. Img tags normalized: ${totalImgs}.`);
}

main();


