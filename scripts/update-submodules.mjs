#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gitmodules = path.join(root, ".gitmodules");
const dryRun = process.argv.includes("--dry-run");
const statusOnly = process.argv.includes("--status");
const unknownArgs = process.argv.slice(2).filter((arg) => !["--dry-run", "--status"].includes(arg));

const skipped = new Set(["Screen-Remote", "external/wiki"]);
const dadbPath = "external/dadb";
const dadbUpstreamUrl = "git@github.com:mobile-dev-inc/dadb.git";
const recentCommitLimit = 8;
const updateReports = [];
const colorEnabled = process.env.FORCE_COLOR !== undefined
  ? process.env.FORCE_COLOR !== "0"
  : !process.env.NO_COLOR && process.stdout.isTTY;

function paint(code, text) {
  return colorEnabled ? `\u001b[${code}m${text}\u001b[0m` : text;
}

const color = {
  bold: (text) => paint("1", text),
  dim: (text) => paint("2", text),
  red: (text) => paint("31", text),
  green: (text) => paint("32", text),
  yellow: (text) => paint("33", text),
  magenta: (text) => paint("35", text),
  cyan: (text) => paint("36", text),
};

function run(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (!allowFailure && result.status !== 0) throw new Error(output || `${args.join(" ")} failed`);
  return { code: result.status ?? 1, output };
}

function git(cwd, ...args) {
  return run(cwd, ["git", ...args]).output;
}

function optionalGit(cwd, ...args) {
  const result = run(cwd, ["git", ...args], { allowFailure: true });
  return result.code === 0 ? result.output : "";
}

function parseCommit(line) {
  const [sha, committedAt, ...subject] = line.split("\u001f");
  return { sha, committedAt, subject: subject.join("\u001f") };
}

function recentChangeReport(repo, previous, current) {
  const changed = previous && previous !== current;
  const revision = changed ? `${previous}..${current}` : "";
  const count = changed ? Number(git(repo, "rev-list", "--count", revision)) : 0;
  const latest = parseCommit(git(
    repo,
    "show",
    "-s",
    "--date=format:%Y-%m-%d %H:%M:%S",
    "--format=%h%x1f%cd%x1f%s",
    current,
  ));
  const recent = changed
    ? git(repo, "log", `--max-count=${recentCommitLimit}`, "--date=format:%Y-%m-%d %H:%M:%S", "--format=%h%x1f%cd%x1f%s", revision)
      .split("\n").filter(Boolean).map(parseCommit)
    : [];
  return { changed, previous, current, count, latest, recent };
}

function printUpdateReports() {
  if (!updateReports.length) return;
  console.log(color.bold(color.green("\n更新结果汇总：")));
  for (const report of updateReports) {
    console.log(`\n${color.cyan("╭─")} ${color.bold(color.cyan(report.path))}`);
    const status = report.changed
      ? `${color.green("已更新")}  ${color.magenta(report.previous.slice(0, 7))} → ${color.magenta(report.current.slice(0, 7))}  ${color.green(`+${report.count}`)}`
      : color.green("已是最新");
    console.log(`${color.cyan("│")} ${color.dim("状态")}  ${status}`);
    console.log(`${color.cyan("│")} ${color.dim("提交")}  ${color.magenta(report.latest.sha)}  ${color.dim(report.latest.committedAt)}`);
    console.log(`${color.cyan("│")} ${color.dim("内容")}  ${report.latest.subject}`);
    if (report.changed && report.recent.length > 1) {
      console.log(`${color.cyan("│")} ${color.dim("近期")}`);
      for (const commit of report.recent.slice(1)) {
        console.log(`${color.cyan("│")}   ${color.magenta(commit.sha)}  ${color.dim(commit.committedAt)}  ${commit.subject}`);
      }
    }
    if (report.changed && report.count > recentCommitLimit) {
      console.log(`${color.cyan("│")}   ${color.dim(`…另有 ${report.count - recentCommitLimit} 个较早提交`)}`);
    }
    console.log(color.cyan("╰────────────────────────────────────────────────────────"));
  }
}

function isRepository(relativePath) {
  return run(path.join(root, relativePath), ["git", "rev-parse", "--git-dir"], { allowFailure: true }).code === 0;
}

function configuredSubmodules() {
  const output = git(root, "config", "--file", gitmodules, "--get-regexp", "^submodule\\..*\\.path$");
  return output.split("\n").filter(Boolean).map((line) => {
    const [key, relativePath] = line.trim().split(/\s+/, 2);
    const name = key.slice("submodule.".length, -".path".length);
    const url = run(root, ["git", "config", "--file", gitmodules, "--get", `submodule.${name}.url`], { allowFailure: true }).output;
    const branch = run(root, ["git", "config", "--file", gitmodules, "--get", `submodule.${name}.branch`], { allowFailure: true }).output;
    return { name, path: relativePath, url, branch };
  });
}

function ensureInitialized(relativePath) {
  if (isRepository(relativePath)) return;
  console.log(color.yellow(`  初始化 ${relativePath}`));
  git(root, "submodule", "update", "--init", "--depth", "1", "--", relativePath);
}

function requireClean(relativePath) {
  const status = git(path.join(root, relativePath), "status", "--porcelain");
  if (status) throw new Error(`${relativePath} 有未提交修改，更新前请先处理`);
}

function checkoutBranch(relativePath, branch) {
  const repo = path.join(root, relativePath);
  const exists = run(repo, ["git", "show-ref", "--verify", "--quiet", `refs/heads/${branch}`], { allowFailure: true }).code === 0;
  git(repo, "checkout", ...(exists ? [branch] : ["-b", branch]));
}

