use base64::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Cursor, Read};
use std::path::PathBuf;

use crate::adb::execute_adb_async;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagedApp {
    pub package_name: String,
    pub name: String,
    pub is_enabled: bool,
    pub is_system: bool,
    pub version_code: i64,
    pub last_update_time: i64,
}

pub fn get_bundled_dadb_helper_path() -> Result<PathBuf, String> {
    let candidate = PathBuf::from("resources/dadb-helper.jar");
    if candidate.exists() {
        return Ok(candidate);
    }
    let candidate2 = PathBuf::from("src-tauri/resources/dadb-helper.jar");
    if candidate2.exists() {
        return Ok(candidate2);
    }
    let candidate3 = PathBuf::from("../src-tauri/resources/dadb-helper.jar");
    if candidate3.exists() {
        return Ok(candidate3);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let res = dir.join("resources").join("dadb-helper.jar");
            if res.exists() {
                return Ok(res);
            }
            let res_parent = dir.join("../Resources/dadb-helper.jar");
            if res_parent.exists() {
                return Ok(res_parent);
            }
        }
    }
    Err("dadb-helper.jar not found in resources".to_string())
}

pub async fn prepare_dadb_helper(serial: &str, custom_adb: Option<&str>) -> Result<(), String> {
    let check_cmd = "if [ ! -f /data/local/tmp/dadb-helper.jar ]; then echo DADB_HELPER_MISSING; else CLASSPATH=/data/local/tmp/dadb-helper.jar exec app_process / dadb.helper.HelperVersionMain 1.6.7; fi";
    let check_out = execute_adb_async(custom_adb, &["-s", serial, "shell", check_cmd]).await.unwrap_or_default();
    if check_out.contains("DADB_HELPER_READY") {
        return Ok(());
    }

    // Need to push jar
    let helper_path = get_bundled_dadb_helper_path()?;
    let path_str = helper_path.to_string_lossy().to_string();
    let push_res = execute_adb_async(custom_adb, &["-s", serial, "push", &path_str, "/data/local/tmp/dadb-helper.jar"]).await?;
    log::info!("Pushed dadb-helper.jar to {}: {}", serial, push_res);

    let verify_out = execute_adb_async(custom_adb, &["-s", serial, "shell", check_cmd]).await?;
    if !verify_out.contains("DADB_HELPER_READY") {
        return Err(format!("DADB helper deployment verification failed: {}", verify_out));
    }
    Ok(())
}

pub async fn list_apps_dadb(serial: &str, custom_adb: Option<&str>) -> Result<Vec<ManagedApp>, String> {
    prepare_dadb_helper(serial, custom_adb).await?;

    let page_size = 250;
    let mut offset = 0;
    let mut all_apps = Vec::new();

    loop {
        let cmd = format!(
            "CLASSPATH=/data/local/tmp/dadb-helper.jar exec app_process / dadb.helper.AppIconExportMain list {} {} 1",
            offset, page_size
        );
        let output = execute_adb_async(custom_adb, &["-s", serial, "shell", &cmd]).await?;

        let mut page_count = 0;
        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let fields: Vec<&str> = line.split('\t').collect();
            if fields.len() < 7 {
                continue;
            }

            let package_name = fields[0].to_string();
            let name = if let Ok(bytes) = BASE64_STANDARD.decode(fields[1]) {
                String::from_utf8(bytes).unwrap_or_else(|_| package_name.clone())
            } else {
                package_name.clone()
            };

            let is_enabled = fields[2] == "1";
            let is_system = fields[3] == "1";
            let version_code = fields[5].parse::<i64>().unwrap_or(0);
            let last_update_time = fields[6].parse::<i64>().unwrap_or(0);

            all_apps.push(ManagedApp {
                package_name,
                name: if name.is_empty() { fields[0].to_string() } else { name },
                is_enabled,
                is_system,
                version_code,
                last_update_time,
            });
            page_count += 1;
        }

        if page_count < page_size {
            break;
        }
        offset += page_count;
    }

    all_apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(all_apps)
}

pub async fn load_app_icons_dadb(
    serial: &str,
    package_names: &[String],
    custom_adb: Option<&str>,
) -> Result<HashMap<String, String>, String> {
    if package_names.is_empty() {
        return Ok(HashMap::new());
    }
    prepare_dadb_helper(serial, custom_adb).await?;

    let req_text = package_names.join("\n");
    let payload = BASE64_STANDARD.encode(req_text.as_bytes());
    let cmd = format!(
        "CLASSPATH=/data/local/tmp/dadb-helper.jar exec app_process / dadb.helper.AppIconExportMain icons {}",
        payload
    );

    let output = execute_adb_async(custom_adb, &["-s", serial, "shell", &cmd]).await?;
    let lines: Vec<&str> = output.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();

    if lines.len() < 3 || lines[0] != "BATCH" {
        return Err("Invalid icon batch header from dadb helper".to_string());
    }

    if lines[1] == "-" || lines[2] == "-" {
        return Ok(HashMap::new());
    }

    let zip_bytes = match BASE64_STANDARD.decode(lines[2]) {
        Ok(b) => b,
        Err(e) => return Err(format!("Failed to decode base64 icon zip: {}", e)),
    };

    let mut icons_map = HashMap::new();
    let reader = Cursor::new(zip_bytes);
    if let Ok(mut archive) = zip::ZipArchive::new(reader) {
        for i in 0..archive.len() {
            if let Ok(mut file) = archive.by_index(i) {
                if file.is_file() {
                    let file_name = file.name().to_string();
                    let pkg = file_name.trim_end_matches(".png").to_string();
                    let mut buf = Vec::new();
                    if file.read_to_end(&mut buf).is_ok() {
                        let data_url = format!("data:image/png;base64,{}", BASE64_STANDARD.encode(&buf));
                        icons_map.insert(pkg, data_url);
                    }
                }
            }
        }
    }

    Ok(icons_map)
}

pub async fn get_device_info_dadb(serial: &str, custom_adb: Option<&str>) -> Result<HashMap<String, String>, String> {
    prepare_dadb_helper(serial, custom_adb).await?;

    let cmd = "CLASSPATH=/data/local/tmp/dadb-helper.jar exec app_process / dadb.helper.ManagementSnapshotMain device";
    let output = execute_adb_async(custom_adb, &["-s", serial, "shell", cmd]).await?;

    let lines: Vec<&str> = output.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
    if lines.is_empty() || lines[0] != "DADB_MANAGEMENT\tDEVICE" {
        return Err("Unexpected header from dadb management helper".to_string());
    }

    let mut fields_map = HashMap::new();
    for line in &lines[1..] {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 4 && parts[0] == "D" {
            let field_name = parts[1].to_string();
            let value = if parts[2] != "-" {
                BASE64_STANDARD.decode(parts[2])
                    .ok()
                    .and_then(|b| String::from_utf8(b).ok())
                    .unwrap_or_default()
            } else {
                String::new()
            };
            fields_map.insert(field_name, value);
        }
    }

    Ok(fields_map)
}
