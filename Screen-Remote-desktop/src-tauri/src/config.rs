use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub adb_path: Option<String>,
    pub theme: String, // "system", "light", "dark"
    pub language: String, // "zh-CN", "en-US"
    pub max_fps: u32,
    pub bit_rate_mbps: u32,
    pub max_size: u32,
    pub video_codec: String, // "h264", "h265", "av1"
    pub audio_enabled: bool,
    pub stay_awake: bool,
    pub turn_screen_off: bool,
    pub only_new_frame: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            adb_path: None,
            theme: "system".to_string(),
            language: "zh-CN".to_string(),
            max_fps: 60,
            bit_rate_mbps: 8,
            max_size: 0, // 0 = original resolution
            video_codec: "h264".to_string(),
            audio_enabled: true,
            stay_awake: true,
            turn_screen_off: false,
            only_new_frame: true,
        }
    }
}

pub fn get_config_dir() -> PathBuf {
    let mut dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("screen-remote-desktop");
    dir
}

pub fn load_settings() -> AppSettings {
    let config_file = get_config_dir().join("settings.json");
    if let Ok(content) = fs::read_to_string(&config_file) {
        if let Ok(settings) = serde_json::from_str(&content) {
            return settings;
        }
    }
    AppSettings::default()
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let dir = get_config_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let config_file = dir.join("settings.json");
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&config_file, content).map_err(|e| e.to_string())?;
    Ok(())
}