function detectBranch(module, allowRemoteLookup = true) {
  if (module.branch && module.branch !== ".") return module.branch;
  if (module.branch === ".") {
    const outerBranch = git(root, "branch", "--show-current");
    if (outerBranch) return outerBranch;
  }
  if (isRepository(module.path)) {
    const repo = path.join(root, module.path);
    const current = git(repo, "branch", "--show-current");
    if (current) return current;
    const symbolic = run(repo, ["git", "symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { allowFailure: true }).output;
    if (symbolic) return symbolic.replace(/^origin\//, "");
  }
  if (!allowRemoteLookup) return "<remote HEAD>";
  const remoteHead = git(root, "ls-remote", "--symref", module.url, "HEAD");
  const match = remoteHead.match(/^ref:\s+refs\/heads\/(\S+)\s+HEAD$/m);
  if (!match) throw new Error(`无法确定 ${module.path} 的远程默认分支，请在 .gitmodules 配置 branch`);
  return match[1];
}

function updateBranch(module) {
  const repo = path.join(root, module.path);
  const branch = detectBranch(module);
  const previous = optionalGit(repo, "rev-parse", `refs/heads/${branch}`);
  console.log(`${color.cyan(`  → ${module.path}`)}: origin/${branch}`);
  git(repo, "config", "remote.origin.tagOpt", "--no-tags");
  checkoutBranch(module.path, branch);
  git(repo, "fetch", "--no-tags", "origin", branch);
  git(repo, "merge", "--ff-only", "FETCH_HEAD");
  updateReports.push({ path: module.path, ...recentChangeReport(repo, previous, git(repo, "rev-parse", "HEAD")) });
}

function updateDadbRemote() {
  const repo = path.join(root, dadbPath);
  const hasUpstream = run(repo, ["git", "remote", "get-url", "upstream"], { allowFailure: true }).code === 0;
  if (!hasUpstream) git(repo, "remote", "add", "upstream", dadbUpstreamUrl);
  const previous = optionalGit(repo, "rev-parse", "refs/remotes/upstream/master");
  git(repo, "config", "remote.upstream.tagOpt", "--no-tags");
  console.log(color.yellow(`  → ${dadbPath}: 仅 fetch upstream/master，不改变工作树`));
  git(repo, "fetch", "--no-tags", "upstream", "+refs/heads/master:refs/remotes/upstream/master");
  const current = git(repo, "rev-parse", "refs/remotes/upstream/master");
  updateReports.push({ path: dadbPath, ...recentChangeReport(repo, previous, current) });
}

function printStatus(modules) {
  for (const module of modules) {
    if (skipped.has(module.path)) {
      console.log(color.yellow(`  - ${module.path}: skipped`));
      continue;
    }
    if (!isRepository(module.path)) {
      console.log(color.yellow(`  ? ${module.path}: not initialized`));
      continue;
    }
    const repo = path.join(root, module.path);
    const branch = git(repo, "branch", "--show-current") || "detached";
    const head = git(repo, "rev-parse", "--short", "HEAD");
    const updatedAt = git(repo, "show", "-s", "--date=format:%Y-%m-%d %H:%M:%S", "--format=%cd", "HEAD");
    const subject = git(repo, "show", "-s", "--format=%s", "HEAD");
    const dirty = git(repo, "status", "--porcelain") ? " dirty" : "";
    const remoteOnly = module.path === dadbPath ? " remote-only" : "";
    const suffix = `${dirty ? color.red(dirty) : ""}${remoteOnly ? color.yellow(remoteOnly) : ""}`;
    console.log(`  ${color.cyan(module.path)}: ${branch}@${head} | ${color.dim(updatedAt)} | ${subject}${suffix}`);
  }
}

function main() {
  if (unknownArgs.length || (dryRun && statusOnly)) {
    throw new Error("用法：node scripts/update-submodules.mjs [--dry-run | --status]");
  }
  if (!existsSync(gitmodules)) throw new Error(`找不到 ${gitmodules}`);
  const modules = configuredSubmodules();

  if (statusOnly) {
    printStatus(modules);
    return;
  }

  console.log(color.bold(color.cyan("子模块更新计划：")));
  console.log(color.dim(`  执行时间：${new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "medium" }).format(new Date())}`));
  for (const module of modules) {
    if (skipped.has(module.path)) console.log(color.yellow(`  - 跳过 ${module.path}`));
    else if (module.path === dadbPath) console.log(color.yellow(`  - ${module.path}: 仅更新 upstream/master 远程跟踪分支`));
    else console.log(`  - ${module.path}: fast-forward 到 origin/${detectBranch(module, false)}`);
  }
  if (dryRun) return;

  // Preflight existing worktrees before any fetch/checkout to avoid partial updates.
  for (const module of modules) {
    if (skipped.has(module.path) || module.path === dadbPath || !isRepository(module.path)) continue;
    requireClean(module.path);
  }

  try {
    for (const module of modules) {
      if (skipped.has(module.path)) continue;
      ensureInitialized(module.path);
      if (module.path === dadbPath) updateDadbRemote();
      else updateBranch(module);
    }
  } finally {
    printUpdateReports();
  }
  console.log(color.green("✓ 子模块更新完成"));
}

try {
  main();
} catch (error) {
  console.error(color.red(`✗ ${error.message}`));
  process.exitCode = 1;
}
