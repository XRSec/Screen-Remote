use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdbDevice {
    pub serial: String,
    pub state: String,
    pub model: Option<String>,
    pub product: Option<String>,
    pub device: Option<String>,
    pub transport_id: Option<String>,
    pub is_wireless: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceDetails {
    pub serial: String,
    pub brand: String,
    pub model: String,
    pub manufacturer: String,
    pub board: String,
    pub android_version: String,
    pub sdk_version: String,
    pub security_patch: String,
    pub build_id: String,
    pub screen_size: String,
    pub screen_density: String,
    pub battery_level: Option<u32>,
    pub battery_temperature: Option<f32>,
    pub battery_voltage: Option<u32>,
    pub battery_health: String,
    pub battery_status: String,
    pub ram_total: String,
    pub ram_free: String,
    pub ram_available: String,
    pub storage_total: String,
    pub storage_used: String,
    pub storage_free: String,
    pub storage_percent: String,
    pub wifi_ip: String,
    pub wifi_mac: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppPackageInfo {
    pub package_name: String,
    pub installer: Option<String>,
    pub is_system: bool,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNodeInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub permissions: String,
    pub modified_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub user: String,
    pub cpu_percent: String,
    pub rss_mem: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortForwardRule {
    pub serial: String,
    pub local: String,
    pub remote: String,
    pub is_reverse: bool,
}

pub fn resolve_adb_path(custom_path: Option<&str>) -> Result<PathBuf, String> {
    if let Some(path_str) = custom_path {
        if !path_str.trim().is_empty() {
            let path = PathBuf::from(path_str);
            if path.exists() {
                return Ok(path);
            }
        }
    }

    if let Ok(path) = which::which("adb") {
        return Ok(path);
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let mac_path = home.join("Library/Android/sdk/platform-tools/adb");
            if mac_path.exists() {
                return Ok(mac_path);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(local_appdata) = dirs::data_local_dir() {
            let win_path = local_appdata.join("Android\\Sdk\\platform-tools\\adb.exe");
            if win_path.exists() {
                return Ok(win_path);
            }
        }
    }

    Err("ADB binary not found. Please ensure Android SDK platform-tools is installed or specify the path in Settings.".to_string())
}

pub fn execute_adb(custom_path: Option<&str>, args: &[&str]) -> Result<String, String> {
    let adb = resolve_adb_path(custom_path)?;
    let output = Command::new(&adb)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to execute adb {:?}: {}", args, e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        let combined = if stderr.is_empty() { stdout } else { stderr };
        Err(combined.trim().to_string())
    }
}

pub async fn execute_adb_async(custom_path: Option<&str>, args: &[&str]) -> Result<String, String> {
    let adb = resolve_adb_path(custom_path)?;
    let output = tokio::process::Command::new(&adb)
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute adb {:?}: {}", args, e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        let combined = if stderr.is_empty() { stdout } else { stderr };
        Err(combined.trim().to_string())
    }
}

pub fn get_adb_version(custom_path: Option<&str>) -> Result<String, String> {
    execute_adb(custom_path, &["version"]).map(|s| s.trim().to_string())
}

pub fn list_devices(custom_path: Option<&str>) -> Result<Vec<AdbDevice>, String> {
    let stdout = execute_adb(custom_path, &["devices", "-l"])?;
    let mut devices = Vec::new();

    for line in stdout.lines().skip(1) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }

        let serial = parts[0].to_string();
        let state = parts[1].to_string();
        let is_wireless = serial.contains(':');

        let mut model = None;
        let mut product = None;
        let mut device = None;
        let mut transport_id = None;

        for part in &parts[2..] {
            if let Some((k, v)) = part.split_once(':') {
                match k {
                    "model" => model = Some(v.replace('_', " ")),
                    "product" => product = Some(v.to_string()),
                    "device" => device = Some(v.to_string()),
                    "transport_id" => transport_id = Some(v.to_string()),
                    _ => {}
                }
            }
        }

        devices.push(AdbDevice {
            serial,
            state,
            model,
            product,
            device,
            transport_id,
            is_wireless,
        });
    }

    Ok(devices)
}

