const APP_HOSTS = new Set(["open", "session", "setting", "adb", "diagnostics", "remote"]);
const MANAGE_SECTIONS = new Set(["device", "utility", "file", "app", "process", "port-forward", "command"]);
const BOOLEAN_SETTINGS = new Set([
  "debugmode",
  "activitylog",
  "audiolog",
  "videolog",
  "controllog",
  "eventlog",
  "shelllog",
  "managementlog",
  "haptic",
  "performancestats",
  "autoupdate",
]);
const ENUM_SETTINGS = new Map([
  ["updatechannel", new Set(["stable", "prerelease"])],
  ["theme", new Set(["system", "light", "dark"])],
  ["language", new Set(["auto", "chinese", "english"])],
]);
const BOOLEAN_VALUES = new Set(["on", "off", "true", "false", "1", "0", "yes", "no"]);
const SCRCPY_PARAMETERS = new Set([
  "maxSize",
  "videoBitRate",
  "maxFps",
  "videoEncoder",
  "videoDecoder",
  "audio",
  "enableAudio",
  "audioBitRate",
  "audioEncoder",
  "audioDecoder",
  "gameMode",
  "fullScreen",
  "useFullScreen",
  "floatingBall",
  "showFloatingBall",
  "hardwareDecoding",
  "enableHardwareDecoding",
  "followOrientation",
  "followRemoteOrientation",
  "clipboard",
  "clipboardSync",
  "turnScreenOff",
  "powerOffOnClose",
  "cleanupOnDisconnect",
  "stayAwake",
  "keepDeviceAwake",
  "showTouches",
  "ignoreVideoEncoderConstraints",
  "displayId",
  "newDisplayEnabled",
  "newDisplay",
  "virtualDisplaySystemDecorations",
  "preserveVirtualDisplayContent",
  "startApp",
  "codecOptions",
  "tunnelMode",
]);
const NEW_SESSION_PARAMETERS = new Set([
  "name",
  "address",
  "color",
  "profileId",
  "useProfileDefaults",
  "backupAddresses",
  "groupIds",
  ...SCRCPY_PARAMETERS,
]);

export function buildScreenRemoteUrl({
  action,
  target,
  parameters,
  section,
  path,
  command,
  setting,
  value,
} = {}) {
  switch (action) {
    case "sessions":
      return "screen-remote://open/sessions";
    case "settings":
      return "screen-remote://open/settings";
    case "new_session": {
      const normalizedParameters = normalizeParameterNames(parameters, NEW_SESSION_PARAMETERS, "new session");
      return `screen-remote://session/new${toQuery(normalizedParameters)}`;
    }
    case "edit_session":
      return buildEditSessionUrl(required(target, "target"));
    case "scrcpy":
      return buildScrcpyUrl(required(target, "target"), parameters);
    case "manage":
      return buildManageUrl(required(target, "target"), { section, path, command, parameters });
    case "setting":
      return buildSettingUrl(required(setting, "setting"), required(value, "value"));
    case "generate_adb_keys":
      return "screen-remote://adb/keys/generate";
    case "diagnostic_logs":
      return "screen-remote://diagnostics/logs";
    case "disconnect":
      return "screen-remote://remote/disconnect";
    default:
      throw new Error(`Unsupported Screen Remote URL action: ${action ?? "(missing)"}`);
  }
}

export function buildScrcpyUrl(target, parameters = {}) {
  const normalizedParameters = normalizeParameterNames(parameters, SCRCPY_PARAMETERS, "scrcpy");
  return `screen-remote://session/${encodeSegment(target)}/scrcpy${toQuery(normalizedParameters)}`;
}

export function buildManageUrl(target, { section = "device", path, command, parameters = {} } = {}) {
  if (!MANAGE_SECTIONS.has(section)) {
    throw new Error(`Unsupported management section: ${section}`);
  }
  const allowedParameters =
    section === "file" ? new Set(["path"]) : section === "command" ? new Set(["command"]) : new Set();
  const unsupported = Object.keys(parameters).filter((key) => !allowedParameters.has(key));
  if (unsupported.length > 0) {
    throw new Error(`Unsupported parameters for ${section} management: ${unsupported.join(", ")}`);
  }
  const effectivePath = path ?? parameters.path;
  const effectiveCommand = command ?? parameters.command;
  if (effectivePath && section !== "file") {
    throw new Error("path is only supported for the file management section");
  }
  const segments = ["screen-remote://session", encodeSegment(target), "manage", section];
  if (effectivePath) {
    for (const item of String(effectivePath).split("/").filter(Boolean)) segments.push(encodeSegment(item));
  }
  const query = {};
  if (effectiveCommand !== undefined) {
    if (section !== "command") throw new Error("command is only supported for the command management section");
    query.command = effectiveCommand;
  }
  return `${segments.join("/")}${toQuery(query)}`;
}

