use byteorder::{BigEndian, ByteOrder};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::process::Child;
use tokio::sync::{mpsc, watch, Mutex, RwLock};
use tokio_tungstenite::tungstenite::Message;

use crate::adb::{execute_adb_async, resolve_adb_path};
use crate::session::ScrcpyDeviceOptions;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeSessionInfo {
    pub session_id: String,
    pub is_virtual_display: bool,
    pub serial: String,
    pub stream_port: u16,
    pub width: u32,
    pub height: u32,
    pub codec: String,
    #[serde(default)]
    pub has_audio: bool,
    #[serde(default)]
    pub audio_codec: String,
}

pub struct ActiveSession {
    pub info: NativeSessionInfo,
    pub server_process: Mutex<Option<Child>>,
    pub forward_port: u16,
    pub control_tx: mpsc::Sender<Vec<u8>>,
    pub stop_tx: watch::Sender<bool>,
}

pub struct NativeScrcpyManager {
    sessions: Arc<RwLock<HashMap<String, Arc<ActiveSession>>>>,
}

impl NativeScrcpyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn get_bundled_scrcpy_server_path() -> Result<PathBuf, String> {
        let candidate = PathBuf::from("resources/scrcpy-server.jar");
        if candidate.exists() {
            return Ok(candidate);
        }
        let candidate2 = PathBuf::from("src-tauri/resources/scrcpy-server.jar");
        if candidate2.exists() {
            return Ok(candidate2);
        }
        let candidate3 = PathBuf::from("../src-tauri/resources/scrcpy-server.jar");
        if candidate3.exists() {
            return Ok(candidate3);
        }
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let res = dir.join("resources").join("scrcpy-server.jar");
                if res.exists() {
                    return Ok(res);
                }
                let res_parent = dir.join("../Resources/scrcpy-server.jar");
                if res_parent.exists() {
                    return Ok(res_parent);
                }
            }
        }
        Err("scrcpy-server.jar not found in resources".to_string())
    }

    pub async fn ensure_server_deployed(serial: &str, custom_adb: Option<&str>) -> Result<(), String> {
        let server_path = Self::get_bundled_scrcpy_server_path()?;
        let path_str = server_path.to_string_lossy().to_string();

        let check_out = execute_adb_async(
            custom_adb,
            &["-s", serial, "shell", "if [ -f /data/local/tmp/scrcpy-server.jar ]; then echo EXISTS; fi"],
        ).await.unwrap_or_default();

        if !check_out.contains("EXISTS") {
            log::info!("Deploying scrcpy-server.jar to {}", serial);
            execute_adb_async(
                custom_adb,
                &["-s", serial, "push", &path_str, "/data/local/tmp/scrcpy-server.jar"],
            ).await?;
        }
        Ok(())
    }

    pub async fn start_session(
        &self,
        session_id: String,
        serial: String,
        options: ScrcpyDeviceOptions,
        is_virtual_display: bool,
        custom_adb: Option<String>,
    ) -> Result<NativeSessionInfo, String> {
        self.stop_session(&session_id).await;

        Self::ensure_server_deployed(&serial, custom_adb.as_deref()).await?;

        // 1. Generate unique scid and socket name
        let scid: u32 = rand::random::<u32>() & 0x7fff_ffff | 1;
        let socket_name = format!("scrcpy_{:08x}", scid);

        // 2. Set up ADB forward
        let forward_arg = format!("localabstract:{}", socket_name);
        let forward_out = execute_adb_async(
            custom_adb.as_deref(),
            &["-s", &serial, "forward", "tcp:0", &forward_arg],
        ).await?;

        let forward_port = forward_out.trim().parse::<u16>().map_err(|e| {
            format!("Invalid forward port from ADB '{}': {}", forward_out.trim(), e)
        })?;

        log::info!(
            "Native scrcpy forward established: serial={}, port={}, socket={}",
            serial, forward_port, socket_name
        );

        let enable_audio = options.enable_audio;
        let audio_codec = if options.audio_codec.trim().is_empty() {
            "opus".to_string()
        } else {
            options.audio_codec.trim().to_lowercase()
        };

        // 3. Prepare server arguments
        let mut server_args = vec![
            "-s".to_string(),
            serial.clone(),
            "shell".to_string(),
            "CLASSPATH=/data/local/tmp/scrcpy-server.jar".to_string(),
            "app_process".to_string(),
            "/".to_string(),
            "com.genymobile.scrcpy.Server".to_string(),
            "4.1".to_string(),
            format!("scid={:08x}", scid),
            "log_level=info".to_string(),
            format!("video_codec={}", options.video_codec),
            format!("video_bit_rate={}", parse_bitrate(&options.video_bitrate, 4_000_000)),
            format!("max_fps={}", options.max_fps.max(1)),
            "tunnel_forward=true".to_string(),
            "send_device_meta=true".to_string(),
            "send_stream_meta=true".to_string(),
            "send_frame_meta=true".to_string(),
            "send_dummy_byte=true".to_string(),
            "display_id=0".to_string(),
            "downsize_on_error=false".to_string(),
            format!("stay_awake={}", options.keep_device_awake),
            "power_off_on_close=false".to_string(),
        ];

        if enable_audio {
            server_args.push("audio=true".to_string());
            server_args.push(format!("audio_codec={}", audio_codec));
            if audio_codec != "raw" && !options.audio_bitrate.trim().is_empty() {
                server_args.push(format!("audio_bit_rate={}", parse_bitrate(&options.audio_bitrate, 128_000)));
            }
        } else {
            server_args.push("audio=false".to_string());
        }

        if options.max_size > 0 {
            server_args.push(format!("max_size={}", options.max_size));
        }

        if is_virtual_display || options.new_display_enabled {
            let mut display_spec = String::new();
            if options.new_display_width > 0 && options.new_display_height > 0 {
                display_spec = format!("{}x{}", options.new_display_width, options.new_display_height);
                if options.new_display_dpi > 0 {
                    display_spec.push_str(&format!("/{}", options.new_display_dpi));
                }
            }
            server_args.push(format!("new_display={}", display_spec));
            server_args.push("vd_system_decorations=false".to_string());
            server_args.push("vd_destroy_content=false".to_string());
        }

        if let Some(ref start_app) = options.start_app {
            if !start_app.is_empty() {
                server_args.push(format!("start_app={}", start_app));
            }
        }

        // 4. Launch server process
        let adb_path = resolve_adb_path(custom_adb.as_deref())?;
        let mut child = tokio::process::Command::new(&adb_path)
            .args(&server_args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn scrcpy-server: {}", e))?;

        log::info!("scrcpy-server process spawned for {}", serial);

        // 5. Connect Video Socket
        let mut video_socket = None;
        let start_time = tokio::time::Instant::now();
        while start_time.elapsed() < Duration::from_secs(8) {
            match TcpStream::connect(("127.0.0.1", forward_port)).await {
                Ok(mut stream) => {
                    let mut dummy = [0u8; 1];
                    if let Ok(_) = stream.read_exact(&mut dummy).await {
                        if dummy[0] == 0 {
                            video_socket = Some(stream);
                            break;
                        }
                    }
                }
                Err(_) => {
                    tokio::time::sleep(Duration::from_millis(60)).await;
                }
            }
        }

        let mut video_socket = video_socket.ok_or_else(|| {
            let _ = child.start_kill();
            "Failed to connect to scrcpy video socket (dummy byte timeout)".to_string()
        })?;

        // 6. Connect Audio Socket (if audio enabled on server)
        let mut audio_socket = None;
        let mut audio_codec_detected = String::new();
        if enable_audio {
            let audio_res = tokio::time::timeout(Duration::from_secs(3), async {
                let mut stream = TcpStream::connect(("127.0.0.1", forward_port)).await?;
                let mut codec_buf = [0u8; 4];
                stream.read_exact(&mut codec_buf).await?;
                Ok::<_, std::io::Error>((stream, codec_buf))
            }).await;

            match audio_res {
                Ok(Ok((stream, codec_buf))) => {
                    let raw_str = String::from_utf8_lossy(&codec_buf).trim_matches('\0').to_string();
                    if codec_buf == [0, 0, 0, 0] || codec_buf == [0, 0, 0, 1] || raw_str.is_empty() {
                        log::warn!("Audio disabled by device or unsupported (code {:?}): falling back to video only", codec_buf);
                    } else {
                        log::info!("Scrcpy audio stream connected: codec={}", raw_str);
                        audio_codec_detected = raw_str;
                        audio_socket = Some(stream);
                    }
                }
                Ok(Err(e)) => {
                    log::warn!("Audio socket connection error: {}, fallback to video only", e);
                }
                Err(_) => {
                    log::warn!("Audio socket connection timeout, fallback to video only");
                }
            }
        }

        // 7. Connect Control Socket
        let mut control_socket = TcpStream::connect(("127.0.0.1", forward_port))
            .await
            .map_err(|e| format!("Failed to connect scrcpy control socket: {}", e))?;

        // 8. Read Video Socket Metadata
        let mut dev_name_buf = [0u8; 64];
        video_socket.read_exact(&mut dev_name_buf).await.map_err(|e| format!("Failed reading device metadata: {}", e))?;
        let _dev_name = String::from_utf8_lossy(&dev_name_buf).trim_matches('\0').to_string();

        let mut codec_buf = [0u8; 4];
        video_socket.read_exact(&mut codec_buf).await.map_err(|e| format!("Failed reading video codec: {}", e))?;
        let codec_str = String::from_utf8_lossy(&codec_buf).trim_matches('\0').to_string();

        let mut initial_header = [0u8; 12];
        video_socket.read_exact(&mut initial_header).await.map_err(|e| format!("Failed reading initial media header: {}", e))?;
        let first = BigEndian::read_u64(&initial_header[0..8]);
        let tail = BigEndian::read_u32(&initial_header[8..12]);

        let (width, height) = if (first & (1 << 63)) != 0 {
            let w = BigEndian::read_u32(&initial_header[4..8]);
            let h = tail;
            (w, h)
        } else {
            (1080, 2400)
        };

        let has_audio = audio_socket.is_some();
        log::info!(
            "Scrcpy stream metadata: video_codec={}, initial_resolution={}x{}, has_audio={}, audio_codec={}",
            codec_str, width, height, has_audio, audio_codec_detected
        );

        // 9. Bind WebSocket listener for Frontend
        let ws_listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| format!("Failed to bind WebSocket listener: {}", e))?;
        let stream_port = ws_listener.local_addr().map_err(|e| e.to_string())?.port();

        let (control_tx, mut control_rx) = mpsc::channel::<Vec<u8>>(128);
        let (stop_tx, _stop_rx) = watch::channel::<bool>(false);

        let info = NativeSessionInfo {
            session_id: session_id.clone(),
            is_virtual_display,
            serial: serial.clone(),
            stream_port,
            width,
            height,
            codec: codec_str.clone(),
            has_audio,
            audio_codec: audio_codec_detected.clone(),
        };

        let session_arc = Arc::new(ActiveSession {
            info: info.clone(),
            server_process: Mutex::new(Some(child)),
            forward_port,
            control_tx: control_tx.clone(),
            stop_tx: stop_tx.clone(),
        });

        self.sessions.write().await.insert(session_id.clone(), session_arc.clone());

        // 10. Control Socket Writer
        tokio::spawn(async move {
            while let Some(msg) = control_rx.recv().await {
                if let Err(e) = control_socket.write_all(&msg).await {
                    log::warn!("Control socket write error: {}", e);
                    break;
                }
            }
        });

        // 11. WebSocket Handler & Multi-task Demuxer
        let active_ws_tx: Arc<RwLock<Option<mpsc::Sender<Message>>>> = Arc::new(RwLock::new(None));

        let ws_active_tx = active_ws_tx.clone();
        let stop_tx_ws = stop_tx.clone();
        let control_tx_ws = control_tx.clone();
        let codec_str_clone = codec_str.clone();
        let audio_codec_clone = audio_codec_detected.clone();
        let session_id_ws = session_id.clone();

        tokio::spawn(async move {
            let mut ws_stop_rx = stop_tx_ws.subscribe();
            loop {
                tokio::select! {
                    _ = ws_stop_rx.changed() => {
                        break;
                    }
                    accept_res = ws_listener.accept() => {
                        let (stream, _) = match accept_res {
                            Ok(c) => c,
                            Err(e) => {
                                log::error!("WebSocket accept failed for {}: {}", session_id_ws, e);
                                break;
                            }
                        };

                        let ws_stream = match tokio_tungstenite::accept_async(stream).await {
                            Ok(ws) => ws,
                            Err(e) => {
                                log::warn!("WebSocket handshake failed for {}: {}", session_id_ws, e);
                                continue;
                            }
                        };

                        let (mut ws_sink, mut ws_src) = ws_stream.split();
                        let (client_tx, mut client_rx) = mpsc::channel::<Message>(256);

                        let init_json = serde_json::json!({
                            "type": "init",
                            "width": width,
                            "height": height,
                            "codec": codec_str_clone,
                            "is_virtual_display": is_virtual_display,
                            "has_audio": has_audio,
                            "audio_codec": audio_codec_clone
                        }).to_string();

                        if ws_sink.send(Message::Text(init_json.into())).await.is_err() {
                            continue;
                        }

                        *ws_active_tx.write().await = Some(client_tx);

                        let mut client_stop_rx = stop_tx_ws.subscribe();
                        let sender_handle = tokio::spawn(async move {
                            loop {
                                tokio::select! {
                                    _ = client_stop_rx.changed() => break,
                                    msg = client_rx.recv() => {
                                        match msg {
                                            Some(m) => {
                                                if ws_sink.send(m).await.is_err() {
                                                    break;
                                                }
                                            }
                                            None => break,
                                        }
                                    }
                                }
                            }
                        });

                        let control_tx_client = control_tx_ws.clone();
                        let receiver_handle = tokio::spawn(async move {
                            while let Some(Ok(msg)) = ws_src.next().await {
                                match msg {
                                    Message::Binary(bin) => {
                                        let _ = control_tx_client.send(bin.to_vec()).await;
                                    }
                                    Message::Text(text) => {
                                        if let Ok(event) = serde_json::from_str::<serde_json::Value>(&text) {
                                            if let Some(bytes) = parse_control_json(&event, width, height) {
                                                let _ = control_tx_client.send(bytes).await;
                                            }
                                        }
                                    }
                                    Message::Close(_) => break,
                                    _ => {}
                                }
                            }
                        });

                        let _ = tokio::join!(sender_handle, receiver_handle);
                        *ws_active_tx.write().await = None;
                        log::info!("WebSocket client disconnected for session {}", session_id_ws);
                    }
                }
            }
        });

        // 12. Audio Demuxer Task (if audio socket is present)
        if let Some(mut audio_stream) = audio_socket {
            let mut audio_stop_rx = stop_tx.subscribe();
            let ws_tx_audio = active_ws_tx.clone();
            tokio::spawn(async move {
                let mut header_buf = [0u8; 12];
                loop {
                    tokio::select! {
                        _ = audio_stop_rx.changed() => break,
                        res = audio_stream.read_exact(&mut header_buf) => {
                            if res.is_err() {
                                break;
                            }
                            let first = BigEndian::read_u64(&header_buf[0..8]);
                            let tail = BigEndian::read_u32(&header_buf[8..12]);

                            let is_config = (first & (1 << 62)) != 0;
                            let is_key_frame = (first & (1 << 61)) != 0;
                            let pts = first & ((1 << 61) - 1);
                            let size = tail as usize;

                            if size > 0 && size <= 4 * 1024 * 1024 {
                                let mut payload = vec![0u8; size];
                                if audio_stream.read_exact(&mut payload).await.is_err() {
                                    break;
                                }

                                let mut packet = Vec::with_capacity(11 + size);
                                packet.push(2); // 0x02: binary audio sample chunk
                                packet.push(if is_config { 1 } else { 0 });
                                packet.push(if is_key_frame { 1 } else { 0 });
                                packet.extend_from_slice(&pts.to_be_bytes());
                                packet.extend_from_slice(&payload);

                                if let Some(tx) = &*ws_tx_audio.read().await {
                                    let _ = tx.send(Message::Binary(packet.into())).await;
                                }
                            }
                        }
                    }
                }
                log::info!("Audio demuxer ended");
            });
        }

        // 13. Video Socket Demuxer Task
        let session_id_clone = session_id.clone();
        let sessions_map = self.sessions.clone();
        let custom_adb_clone = custom_adb.clone();
        let serial_clone = serial.clone();
        let ws_tx_video = active_ws_tx.clone();
        let stop_tx_video = stop_tx.clone();
        let mut video_stop_rx = stop_tx.subscribe();

        tokio::spawn(async move {
            let mut header_buf = [0u8; 12];
            loop {
                tokio::select! {
                    _ = video_stop_rx.changed() => {
                        break;
                    }
                    res = video_socket.read_exact(&mut header_buf) => {
                        if res.is_err() {
                            break;
                        }
                        let first = BigEndian::read_u64(&header_buf[0..8]);
                        let tail = BigEndian::read_u32(&header_buf[8..12]);

                        if (first & (1 << 63)) != 0 {
                            let new_w = BigEndian::read_u32(&header_buf[4..8]);
                            let new_h = tail;
                            let resize_json = serde_json::json!({
                                "type": "resize",
                                "width": new_w,
                                "height": new_h
                            }).to_string();
                            if let Some(tx) = &*ws_tx_video.read().await {
                                let _ = tx.send(Message::Text(resize_json.into())).await;
                            }
                        } else {
                            let pts = first & ((1 << 61) - 1);
                            let is_config = (first & (1 << 62)) != 0;
                            let is_key_frame = (first & (1 << 61)) != 0;
                            let size = tail as usize;

                            if size > 0 && size <= 32 * 1024 * 1024 {
                                let mut payload = vec![0u8; size];
                                if video_socket.read_exact(&mut payload).await.is_err() {
                                    break;
                                }

                                let mut packet = Vec::with_capacity(11 + size);
                                packet.push(1); // 0x01: binary video packet
                                packet.push(if is_config { 1 } else { 0 });
                                packet.push(if is_key_frame { 1 } else { 0 });
                                packet.extend_from_slice(&pts.to_be_bytes());
                                packet.extend_from_slice(&payload);

                                if let Some(tx) = &*ws_tx_video.read().await {
                                    let _ = tx.send(Message::Binary(packet.into())).await;
                                }
                            }
                        }
                    }
                }
            }

            log::info!("Video stream ended for session {}", session_id_clone);
            let _ = stop_tx_video.send(true);
            let _ = execute_adb_async(
                custom_adb_clone.as_deref(),
                &["-s", &serial_clone, "forward", "--remove", &format!("tcp:{}", forward_port)],
            ).await;
            sessions_map.write().await.remove(&session_id_clone);
        });

        Ok(info)
    }

    pub async fn send_control(&self, session_id: &str, raw_packet: Vec<u8>) -> Result<(), String> {
        let list = self.sessions.read().await;
        if let Some(session) = list.get(session_id) {
            session.control_tx.send(raw_packet).await.map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    }

    pub async fn stop_session(&self, session_id: &str) {
        let mut list = self.sessions.write().await;
        if let Some(session) = list.remove(session_id) {
            let _ = session.stop_tx.send(true);
            if let Some(mut proc) = session.server_process.lock().await.take() {
                let _ = proc.start_kill();
            }
        }
    }

    pub async fn stop_all(&self) {
        let mut list = self.sessions.write().await;
        for (_, session) in list.drain() {
            let _ = session.stop_tx.send(true);
            if let Some(mut proc) = session.server_process.lock().await.take() {
                let _ = proc.start_kill();
            }
        }
    }
}

