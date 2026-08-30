#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const wikiRoots = [
  join(repositoryRoot, "external", "wiki-android"),
  join(repositoryRoot, "external", "wiki-macos"),
];
const verbose = process.argv.includes("--verbose");

function linkPath(root, target) {
  if (!target || /^(?:[a-z]+:|#)/iu.test(target)) return null;
  const clean = target.split("#", 1)[0];
  return resolve(root, clean.endsWith(".md") ? clean : `${clean}.md`);
}

function header(path) {
  return readFileSync(path, "utf8").split(/\r?\n/u).slice(0, 8).join("\n");
}

function languageTarget(root, path, language) {
  const label = language === "english" ? "English" : "(?:中文|Chinese)";
  const target = new RegExp(`\\[[^\\]]*${label}[^\\]]*\\]\\(([^)]+)\\)`, "u").exec(header(path))?.[1];
  return linkPath(root, target);
}

function pairKey(englishPath, chinesePath) {
  return `${englishPath}\u0000${chinesePath}`;
}

const errors = [];
const pairs = new Map();
const sidebarPairs = new Set();

for (const root of wikiRoots) {
  const files = readdirSync(root)
    .filter((filename) => filename.endsWith(".md") && filename !== "_Sidebar.md")
    .map((filename) => resolve(root, filename));

  for (const path of files) {
    const englishTarget = languageTarget(root, path, "english");
    const chineseTarget = languageTarget(root, path, "chinese");
    if (!englishTarget && !chineseTarget) {
      errors.push(`${path}: missing language counterpart link in first 8 lines`);
      continue;
    }

    const englishPath = englishTarget ?? path;
    const chinesePath = chineseTarget ?? path;
    const counterpart = englishTarget ?? chineseTarget;
    if (!existsSync(counterpart)) {
      errors.push(`${path}: counterpart does not exist: ${counterpart}`);
      continue;
    }

    const backlink = englishTarget
      ? languageTarget(root, englishTarget, "chinese")
      : languageTarget(root, chineseTarget, "english");
    if (backlink !== path) {
      errors.push(`${path}: counterpart does not link back correctly`);
      continue;
    }
    pairs.set(pairKey(englishPath, chinesePath), { englishPath, chinesePath });
  }

  const sidebarPath = join(root, "_Sidebar.md");
  const sidebar = readFileSync(sidebarPath, "utf8");
  const pattern = /\[[^\]]+\]\(([^)]+)\)\s*\/\s*\[[^\]]+\]\(([^)]+)\)/gu;
  for (const match of sidebar.matchAll(pattern)) {
    const englishPath = linkPath(root, match[1]);
    const chinesePath = linkPath(root, match[2]);
    if (!englishPath || !chinesePath || !existsSync(englishPath) || !existsSync(chinesePath)) {
      errors.push(`${sidebarPath}: invalid bilingual entry ${match[0]}`);
      continue;
    }
    const key = pairKey(englishPath, chinesePath);
    sidebarPairs.add(key);
    if (!pairs.has(key)) errors.push(`${sidebarPath}: entry is not a valid reciprocal pair: ${match[0]}`);
  }
}

const unlisted = [...pairs.entries()].filter(([key]) => !sidebarPairs.has(key));
if (errors.length > 0) {
  process.stdout.write(`error pairs=${pairs.size} sidebar=${sidebarPairs.size} unlisted=${unlisted.length} errors=${errors.length}\n`);
  for (const error of errors) process.stdout.write(`- ${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`ok pairs=${pairs.size} sidebar=${sidebarPairs.size} unlisted=${unlisted.length}\n`);
}

if (verbose && unlisted.length > 0) {
  process.stdout.write("Valid bilingual pairs outside curated sidebar navigation:\n");
  for (const [, pair] of unlisted) {
    process.stdout.write(`- ${pair.englishPath} <-> ${pair.chinesePath}\n`);
  }
}