pub fn connect_device(custom_path: Option<&str>, address: &str) -> Result<String, String> {
    let res = execute_adb(custom_path, &["connect", address])?;
    if res.contains("connected to") {
        Ok(res.trim().to_string())
    } else {
        Err(res.trim().to_string())
    }
}

pub fn disconnect_device(custom_path: Option<&str>, address: &str) -> Result<String, String> {
    execute_adb(custom_path, &["disconnect", address]).map(|s| s.trim().to_string())
}

pub fn get_battery_info(custom_path: Option<&str>, serial: &str) -> Result<Option<u32>, String> {
    let out = match execute_adb(custom_path, &["-s", serial, "shell", "dumpsys", "battery"]) {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    for line in out.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("level:") {
            if let Some((_, level_str)) = trimmed.split_once(':') {
                if let Ok(lvl) = level_str.trim().parse::<u32>() {
                    return Ok(Some(lvl));
                }
            }
        }
    }
    Ok(None)
}

pub fn get_device_details(custom_path: Option<&str>, serial: &str) -> Result<DeviceDetails, String> {
    let get_prop = |key: &str| -> String {
        execute_adb(custom_path, &["-s", serial, "shell", "getprop", key])
            .unwrap_or_default()
            .trim()
            .to_string()
    };

    let brand = get_prop("ro.product.brand");
    let model = get_prop("ro.product.model");
    let manufacturer = get_prop("ro.product.manufacturer");
    let board = get_prop("ro.product.board");
    let android_version = get_prop("ro.build.version.release");
    let sdk_version = get_prop("ro.build.version.sdk");
    let security_patch = get_prop("ro.build.version.security_patch");
    let build_id = get_prop("ro.build.display.id");

    // Display
    let wm_size_out = execute_adb(custom_path, &["-s", serial, "shell", "wm", "size"]).unwrap_or_default();
    let mut screen_size = "Unknown".to_string();
    for line in wm_size_out.lines() {
        if line.contains("Physical size:") || line.contains("Override size:") {
            if let Some(val) = line.split(':').nth(1) {
                screen_size = val.trim().to_string();
            }
        }
    }

    let wm_density_out = execute_adb(custom_path, &["-s", serial, "shell", "wm", "density"]).unwrap_or_default();
    let mut screen_density = "Unknown".to_string();
    for line in wm_density_out.lines() {
        if line.contains("Physical density:") || line.contains("Override density:") {
            if let Some(val) = line.split(':').nth(1) {
                screen_density = format!("{} DPI", val.trim());
            }
        }
    }

    // Battery
    let battery_out = execute_adb(custom_path, &["-s", serial, "shell", "dumpsys", "battery"]).unwrap_or_default();
    let mut battery_level = None;
    let mut battery_temperature = None;
    let mut battery_voltage = None;
    let mut battery_health = "Unknown".to_string();
    let mut battery_status = "Unknown".to_string();

    for line in battery_out.lines() {
        let trimmed = line.trim();
        if let Some((k, v)) = trimmed.split_once(':') {
            let val = v.trim();
            match k {
                "level" => battery_level = val.parse::<u32>().ok(),
                "temperature" => {
                    if let Ok(temp_raw) = val.parse::<f32>() {
                        battery_temperature = Some(temp_raw / 10.0);
                    }
                }
                "voltage" => battery_voltage = val.parse::<u32>().ok(),
                "health" => {
                    battery_health = match val {
                        "2" => "Good (良好)".to_string(),
                        "3" => "Overheat (过热)".to_string(),
                        "4" => "Dead (损坏)".to_string(),
                        "5" => "Over Voltage (过压)".to_string(),
                        "7" => "Cold (过冷)".to_string(),
                        _ => format!("Code {}", val),
                    };
                }
                "status" => {
                    battery_status = match val {
                        "2" => "Charging (充电中)".to_string(),
                        "3" => "Discharging (放电中)".to_string(),
                        "4" => "Not charging (未充电)".to_string(),
                        "5" => "Full (已充满)".to_string(),
                        _ => format!("Status {}", val),
                    };
                }
                _ => {}
            }
        }
    }

    // Memory
    let meminfo_out = execute_adb(custom_path, &["-s", serial, "shell", "cat", "/proc/meminfo"]).unwrap_or_default();
    let mut ram_total = "Unknown".to_string();
    let mut ram_free = "Unknown".to_string();
    let mut ram_available = "Unknown".to_string();

    let format_kb = |val_kb: u64| -> String {
        if val_kb > 1024 * 1024 {
            format!("{:.2} GB", val_kb as f64 / (1024.0 * 1024.0))
        } else {
            format!("{:.1} MB", val_kb as f64 / 1024.0)
        }
    };

    for line in meminfo_out.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            if parts[0].starts_with("MemTotal:") {
                if let Ok(kb) = parts[1].parse::<u64>() {
                    ram_total = format_kb(kb);
                }
            } else if parts[0].starts_with("MemFree:") {
                if let Ok(kb) = parts[1].parse::<u64>() {
                    ram_free = format_kb(kb);
                }
            } else if parts[0].starts_with("MemAvailable:") {
                if let Ok(kb) = parts[1].parse::<u64>() {
                    ram_available = format_kb(kb);
                }
            }
        }
    }

    // Storage
    let df_out = execute_adb(custom_path, &["-s", serial, "shell", "df", "-h", "/data"]).unwrap_or_default();
    let mut storage_total = "Unknown".to_string();
    let mut storage_used = "Unknown".to_string();
    let mut storage_free = "Unknown".to_string();
    let mut storage_percent = "Unknown".to_string();

    for line in df_out.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 5 {
            storage_total = parts[1].to_string();
            storage_used = parts[2].to_string();
            storage_free = parts[3].to_string();
            storage_percent = parts[4].to_string();
            break;
        }
    }

    // Network
    let ip_out = execute_adb(custom_path, &["-s", serial, "shell", "ip", "addr", "show", "wlan0"]).unwrap_or_default();
    let mut wifi_ip = "Not connected".to_string();
    let mut wifi_mac = "Unknown".to_string();

    for line in ip_out.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("inet ") {
            if let Some(first) = trimmed.split_whitespace().nth(1) {
                if let Some((ip, _)) = first.split_once('/') {
                    wifi_ip = ip.to_string();
                } else {
                    wifi_ip = first.to_string();
                }
            }
        } else if trimmed.starts_with("link/ether ") {
            if let Some(mac) = trimmed.split_whitespace().nth(1) {
                wifi_mac = mac.to_string();
            }
        }
    }

    Ok(DeviceDetails {
        serial: serial.to_string(),
        brand,
        model,
        manufacturer,
        board,
        android_version,
        sdk_version,
        security_patch,
        build_id,
        screen_size,
        screen_density,
        battery_level,
        battery_temperature,
        battery_voltage,
        battery_health,
        battery_status,
        ram_total,
        ram_free,
        ram_available,
        storage_total,
        storage_used,
        storage_free,
        storage_percent,
        wifi_ip,
        wifi_mac,
    })
}

