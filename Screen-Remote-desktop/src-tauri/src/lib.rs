pub mod adb;
pub mod avd;
pub mod config;
pub mod dadb;
pub mod layout_inspector;
pub mod scrcpy;
pub mod scrcpy_server;
pub mod session;
pub mod window_manager;

use std::collections::HashMap;
use adb::{
    AdbDevice, AppPackageInfo, DeviceDetails, FileNodeInfo, PortForwardRule, ProcessInfo,
};
use config::AppSettings;
use dadb::ManagedApp;
use scrcpy_server::{NativeScrcpyManager, NativeSessionInfo};
use session::{DeviceGroup, DeviceSession, DeviceTransport, SessionManager};
use tauri::State;

#[tauri::command]
fn get_adb_version(custom_path: Option<String>) -> Result<String, String> {
    adb::get_adb_version(custom_path.as_deref())
}

#[tauri::command]
fn list_devices(custom_path: Option<String>) -> Result<Vec<AdbDevice>, String> {
    adb::list_devices(custom_path.as_deref())
}

#[tauri::command]
fn connect_device(address: String, custom_path: Option<String>) -> Result<String, String> {
    adb::connect_device(custom_path.as_deref(), &address)
}

#[tauri::command]
fn disconnect_device(address: String, custom_path: Option<String>) -> Result<String, String> {
    adb::disconnect_device(custom_path.as_deref(), &address)
}

#[tauri::command]
fn get_battery_info(serial: String, custom_path: Option<String>) -> Result<Option<u32>, String> {
    adb::get_battery_info(custom_path.as_deref(), &serial)
}

#[tauri::command]
fn get_device_details(serial: String, custom_path: Option<String>) -> Result<DeviceDetails, String> {
    adb::get_device_details(custom_path.as_deref(), &serial)
}

#[tauri::command]
fn list_packages(
    serial: String,
    include_system: bool,
    custom_path: Option<String>,
) -> Result<Vec<AppPackageInfo>, String> {
    adb::list_packages(custom_path.as_deref(), &serial, include_system)
}

#[tauri::command]
fn launch_app(serial: String, package_name: String, custom_path: Option<String>) -> Result<String, String> {
    adb::launch_app(custom_path.as_deref(), &serial, &package_name)
}

#[tauri::command]
fn stop_app(serial: String, package_name: String, custom_path: Option<String>) -> Result<String, String> {
    adb::stop_app(custom_path.as_deref(), &serial, &package_name)
}

#[tauri::command]
fn clear_app_data(serial: String, package_name: String, custom_path: Option<String>) -> Result<String, String> {
    adb::clear_app_data(custom_path.as_deref(), &serial, &package_name)
}

#[tauri::command]
fn uninstall_package(serial: String, package_name: String, custom_path: Option<String>) -> Result<String, String> {
    adb::uninstall_package(custom_path.as_deref(), &serial, &package_name)
}

#[tauri::command]
fn install_apk(serial: String, apk_path: String, custom_path: Option<String>) -> Result<String, String> {
    adb::install_apk(custom_path.as_deref(), &serial, &apk_path)
}

#[tauri::command]
fn list_directory(serial: String, path: String, custom_path: Option<String>) -> Result<Vec<FileNodeInfo>, String> {
    adb::list_directory(custom_path.as_deref(), &serial, &path)
}

#[tauri::command]
fn delete_remote_file(serial: String, path: String, custom_path: Option<String>) -> Result<String, String> {
    adb::delete_remote_file(custom_path.as_deref(), &serial, &path)
}

#[tauri::command]
fn create_remote_dir(serial: String, path: String, custom_path: Option<String>) -> Result<String, String> {
    adb::create_remote_dir(custom_path.as_deref(), &serial, &path)
}

#[tauri::command]
fn push_file_to_device(
    serial: String,
    local_path: String,
    remote_path: String,
    custom_path: Option<String>,
) -> Result<String, String> {
    adb::push_file_to_device(custom_path.as_deref(), &serial, &local_path, &remote_path)
}

#[tauri::command]
fn pull_file_from_device(
    serial: String,
    remote_path: String,
    local_path: String,
    custom_path: Option<String>,
) -> Result<String, String> {
    adb::pull_file_from_device(custom_path.as_deref(), &serial, &remote_path, &local_path)
}

#[tauri::command]
fn list_processes(serial: String, custom_path: Option<String>) -> Result<Vec<ProcessInfo>, String> {
    adb::list_processes(custom_path.as_deref(), &serial)
}

#[tauri::command]
fn kill_remote_process(serial: String, pid: u32, custom_path: Option<String>) -> Result<String, String> {
    adb::kill_remote_process(custom_path.as_deref(), &serial, pid)
}

#[tauri::command]
fn list_port_forwards(serial: String, custom_path: Option<String>) -> Result<Vec<PortForwardRule>, String> {
    adb::list_port_forwards(custom_path.as_deref(), &serial)
}

