# scrcpy session order

The official scrcpy server assigns socket roles by `accept()` order and does not perform a client role handshake. Every client must open channels strictly and sequentially:

1. video;
2. audio, only when enabled;
3. control.

Never use parallel jobs, races, or completion order to assign channels.

## Startup and retry boundary

- Create a fresh server/SCID lifecycle for every complete connection attempt.
- Only retry a video connection while the server socket has not accepted that connection.
- Once a forwarded TCP connection succeeds, a dummy-byte, metadata, audio, or control failure must tear down the whole lifecycle. Do not create another partial trio against the same server because its accept sequence may already have advanced.
- Read the video dummy byte before exposing the connected socket set.
- Establish every required channel before reading media metadata or publishing a ready state.

## Stream and lifecycle invariants

- Use exact reads for fixed-size metadata and frame headers.
- Treat negotiated codec, dimensions, and audio availability as runtime facts, separate from saved preferences.
- Preserve packet boundaries, PTS, codec configuration, and decoder bootstrap order.
- Keep control writes off the UI caller path and bound high-frequency input backpressure.
- Serialize connect/disconnect ownership. Cleanup covers sockets, forwards, server processes, media pipelines, control queues, and presentation state.
- Retrying after transport loss creates a new server/SCID and a new ordered socket set.

The upstream `external/scrcpy/` server is authoritative. `external/scrcpy-mask/` may inform client presentation and input behavior but its server extensions are not part of this contract.