pub fn list_packages(
    custom_path: Option<&str>,
    serial: &str,
    include_system: bool,
) -> Result<Vec<AppPackageInfo>, String> {
    let arg = if include_system { "-i" } else { "-3 -i" };
    let cmd = format!("pm list packages {}", arg);
    let output = execute_adb(custom_path, &["-s", serial, "shell", &cmd])?;

    let mut apps = Vec::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("package:") {
            continue;
        }
        let rest = &trimmed["package:".len()..];
        let mut parts = rest.split_whitespace();
        let pkg_name = parts.next().unwrap_or("").to_string();
        if pkg_name.is_empty() {
            continue;
        }

        let mut installer = None;
        for p in parts {
            if let Some((k, v)) = p.split_once('=') {
                if k == "installer" && v != "null" {
                    installer = Some(v.to_string());
                }
            }
        }

        apps.push(AppPackageInfo {
            package_name: pkg_name,
            installer,
            is_system: include_system,
            path: None,
        });
    }

    apps.sort_by(|a, b| a.package_name.cmp(&b.package_name));
    Ok(apps)
}

pub fn launch_app(custom_path: Option<&str>, serial: &str, package_name: &str) -> Result<String, String> {
    let cmd = format!("monkey -p {} -c android.intent.category.LAUNCHER 1", package_name);
    execute_adb(custom_path, &["-s", serial, "shell", &cmd]).map(|s| s.trim().to_string())
}