#[tauri::command]
fn add_port_forward(
    serial: String,
    local_port: String,
    remote_port: String,
    is_reverse: bool,
    custom_path: Option<String>,
) -> Result<String, String> {
    adb::add_port_forward(custom_path.as_deref(), &serial, &local_port, &remote_port, is_reverse)
}

#[tauri::command]
fn remove_port_forward(
    serial: String,
    local_port: String,
    is_reverse: bool,
    custom_path: Option<String>,
) -> Result<String, String> {
    adb::remove_port_forward(custom_path.as_deref(), &serial, &local_port, is_reverse)
}

#[tauri::command]
fn send_key_event(serial: String, keycode: u32, custom_path: Option<String>) -> Result<String, String> {
    adb::send_key_event(custom_path.as_deref(), &serial, keycode)
}

#[tauri::command]
fn send_text_input(serial: String, text: String, custom_path: Option<String>) -> Result<String, String> {
    adb::send_text_input(custom_path.as_deref(), &serial, &text)
}

#[tauri::command]
fn capture_screenshot(serial: String, custom_path: Option<String>) -> Result<String, String> {
    adb::capture_screenshot(custom_path.as_deref(), &serial)
}

#[tauri::command]
fn reboot_device(serial: String, mode: String, custom_path: Option<String>) -> Result<String, String> {
    adb::reboot_device(custom_path.as_deref(), &serial, &mode)
}

#[tauri::command]
fn dump_logcat(serial: String, lines: u32, custom_path: Option<String>) -> Result<String, String> {
    adb::dump_logcat(custom_path.as_deref(), &serial, lines)
}

#[tauri::command]
fn run_adb_shell_command(serial: String, command: String, custom_path: Option<String>) -> Result<String, String> {
    adb::run_adb_shell(custom_path.as_deref(), &serial, &command)
}

#[tauri::command]
fn run_raw_adb_command(args: Vec<String>, custom_path: Option<String>) -> Result<String, String> {
    adb::run_raw_adb(custom_path.as_deref(), &args)
}

#[tauri::command]
fn get_settings() -> AppSettings {
    config::load_settings()
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    config::save_settings(&settings)
}

// --- Session & Multi-Endpoint Management Commands ---

#[tauri::command]
fn get_sessions(manager: State<SessionManager>) -> Vec<DeviceSession> {
    manager.get_sessions()
}

#[tauri::command]
fn get_groups(manager: State<SessionManager>) -> Vec<DeviceGroup> {
    manager.get_groups()
}

#[tauri::command]
fn save_session(session: DeviceSession, manager: State<SessionManager>) -> Result<(), String> {
    manager.save_session(session);
    Ok(())
}

#[tauri::command]
fn delete_session(id: String, manager: State<SessionManager>) -> Result<(), String> {
    manager.delete_session(&id);
    Ok(())
}

#[tauri::command]
fn save_group(group: DeviceGroup, manager: State<SessionManager>) -> Result<(), String> {
    manager.save_group(group);
    Ok(())
}

#[tauri::command]
fn delete_group(id: String, manager: State<SessionManager>) -> Result<(), String> {
    manager.delete_group(&id);
    Ok(())
}

#[tauri::command]
fn sync_sessions_with_live_devices(
    manager: State<SessionManager>,
    custom_path: Option<String>,
) -> Result<Vec<DeviceSession>, String> {
    let live_devices = adb::list_devices(custom_path.as_deref())?;
    Ok(manager.sync_with_live_devices(&live_devices))
}

#[tauri::command]
async fn resolve_and_connect_session(
    session_id: String,
    manager: State<'_, SessionManager>,
    custom_path: Option<String>,
) -> Result<(String, DeviceTransport), String> {
    manager.resolve_connection(&session_id, custom_path.as_deref()).await
}

// --- In-App Native Scrcpy & Virtual Display Commands ---

#[tauri::command]
async fn start_native_screen_session(
    session_id: String,
    is_virtual_display: bool,
    start_app: Option<String>,
    scrcpy_manager: State<'_, NativeScrcpyManager>,
    session_manager: State<'_, SessionManager>,
    custom_path: Option<String>,
) -> Result<NativeSessionInfo, String> {
    // 1. Resolve active connection for this session (strip virtual display suffix if present)
    let base_session_id = session_id.split("-vd-").next().unwrap_or(&session_id);
    let (winner_serial, _) = session_manager.resolve_connection(base_session_id, custom_path.as_deref()).await?;

    // 2. Fetch session scrcpy options
    let sessions = session_manager.get_sessions();
    let mut options = sessions
        .iter()
        .find(|s| s.id == base_session_id)
        .map(|s| s.scrcpy_options.clone())
        .unwrap_or_default();

    if let Some(app) = start_app {
        options.start_app = Some(app);
    }
    if is_virtual_display {
        options.new_display_enabled = true;
        if options.new_display_width == 0 {
            options.new_display_width = 1200;
            options.new_display_height = 800;
            options.new_display_dpi = 280;
        }
    }

    scrcpy_manager
        .start_session(
            session_id,
            winner_serial,
            options,
            is_virtual_display,
            custom_path,
        )
        .await
}

