const CONNECTION_PATTERNS = [
  ["adb", /ADB Race winner:/iu],
  ["video_socket", /channel=video/iu],
  ["video_socket", /video socket connected/iu],
  ["audio_socket", /audio socket connected/iu],
  ["control_socket", /control socket connected/iu],
  ["dummy_byte", /dummy byte verified/iu],
  ["session", /connection established/iu],
  ["video_decoder", /decoder started: Video/iu],
  ["audio_decoder", /decoder started: Audio/iu],
  ["video_output", /decoder output frame #1:/iu],
  ["audio_output", /first audio output:/iu],
  ["heartbeat", /ADB heartbeat detection has started/iu],
];

export function summarizeLogs(entries) {
  const byLevel = countBy(entries, (entry) => entry.level);
  const byTag = countBy(entries, (entry) => entry.tag);
  const recentIssues = entries.filter((entry) => entry.level === "W" || entry.level === "E").slice(-20);
  return {
    total: entries.length,
    firstId: entries[0]?.id ?? null,
    lastId: entries.at(-1)?.id ?? null,
    byLevel,
    byTag,
    recentIssues,
  };
}

export function buildConnectionTimeline(entries) {
  return entries.flatMap((entry) => {
    const matched = CONNECTION_PATTERNS.find(([, pattern]) => pattern.test(entry.message));
    if (!matched) return [];
    return [
      {
        id: entry.id,
        stage: matched[0],
        level: entry.level,
        tag: entry.tag,
        message: entry.message,
      },
    ];
  });
}

export function analyzeRuntime({ session, sockets, metrics, logs }) {
  const findings = [];
  const timeline = buildConnectionTimeline(logs);
  const hasEstablishedLog = timeline.some((event) => event.stage === "session");

  if (!session.available) {
    findings.push(finding("warning", "client_unavailable", "No ScrcpyClient instance is registered in the app process."));
  } else if (!session.active) {
    findings.push(finding("info", "session_inactive", "No active scrcpy session is currently registered."));
  }

  if (session.active && !sockets.allRequiredSocketsConnected) {
    findings.push(
      finding(
        "warning",
        "socket_set_incomplete",
        `Only ${(sockets.connectedSockets ?? []).length} of ${sockets.expectedSocketCount ?? 0} required sockets are connected.`,
      ),
    );
  }

  if (session.active && !metrics.videoStreamReady) {
    findings.push(finding("warning", "video_stream_not_ready", "The session is active but the video stream is not ready."));
  }
  if (session.configuration?.audioEnabled && session.active && !metrics.audioStreamReady) {
    findings.push(finding("warning", "audio_stream_not_ready", "Audio is enabled but the audio stream is not ready."));
  }
  if (!session.active && hasEstablishedLog) {
    findings.push(
      finding(
        "info",
        "historical_connection_only",
        "Logs contain an established connection, but the current diagnostics snapshot has no active session.",
      ),
    );
  }
  if (logs.length === 0) {
    findings.push(
      finding("info", "live_logs_empty", "No in-memory logs are available; enable debug mode in Screen Remote for log diagnostics."),
    );
  }
  if (findings.length === 0) {
    findings.push(finding("info", "runtime_healthy", "No readiness inconsistency was detected in the current snapshot."));
  }
  return { findings, timeline };
}

export function calculateMetricRates(before, after, elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    throw new Error("elapsedMs must be greater than zero");
  }
  return {
    elapsedMs,
    networkTxBitsPerSecond: byteCounterRate(before.networkTxBytes, after.networkTxBytes, elapsedMs),
    networkRxBitsPerSecond: byteCounterRate(before.networkRxBytes, after.networkRxBytes, elapsedMs),
  };
}

function byteCounterRate(before, after, elapsedMs) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || after < before) return null;
  return ((after - before) * 8_000) / elapsedMs;
}

function countBy(items, keyOf) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const key = keyOf(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map())].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function finding(severity, code, message) {
  return { severity, code, message };
}