pub fn stop_app(custom_path: Option<&str>, serial: &str, package_name: &str) -> Result<String, String> {
    let cmd = format!("am force-stop {}", package_name);
    execute_adb(custom_path, &["-s", serial, "shell", &cmd]).map(|s| s.trim().to_string())
}

pub fn clear_app_data(custom_path: Option<&str>, serial: &str, package_name: &str) -> Result<String, String> {
    let cmd = format!("pm clear {}", package_name);
    execute_adb(custom_path, &["-s", serial, "shell", &cmd]).map(|s| s.trim().to_string())
}

pub fn uninstall_package(custom_path: Option<&str>, serial: &str, package_name: &str) -> Result<String, String> {
    let cmd = format!("pm uninstall {}", package_name);
    execute_adb(custom_path, &["-s", serial, "shell", &cmd]).map(|s| s.trim().to_string())
}

pub fn install_apk(custom_path: Option<&str>, serial: &str, apk_path: &str) -> Result<String, String> {
    execute_adb(custom_path, &["-s", serial, "install", "-r", apk_path]).map(|s| s.trim().to_string())
}

pub fn list_directory(custom_path: Option<&str>, serial: &str, path: &str) -> Result<Vec<FileNodeInfo>, String> {
    let target_dir = if path.trim().is_empty() {
        "/sdcard/".to_string()
    } else if !path.ends_with('/') {
        format!("{}/", path.trim())
    } else {
        path.trim().to_string()
    };

    let cmd = format!("ls -la \"{}\"", target_dir);
    let output = execute_adb(custom_path, &["-s", serial, "shell", &cmd])?;

    let mut items = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("total") || trimmed.is_empty() {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 8 {
            continue;
        }

        let perms = parts[0];
        let is_dir = perms.starts_with('d');
        let is_symlink = perms.starts_with('l');

        let mut name_index = 0;
        for (i, p) in parts.iter().enumerate() {
            if p.contains('-') && p.len() == 10 && i + 1 < parts.len() && parts[i + 1].contains(':') {
                name_index = i + 2;
                break;
            }
        }

        if name_index == 0 || name_index >= parts.len() {
            continue;
        }

        let name_str = parts[name_index..].join(" ");
        let (name, final_is_dir) = if is_symlink {
            if let Some((orig, _)) = name_str.split_once(" ->") {
                (orig.trim().to_string(), is_dir)
            } else {
                (name_str.clone(), is_dir)
            }
        } else {
            (name_str.clone(), is_dir)
        };

        if name == "." || name == ".." {
            continue;
        }

        let size: u64 = if name_index >= 4 {
            parts[name_index - 3].parse::<u64>().unwrap_or(0)
        } else {
            0
        };

        let modified_time = if name_index >= 2 {
            format!("{} {}", parts[name_index - 2], parts[name_index - 1])
        } else {
            "Unknown".to_string()
        };

        let full_path = format!("{}{}", target_dir, name);

        items.push(FileNodeInfo {
            name,
            path: full_path,
            is_dir: final_is_dir,
            is_symlink,
            size,
            permissions: perms.to_string(),
            modified_time,
        });
    }

    items.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(items)
}

pub fn delete_remote_file(custom_path: Option<&str>, serial: &str, path: &str) -> Result<String, String> {
    let cmd = format!("rm -rf \"{}\"", path);
    execute_adb(custom_path, &["-s", serial, "shell", &cmd]).map(|s| s.trim().to_string())
}

pub fn create_remote_dir(custom_path: Option<&str>, serial: &str, path: &str) -> Result<String, String> {
    let cmd = format!("mkdir -p \"{}\"", path);
    execute_adb(custom_path, &["-s", serial, "shell", &cmd]).map(|s| s.trim().to_string())
}

pub fn push_file_to_device(
    custom_path: Option<&str>,
    serial: &str,
    local_path: &str,
    remote_path: &str,
) -> Result<String, String> {
    execute_adb(custom_path, &["-s", serial, "push", local_path, remote_path]).map(|s| s.trim().to_string())
}

pub fn pull_file_from_device(
    custom_path: Option<&str>,
    serial: &str,
    remote_path: &str,
    local_path: &str,
) -> Result<String, String> {
    execute_adb(custom_path, &["-s", serial, "pull", remote_path, local_path]).map(|s| s.trim().to_string())
}

