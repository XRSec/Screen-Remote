export interface AdbDevice {
  serial: string;
  state: string;
  model: string | null;
  product: string | null;
  device: string | null;
  transport_id: string | null;
  is_wireless: boolean;
}

export type DeviceTransport = 'USB' | 'TCP/IP' | 'mDNS';

export interface DeviceConnection {
  id: string;
  transport: DeviceTransport;
  host: string;
  port: number;
  serial: string;
  priority: number;
}

export interface ScrcpyDeviceOptions {
  max_size: number;
  video_bitrate: string;
  max_fps: number;
  video_codec: string;
  video_encoder?: string;
  enable_audio: boolean;
  audio_codec: string;
  audio_bitrate: string;
  clipboard_sync: boolean;
  keep_device_awake: boolean;
  power_off_on_close: boolean;
  cleanup_on_disconnect: boolean;
  new_display_enabled: boolean;
  new_display_width: number;
  new_display_height: number;
  new_display_dpi: number;
  virtual_display_system_decorations: boolean;
  preserve_virtual_display_content: boolean;
  start_app?: string;
}

export interface DeviceSession {
  id: string;
  name: string;
  model: string;
  system_version: string;
  battery: number;
  accent: string;
  is_connected: boolean;
  active_serial?: string;
  active_transport?: DeviceTransport;
  connection_status: 'connected' | 'disconnected' | 'racing' | 'connecting';
  group_ids: string[];
  connections: DeviceConnection[];
  scrcpy_options: ScrcpyDeviceOptions;
}

export interface DeviceGroup {
  id: string;
  name: string;
  symbol: string;
  parent_id?: string;
}

export interface NativeSessionInfo {
  session_id: string;
  is_virtual_display: boolean;
  serial: string;
  stream_port: number;
  width: number;
  height: number;
  codec: string;
  has_audio?: boolean;
  audio_codec?: string;
}

export interface ManagedApp {
  package_name: string;
  name: string;
  is_enabled: boolean;
  is_system: boolean;
  version_code: number;
  last_update_time: number;
}

export interface AppSettings {
  adb_path: string | null;
  theme: 'system' | 'light' | 'dark';
  language: string;
  max_fps: number;
  bit_rate_mbps: number;
  max_size: number;
  video_codec: 'h264' | 'h265' | 'av1';
  audio_enabled: boolean;
  stay_awake: boolean;
  turn_screen_off: boolean;
  only_new_frame: boolean;
}

export type AppSection =
  | 'home'
  | 'screens'
  | 'deviceInfo'
  | 'utilities'
  | 'files'
  | 'apps'
  | 'processes'
  | 'portForward'
  | 'notifications'
  | 'messages'
  | 'photos';

export interface AvdInfo {
  name: string;
  target: string;
  abi: string;
  path: string;
  is_running: boolean;
  serial?: string;
}

export interface SystemImageInfo {
  id: string;
  api_level: string;
  tag: string;
  abi: string;
  display_name: string;
  path: string;
  is_installed: boolean;
}

export interface SkinInfo {
  name: string;
  path: string;
  width: number;
  height: number;
  form_factor: string;
}

export interface DeviceDetails {
  serial: string;
  brand: string;
  model: string;
  manufacturer: string;
  board: string;
  android_version: string;
  sdk_version: string;
  security_patch: string;
  build_id: string;
  screen_size: string;
  screen_density: string;
  battery_level: number | null;
  battery_temperature: number | null;
  battery_voltage: number | null;
  battery_health: string;
  battery_status: string;
  ram_total: string;
  ram_free: string;
  ram_available: string;
  storage_total: string;
  storage_used: string;
  storage_free: string;
  storage_percent: string;
  wifi_ip: string;
  wifi_mac: string;
}

export interface AppPackageInfo {
  package_name: string;
  installer: string | null;
  is_system: boolean;
  path: string | null;
}

export interface FileNodeInfo {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink: boolean;
  size: number;
  permissions: string;
  modified_time: string;
}

export interface ProcessInfo {
  pid: number;
  user: string;
  cpu_percent: string;
  rss_mem: string;
  name: string;
}

export interface PortForwardRule {
  serial: string;
  local: string;
  remote: string;
  is_reverse: boolean;
}

// --- Remote UI Layout Inspector Types ---

export interface RemoteUiLayoutBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type RemoteUiLayoutNodeKind =
  | 'input'
  | 'button'
  | 'text'
  | 'toggle'
  | 'image'
  | 'container'
  | 'other';

export type RemoteUiLayoutLabelSource =
  | 'text'
  | 'contentDescription'
  | 'resourceId'
  | 'fallback';

export interface RemoteUiLayoutNode {
  bounds: RemoteUiLayoutBounds;
  label: string;
  labelSource: RemoteUiLayoutLabelSource;
  componentKey?: string | null;
  kind: RemoteUiLayoutNodeKind;
  packageName: string;
  className: string;
  resourceId: string;
  text: string;
  contentDescription: string;
  isLeaf: boolean;
  clickable: boolean;
  enabled: boolean;
  focusable: boolean;
  focused: boolean;
  checkable: boolean;
  checked: boolean;
  selected: boolean;
  scrollable: boolean;
  password: boolean;
  visibleToUser: boolean;
  hasInputDescendant: boolean;
  hasTextDescendant: boolean;
  hasButtonDescendant: boolean;
  hasCheckIndicatorDescendant: boolean;
  xpath?: string;
}

export interface RemoteUiLayoutSnapshot {
  viewportBounds: RemoteUiLayoutBounds;
  nodes: RemoteUiLayoutNode[];
}

export * from './types/deviceInfo';


