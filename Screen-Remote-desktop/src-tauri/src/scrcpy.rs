use crate::adb;
use crate::config::AppSettings;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;

pub const BUNDLED_SHA256: &str = "deacb991ed2509715160ffdc7907e47b4160eb30d1566217e9047fd5b8850cae";
const REMOTE_SERVER_PATH: &str = "/data/local/tmp/scrcpy-server.jar";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub serial: String,
    pub pid: u32,
    pub start_time: u64,
}

pub struct SessionManager {
    sessions: Mutex<HashMap<String, Child>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub fn find_bundled_server_jar(&self) -> Option<PathBuf> {
        let candidates = [
            PathBuf::from("resources/scrcpy-server.jar"),
            PathBuf::from("src-tauri/resources/scrcpy-server.jar"),
            PathBuf::from("../src-tauri/resources/scrcpy-server.jar"),
        ];

        for c in &candidates {
            if c.exists() {
                return Some(std::fs::canonicalize(c).unwrap_or_else(|_| c.clone()));
            }
        }

        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let p = dir.join("resources/scrcpy-server.jar");
                if p.exists() {
                    return Some(p);
                }
            }
        }

        None
    }

    pub fn deploy_bundled_server(&self, custom_adb: Option<&str>, serial: &str) -> Result<String, String> {
        let jar_path = self.find_bundled_server_jar()
            .ok_or_else(|| "Bundled scrcpy-server.jar not found on desktop filesystem".to_string())?;

        let jar_str = jar_path.to_str().ok_or("Invalid jar path unicode")?;
        let push_res = adb::push_file_to_device(custom_adb, serial, jar_str, REMOTE_SERVER_PATH)?;
        Ok(format!("Deployed scrcpy-server: {}", push_res))
    }

    pub fn start_session(
        &self,
        serial: &str,
        settings: &AppSettings,
    ) -> Result<u32, String> {
        let mut sessions = self.sessions.lock().unwrap();

        // If a session is already running for this device, verify whether child is alive
        if let Some(child) = sessions.get_mut(serial) {
            if let Ok(None) = child.try_wait() {
                return Err(format!("Session already active for {}", serial));
            }
        }

        let scrcpy_bin = which::which("scrcpy")
            .map_err(|_| "scrcpy executable not found in system PATH. Please ensure scrcpy is installed.".to_string())?;

        let mut cmd = Command::new(scrcpy_bin);
        cmd.arg("-s").arg(serial);

        if let Some(jar) = self.find_bundled_server_jar() {
            if let Some(path_str) = jar.to_str() {
                cmd.env("SCRCPY_SERVER_PATH", path_str);
            }
        }

        if settings.max_fps > 0 {
            cmd.arg(format!("--max-fps={}", settings.max_fps));
        }

        if settings.bit_rate_mbps > 0 {
            cmd.arg(format!("--video-bit-rate={}M", settings.bit_rate_mbps));
        }

        if settings.max_size > 0 {
            cmd.arg(format!("--max-size={}", settings.max_size));
        }

        match settings.video_codec.as_str() {
            "h265" => {
                cmd.arg("--video-codec=h265");
            }
            "av1" => {
                cmd.arg("--video-codec=av1");
            }
            _ => {
                cmd.arg("--video-codec=h264");
            }
        }

        if !settings.audio_enabled {
            cmd.arg("--no-audio");
        }

        if settings.stay_awake {
            cmd.arg("--stay-awake");
        }

        if settings.turn_screen_off {
            cmd.arg("--turn-screen-off");
        }

        let child = cmd.spawn().map_err(|e| format!("Failed to spawn scrcpy: {}", e))?;
        let pid = child.id();
        sessions.insert(serial.to_string(), child);

        Ok(pid)
    }

    pub fn stop_session(&self, serial: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(mut child) = sessions.remove(serial) {
            let _ = child.kill();
            let _ = child.wait();
            Ok(())
        } else {
            Err(format!("No active session for {}", serial))
        }
    }

    pub fn get_active_sessions(&self) -> Vec<String> {
        let mut sessions = self.sessions.lock().unwrap();
        let mut active = Vec::new();

        sessions.retain(|serial, child| {
            match child.try_wait() {
                Ok(None) => {
                    active.push(serial.clone());
                    true
                }
                _ => false,
            }
        });

        active
    }
}
