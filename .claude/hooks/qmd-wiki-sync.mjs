#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const wikiRoots = [
  join(repositoryRoot, "external", "wiki-android"),
  join(repositoryRoot, "external", "wiki-macos"),
];
const stateFile = join(homedir(), ".cache", "qmd", "screen-remote-wiki.sha256");
const showStatus = process.argv.includes("--status");

function reportError(details) {
  if (showStatus) {
    process.stdout.write(`error: ${details}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({ systemMessage: "qmd-wiki-sync failed; rerun it with --status." })}\n`);
  }
}

function markdownFiles(root) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(path);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(path);
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function wikiDigest() {
  const hash = createHash("sha256");
  for (const wikiRoot of wikiRoots) {
    if (!existsSync(wikiRoot) || !statSync(wikiRoot).isDirectory()) {
      throw new Error(`Wiki directory is missing: ${wikiRoot}`);
    }
    hash.update(`${basename(wikiRoot)}\0`);
    for (const path of markdownFiles(wikiRoot)) {
      hash.update(`${relative(wikiRoot, path).split("\\").join("/")}\0`);
      hash.update(readFileSync(path));
      hash.update("\0");
    }
  }
  return hash.digest("hex");
}

function main() {
  let currentDigest;
  try {
    currentDigest = wikiDigest();
  } catch (error) {
    reportError(error.message);
    return 1;
  }

  let previousDigest = "";
  try {
    if (existsSync(stateFile)) previousDigest = readFileSync(stateFile, "utf8").trim();
  } catch (error) {
    reportError(error.message);
    return 1;
  }

  if (currentDigest === previousDigest) {
    if (showStatus) process.stdout.write("unchanged\n");
    return 0;
  }

  // Wait for indexing to finish. Save the hash only after qmd exits successfully.
  const result = spawnSync("qmd", ["update"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    timeout: 25_000,
  });
  if (result.error || result.status !== 0) {
    const details = result.error?.message ?? (result.stderr || result.stdout || "unknown qmd error").trim().slice(-1000);
    reportError(details);
    return 1;
  }

  try {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, `${currentDigest}\n`, "utf8");
  } catch (error) {
    reportError(`index updated but state was not saved: ${error.message}`);
    return 1;
  }

  if (showStatus) process.stdout.write("updated\n");
  return 0;
}

process.exitCode = main();
