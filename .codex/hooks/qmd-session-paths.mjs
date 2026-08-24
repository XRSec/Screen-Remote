#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const stateDirectory = join(homedir(), ".cache", "qmd", "screen-remote-sessions");
const collectionRoots = new Map([
  ["screen-remote-android-wiki", join(repositoryRoot, "external", "wiki-android")],
  ["screen-remote-macos-wiki", join(repositoryRoot, "external", "wiki-macos")],
]);
const bilingualEnglishByPath = loadBilingualEnglishPaths();
const stopWords = new Set([
  "读取", "查看", "检查", "现在", "需要", "帮我", "一下", "这个", "那个",
  "完善", "更新", "修改", "实现", "处理", "继续", "逻辑", "任务", "会话",
  "please", "read", "check", "update", "implement", "continue", "task", "thread",
]);

function readHookInput() {
  const raw = readFileSync(0, "utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function searchTerms(prompt) {
  const withoutIds = prompt
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu, " ")
    .replace(/[^\p{L}\p{N}_.+-]+/gu, " ");
  const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
  const terms = [];
  const seen = new Set();
  for (const segment of segmenter.segment(withoutIds)) {
    const term = segment.segment.trim();
    const normalized = term.toLocaleLowerCase("zh-CN");
    if (!segment.isWordLike || term.length < 2 || /^\d+$/u.test(term) || stopWords.has(normalized) || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    terms.push(term);
    if (terms.length === 12) break;
  }
  return terms;
}

function absoluteWikiPath(file) {
  if (file.startsWith("qmd://")) {
    const match = /^qmd:\/\/([^/]+)\/(.+)$/u.exec(file);
    const root = match && collectionRoots.get(match[1]);
    if (!root || !match) return null;
    const path = join(root, match[2]);
    if (existsSync(path)) return path;
    const sidebarPath = match[2] === "Sidebar.md" ? join(root, "_Sidebar.md") : null;
    return sidebarPath && existsSync(sidebarPath) ? sidebarPath : null;
  }
  const path = resolve(repositoryRoot, file);
  return existsSync(path) ? path : null;
}

function markerPath(sessionId) {
  const safeId = String(sessionId || "unknown").replace(/[^a-zA-Z0-9_-]/gu, "_");
  return join(stateDirectory, `${safeId}.done`);
}

function wikiLinkPath(wikiRoot, target) {
  if (!target || /^(?:[a-z]+:|#)/iu.test(target)) return null;
  const withoutAnchor = target.split("#", 1)[0];
  const relativePath = withoutAnchor.endsWith(".md") ? withoutAnchor : `${withoutAnchor}.md`;
  return resolve(wikiRoot, relativePath);
}

function loadBilingualEnglishPaths() {
  const mappings = new Map();
  const pairPattern = /\[[^\]]+\]\(([^)]+)\)\s*\/\s*\[[^\]]+\]\(([^)]+)\)/gu;
  for (const wikiRoot of collectionRoots.values()) {
    let sidebar;
    try {
      sidebar = readFileSync(join(wikiRoot, "_Sidebar.md"), "utf8");
    } catch {
      continue;
    }
    for (const match of sidebar.matchAll(pairPattern)) {
      const englishPath = wikiLinkPath(wikiRoot, match[1]);
      const chinesePath = wikiLinkPath(wikiRoot, match[2]);
      if (!englishPath || !chinesePath || !existsSync(englishPath) || !existsSync(chinesePath)) continue;
      mappings.set(chinesePath, englishPath);
    }

    let filenames;
    try {
      filenames = readdirSync(wikiRoot).filter((filename) => filename.endsWith(".md") && filename !== "_Sidebar.md");
    } catch {
      continue;
    }
    for (const filename of filenames) {
      const chinesePath = resolve(wikiRoot, filename);
      if (mappings.has(chinesePath)) continue;
      let chineseHeader;
      try {
        chineseHeader = readFileSync(chinesePath, "utf8").split(/\r?\n/u).slice(0, 8).join("\n");
      } catch {
        continue;
      }
      const englishTarget = /\[English\]\(([^)]+)\)/u.exec(chineseHeader)?.[1];
      const englishPath = wikiLinkPath(wikiRoot, englishTarget);
      if (!englishPath || !existsSync(englishPath)) continue;

      let englishHeader;
      try {
        englishHeader = readFileSync(englishPath, "utf8").split(/\r?\n/u).slice(0, 8).join("\n");
      } catch {
        continue;
      }
      const chineseTargets = [...englishHeader.matchAll(/\[[^\]]*(?:中文|Chinese)[^\]]*\]\(([^)]+)\)/gu)]
        .map((match) => wikiLinkPath(wikiRoot, match[1]));
      if (chineseTargets.includes(chinesePath)) mappings.set(chinesePath, englishPath);
    }
  }
  return mappings;
}

function emitPaths(paths) {
  const additionalContext = [
    "QMD cached Wiki candidate paths (the index update check completed before lookup; no document contents were loaded):",
    ...paths.map((path) => `- ${path}`),
    "These Wiki collections are bilingual. When a Chinese document has an English translation identified by the Wiki sidebar or reciprocal language links, only the English path is returned; Chinese-only documents remain available.",
    "Treat translated counterparts as the same knowledge source rather than independent corroboration.",
  ].join("\n");
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext,
    },
  })}\n`);
}

function qmdSearch(query) {
  const search = spawnSync("qmd", ["search", query, "--format", "json", "--full-path", "--all"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    timeout: 5_000,
  });
  if (search.error || search.status !== 0) return null;
  try {
    return JSON.parse(search.stdout || "[]");
  } catch {
    return null;
  }
}

function main() {
  let input;
  try {
    input = readHookInput();
  } catch {
    return 0;
  }

  const marker = markerPath(input.session_id);
  if (existsSync(marker)) return 0;

  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  const terms = searchTerms(prompt);
  if (terms.length === 0) {
    mkdirSync(stateDirectory, { recursive: true });
    writeFileSync(marker, "no-query\n", "utf8");
    return 0;
  }

  const sync = spawnSync(process.execPath, [join(repositoryRoot, ".codex", "hooks", "qmd-wiki-sync.mjs")], {
    cwd: repositoryRoot,
    encoding: "utf8",
    timeout: 30_000,
  });
  if (sync.error || sync.status !== 0) return 0;

  const query = terms.join(" ");
  const results = qmdSearch(query);
  if (results === null) return 0;
  if (results.length < 3) {
    for (const term of terms.slice(0, 4)) {
      const fallbackResults = qmdSearch(term);
      if (fallbackResults === null) return 0;
      results.push(...fallbackResults);
    }
  }

  const paths = [];
  const seen = new Set();
  for (const result of results) {
    if (typeof result?.file !== "string") continue;
    const path = absoluteWikiPath(result.file);
    if (!path) continue;
    const preferredPath = bilingualEnglishByPath.get(path) ?? path;
    if (seen.has(preferredPath)) continue;
    seen.add(preferredPath);
    paths.push(preferredPath);
  }

  mkdirSync(stateDirectory, { recursive: true });
  writeFileSync(marker, `${query}\n`, "utf8");
  if (paths.length > 0) emitPaths(paths);
  return 0;
}

process.exitCode = main();