pub fn list_processes(custom_path: Option<&str>, serial: &str) -> Result<Vec<ProcessInfo>, String> {
    let output = execute_adb(custom_path, &["-s", serial, "shell", "ps", "-A"])?;
    let mut procs = Vec::new();

    for line in output.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 9 {
            continue;
        }

        let user = parts[0].to_string();
        let pid = parts[1].parse::<u32>().unwrap_or(0);
        if pid == 0 {
            continue;
        }

        let rss_kb = parts[4].parse::<u64>().unwrap_or(0);
        let rss_mem = if rss_kb > 1024 {
            format!("{:.1} MB", rss_kb as f64 / 1024.0)
        } else {
            format!("{} KB", rss_kb)
        };

        let name = parts[8..].join(" ");

        procs.push(ProcessInfo {
            pid,
            user,
            cpu_percent: "-".to_string(),
            rss_mem,
            name,
        });
    }

    procs.sort_by(|a, b| a.pid.cmp(&b.pid));
    Ok(procs)
}

pub fn kill_remote_process(custom_path: Option<&str>, serial: &str, pid: u32) -> Result<String, String> {
    let cmd = format!("kill -9 {}", pid);
    execute_adb(custom_path, &["-s", serial, "shell", &cmd]).map(|s| s.trim().to_string())
}

pub fn list_port_forwards(custom_path: Option<&str>, serial: &str) -> Result<Vec<PortForwardRule>, String> {
    let mut rules = Vec::new();

    if let Ok(forward_out) = execute_adb(custom_path, &["forward", "--list"]) {
        for line in forward_out.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 && parts[0] == serial {
                rules.push(PortForwardRule {
                    serial: serial.to_string(),
                    local: parts[1].to_string(),
                    remote: parts[2].to_string(),
                    is_reverse: false,
                });
            }
        }
    }

    if let Ok(reverse_out) = execute_adb(custom_path, &["reverse", "--list"]) {
        for line in reverse_out.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 && parts[0] == serial {
                rules.push(PortForwardRule {
                    serial: serial.to_string(),
                    local: parts[1].to_string(),
                    remote: parts[2].to_string(),
                    is_reverse: true,
                });
            }
        }
    }

    Ok(rules)
}

pub fn add_port_forward(
    custom_path: Option<&str>,
    serial: &str,
    local_port: &str,
    remote_port: &str,
    is_reverse: bool,
) -> Result<String, String> {
    let local_spec = if local_port.starts_with("tcp:") { local_port.to_string() } else { format!("tcp:{}", local_port) };
    let remote_spec = if remote_port.starts_with("tcp:") { remote_port.to_string() } else { format!("tcp:{}", remote_port) };

    if is_reverse {
        execute_adb(custom_path, &["-s", serial, "reverse", &local_spec, &remote_spec])
    } else {
        execute_adb(custom_path, &["-s", serial, "forward", &local_spec, &remote_spec])
    }
}

pub fn remove_port_forward(
    custom_path: Option<&str>,
    serial: &str,
    local_port: &str,
    is_reverse: bool,
) -> Result<String, String> {
    let local_spec = if local_port.starts_with("tcp:") { local_port.to_string() } else { format!("tcp:{}", local_port) };

    if is_reverse {
        execute_adb(custom_path, &["-s", serial, "reverse", "--remove", &local_spec])
    } else {
        execute_adb(custom_path, &["-s", serial, "forward", "--remove", &local_spec])
    }
}

pub fn send_key_event(custom_path: Option<&str>, serial: &str, keycode: u32) -> Result<String, String> {
    let cmd = format!("input keyevent {}", keycode);
    execute_adb(custom_path, &["-s", serial, "shell", &cmd]).map(|s| s.trim().to_string())
}

pub fn send_text_input(custom_path: Option<&str>, serial: &str, text: &str) -> Result<String, String> {
    let escaped = text.replace(' ', "%s").replace('&', "\\&").replace('\'', "\\'");
    let cmd = format!("input text '{}'", escaped);
    execute_adb(custom_path, &["-s", serial, "shell", &cmd]).map(|s| s.trim().to_string())
}

