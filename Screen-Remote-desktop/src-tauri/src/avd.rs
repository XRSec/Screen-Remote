use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvdInfo {
    pub name: String,
    pub target: String,
    pub abi: String,
    pub path: String,
    pub is_running: bool,
    pub serial: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemImageInfo {
    pub id: String,
    pub api_level: String,
    pub tag: String,
    pub abi: String,
    pub display_name: String,
    pub path: String,
    pub is_installed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkinInfo {
    pub name: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub form_factor: String,
}

fn resolve_sdk_root() -> Option<PathBuf> {
    if let Ok(env_root) = std::env::var("ANDROID_HOME") {
        let p = PathBuf::from(env_root);
        if p.exists() {
            return Some(p);
        }
    }
    if let Ok(env_root) = std::env::var("ANDROID_SDK_ROOT") {
        let p = PathBuf::from(env_root);
        if p.exists() {
            return Some(p);
        }
    }
    if let Some(home) = dirs::home_dir() {
        let default_mac = home.join("Library/Android/sdk");
        if default_mac.exists() {
            return Some(default_mac);
        }
    }
    None
}

fn resolve_emulator_path() -> Result<PathBuf, String> {
    if let Some(sdk) = resolve_sdk_root() {
        let emulator = sdk.join("emulator/emulator");
        if emulator.exists() {
            return Ok(emulator);
        }
    }
    if let Ok(p) = which::which("emulator") {
        return Ok(p);
    }
    Err("Android emulator binary not found".to_string())
}

#[tauri::command]
pub async fn list_avds() -> Result<Vec<AvdInfo>, String> {
    let home = dirs::home_dir().ok_or("Cannot resolve home directory")?;
    let avd_dir = home.join(".android/avd");
    if !avd_dir.exists() {
        return Ok(Vec::new());
    }

    let mut avds = Vec::new();
    if let Ok(entries) = fs::read_dir(&avd_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("ini") {
                let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
                if name.is_empty() {
                    continue;
                }

                let ini_content = fs::read_to_string(&path).unwrap_or_default();
                let mut avd_folder = avd_dir.join(format!("{}.avd", name));
                for line in ini_content.lines() {
                    if let Some(rest) = line.strip_prefix("path=") {
                        avd_folder = PathBuf::from(rest.trim());
                    }
                }

                let mut target = "android-33".to_string();
                let mut abi = "arm64-v8a".to_string();
                let config_path = avd_folder.join("config.ini");
                if config_path.exists() {
                    if let Ok(config_str) = fs::read_to_string(&config_path) {
                        for line in config_str.lines() {
                            if let Some(val) = line.strip_prefix("target=") {
                                target = val.trim().to_string();
                            } else if let Some(val) = line.strip_prefix("abi.type=") {
                                abi = val.trim().to_string();
                            }
                        }
                    }
                }

                avds.push(AvdInfo {
                    name,
                    target,
                    abi,
                    path: avd_folder.to_string_lossy().to_string(),
                    is_running: false,
                    serial: None,
                });
            }
        }
    }

    avds.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(avds)
}

#[tauri::command]
pub async fn start_avd(name: String) -> Result<(), String> {
    let emulator = resolve_emulator_path()?;
    let avd_arg = format!("@{}", name);

    let child = Command::new(&emulator)
        .arg(&avd_arg)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to launch emulator: {}", e))?;

    std::mem::forget(child);
    Ok(())
}

#[tauri::command]
pub async fn stop_avd(name: String) -> Result<(), String> {
    let _ = Command::new("pkill")
        .args(&["-f", &format!("qemu.*{}", name)])
        .output()
        .await;
    Ok(())
}

#[tauri::command]
pub async fn delete_avd(name: String) -> Result<(), String> {
    if let Some(sdk) = resolve_sdk_root() {
        let avdmanager = sdk.join("cmdline-tools/latest/bin/avdmanager");
        if avdmanager.exists() {
            let res = Command::new(&avdmanager)
                .args(&["delete", "avd", "-n", &name])
                .output()
                .await
                .map_err(|e| e.to_string())?;
            if res.status.success() {
                return Ok(());
            }
        }
    }

    // Fallback: remove files in ~/.android/avd
    if let Some(home) = dirs::home_dir() {
        let ini = home.join(format!(".android/avd/{}.ini", name));
        let folder = home.join(format!(".android/avd/{}.avd", name));
        let _ = fs::remove_file(ini);
        let _ = fs::remove_dir_all(folder);
    }
    Ok(())
}

#[tauri::command]
pub async fn list_installed_system_images() -> Result<Vec<SystemImageInfo>, String> {
    let sdk = match resolve_sdk_root() {
        Some(s) => s,
        None => return Ok(Vec::new()),
    };

    let sys_dir = sdk.join("system-images");
    if !sys_dir.exists() {
        return Ok(Vec::new());
    }

    let mut images = Vec::new();
    if let Ok(api_dirs) = fs::read_dir(&sys_dir) {
        for api_entry in api_dirs.flatten() {
            let api_path = api_entry.path();
            if !api_path.is_dir() {
                continue;
            }
            let api_name = api_path.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();
            let api_level = api_name.replace("android-", "");

            if let Ok(tag_dirs) = fs::read_dir(&api_path) {
                for tag_entry in tag_dirs.flatten() {
                    let tag_path = tag_entry.path();
                    if !tag_path.is_dir() {
                        continue;
                    }
                    let tag_name = tag_path.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();

                    if let Ok(abi_dirs) = fs::read_dir(&tag_path) {
                        for abi_entry in abi_dirs.flatten() {
                            let abi_path = abi_entry.path();
                            if !abi_path.is_dir() {
                                continue;
                            }
                            let abi_name = abi_path.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();

                            let display_tag = if tag_name == "default" {
                                "AOSP".to_string()
                            } else {
                                tag_name.replace('_', " ").to_uppercase()
                            };

                            let id = format!("system-images;{};{};{}", api_name, tag_name, abi_name);
                            let display_name = format!("API {} · {} · {}", api_level, display_tag, abi_name);

                            images.push(SystemImageInfo {
                                id,
                                api_level: api_level.clone(),
                                tag: tag_name.clone(),
                                abi: abi_name,
                                display_name,
                                path: format!("system-images/{}/{}/{}", api_name, tag_entry.file_name().to_string_lossy(), abi_entry.file_name().to_string_lossy()),
                                is_installed: true,
                            });
                        }
                    }
                }
            }
        }
    }

    images.sort_by(|a, b| b.api_level.cmp(&a.api_level));
    Ok(images)
}

#[tauri::command]
pub async fn list_available_skins() -> Result<Vec<SkinInfo>, String> {
    let sdk = match resolve_sdk_root() {
        Some(s) => s,
        None => return Ok(Vec::new()),
    };

    let skins_dir = sdk.join("skins");
    if !skins_dir.exists() {
        return Ok(Vec::new());
    }

    let mut skins = Vec::new();
    if let Ok(entries) = fs::read_dir(&skins_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();
            if name.starts_with('.') {
                continue;
            }

            // Defaults
            let mut width = 1080;
            let mut height = 2400;
            let mut form_factor = "phone".to_string();

            let layout_file = path.join("layout");
            if layout_file.exists() {
                if let Ok(content) = fs::read_to_string(&layout_file) {
                    for line in content.lines() {
                        let l = line.trim();
                        if l.starts_with("width") {
                            if let Some(val) = l.split_whitespace().nth(1) {
                                if let Ok(w) = val.parse::<u32>() {
                                    width = w;
                                }
                            }
                        } else if l.starts_with("height") {
                            if let Some(val) = l.split_whitespace().nth(1) {
                                if let Ok(h) = val.parse::<u32>() {
                                    height = h;
                                }
                            }
                        }
                    }
                }
            }

            let lower = name.to_lowercase();
            if lower.contains("tablet") || lower.contains("tab") {
                form_factor = "tablet".to_string();
            } else if lower.contains("tv") || lower.contains("automotive") {
                form_factor = "tv".to_string();
            }

            skins.push(SkinInfo {
                name,
                path: path.to_string_lossy().to_string(),
                width,
                height,
                form_factor,
            });
        }
    }

    skins.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skins)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_list_avds() {
        let avds = list_avds().await.unwrap();
        println!("Found {} AVDs: {:?}", avds.len(), avds.iter().map(|a| &a.name).collect::<Vec<_>>());
        assert!(!avds.is_empty(), "Should list AVDs in ~/.android/avd");
    }

    #[tokio::test]
    async fn test_list_system_images() {
        let images = list_installed_system_images().await.unwrap();
        println!("Found {} installed images: {:?}", images.len(), images.iter().map(|i| &i.display_name).collect::<Vec<_>>());
        assert!(!images.is_empty(), "Should find installed system images");
    }
}
