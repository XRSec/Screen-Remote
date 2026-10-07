import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  AdbDevice, 
  DeviceDetails, 
  AppPackageInfo, 
  FileNodeInfo, 
  ProcessInfo, 
  PortForwardRule 
} from '../types';
import {
  ArrowLeft,
  Info,
  Layers,
  Folder,
  Cpu,
  Network,
  Wrench,
  Search,
  RotateCw,
  Play,
  Square,
  Trash2,
  Upload,
  Download,
  FolderPlus,
  Camera,
  Terminal,
  Volume2,
  VolumeX,
  Power,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';

interface DeviceWorkspaceProps {
  device: AdbDevice;
  onBack: () => void;
  activeSessions: string[];
  onStartSession: (serial: string) => void;
  onStopSession: (serial: string) => void;
}

type SubTab = 'info' | 'apps' | 'files' | 'processes' | 'forwards' | 'utilities';

export const DeviceWorkspace: React.FC<DeviceWorkspaceProps> = ({
  device,
  onBack,
  activeSessions,
  onStartSession,
  onStopSession,
}) => {
  const [activeTab, setActiveTab] = useState<SubTab>('info');
  const isSessionActive = activeSessions.includes(device.serial);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subtab 1: Device Details
  const [details, setDetails] = useState<DeviceDetails | null>(null);

  // Subtab 2: Apps
  const [apps, setApps] = useState<AppPackageInfo[]>([]);
  const [appSearch, setAppSearch] = useState('');
  const [includeSystemApps, setIncludeSystemApps] = useState(false);
  const [installApkPath, setInstallApkPath] = useState('');

  // Subtab 3: Files
  const [currentPath, setCurrentPath] = useState('/sdcard/');
  const [files, setFiles] = useState<FileNodeInfo[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [uploadLocalPath, setUploadLocalPath] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Subtab 4: Processes
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [processSearch, setProcessSearch] = useState('');

  // Subtab 5: Forwards
  const [forwardRules, setForwardRules] = useState<PortForwardRule[]>([]);
  const [newLocalPort, setNewLocalPort] = useState('');
  const [newRemotePort, setNewRemotePort] = useState('');
  const [newIsReverse, setNewIsReverse] = useState(false);

  // Subtab 6: Utilities
  const [textInput, setTextInput] = useState('');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [logcatOutput, setLogcatOutput] = useState<string>('');
  const [logcatCopied, setLogcatCopied] = useState(false);

  // Clear messages after a delay
  const notifySuccess = (msg: string) => {
    setActionMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setActionMessage(null), 3500);
  };

  const notifyError = (msg: string) => {
    setErrorMessage(msg);
    setActionMessage(null);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // Fetch Device Details
  const loadDeviceDetails = async () => {
    setLoading(true);
    try {
      const data = await invoke<DeviceDetails>('get_device_details', {
        serial: device.serial,
        customPath: null,
      });
      setDetails(data);
    } catch (e: any) {
      notifyError(`获取设备详情失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Apps
  const loadApps = async () => {
    setLoading(true);
    try {
      const list = await invoke<AppPackageInfo[]>('list_packages', {
        serial: device.serial,
        includeSystem: includeSystemApps,
        customPath: null,
      });
      setApps(list);
    } catch (e: any) {
      notifyError(`获取应用列表失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Files
  const loadFiles = async (path: string) => {
    setLoading(true);
    try {
      const list = await invoke<FileNodeInfo[]>('list_directory', {
        serial: device.serial,
        path,
        customPath: null,
      });
      setFiles(list);
      setCurrentPath(path);
    } catch (e: any) {
      notifyError(`读取目录失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Processes
  const loadProcesses = async () => {
    setLoading(true);
    try {
      const list = await invoke<ProcessInfo[]>('list_processes', {
        serial: device.serial,
        customPath: null,
      });
      setProcesses(list);
    } catch (e: any) {
      notifyError(`获取进程列表失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Port Forwards
  const loadForwards = async () => {
    setLoading(true);
    try {
      const rules = await invoke<PortForwardRule[]>('list_port_forwards', {
        serial: device.serial,
        customPath: null,
      });
      setForwardRules(rules);
    } catch (e: any) {
      notifyError(`获取端口转发失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Tab change trigger
  useEffect(() => {
    if (activeTab === 'info') {
      loadDeviceDetails();
    } else if (activeTab === 'apps') {
      loadApps();
    } else if (activeTab === 'files') {
      loadFiles(currentPath);
    } else if (activeTab === 'processes') {
      loadProcesses();
    } else if (activeTab === 'forwards') {
      loadForwards();
    }
  }, [activeTab, includeSystemApps]);

  // App Actions
  const handleLaunchApp = async (pkg: string) => {
    try {
      await invoke('launch_app', { serial: device.serial, packageName: pkg, customPath: null });
      notifySuccess(`已启动 ${pkg}`);
    } catch (e: any) {
      notifyError(`启动失败: ${e}`);
    }
  };

  const handleStopApp = async (pkg: string) => {
    try {
      await invoke('stop_app', { serial: device.serial, packageName: pkg, customPath: null });
      notifySuccess(`已停止 ${pkg}`);
    } catch (e: any) {
      notifyError(`停止失败: ${e}`);
    }
  };

  const handleClearAppData = async (pkg: string) => {
    if (!confirm(`确定清除应用 ${pkg} 的数据吗？此操作不可逆！`)) return;
    try {
      await invoke('clear_app_data', { serial: device.serial, packageName: pkg, customPath: null });
      notifySuccess(`已清除数据: ${pkg}`);
    } catch (e: any) {
      notifyError(`清除数据失败: ${e}`);
    }
  };

  const handleUninstallApp = async (pkg: string) => {
    if (!confirm(`确定卸载应用 ${pkg} 吗？`)) return;
    try {
      await invoke('uninstall_package', { serial: device.serial, packageName: pkg, customPath: null });
      notifySuccess(`已卸载 ${pkg}`);
      loadApps();
    } catch (e: any) {
      notifyError(`卸载失败: ${e}`);
    }
  };

  const handleInstallApk = async () => {
    if (!installApkPath.trim()) return;
    setLoading(true);
    try {
      await invoke('install_apk', { serial: device.serial, apkPath: installApkPath.trim(), customPath: null });
      notifySuccess(`APK 安装成功！`);
      setInstallApkPath('');
      loadApps();
    } catch (e: any) {
      notifyError(`安装 APK 失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // File Actions
  const handleFolderClick = (item: FileNodeInfo) => {
    if (item.is_dir) {
      const newP = item.path.endsWith('/') ? item.path : `${item.path}/`;
      loadFiles(newP);
    }
  };

  const handleNavigateUp = () => {
    const trimmed = currentPath.replace(/\/$/, '');
    const lastSlash = trimmed.lastIndexOf('/');
    if (lastSlash >= 0) {
      const parent = trimmed.substring(0, lastSlash + 1) || '/';
      loadFiles(parent);
    }
  };

  const handleDeleteFile = async (path: string) => {
    if (!confirm(`确定删除 ${path} 吗？`)) return;
    try {
      await invoke('delete_remote_file', { serial: device.serial, path, customPath: null });
      notifySuccess(`已删除`);
      loadFiles(currentPath);
    } catch (e: any) {
      notifyError(`删除失败: ${e}`);
    }
  };

  const handlePullFile = async (remotePath: string, fileName: string) => {
    const localDest = prompt(`请输入下载到本机的目标路径:`, fileName);
    if (!localDest) return;
    setLoading(true);
    try {
      await invoke('pull_file_from_device', {
        serial: device.serial,
        remotePath,
        localPath: localDest,
        customPath: null,
      });
      notifySuccess(`已下载文件至 ${localDest}`);
    } catch (e: any) {
      notifyError(`下载失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const target = `${currentPath}${newFolderName.trim()}`;
    try {
      await invoke('create_remote_dir', { serial: device.serial, path: target, customPath: null });
      notifySuccess(`文件夹已创建`);
      setNewFolderName('');
      setShowNewFolderModal(false);
      loadFiles(currentPath);
    } catch (e: any) {
      notifyError(`创建文件夹失败: ${e}`);
    }
  };

  const handleUploadFile = async () => {
    if (!uploadLocalPath.trim()) return;
    const fileName = uploadLocalPath.trim().split(/[/\\]/).pop() || 'upload.bin';
    const remoteDest = `${currentPath}${fileName}`;
    setLoading(true);
    try {
      await invoke('push_file_to_device', {
        serial: device.serial,
        localPath: uploadLocalPath.trim(),
        remotePath: remoteDest,
        customPath: null,
      });
      notifySuccess(`文件上传成功: ${fileName}`);
      setUploadLocalPath('');
      setShowUploadModal(false);
      loadFiles(currentPath);
    } catch (e: any) {
      notifyError(`上传失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Process Actions
  const handleKillProcess = async (pid: number) => {
    if (!confirm(`确定杀死进程 PID ${pid} 吗？`)) return;
    try {
      await invoke('kill_remote_process', { serial: device.serial, pid, customPath: null });
      notifySuccess(`已杀死进程 ${pid}`);
      loadProcesses();
    } catch (e: any) {
      notifyError(`杀死进程失败: ${e}`);
    }
  };

  // Port Forward Actions
  const handleAddForward = async () => {
    if (!newLocalPort.trim() || !newRemotePort.trim()) return;
    try {
      await invoke('add_port_forward', {
        serial: device.serial,
        localPort: newLocalPort.trim(),
        remotePort: newRemotePort.trim(),
        isReverse: newIsReverse,
        customPath: null,
      });
      notifySuccess(`端口转发规则已添加`);
      setNewLocalPort('');
      setNewRemotePort('');
      loadForwards();
    } catch (e: any) {
      notifyError(`添加转发失败: ${e}`);
    }
  };

  const handleRemoveForward = async (localPort: string, isReverse: boolean) => {
    try {
      await invoke('remove_port_forward', {
        serial: device.serial,
        localPort,
        isReverse,
        customPath: null,
      });
      notifySuccess(`规则已移除`);
      loadForwards();
    } catch (e: any) {
      notifyError(`移除规则失败: ${e}`);
    }
  };

  // Utility Actions
  const handleSendKey = async (keycode: number, name: string) => {
    try {
      await invoke('send_key_event', { serial: device.serial, keycode, customPath: null });
      notifySuccess(`按键触发: ${name}`);
    } catch (e: any) {
      notifyError(`按键失败: ${e}`);
    }
  };

  const handleSendText = async () => {
    if (!textInput) return;
    try {
      await invoke('send_text_input', { serial: device.serial, text: textInput, customPath: null });
      notifySuccess(`文本已发送`);
      setTextInput('');
    } catch (e: any) {
      notifyError(`文本发送失败: ${e}`);
    }
  };

  const handleCaptureScreenshot = async () => {
    setLoading(true);
    try {
      const dataUrl = await invoke<string>('capture_screenshot', {
        serial: device.serial,
        customPath: null,
      });
      setScreenshotData(dataUrl);
      notifySuccess(`截图成功`);
    } catch (e: any) {
      notifyError(`截屏失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReboot = async (mode: string) => {
    if (!confirm(`确定将设备重启至 ${mode} 模式吗？`)) return;
    try {
      await invoke('reboot_device', { serial: device.serial, mode, customPath: null });
      notifySuccess(`已下发重启命令`);
    } catch (e: any) {
      notifyError(`重启失败: ${e}`);
    }
  };

  const handleDumpLogcat = async () => {
    setLoading(true);
    try {
      const out = await invoke<string>('dump_logcat', {
        serial: device.serial,
        lines: 100,
        customPath: null,
      });
      setLogcatOutput(out);
      notifySuccess(`已获取最新 100 行日志`);
    } catch (e: any) {
      notifyError(`读取日志失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeployServer = async () => {
    setLoading(true);
    try {
      const res = await invoke<string>('deploy_bundled_server', {
        serial: device.serial,
        customPath: null,
      });
      notifySuccess(res);
    } catch (e: any) {
      notifyError(`部署 server 失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Filtered Apps
  const filteredApps = apps.filter((a) =>
    a.package_name.toLowerCase().includes(appSearch.toLowerCase())
  );

  // Filtered Processes
  const filteredProcs = processes.filter(
    (p) =>
      p.name.toLowerCase().includes(processSearch.toLowerCase()) ||
      p.pid.toString().includes(processSearch)
  );

  return (
    <div className="workspace-container">
      {/* Workspace Header */}
      <div className="workspace-header">
        <div className="workspace-header-left">
          <button className="workspace-back-btn" onClick={onBack} title="返回设备列表">
            <ArrowLeft size={16} />
            <span>设备列表</span>
          </button>
          <div className="workspace-device-title">
            <span className="workspace-device-name">
              {device.model || device.product || 'Android Device'}
            </span>
            <span className="workspace-device-serial">{device.serial}</span>
          </div>
        </div>

        <div className="workspace-header-right">
          {details?.wifi_ip && details.wifi_ip !== 'Not connected' && (
            <span className="badge badge-info" style={{ marginRight: '8px' }}>
              Wi-Fi: {details.wifi_ip}
            </span>
          )}

          {isSessionActive ? (
            <button
              className="btn btn-danger"
              style={{ padding: '6px 14px', fontSize: '13px' }}
              onClick={() => onStopSession(device.serial)}
            >
              <Square size={13} fill="currentColor" />
              <span>停止投屏</span>
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '13px' }}
              onClick={() => onStartSession(device.serial)}
            >
              <Play size={13} fill="currentColor" />
              <span>启动投屏</span>
            </button>
          )}

          <button
            className="btn btn-secondary"
            style={{ padding: '6px 12px' }}
            onClick={() => {
              if (activeTab === 'info') loadDeviceDetails();
              else if (activeTab === 'apps') loadApps();
              else if (activeTab === 'files') loadFiles(currentPath);
              else if (activeTab === 'processes') loadProcesses();
              else if (activeTab === 'forwards') loadForwards();
            }}
            title="刷新当前视图"
          >
            <RotateCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div className="alert alert-success" style={{ margin: '8px 0 14px 0' }}>
          <CheckCircle2 size={15} />
          <span>{actionMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="alert alert-danger" style={{ margin: '8px 0 14px 0' }}>
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Workspace Subtabs */}
      <div className="workspace-nav-bar">
        <button
          className={`workspace-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          <Info size={15} />
          <span>概览</span>
        </button>
        <button
          className={`workspace-tab-btn ${activeTab === 'apps' ? 'active' : ''}`}
          onClick={() => setActiveTab('apps')}
        >
          <Layers size={15} />
          <span>应用管理</span>
        </button>
        <button
          className={`workspace-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <Folder size={15} />
          <span>文件管理</span>
        </button>
        <button
          className={`workspace-tab-btn ${activeTab === 'processes' ? 'active' : ''}`}
          onClick={() => setActiveTab('processes')}
        >
          <Cpu size={15} />
          <span>系统进程</span>
        </button>
        <button
          className={`workspace-tab-btn ${activeTab === 'forwards' ? 'active' : ''}`}
          onClick={() => setActiveTab('forwards')}
        >
          <Network size={15} />
          <span>端口转发</span>
        </button>
        <button
          className={`workspace-tab-btn ${activeTab === 'utilities' ? 'active' : ''}`}
          onClick={() => setActiveTab('utilities')}
        >
          <Wrench size={15} />
          <span>实用工具</span>
        </button>
      </div>

      {/* Tab 1: Info Overview */}
      {activeTab === 'info' && (
        <div className="tab-pane">
          {details ? (
            <div className="info-grid">
              {/* Hardware Card */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">硬件规格与设备型号</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">品牌 / 制造商</span>
                  <span className="info-val">{details.brand || details.manufacturer}</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">设备型号 (Model)</span>
                  <span className="info-val">{details.model}</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">主板代号 (Board)</span>
                  <span className="info-val">{details.board}</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">序列号 (Serial)</span>
                  <span className="info-val" style={{ fontFamily: 'monospace' }}>
                    {details.serial}
                  </span>
                </div>
              </div>

              {/* System & OS Card */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">系统与架构</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">Android 版本</span>
                  <span className="badge badge-success">Android {details.android_version}</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">API 级别 (SDK)</span>
                  <span className="info-val">SDK {details.sdk_version}</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">安全补丁程序级别</span>
                  <span className="info-val">{details.security_patch}</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">内部构建版本号</span>
                  <span className="info-val" style={{ fontSize: '12px' }}>
                    {details.build_id}
                  </span>
                </div>
              </div>

              {/* Display Card */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">显示与分辨率</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">物理分辨率</span>
                  <span className="info-val">{details.screen_size}</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">屏幕像素密度</span>
                  <span className="info-val">{details.screen_density}</span>
                </div>
              </div>

              {/* Battery Card */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">电池状态</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">剩余电量</span>
                  <span className="info-val" style={{ fontWeight: 600, color: 'var(--accent-green)' }}>
                    {details.battery_level !== null ? `${details.battery_level}%` : '未知'}
                  </span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">电池温度</span>
                  <span className="info-val">
                    {details.battery_temperature !== null ? `${details.battery_temperature} °C` : '未知'}
                  </span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">电池电压</span>
                  <span className="info-val">
                    {details.battery_voltage !== null ? `${details.battery_voltage} mV` : '未知'}
                  </span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">健康状态</span>
                  <span className="info-val">{details.battery_health}</span>
                </div>
              </div>

              {/* Memory & Storage Card */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">运行内存与内置存储</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">系统总内存 (RAM)</span>
                  <span className="info-val">{details.ram_total}</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">可用空闲内存</span>
                  <span className="info-val" style={{ color: 'var(--accent-blue)' }}>
                    {details.ram_available}
                  </span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">内置存储空间</span>
                  <span className="info-val">
                    已用 {details.storage_used} / 总共 {details.storage_total} ({details.storage_percent})
                  </span>
                </div>
              </div>

              {/* Network Card */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">网络与连接信息</span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">Wi-Fi IP 地址</span>
                  <span className="info-val" style={{ fontFamily: 'monospace' }}>
                    {details.wifi_ip}
                  </span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">WLAN MAC 地址</span>
                  <span className="info-val" style={{ fontFamily: 'monospace' }}>
                    {details.wifi_mac}
                  </span>
                </div>
                <div className="setting-row">
                  <span className="setting-label">内置 Scrcpy Server 部署</span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={handleDeployServer}
                  >
                    重新推送到 /data/local/tmp
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <RotateCw size={24} className="spin" />
              <p>正在读取设备参数...</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Apps Manager */}
      {activeTab === 'apps' && (
        <div className="tab-pane">
          {/* Controls bar */}
          <div className="toolbar-row">
            <div className="search-box">
              <Search size={14} color="var(--text-secondary)" />
              <input
                type="text"
                placeholder="搜索应用包名..."
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
              />
            </div>

            <div className="segmented-control" style={{ width: '220px' }}>
              <div
                className={`segmented-btn ${!includeSystemApps ? 'active' : ''}`}
                onClick={() => setIncludeSystemApps(false)}
              >
                第三方应用
              </div>
              <div
                className={`segmented-btn ${includeSystemApps ? 'active' : ''}`}
                onClick={() => setIncludeSystemApps(true)}
              >
                全部应用
              </div>
            </div>

            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              共 {filteredApps.length} 项
            </span>
          </div>

          {/* Install APK Section */}
          <div className="card" style={{ marginBottom: '14px', padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Upload size={16} color="var(--accent-blue)" />
              <span style={{ fontSize: '13.5px', fontWeight: 500 }}>安装 APK:</span>
              <input
                type="text"
                placeholder="输入本地 APK 文件的完整绝对路径..."
                value={installApkPath}
                onChange={(e) => setInstallApkPath(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              />
              <button
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: '13px' }}
                onClick={handleInstallApk}
              >
                安装到设备
              </button>
            </div>
          </div>

          {/* Apps Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>应用包名</th>
                  <th style={{ width: '20%' }}>安装来源</th>
                  <th style={{ width: '35%', textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.slice(0, 150).map((app) => (
                  <tr key={app.package_name}>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                      {app.package_name}
                    </td>
                    <td>
                      <span className="badge badge-gray">
                        {app.installer || 'Sideload / Unknown'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="table-action-btn"
                          onClick={() => handleLaunchApp(app.package_name)}
                          title="启动"
                        >
                          启动
                        </button>
                        <button
                          className="table-action-btn"
                          onClick={() => handleStopApp(app.package_name)}
                          title="强行停止"
                        >
                          停止
                        </button>
                        <button
                          className="table-action-btn"
                          onClick={() => handleClearAppData(app.package_name)}
                          title="清除数据"
                        >
                          清除
                        </button>
                        <button
                          className="table-action-btn btn-danger-text"
                          onClick={() => handleUninstallApp(app.package_name)}
                          title="卸载"
                        >
                          卸载
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredApps.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                      无匹配的应用
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: File Explorer */}
      {activeTab === 'files' && (
        <div className="tab-pane">
          {/* Breadcrumb & Path Bar */}
          <div className="toolbar-row">
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px' }}
              onClick={handleNavigateUp}
              disabled={currentPath === '/' || currentPath === ''}
              title="返回上级"
            >
              .. 上级目录
            </button>

            <div className="breadcrumb-box">
              <span>{currentPath}</span>
            </div>

            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px' }}
              onClick={() => setShowNewFolderModal(true)}
            >
              <FolderPlus size={14} />
              <span>新建文件夹</span>
            </button>

            <button
              className="btn btn-primary"
              style={{ padding: '6px 12px' }}
              onClick={() => setShowUploadModal(true)}
            >
              <Upload size={14} />
              <span>上传文件</span>
            </button>
          </div>

          {/* Files Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>文件名</th>
                  <th style={{ width: '15%' }}>大小</th>
                  <th style={{ width: '20%' }}>修改时间</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.path}
                    className={file.is_dir ? 'clickable-row' : ''}
                    onDoubleClick={() => handleFolderClick(file)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {file.is_dir ? (
                          <Folder size={16} color="var(--accent-blue)" />
                        ) : (
                          <Folder size={16} color="var(--text-secondary)" style={{ opacity: 0.5 }} />
                        )}
                        <span
                          style={{
                            fontWeight: file.is_dir ? 500 : 400,
                            cursor: file.is_dir ? 'pointer' : 'default',
                            color: file.is_dir ? 'var(--accent-blue)' : 'inherit',
                          }}
                          onClick={() => handleFolderClick(file)}
                        >
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        {file.is_dir
                          ? '-'
                          : file.size > 1024 * 1024
                          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                          : file.size > 1024
                          ? `${(file.size / 1024).toFixed(1)} KB`
                          : `${file.size} B`}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {file.modified_time}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!file.is_dir && (
                        <button
                          className="table-action-btn"
                          style={{ marginRight: '6px' }}
                          onClick={() => handlePullFile(file.path, file.name)}
                          title="下载到本机"
                        >
                          <Download size={13} />
                        </button>
                      )}
                      <button
                        className="table-action-btn btn-danger-text"
                        onClick={() => handleDeleteFile(file.path)}
                        title="删除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {files.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                      目录为空
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* New Folder Modal */}
          {showNewFolderModal && (
            <div className="modal-backdrop">
              <div className="modal-card">
                <h3>新建文件夹</h3>
                <input
                  type="text"
                  placeholder="文件夹名称..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="modal-input"
                  autoFocus
                />
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setShowNewFolderModal(false)}>
                    取消
                  </button>
                  <button className="btn btn-primary" onClick={handleCreateFolder}>
                    确定
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upload File Modal */}
          {showUploadModal && (
            <div className="modal-backdrop">
              <div className="modal-card">
                <h3>上传文件到此目录</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  目标远程路径: {currentPath}
                </p>
                <input
                  type="text"
                  placeholder="本地文件的绝对路径 (如 /Users/xr/Downloads/app.apk)..."
                  value={uploadLocalPath}
                  onChange={(e) => setUploadLocalPath(e.target.value)}
                  className="modal-input"
                  autoFocus
                />
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>
                    取消
                  </button>
                  <button className="btn btn-primary" onClick={handleUploadFile}>
                    上传 (Push)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Process Manager */}
      {activeTab === 'processes' && (
        <div className="tab-pane">
          <div className="toolbar-row">
            <div className="search-box">
              <Search size={14} color="var(--text-secondary)" />
              <input
                type="text"
                placeholder="搜索进程名或 PID..."
                value={processSearch}
                onChange={(e) => setProcessSearch(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              活动进程: {filteredProcs.length} 项
            </span>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>PID</th>
                  <th style={{ width: '15%' }}>用户</th>
                  <th style={{ width: '15%' }}>物理内存 (RSS)</th>
                  <th style={{ width: '45%' }}>进程命令 / 进程名</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcs.map((p) => (
                  <tr key={p.pid}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>{p.pid}</td>
                    <td>
                      <span className="badge badge-gray">{p.user}</span>
                    </td>
                    <td>{p.rss_mem}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{p.name}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="table-action-btn btn-danger-text"
                        onClick={() => handleKillProcess(p.pid)}
                        title="结束进程 (Kill)"
                      >
                        结束
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Port Forwards */}
      {activeTab === 'forwards' && (
        <div className="tab-pane">
          {/* Add Rule Card */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <span className="card-title">添加端口转发规则</span>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 0' }}>
              <div className="segmented-control" style={{ width: '220px' }}>
                <div
                  className={`segmented-btn ${!newIsReverse ? 'active' : ''}`}
                  onClick={() => setNewIsReverse(false)}
                >
                  正向 (Forward)
                </div>
                <div
                  className={`segmented-btn ${newIsReverse ? 'active' : ''}`}
                  onClick={() => setNewIsReverse(true)}
                >
                  反向 (Reverse)
                </div>
              </div>

              <input
                type="text"
                placeholder="本地端口 (如 8080)"
                value={newLocalPort}
                onChange={(e) => setNewLocalPort(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  width: '180px',
                }}
              />

              <span>➜</span>

              <input
                type="text"
                placeholder="设备远程端口 (如 8080)"
                value={newRemotePort}
                onChange={(e) => setNewRemotePort(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  width: '180px',
                }}
              />

              <button className="btn btn-primary" onClick={handleAddForward}>
                添加规则
              </button>
            </div>
          </div>

          {/* Rules List */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>规则类型</th>
                  <th style={{ width: '35%' }}>本地端口 / 套接字</th>
                  <th style={{ width: '35%' }}>远程设备端口 / 套接字</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {forwardRules.map((rule, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className={`badge ${rule.is_reverse ? 'badge-info' : 'badge-success'}`}>
                        {rule.is_reverse ? 'Reverse' : 'Forward'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{rule.local}</td>
                    <td style={{ fontFamily: 'monospace' }}>{rule.remote}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="table-action-btn btn-danger-text"
                        onClick={() => handleRemoveForward(rule.local, rule.is_reverse)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {forwardRules.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                      暂无端口转发规则
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Utilities */}
      {activeTab === 'utilities' && (
        <div className="tab-pane">
          <div className="utilities-grid">
            {/* Quick Key Matrix */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">按键快捷指令 (Key Events)</span>
              </div>
              <div className="key-matrix">
                <button className="key-btn" onClick={() => handleSendKey(3, '主页 (Home)')}>
                  主页 (Home)
                </button>
                <button className="key-btn" onClick={() => handleSendKey(4, '返回 (Back)')}>
                  返回 (Back)
                </button>
                <button className="key-btn" onClick={() => handleSendKey(187, '多任务 (Recents)')}>
                  多任务 (Recents)
                </button>
                <button className="key-btn" onClick={() => handleSendKey(26, '电源 (Power)')}>
                  <Power size={13} /> 电源
                </button>
                <button className="key-btn" onClick={() => handleSendKey(24, '音量+ (Vol Up)')}>
                  <Volume2 size={13} /> 音量加
                </button>
                <button className="key-btn" onClick={() => handleSendKey(25, '音量- (Vol Down)')}>
                  <Volume2 size={13} /> 音量减
                </button>
                <button className="key-btn" onClick={() => handleSendKey(164, '静音 (Mute)')}>
                  <VolumeX size={13} /> 静音
                </button>
                <button className="key-btn" onClick={() => handleSendKey(224, '唤醒屏幕 (Wakeup)')}>
                  唤醒屏幕
                </button>
              </div>
            </div>

            {/* Text Input Sender */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">快速文本输入 (Text to Device)</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', padding: '12px 0' }}>
                <input
                  type="text"
                  placeholder="输入要直接打入 Android 当前焦点输入框的文本..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
                <button className="btn btn-primary" onClick={handleSendText}>
                  发送到设备
                </button>
              </div>
            </div>

            {/* Screenshot Tool */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">屏幕截取与预览</span>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                  onClick={handleCaptureScreenshot}
                >
                  <Camera size={13} />
                  <span>立即截图</span>
                </button>
              </div>
              {screenshotData ? (
                <div style={{ textAlign: 'center', padding: '12px' }}>
                  <img
                    src={screenshotData}
                    alt="Device Screenshot"
                    style={{
                      maxHeight: '380px',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  />
                  <div style={{ marginTop: '8px' }}>
                    <a
                      href={screenshotData}
                      download={`screenshot_${device.serial}_${Date.now()}.png`}
                      className="btn btn-secondary"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                    >
                      保存图片到本地
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  点击右上角“立即截图”获取设备当前屏幕画面
                </div>
              )}
            </div>

            {/* Reboot Tool */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">设备重启控制</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '12px 0' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                  onClick={() => handleReboot('system')}
                >
                  <RotateCcw size={13} />
                  <span>普通重启 (System)</span>
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                  onClick={() => handleReboot('recovery')}
                >
                  <span>重启至 Recovery</span>
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                  onClick={() => handleReboot('bootloader')}
                >
                  <span>重启至 Bootloader</span>
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                  onClick={() => handleReboot('fastboot')}
                >
                  <span>重启至 Fastboot</span>
                </button>
              </div>
            </div>

            {/* Logcat Reader */}
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header">
                <span className="card-title">实时 Logcat 日志抓取</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {logcatOutput && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => {
                        navigator.clipboard.writeText(logcatOutput);
                        setLogcatCopied(true);
                        setTimeout(() => setLogcatCopied(false), 2000);
                      }}
                    >
                      {logcatCopied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{logcatCopied ? '已复制' : '复制日志'}</span>
                    </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={handleDumpLogcat}
                  >
                    <Terminal size={12} />
                    <span>抓取最新 100 行</span>
                  </button>
                </div>
              </div>
              <pre className="logcat-viewer">
                {logcatOutput || '点击右上角“抓取最新 100 行”拉取日志输出...'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
