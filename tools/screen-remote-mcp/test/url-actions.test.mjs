import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEditSessionUrl,
  buildManageUrl,
  buildNewSessionUrl,
  buildScrcpyUrl,
  buildScreenRemoteUrl,
  buildSettingUrl,
  validateAppUrl,
} from "../src/url-actions.mjs";

test("builds encoded scrcpy URLs with deterministic parameters", () => {
  assert.equal(
    buildScrcpyUrl("Living room", { videoBitRate: "8M", audio: true, maxFps: 120 }),
    "screen-remote://session/Living%20room/scrcpy?audio=true&maxFps=120&videoBitRate=8M",
  );
});

test("builds management file and command URLs", () => {
  assert.equal(
    buildManageUrl("192.168.1.20:5555", { section: "file", path: "/sdcard/My Files" }),
    "screen-remote://session/192.168.1.20%3A5555/manage/file/sdcard/My%20Files",
  );
  assert.equal(
    buildManageUrl("Living room", { section: "command", command: "getprop ro.product.model" }),
    "screen-remote://session/Living%20room/manage/command?command=getprop%20ro.product.model",
  );
});

test("builds editor and setting URLs", () => {
  assert.equal(buildEditSessionUrl("Living room"), "screen-remote://session/edit/Living%20room");
  assert.equal(buildSettingUrl("debugmode", "on"), "screen-remote://setting/debugmode/on");
  assert.equal(
    buildScreenRemoteUrl({ action: "generate_adb_keys" }),
    "screen-remote://adb/keys/generate",
  );
});

test("builds a fully prefilled new-session URL", () => {
  assert.equal(
    buildNewSessionUrl({
      name: "Living room",
      address: "192.168.1.20:5555",
      color: "blue",
      useProfileDefaults: false,
      backupAddresses: ["192.168.1.21:5555"],
      groupIds: ["group-1", "group-2"],
      parameters: { maxFps: 120, audio: "on" },
    }),
    "screen-remote://session/new?address=192.168.1.20%3A5555&audio=on&backupAddresses=192.168.1.21%3A5555&color=blue&groupIds=group-1%2Cgroup-2&maxFps=120&name=Living%20room&useProfileDefaults=off",
  );
});

test("rejects invalid management options and non-app URLs", () => {
  assert.throws(
    () => buildManageUrl("device", { section: "app", path: "/sdcard" }),
    /path is only supported/u,
  );
  assert.throws(() => validateAppUrl("screen-remote://runtime/session"), /not an app command/u);
  assert.throws(() => validateAppUrl("https://example.com"), /canonical case/u);
  assert.throws(() => buildSettingUrl("theme", "purple"), /Invalid value for theme/u);
  assert.throws(() => buildSettingUrl("unknown", "on"), /Unsupported Screen Remote setting/u);
  assert.equal(buildSettingUrl("DEBUGMODE", "on"), "screen-remote://setting/debugmode/on");
  assert.throws(() => buildSettingUrl("debugmode", "ON"), /Invalid boolean value/u);
  assert.equal(
    buildScrcpyUrl("Z5", { MAXSIZE: 1080 }),
    "screen-remote://session/Z5/scrcpy?maxSize=1080",
  );
  assert.equal(
    buildNewSessionUrl({ parameters: { MAXFPS: 60 } }),
    "screen-remote://session/new?maxFps=60",
  );
  assert.throws(() => validateAppUrl("SCREEN-REMOTE://session/Z5/scrcpy"), /canonical case/u);
  assert.throws(() => validateAppUrl("screen-remote://SESSION/Z5/scrcpy"), /not an app command/u);
});
