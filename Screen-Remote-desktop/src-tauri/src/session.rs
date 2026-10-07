use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use crate::adb::{execute_adb_async, AdbDevice};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum DeviceTransport {
    #[serde(rename = "USB")]
    Usb,
    #[serde(rename = "TCP/IP")]
    Tcp,
    #[serde(rename = "mDNS")]
    Mdns,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConnection {
    pub id: String,
    pub transport: DeviceTransport,
    #[serde(default)]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default)]
    pub serial: String,
    #[serde(default)]
    pub priority: i32,
}

fn default_port() -> u16 {
    5555
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrcpyDeviceOptions {
    #[serde(default = "default_max_size")]
    pub max_size: u32,
    #[serde(default = "default_bitrate")]
    pub video_bitrate: String,
    #[serde(default = "default_max_fps")]
    pub max_fps: u32,
    #[serde(default = "default_video_codec")]
    pub video_codec: String,
    #[serde(default)]
    pub video_encoder: Option<String>,
    #[serde(default = "default_true")]
    pub enable_audio: bool,
    #[serde(default = "default_audio_codec")]
    pub audio_codec: String,
    #[serde(default = "default_audio_bitrate")]
    pub audio_bitrate: String,
    #[serde(default = "default_true")]
    pub clipboard_sync: bool,
    #[serde(default = "default_true")]
    pub keep_device_awake: bool,
    #[serde(default)]
    pub power_off_on_close: bool,
    #[serde(default = "default_true")]
    pub cleanup_on_disconnect: bool,
    #[serde(default)]
    pub new_display_enabled: bool,
    #[serde(default)]
    pub new_display_width: u32,
    #[serde(default)]
    pub new_display_height: u32,
    #[serde(default)]
    pub new_display_dpi: u32,
    #[serde(default)]
    pub virtual_display_system_decorations: bool,
    #[serde(default = "default_true")]
    pub preserve_virtual_display_content: bool,
    #[serde(default)]
    pub start_app: Option<String>,
}

fn default_max_size() -> u32 { 0 }
fn default_bitrate() -> String { "8M".to_string() }
fn default_max_fps() -> u32 { 60 }
fn default_video_codec() -> String { "h264".to_string() }
fn default_audio_codec() -> String { "opus".to_string() }
fn default_audio_bitrate() -> String { "128K".to_string() }
fn default_true() -> bool { true }

impl Default for ScrcpyDeviceOptions {
    fn default() -> Self {
        Self {
            max_size: 0,
            video_bitrate: "8M".to_string(),
            max_fps: 60,
            video_codec: "h264".to_string(),
            video_encoder: None,
            enable_audio: true,
            audio_codec: "opus".to_string(),
            audio_bitrate: "128K".to_string(),
            clipboard_sync: true,
            keep_device_awake: true,
            power_off_on_close: false,
            cleanup_on_disconnect: true,
            new_display_enabled: false,
            new_display_width: 0,
            new_display_height: 0,
            new_display_dpi: 0,
            virtual_display_system_decorations: false,
            preserve_virtual_display_content: true,
            start_app: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceGroup {
    pub id: String,
    pub name: String,
    pub symbol: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceSession {
    pub id: String,
    pub name: String,
    pub model: String,
    pub system_version: String,
    pub battery: i32,
    pub accent: String,
    pub is_connected: bool,
    pub active_serial: Option<String>,
    pub active_transport: Option<DeviceTransport>,
    pub connection_status: String, // "connected", "disconnected", "racing", "connecting"
    #[serde(default)]
    pub group_ids: Vec<String>,
    pub connections: Vec<DeviceConnection>,
    pub scrcpy_options: ScrcpyDeviceOptions,
}

#[derive(Debug, Serialize, Deserialize)]
struct SessionsStorage {
    sessions: Vec<DeviceSession>,
    groups: Vec<DeviceGroup>,
}

pub struct SessionManager {
    storage_path: PathBuf,
    sessions: Mutex<Vec<DeviceSession>>,
    groups: Mutex<Vec<DeviceGroup>>,
}

impl SessionManager {
    pub fn new() -> Self {
        let storage_path = Self::default_storage_path();
        let (mut sessions, groups) = Self::load_from_path(&storage_path);
        let pruned = Self::deduplicate_sessions(&mut sessions);
        let mgr = Self {
            storage_path,
            sessions: Mutex::new(sessions),
            groups: Mutex::new(groups),
        };
        if pruned {
            mgr.persist();
        }
        mgr
    }

    fn default_storage_path() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".screen-remote")
            .join("sessions.json")
    }

    fn load_from_path(path: &PathBuf) -> (Vec<DeviceSession>, Vec<DeviceGroup>) {
        if let Ok(data) = fs::read_to_string(path) {
            if let Ok(storage) = serde_json::from_str::<SessionsStorage>(&data) {
                return (storage.sessions, storage.groups);
            }
        }
        (Vec::new(), Vec::new())
    }

    /// Deduplicates sessions in place, keeping the single most relevant/connected session
    /// for each unique device. Also repairs legacy mDNS connections misclassified as TCP.
    pub fn deduplicate_sessions(sessions: &mut Vec<DeviceSession>) -> bool {
        let original_len = sessions.len();
        let mut unique: Vec<DeviceSession> = Vec::new();

        for mut session in sessions.drain(..) {
            // Normalize any legacy mDNS connection misclassified as TCP
            for conn in &mut session.connections {
                let is_mdns = conn.host.starts_with("adb-")
                    || conn.host.contains("._tcp")
                    || conn.host.contains("._adb")
                    || conn.serial.starts_with("adb-");
                if is_mdns {
                    conn.transport = DeviceTransport::Mdns;
                    conn.port = 0;
                    if conn.serial.is_empty() {
                        conn.serial = conn.host.clone();
                    }
                }
            }

            // Extract identification keys for this session
            let mut keys: Vec<String> = Vec::new();
            if let Some(ref s) = session.active_serial {
                if !s.is_empty() {
                    keys.push(s.clone());
                    if s.starts_with("adb-") {
                        if let Some(base) = s.strip_prefix("adb-").and_then(|r| r.split('-').next()) {
                            keys.push(format!("mdns_base:{}", base));
                        }
                    }
                }
            }
            for conn in &session.connections {
                if !conn.serial.is_empty() {
                    keys.push(conn.serial.clone());
                }
                if !conn.host.is_empty() {
                    if conn.transport == DeviceTransport::Mdns || conn.host.starts_with("adb-") {
                        keys.push(conn.host.clone());
                        if conn.host.starts_with("adb-") {
                            if let Some(base) = conn.host.strip_prefix("adb-").and_then(|r| r.split('-').next()) {
                                keys.push(format!("mdns_base:{}", base));
                            }
                        }
                    } else if conn.host.contains(':') {
                        keys.push(conn.host.clone());
                    } else {
                        keys.push(format!("{}:{}", conn.host, conn.port));
                    }
                }
            }

            let existing_idx = unique.iter().position(|u| {
                if u.id == session.id {
                    return true;
                }
                let mut u_keys: Vec<String> = Vec::new();
                if let Some(ref s) = u.active_serial {
                    if !s.is_empty() {
                        u_keys.push(s.clone());
                        if s.starts_with("adb-") {
                            if let Some(base) = s.strip_prefix("adb-").and_then(|r| r.split('-').next()) {
                                u_keys.push(format!("mdns_base:{}", base));
                            }
                        }
                    }
                }
                for c in &u.connections {
                    if !c.serial.is_empty() {
                        u_keys.push(c.serial.clone());
                    }
                    if !c.host.is_empty() {
                        if c.transport == DeviceTransport::Mdns || c.host.starts_with("adb-") {
                            u_keys.push(c.host.clone());
                            if c.host.starts_with("adb-") {
                                if let Some(base) = c.host.strip_prefix("adb-").and_then(|r| r.split('-').next()) {
                                    u_keys.push(format!("mdns_base:{}", base));
                                }
                            }
                        } else if c.host.contains(':') {
                            u_keys.push(c.host.clone());
                        } else {
                            u_keys.push(format!("{}:{}", c.host, c.port));
                        }
                    }
                }

                keys.iter().any(|k| u_keys.contains(k))
            });

            if let Some(idx) = existing_idx {
                let existing = &mut unique[idx];
                if !existing.is_connected && session.is_connected {
                    *existing = session;
                } else {
                    for conn in session.connections {
                        let exists = existing.connections.iter().any(|c| {
                            (c.transport == conn.transport && c.host == conn.host && c.port == conn.port)
                                || (!c.serial.is_empty() && c.serial == conn.serial)
                        });
                        if !exists {
                            existing.connections.push(conn);
                        }
                    }
                }
            } else {
                unique.push(session);
            }
        }

        let changed = unique.len() != original_len;
        *sessions = unique;
        changed
    }

    fn persist(&self) {
        if let Some(parent) = self.storage_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let sessions = self.sessions.lock().unwrap().clone();
        let groups = self.groups.lock().unwrap().clone();
        let storage = SessionsStorage { sessions, groups };
        if let Ok(json) = serde_json::to_string_pretty(&storage) {
            let _ = fs::write(&self.storage_path, json);
        }
    }

    pub fn get_sessions(&self) -> Vec<DeviceSession> {
        self.sessions.lock().unwrap().clone()
    }

    pub fn get_groups(&self) -> Vec<DeviceGroup> {
        self.groups.lock().unwrap().clone()
    }

    pub fn save_session(&self, session: DeviceSession) {
        let mut list = self.sessions.lock().unwrap();
        if let Some(pos) = list.iter().position(|s| s.id == session.id) {
            list[pos] = session;
        } else {
            list.push(session);
        }
        drop(list);
        self.persist();
    }

    pub fn delete_session(&self, id: &str) {
        let mut list = self.sessions.lock().unwrap();
        list.retain(|s| s.id != id);
        drop(list);
        self.persist();
    }

    pub fn save_group(&self, group: DeviceGroup) {
        let mut list = self.groups.lock().unwrap();
        if let Some(pos) = list.iter().position(|g| g.id == group.id) {
            list[pos] = group;
        } else {
            list.push(group);
        }
        drop(list);
        self.persist();
    }

    pub fn delete_group(&self, id: &str) {
        let mut list = self.groups.lock().unwrap();
        list.retain(|g| g.id != id);
        drop(list);
        self.persist();
    }

    /// Syncs persistent sessions with live detected ADB devices:
    pub fn sync_with_live_devices(&self, live_devices: &[AdbDevice]) -> Vec<DeviceSession> {
        let mut list = self.sessions.lock().unwrap();
        let mut changed = Self::deduplicate_sessions(&mut list);

        for session in list.iter_mut() {
            let mut matched_device: Option<&AdbDevice> = None;
            for conn in &session.connections {
                let candidate_serial = match conn.transport {
                    DeviceTransport::Usb => conn.serial.clone(),
                    DeviceTransport::Tcp => {
                        if conn.host.is_empty() {
                            String::new()
                        } else if conn.host.contains(':') {
                            conn.host.clone()
                        } else {
                            format!("{}:{}", conn.host, conn.port)
                        }
                    }
                    DeviceTransport::Mdns => {
                        if !conn.serial.is_empty() {
                            conn.serial.clone()
                        } else {
                            conn.host.clone()
                        }
                    }
                };
                if candidate_serial.is_empty() {
                    continue;
                }
                if let Some(live) = live_devices.iter().find(|d| {
                    d.state == "device"
                        && (d.serial == candidate_serial
                            || (conn.transport == DeviceTransport::Mdns
                                && (d.serial == conn.host || d.serial == conn.serial)))
                }) {
                    matched_device = Some(live);
                    session.active_serial = Some(live.serial.clone());
                    session.active_transport = Some(conn.transport);
                    break;
                }
            }

            let was_connected = session.is_connected;
            session.is_connected = matched_device.is_some();
            session.connection_status = if session.is_connected {
                "connected".to_string()
            } else {
                "disconnected".to_string()
            };

            if let Some(dev) = matched_device {
                if let Some(ref m) = dev.model {
                    if !m.is_empty() && session.model.is_empty() {
                        session.model = m.clone();
                    }
                }
            }

            if was_connected != session.is_connected {
                changed = true;
            }
        }

        let result = list.clone();
        drop(list);
        if changed {
            self.persist();
        }
        result
    }

    /// Resolves and races connection candidates for a session:
    /// Returns winning `(serial: String, transport: DeviceTransport)`.
    pub async fn resolve_connection(
        &self,
        session_id: &str,
        custom_adb: Option<&str>,
    ) -> Result<(String, DeviceTransport), String> {
        let session = {
            let list = self.sessions.lock().unwrap();
            list.iter().find(|s| s.id == session_id).cloned()
        }.ok_or_else(|| "Session not found".to_string())?;

        if session.connections.is_empty() {
            return Err("No connection candidates configured for this session".to_string());
        }

        // Sort candidates by priority (lower priority number = higher precedence)
        let mut candidates = session.connections.clone();
        candidates.sort_by_key(|c| c.priority);

        // First, check live ADB devices
        let live_output = execute_adb_async(custom_adb, &["devices", "-l"]).await?;
        let connected_serials: Vec<String> = live_output
            .lines()
            .filter(|l| l.contains("device") && !l.starts_with("List of devices"))
            .filter_map(|l| l.split_whitespace().next().map(|s| s.to_string()))
            .collect();

        // Check if any existing candidate is already connected
        for candidate in &candidates {
            match candidate.transport {
                DeviceTransport::Usb => {
                    if connected_serials.contains(&candidate.serial) {
                        return Ok((candidate.serial.clone(), DeviceTransport::Usb));
                    }
                }
                DeviceTransport::Tcp => {
                    let addr = format!("{}:{}", candidate.host, candidate.port);
                    if connected_serials.contains(&addr) {
                        return Ok((addr, DeviceTransport::Tcp));
                    }
                }
                DeviceTransport::Mdns => {
                    let target = if !candidate.serial.is_empty() {
                        &candidate.serial
                    } else {
                        &candidate.host
                    };
                    if connected_serials.contains(target) {
                        return Ok((target.clone(), DeviceTransport::Mdns));
                    }
                }
            }
        }

        // None connected yet; race network candidates concurrently
        let network_candidates: Vec<DeviceConnection> = candidates
            .into_iter()
            .filter(|c| c.transport != DeviceTransport::Usb)
            .collect();

        if network_candidates.is_empty() {
            return Err("USB device is disconnected and no network candidates available".to_string());
        }

        // Set status to racing
        {
            let mut list = self.sessions.lock().unwrap();
            if let Some(s) = list.iter_mut().find(|s| s.id == session_id) {
                s.connection_status = "racing".to_string();
            }
        }

        // Concurrently attempt adb connect for all network candidates with 4-second timeout
        let mut join_set = tokio::task::JoinSet::new();
        for candidate in network_candidates {
            let adb_str = custom_adb.map(|s| s.to_string());
            join_set.spawn(async move {
                let addr = match candidate.transport {
                    DeviceTransport::Tcp => {
                        if candidate.host.contains(':') {
                            candidate.host.clone()
                        } else {
                            format!("{}:{}", candidate.host, candidate.port)
                        }
                    }
                    DeviceTransport::Mdns => {
                        if !candidate.serial.is_empty() {
                            candidate.serial.clone()
                        } else {
                            candidate.host.clone()
                        }
                    }
                    _ => return Err("invalid transport".to_string()),
                };
                let res = tokio::time::timeout(Duration::from_secs(4), async {
                    execute_adb_async(adb_str.as_deref(), &["connect", &addr]).await
                }).await;

                match res {
                    Ok(Ok(output)) => {
                        if output.contains("connected to") || output.contains("already connected to") {
                            Ok((addr, candidate.transport))
                        } else {
                            Err(format!("connect failed: {}", output))
                        }
                    }
                    Ok(Err(e)) => Err(e),
                    Err(_) => Err("timeout".to_string()),
                }
            });
        }

        while let Some(res) = join_set.join_next().await {
            if let Ok(Ok((winner_serial, transport))) = res {
                join_set.abort_all();
                // Update session state
                let mut list = self.sessions.lock().unwrap();
                if let Some(s) = list.iter_mut().find(|s| s.id == session_id) {
                    s.is_connected = true;
                    s.active_serial = Some(winner_serial.clone());
                    s.active_transport = Some(transport);
                    s.connection_status = "connected".to_string();
                }
                drop(list);
                self.persist();
                return Ok((winner_serial, transport));
            }
        }

        // All failed
        let mut list = self.sessions.lock().unwrap();
        if let Some(s) = list.iter_mut().find(|s| s.id == session_id) {
            s.is_connected = false;
            s.connection_status = "disconnected".to_string();
        }
        drop(list);
        self.persist();

        Err("All connection candidate attempts timed out or failed".to_string())
    }
}