#[tauri::command]
async fn stop_native_screen_session(
    session_id: String,
    scrcpy_manager: State<'_, NativeScrcpyManager>,
) -> Result<(), String> {
    scrcpy_manager.stop_session(&session_id).await;
    Ok(())
}

#[tauri::command]
async fn send_native_control_event(
    session_id: String,
    event: serde_json::Value,
    scrcpy_manager: State<'_, NativeScrcpyManager>,
) -> Result<(), String> {
    // Send event through raw packet serialization
    if let Some(bytes) = scrcpy_server::parse_control_json(&event, 1080, 2400) {
        scrcpy_manager.send_control(&session_id, bytes).await
    } else {
        Err("Invalid control event format".to_string())
    }
}

// --- DADB Helper Runtime Commands ---

#[tauri::command]
async fn list_apps_dadb(
    serial: String,
    custom_path: Option<String>,
) -> Result<Vec<ManagedApp>, String> {
    dadb::list_apps_dadb(&serial, custom_path.as_deref()).await
}

#[tauri::command]
async fn load_app_icons_dadb(
    serial: String,
    package_names: Vec<String>,
    custom_path: Option<String>,
) -> Result<HashMap<String, String>, String> {
    dadb::load_app_icons_dadb(&serial, &package_names, custom_path.as_deref()).await
}

#[tauri::command]
async fn get_device_info_dadb(
    serial: String,
    custom_path: Option<String>,
) -> Result<HashMap<String, String>, String> {
    dadb::get_device_info_dadb(&serial, custom_path.as_deref()).await
}

#[tauri::command]
async fn dump_remote_ui_layout(
    serial: String,
    custom_path: Option<String>,
) -> Result<layout_inspector::RemoteUiLayoutSnapshot, String> {
    layout_inspector::dump_remote_ui_layout(serial, custom_path).await
}

#[tauri::command]
async fn set_screen_rotation(
    serial: String,
    rotation: u32,
    custom_path: Option<String>,
) -> Result<(), String> {
    let custom = custom_path.as_deref();
    let rot = (rotation % 4).to_string();
    let _ = adb::execute_adb_async(
        custom,
        &["-s", &serial, "shell", "settings", "put", "system", "accelerometer_rotation", "0"],
    ).await;
    adb::execute_adb_async(
        custom,
        &["-s", &serial, "shell", "settings", "put", "system", "user_rotation", &rot],
    )
    .await
    .map(|_| ())
}

#[tauri::command]
async fn get_screen_rotation(
    serial: String,
    custom_path: Option<String>,
) -> Result<u32, String> {
    let custom = custom_path.as_deref();
    let out = adb::execute_adb_async(
        custom,
        &["-s", &serial, "shell", "settings", "get", "system", "user_rotation"],
    )
    .await
    .unwrap_or_else(|_| "0".to_string());
    Ok(out.trim().parse::<u32>().unwrap_or(0))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let session_manager = SessionManager::new();
    let native_scrcpy = NativeScrcpyManager::new();

    tauri::Builder::default()
        .manage(session_manager)
        .manage(native_scrcpy)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_adb_version,
            list_devices,
            connect_device,
            disconnect_device,
            get_battery_info,
            get_device_details,
            list_packages,
            launch_app,
            stop_app,
            clear_app_data,
            uninstall_package,
            install_apk,
            list_directory,
            delete_remote_file,
            create_remote_dir,
            push_file_to_device,
            pull_file_from_device,
            list_processes,
            kill_remote_process,
            list_port_forwards,
            add_port_forward,
            remove_port_forward,
            send_key_event,
            send_text_input,
            capture_screenshot,
            reboot_device,
            dump_logcat,
            run_adb_shell_command,
            run_raw_adb_command,
            get_settings,
            save_settings,
            // Session management
            get_sessions,
            get_groups,
            save_session,
            delete_session,
            save_group,
            delete_group,
            sync_sessions_with_live_devices,
            resolve_and_connect_session,
            // Native scrcpy & Virtual display
            start_native_screen_session,
            stop_native_screen_session,
            send_native_control_event,
            // DADB helper runtime
            list_apps_dadb,
            load_app_icons_dadb,
            get_device_info_dadb,
            // UI Layout Inspector
            dump_remote_ui_layout,
            // Screen Rotation
            set_screen_rotation,
            get_screen_rotation,
            // Detached Screen Window Manager
            window_manager::open_detached_screen_window,
            window_manager::close_detached_screen_window,
            // Android Virtual Devices (AVD)
            avd::list_avds,
            avd::start_avd,
            avd::stop_avd,
            avd::delete_avd,
            avd::list_installed_system_images,
            avd::list_available_skins
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