fn parse_bitrate(val: &str, fallback: u64) -> u64 {
    let lower = val.to_lowercase();
    if lower.ends_with('m') {
        lower.trim_end_matches('m').parse::<u64>().map(|v| v * 1_000_000).unwrap_or(fallback)
    } else if lower.ends_with('k') {
        lower.trim_end_matches('k').parse::<u64>().map(|v| v * 1_000).unwrap_or(fallback)
    } else {
        val.parse::<u64>().unwrap_or(fallback)
    }
}

pub fn make_touch_packet(
    action: u8,
    pointer_id: u64,
    x: u32,
    y: u32,
    screen_width: u16,
    screen_height: u16,
    pressure: u16,
    action_button: u32,
    buttons: u32,
) -> Vec<u8> {
    let mut buf = Vec::with_capacity(32);
    buf.push(2); // SC_CONTROL_MSG_TYPE_INJECT_TOUCH_EVENT
    buf.push(action);
    buf.extend_from_slice(&pointer_id.to_be_bytes());
    buf.extend_from_slice(&x.to_be_bytes());
    buf.extend_from_slice(&y.to_be_bytes());
    buf.extend_from_slice(&screen_width.to_be_bytes());
    buf.extend_from_slice(&screen_height.to_be_bytes());
    buf.extend_from_slice(&pressure.to_be_bytes());
    buf.extend_from_slice(&action_button.to_be_bytes());
    buf.extend_from_slice(&buttons.to_be_bytes());
    buf
}

