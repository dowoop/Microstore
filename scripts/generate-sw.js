#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Generates public/sw.js from the template, embedding the current build ID
 * as the SW version. Run after `next build` (requires .next/BUILD_ID).
 *
 * Usage:
 *   node scripts/generate-sw.js           # reads .next/BUILD_ID
 *   node scripts/generate-sw.js --dev     # uses 'dev' version
 */

const fs = require('fs');
const path = require('path');

const isDev = process.argv.includes('--dev');

let version;
if (isDev) {
  version = 'dev';
} else {
  const buildIdPath = path.join(__dirname, '..', '.next', 'BUILD_ID');
  if (!fs.existsSync(buildIdPath)) {
    console.error('ERROR: .next/BUILD_ID not found. Run `next build` first or use --dev.');
    process.exit(1);
  }
  version = fs.readFileSync(buildIdPath, 'utf8').trim();
}

const templatePath = path.join(__dirname, '..', 'public', 'sw.template.js');
const outputPath = path.join(__dirname, '..', 'public', 'sw.js');

if (!fs.existsSync(templatePath)) {
  console.error('ERROR: public/sw.template.js not found.');
  process.exit(1);
}

let sw = fs.readFileSync(templatePath, 'utf8');

// Replace the version placeholder
const replaced = sw.replace(/__SW_VERSION__/g, version);
if (replaced === sw) {
  console.warn('WARNING: __SW_VERSION__ placeholder not found in template.');
}

fs.writeFileSync(outputPath, replaced);
console.log(`[generate-sw] Generated public/sw.js with version: ${version}`);

// Write a tiny JSON file the client can fetch to know the expected version
const versionJsonPath = path.join(__dirname, '..', 'public', 'sw-version.json');
fs.writeFileSync(versionJsonPath, JSON.stringify({ version }));
console.log(`[generate-sw] Wrote public/sw-version.json`);
