import { spawn } from "node:child_process";

const DEFAULT_AUTHORITY = "com.screen.remote.android.debug.diagnostics";
const DEFAULT_TIMEOUT_MS = 10_000;

export class AdbDiagnosticsClient {
  constructor({
    adbPath = process.env.SCREEN_REMOTE_ADB_PATH || "adb",
    authority = process.env.SCREEN_REMOTE_DIAGNOSTICS_AUTHORITY || DEFAULT_AUTHORITY,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    this.adbPath = adbPath;
    this.authority = authority;
    this.timeoutMs = timeoutMs;
  }

  async listControllers() {
    const output = await this.#run(["devices", "-l"]);
    return output
      .split(/\r?\n/u)
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseDeviceLine)
      .filter((device) => device !== null);
  }

  async resolveController(requestedSerial) {
    const controllers = await this.listControllers();
    const online = controllers.filter((controller) => controller.state === "device");
    if (requestedSerial) {
      const selected = online.find((controller) => controller.serial === requestedSerial);
      if (!selected) {
        throw new Error(`ADB controller is not online: ${requestedSerial}`);
      }
      return selected;
    }
    if (online.length === 0) {
      throw new Error("No online ADB controller found");
    }
    if (online.length > 1) {
      throw new Error(
        `Multiple ADB controllers are online; specify controllerSerial (${online.map((item) => item.serial).join(", ")})`,
      );
    }
    return online[0];
  }

  async call(method, requestedSerial) {
    const controller = await this.resolveController(requestedSerial);
    return this.callForController(method, controller);
  }

  async callForController(method, controller) {
    const output = await this.#run([
      "-s",
      controller.serial,
      "shell",
      "content",
      "call",
      "--uri",
      `content://${this.authority}`,
      "--method",
      method,
    ]);
    return {
      controller,
      payload: decodeProviderPayload(output),
    };
  }

  async openUrl(url, requestedSerial) {
    const controller = await this.resolveController(requestedSerial);
    const output = await this.#run([
      "-s",
      controller.serial,
      "shell",
      "am",
      "start",
      "-W",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      url,
    ]);
    const activity = parseActivityStartOutput(output);
    const activityError = output.split(/\r?\n/u).find((line) => line.trim().startsWith("Error:"));
    if (activityError) {
      throw new Error(`Android rejected Screen Remote URL: ${activityError.trim()}`);
    }
    if (activity.status && activity.status.toLowerCase() !== "ok") {
      throw new Error(`Android activity launch failed with status ${activity.status}: ${output}`);
    }
    return {
      controller,
      url,
      activity,
    };
  }

  #run(args) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.adbPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`ADB command timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(new Error(`Unable to start ADB: ${error.message}`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`ADB exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }
}

export function parseActivityStartOutput(output) {
  const values = {};
  for (const line of output.split(/\r?\n/u)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) values[key] = value;
  }
  return {
    status: values.Status ?? null,
    activity: values.Activity ?? null,
    launchState: values.LaunchState ?? null,
    totalTimeMs: toOptionalNumber(values.TotalTime),
    waitTimeMs: toOptionalNumber(values.WaitTime),
    raw: output,
  };
}

function toOptionalNumber(value) {
  if (value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function decodeProviderPayload(output) {
  const match = output.match(/payload_base64=([^}\]]+)/u);
  if (!match) {
    throw new Error(
      "Screen Remote diagnostics provider did not return a payload. Install and launch the debug build first.",
    );
  }
  try {
    const payload = JSON.parse(Buffer.from(match[1].trim(), "base64").toString("utf8"));
    if (payload.error) {
      throw new Error(`Screen Remote diagnostics error: ${payload.error}`);
    }
    return payload;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid diagnostics payload: ${error.message}`);
    }
    throw error;
  }
}

function parseDeviceLine(line) {
  const [serial, state, ...attributes] = line.split(/\s+/u);
  if (!serial || !state) return null;
  const details = Object.fromEntries(
    attributes
      .map((attribute) => attribute.split(":", 2))
      .filter((parts) => parts.length === 2),
  );
  return {
    serial,
    state,
    product: details.product ?? null,
    model: details.model ?? null,
    device: details.device ?? null,
    transportId: details.transport_id ?? null,
  };
}