pub fn make_scroll_packet(
    x: u32,
    y: u32,
    screen_width: u16,
    screen_height: u16,
    h_scroll: i32,
    v_scroll: i32,
    buttons: u32,
) -> Vec<u8> {
    let mut buf = Vec::with_capacity(21);
    buf.push(3); // SC_CONTROL_MSG_TYPE_INJECT_SCROLL_EVENT
    buf.extend_from_slice(&x.to_be_bytes());
    buf.extend_from_slice(&y.to_be_bytes());
    buf.extend_from_slice(&screen_width.to_be_bytes());
    buf.extend_from_slice(&screen_height.to_be_bytes());
    buf.extend_from_slice(&h_scroll.to_be_bytes());
    buf.extend_from_slice(&v_scroll.to_be_bytes());
    buf.extend_from_slice(&buttons.to_be_bytes());
    buf
}

pub fn make_keycode_packet(action: u8, keycode: u32, repeat: u32, meta: u32) -> Vec<u8> {
    let mut buf = Vec::with_capacity(14);
    buf.push(0); // SC_CONTROL_MSG_TYPE_INJECT_KEYCODE
    buf.push(action);
    buf.extend_from_slice(&keycode.to_be_bytes());
    buf.extend_from_slice(&repeat.to_be_bytes());
    buf.extend_from_slice(&meta.to_be_bytes());
    buf
}