pub fn capture_screenshot(custom_path: Option<&str>, serial: &str) -> Result<String, String> {
    let adb = resolve_adb_path(custom_path)?;
    let output = Command::new(&adb)
        .args(["-s", serial, "exec-out", "screencap", "-p"])
        .output()
        .map_err(|e| format!("Failed to capture screenshot: {}", e))?;

    if !output.status.success() || output.stdout.is_empty() {
        return Err("Screenshot capture returned empty buffer".to_string());
    }

    let b64 = base64::engine::general_purpose::STANDARD.encode(&output.stdout);
    Ok(format!("data:image/png;base64,{}", b64))
}

pub fn reboot_device(custom_path: Option<&str>, serial: &str, mode: &str) -> Result<String, String> {
    let args = match mode {
        "bootloader" => vec!["-s", serial, "reboot", "bootloader"],
        "recovery" => vec!["-s", serial, "reboot", "recovery"],
        "fastboot" => vec!["-s", serial, "reboot", "fastboot"],
        _ => vec!["-s", serial, "reboot"],
    };
    execute_adb(custom_path, &args).map(|s| s.trim().to_string())
}

pub fn dump_logcat(custom_path: Option<&str>, serial: &str, lines: u32) -> Result<String, String> {
    let line_str = lines.to_string();
    execute_adb(custom_path, &["-s", serial, "logcat", "-d", "-t", &line_str])
}

pub fn run_adb_shell(custom_path: Option<&str>, serial: &str, command: &str) -> Result<String, String> {
    execute_adb(custom_path, &["-s", serial, "shell", command])
}

pub fn run_raw_adb(custom_path: Option<&str>, args: &[String]) -> Result<String, String> {
    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    execute_adb(custom_path, &str_args)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_adb() {
        let res = resolve_adb_path(None);
        assert!(res.is_ok(), "ADB path should be resolved");
    }

    #[test]
    fn test_list_devices() {
        let devs = list_devices(None).expect("Failed to list devices");
        println!("Detected devices: {:?}", devs);
        assert!(!devs.is_empty(), "At least one device should be detected");
    }

    #[test]
    fn test_real_device_details() {
        let devs = list_devices(None).expect("Failed to list devices");
        let online = devs.iter().find(|d| d.state == "device");
        if let Some(dev) = online {
            let details = get_device_details(None, &dev.serial).expect("Failed to get device details");
            println!("Details for {}: {:?}", dev.serial, details);
            assert!(!details.android_version.is_empty());
            assert!(!details.model.is_empty());
        }
    }

    #[test]
    fn test_real_device_apps() {
        let devs = list_devices(None).expect("Failed to list devices");
        let online = devs.iter().find(|d| d.state == "device");
        if let Some(dev) = online {
            let apps = list_packages(None, &dev.serial, false).expect("Failed to list packages");
            println!("Found {} third-party apps on {}", apps.len(), dev.serial);
            assert!(!apps.is_empty());
        }
    }

    #[test]
    fn test_real_device_files() {
        let devs = list_devices(None).expect("Failed to list devices");
        let online = devs.iter().find(|d| d.state == "device");
        if let Some(dev) = online {
            let files = list_directory(None, &dev.serial, "/sdcard/").expect("Failed to list /sdcard/");
            println!("Found {} items in /sdcard/ on {}", files.len(), dev.serial);
            assert!(!files.is_empty());
        }
    }

    #[test]
    fn test_real_device_processes() {
        let devs = list_devices(None).expect("Failed to list devices");
        let online = devs.iter().find(|d| d.state == "device");
        if let Some(dev) = online {
            let procs = list_processes(None, &dev.serial).expect("Failed to list processes");
            println!("Found {} processes on {}", procs.len(), dev.serial);
            assert!(!procs.is_empty());
        }
    }

    #[test]
    fn test_real_device_screenshot() {
        let devs = list_devices(None).expect("Failed to list devices");
        let online = devs.iter().find(|d| d.state == "device");
        if let Some(dev) = online {
            let b64 = capture_screenshot(None, &dev.serial).expect("Failed to capture screenshot");
            assert!(b64.starts_with("data:image/png;base64,"));
            assert!(b64.len() > 1000);
            println!("Screenshot base64 length: {}", b64.len());
        }
    }
}