export function buildNewSessionUrl({
  name,
  address,
  color,
  profileId,
  useProfileDefaults,
  backupAddresses,
  groupIds,
  parameters = {},
} = {}) {
  const query = normalizeParameterNames(parameters, SCRCPY_PARAMETERS, "scrcpy");
  if (name !== undefined) query.name = name;
  if (address !== undefined) query.address = address;
  if (color !== undefined) query.color = color;
  if (profileId !== undefined) query.profileId = profileId;
  if (useProfileDefaults !== undefined) query.useProfileDefaults = useProfileDefaults ? "on" : "off";
  if (backupAddresses?.length) query.backupAddresses = backupAddresses.join(",");
  if (groupIds?.length) query.groupIds = groupIds.join(",");
  return `screen-remote://session/new${toQuery(query)}`;
}

export function buildEditSessionUrl(target) {
  return `screen-remote://session/edit/${encodeSegment(target)}`;
}

export function buildSettingUrl(setting, value) {
  const requestedSetting = required(setting, "setting");
  const strictValue = required(value, "value");
  const strictSetting =
    [...BOOLEAN_SETTINGS, ...ENUM_SETTINGS.keys()].find(
      (candidate) => candidate.toLowerCase() === requestedSetting.toLowerCase(),
    ) ?? requestedSetting;
  if (BOOLEAN_SETTINGS.has(strictSetting)) {
    if (!BOOLEAN_VALUES.has(strictValue)) {
      throw new Error(`Invalid boolean value for ${strictSetting}: ${value}`);
    }
  } else {
    const allowed = ENUM_SETTINGS.get(strictSetting);
    if (!allowed) throw new Error(`Unsupported Screen Remote setting: ${setting}`);
    if (!allowed.has(strictValue)) {
      throw new Error(`Invalid value for ${strictSetting}: ${value}; expected ${[...allowed].join(", ")}`);
    }
  }
  return `screen-remote://setting/${encodeSegment(strictSetting)}/${encodeSegment(strictValue)}`;
}

export function validateAppUrl(value) {
  const rawPrefix = /^screen-remote:\/\/([^/?#]+)/u.exec(value);
  if (!rawPrefix) throw new Error("URL scheme and host must use their canonical case");
  if (!APP_HOSTS.has(rawPrefix[1])) {
    throw new Error(`URL host is not an app command: ${rawPrefix[1]}`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid Screen Remote URL: ${value}`);
  }
  if (url.protocol !== "screen-remote:") throw new Error("URL scheme must be screen-remote");
  if (!APP_HOSTS.has(url.hostname)) throw new Error(`URL host is not an app command: ${url.hostname}`);
  if (url.username || url.password || url.hash) throw new Error("Screen Remote app URLs cannot contain credentials or fragments");
  return url.href;
}

function toQuery(parameters = {}) {
  const entries = Object.entries(parameters).filter(([, value]) => value !== undefined && value !== null);
  if (entries.length === 0) return "";
  entries.sort(([left], [right]) => left.localeCompare(right));
  return `?${entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&")}`;
}

function encodeSegment(value) {
  return encodeURIComponent(required(value, "path value"));
}

function required(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function normalizeParameterNames(parameters = {}, allowed, context) {
  const normalized = {};
  for (const [key, value] of Object.entries(parameters)) {
    const canonicalKey = [...allowed].find(
      (candidate) => candidate.toLowerCase() === key.toLowerCase(),
    );
    if (!canonicalKey) throw new Error(`Unsupported ${context} parameter: ${key}`);
    if (Object.hasOwn(normalized, canonicalKey)) {
      throw new Error(`Duplicate ${context} parameter: ${canonicalKey}`);
    }
    normalized[canonicalKey] = value;
  }
  return normalized;
}