pub fn make_text_packet(text: &str) -> Vec<u8> {
    let bytes = text.as_bytes();
    let mut buf = Vec::with_capacity(5 + bytes.len());
    buf.push(1); // SC_CONTROL_MSG_TYPE_INJECT_TEXT
    buf.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    buf.extend_from_slice(bytes);
    buf
}

pub fn make_start_app_packet(package_name: &str) -> Vec<u8> {
    let bytes = package_name.as_bytes();
    let len = bytes.len().min(255) as u8;
    let mut buf = Vec::with_capacity(2 + len as usize);
    buf.push(16); // SC_CONTROL_MSG_TYPE_START_APP
    buf.push(len);
    buf.extend_from_slice(&bytes[..len as usize]);
    buf
}

pub fn parse_control_json(val: &serde_json::Value, width: u32, height: u32) -> Option<Vec<u8>> {
    let event_type = val.get("type")?.as_str()?;
    match event_type {
        "touch" => {
            let action = val.get("action")?.as_u64()? as u8;
            let x = val.get("x")?.as_u64()? as u32;
            let y = val.get("y")?.as_u64()? as u32;
            let pressure = if action == 1 { 0 } else { 0xffff };
            Some(make_touch_packet(
                action,
                u64::MAX - 1,
                x,
                y,
                width as u16,
                height as u16,
                pressure,
                0,
                0,
            ))
        }
        "scroll" => {
            let x = val.get("x")?.as_u64()? as u32;
            let y = val.get("y")?.as_u64()? as u32;
            let h = val.get("h")?.as_i64()? as i32;
            let v = val.get("v")?.as_i64()? as i32;
            Some(make_scroll_packet(x, y, width as u16, height as u16, h, v, 0))
        }
        "key" => {
            let action = val.get("action")?.as_u64()? as u8;
            let keycode = val.get("keycode")?.as_u64()? as u32;
            Some(make_keycode_packet(action, keycode, 0, 0))
        }
        "text" => {
            let text = val.get("text")?.as_str()?;
            Some(make_text_packet(text))
        }
        "start_app" => {
            let pkg = val.get("package")?.as_str()?;
            Some(make_start_app_packet(pkg))
        }
        _ => None,
    }
}
