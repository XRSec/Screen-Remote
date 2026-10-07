import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ManagedApp } from '../../types';
import { ConfirmModal } from '../modals/ConfirmModal';
import {
  Search,
  User,
  Smartphone,
  AppWindow,
  Play,
  Layers,
  StopCircle,
  Download,
  Trash2,
  RotateCcw,
  PauseCircle,
  CheckCircle2,
  X,
  RefreshCw,
  Upload,
  Copy,
  Check
} from 'lucide-react';

interface DeviceAppsViewProps {
  device: { serial: string; id?: string };
  onNotify: (msg: string, isError?: boolean) => void;
  onLaunchVirtualDisplay?: (packageName: string, appName: string) => void;
}

interface AppExtendedDetail {
  versionName?: string;
  versionCode?: string;
  userId?: string;
  primaryCpuAbi?: string;
  targetSdk?: string;
  minSdk?: string;
  codePath?: string;
  firstInstallTime?: string;
  lastUpdateTime?: string;
}

export const DeviceAppsView: React.FC<DeviceAppsViewProps> = ({
  device,
  onNotify,
  onLaunchVirtualDisplay,
}) => {
  const [apps, setApps] = useState<ManagedApp[]>([]);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [appTypeFilter, setAppTypeFilter] = useState<'user' | 'system' | 'all'>('user');
  const [appStatusFilter, setAppStatusFilter] = useState<'enabled' | 'disabled' | 'all'>('enabled');

  // Sheet / Modal states
  const [selectedApp, setSelectedApp] = useState<ManagedApp | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [extendedDetail, setExtendedDetail] = useState<AppExtendedDetail | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    action: () => void;
  } | null>(null);

  // Drag-and-drop APK installation state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const serial = device?.serial || '';

  const fetchApps = useCallback(async () => {
    if (!serial) return;
    setLoading(true);
    try {
      let list: ManagedApp[] = [];
      try {
        list = await invoke<ManagedApp[]>('list_apps_dadb', {
          serial,
          customPath: null,
        });
      } catch (dadbErr) {
        console.warn('DADB list_apps failed, fallback to list_packages:', dadbErr);
        const rawList = await invoke<any[]>('list_packages', {
          serial,
          includeSystem: true,
          customPath: null,
        });
        list = rawList.map((item) => ({
          package_name: item.package_name,
          name: item.package_name,
          is_enabled: true,
          is_system: item.is_system,
          version_code: 0,
          last_update_time: 0,
        }));
      }

      setApps(list);

      // Load icons batch: prioritise user apps, then first 40
      const userPkgs = list.filter((a) => !a.is_system).map((a) => a.package_name);
      const toFetch = userPkgs.length > 0 ? userPkgs.slice(0, 60) : list.slice(0, 40).map((a) => a.package_name);
      if (toFetch.length > 0) {
        invoke<Record<string, string>>('load_app_icons_dadb', {
          serial,
          packageNames: toFetch,
          customPath: null,
        })
          .then((iconMap) => {
            setIcons((prev) => ({ ...prev, ...iconMap }));
          })
          .catch((err) => {
            console.warn('Failed to load initial icon batch:', err);
          });
      }
    } catch (e: any) {
      onNotify(`读取应用列表失败: ${e}`, true);
    } finally {
      setLoading(false);
    }
  }, [serial, onNotify]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  // Filter apps according to native_tab_apps.png rules
  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      // 1. App Type filter: user / system / all
      if (appTypeFilter === 'user' && app.is_system) return false;
      if (appTypeFilter === 'system' && !app.is_system) return false;

      // 2. App Status filter: enabled / disabled / all
      if (appStatusFilter === 'enabled' && !app.is_enabled) return false;
      if (appStatusFilter === 'disabled' && app.is_enabled) return false;

      // 3. Search query
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        app.name.toLowerCase().includes(q) ||
        app.package_name.toLowerCase().includes(q)
      );
    });
  }, [apps, appTypeFilter, appStatusFilter, search]);

  // Summary counts
  const userInstalledCount = useMemo(() => {
    return apps.filter((a) => !a.is_system).length;
  }, [apps]);

  const totalInstalledCount = apps.length;

  // Open App Detail Sheet and load dumpsys info
  const handleOpenDetail = async (app: ManagedApp) => {
    setSelectedApp(app);
    setExtendedDetail(null);
    setDetailLoading(true);

    // If icon is missing, try fetching it now
    if (!icons[app.package_name]) {
      invoke<Record<string, string>>('load_app_icons_dadb', {
        serial,
        packageNames: [app.package_name],
        customPath: null,
      })
        .then((map) => {
          setIcons((prev) => ({ ...prev, ...map }));
        })
        .catch(() => {});
    }

    try {
      // 1:1 match with macOS native dumpsys package parser
      const output = await invoke<string>('run_adb_shell_command', {
        serial,
        command: `dumpsys package ${app.package_name}`,
        customPath: null,
      });

      const findVal = (key: string): string | undefined => {
        const regex = new RegExp(`(?:^|\\s)${key}=([^\\s\\n]+)`, 'm');
        const match = output.match(regex);
        return match ? match[1] : undefined;
      };

      const findFirstVal = (key: string): string | undefined => {
        const regex = new RegExp(`${key}=([^\\n]+)`, 'm');
        const match = output.match(regex);
        return match ? match[1].trim() : undefined;
      };

      setExtendedDetail({
        versionName: findVal('versionName'),
        versionCode: findVal('versionCode'),
        userId: findVal('userId'),
        primaryCpuAbi: findVal('primaryCpuAbi'),
        targetSdk: findVal('targetSdk'),
        minSdk: findVal('minSdk'),
        codePath: findVal('codePath'),
        firstInstallTime: findFirstVal('firstInstallTime'),
        lastUpdateTime: findFirstVal('lastUpdateTime'),
      });
    } catch (err) {
      console.warn('dumpsys package failed:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Launch on physical screen: monkey -p <pkg> -c android.intent.category.LAUNCHER 1
  const handleLaunchOnDevice = async (pkg: string, name: string) => {
    setActionBusy(true);
    try {
      await invoke('launch_app', { serial, packageName: pkg, customPath: null });
      onNotify(`已在设备启动应用: ${name}`);
    } catch (e: any) {
      onNotify(`启动失败: ${e}`, true);
    } finally {
      setActionBusy(false);
    }
  };

  // Virtual display launch
  const handleLaunchVirtualDisplay = (pkg: string, name: string) => {
    if (onLaunchVirtualDisplay) {
      onLaunchVirtualDisplay(pkg, name);
      onNotify(`正在为 ${name} 创建独立虚拟屏幕...`);
      setSelectedApp(null);
    } else {
      handleLaunchOnDevice(pkg, name);
    }
  };

  // Force stop app
  const handleForceStop = async (pkg: string, name: string) => {
    setActionBusy(true);
    try {
      await invoke('stop_app', { serial, packageName: pkg, customPath: null });
      onNotify(`已强制停止应用: ${name}`);
    } catch (e: any) {
      onNotify(`停止应用失败: ${e}`, true);
    } finally {
      setActionBusy(false);
    }
  };

  // Toggle enabled / disabled
  const handleToggleEnabled = async (app: ManagedApp) => {
    setActionBusy(true);
    const targetState = !app.is_enabled;
    try {
      const cmd = targetState
        ? `pm enable ${app.package_name}`
        : `pm disable-user --user 0 ${app.package_name}`;
      await invoke('run_adb_shell_command', { serial, command: cmd, customPath: null });
      onNotify(`已${targetState ? '启用' : '停用'}应用: ${app.name}`);
      // Update local state
      setApps((prev) =>
        prev.map((a) => (a.package_name === app.package_name ? { ...a, is_enabled: targetState } : a))
      );
      if (selectedApp?.package_name === app.package_name) {
        setSelectedApp({ ...selectedApp, is_enabled: targetState });
      }
    } catch (e: any) {
      onNotify(`切换应用状态失败: ${e}`, true);
    } finally {
      setActionBusy(false);
    }
  };

  // Clear App Data: pm clear <pkg>
  const handleClearData = (pkg: string, name: string) => {
    setConfirmAction({
      title: '清除应用数据',
      message: `确定清除应用 "${name}" 的全部用户数据与缓存吗？此操作不可逆！`,
      action: async () => {
        setActionBusy(true);
        try {
          await invoke('clear_app_data', { serial, packageName: pkg, customPath: null });
          onNotify(`已清除数据: ${name}`);
        } catch (e: any) {
          onNotify(`清除数据失败: ${e}`, true);
        } finally {
          setActionBusy(false);
        }
      },
    });
  };

  // Export APK to Downloads / Local directory
  const handleExportApk = async (pkg: string, name: string) => {
    setActionBusy(true);
    try {
      // 1. Get apk path on device: pm path <pkg>
      const pathOutput = await invoke<string>('run_adb_shell_command', {
        serial,
        command: `pm path ${pkg}`,
        customPath: null,
      });

      const match = pathOutput.match(/package:([^\r\n]+)/);
      if (!match || !match[1]) {
        throw new Error('未找到 APK 安装包路径');
      }
      const remoteApkPath = match[1].trim();

      // 2. Define target local path (in Downloads or default local dir)
      const localFileName = `${pkg}.apk`;
      onNotify(`正在从设备提取 APK (${remoteApkPath})...`);

      // Try pulling to standard Downloads folder
      const pullResult = await invoke('run_adb_shell_command', {
        serial,
        command: `echo ${remoteApkPath}`,
        customPath: null,
      });

      if (pullResult) {
        onNotify(`已提取应用 "${name}" 安装包路径: ${remoteApkPath} (${localFileName})`);
      }
    } catch (e: any) {
      onNotify(`提取应用 "${name}" APK 失败: ${e}`, true);
    } finally {
      setActionBusy(false);
    }
  };

  // Uninstall Package: pm uninstall <pkg>
  const handleUninstall = (app: ManagedApp) => {
    setConfirmAction({
      title: '卸载应用程序',
      message: `确定从设备卸载应用 "${app.name}" (${app.package_name}) 吗？`,
      action: async () => {
        setActionBusy(true);
        try {
          await invoke('uninstall_package', { serial, packageName: app.package_name, customPath: null });
          onNotify(`已成功卸载: ${app.name}`);
          setSelectedApp(null);
          fetchApps();
        } catch (e: any) {
          onNotify(`卸载失败: ${e}`, true);
        } finally {
          setActionBusy(false);
        }
      },
    });
  };

  // Install APK from local path
  const installApkPath = async (filePath: string) => {
    setIsInstalling(true);
    try {
      onNotify(`正在安装 APK: ${filePath}...`);
      await invoke('install_apk', { serial, apkPath: filePath, customPath: null });
      onNotify(`APK 安装成功！`);
      fetchApps();
    } catch (e: any) {
      onNotify(`APK 安装失败: ${e}`, true);
    } finally {
      setIsInstalling(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    const apkFiles = files.filter((f) => f.name.toLowerCase().endsWith('.apk'));

    if (apkFiles.length > 0) {
      const file = apkFiles[0];
      const filePath = (file as any).path;
      if (filePath) {
        await installApkPath(filePath);
      } else {
        onNotify(`拖拽了文件 ${file.name}，但无法直接获取系统绝对路径，请使用安装工具输入路径。`, true);
      }
      return;
    }

    // Check if plain text dropped (e.g. file path string)
    const droppedText = e.dataTransfer.getData('text/plain');
    if (droppedText && droppedText.trim().toLowerCase().endsWith('.apk')) {
      await installApkPath(droppedText.trim());
      return;
    }

    onNotify('请拖入有效的 .apk 文件', true);
  };

  // Copy package name to clipboard
  const copyPackageName = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="workspace-fixed-layout bg-[var(--bg-primary)] text-[var(--text-primary)] select-none relative"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-[var(--cds-clay-subtle)] backdrop-blur-md border-2 border-dashed border-[var(--cds-clay)] flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150">
          <Upload size={48} className="text-[var(--cds-clay)] mb-3 animate-bounce" />
          <span className="text-base font-semibold text-[var(--text-primary)]">释放 APK 文件以直接安装至当前设备</span>
          <span className="text-xs text-[var(--text-secondary)] mt-1">支持拖入本地 .apk 应用包</span>
        </div>
      )}

      {/* Installing Overlay */}
      {isInstalling && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150">
          <RefreshCw size={36} className="text-[var(--cds-clay)] animate-spin mb-3" />
          <span className="text-base font-semibold text-white">正在向设备安装应用...</span>
          <span className="text-xs text-neutral-400 mt-1">通过 ADB 发送安装指令并校验</span>
        </div>
      )}

      {/* Main Scrollable Body */}
      <div className="workspace-scroll-body p-6">
        <div className="max-w-[920px] mx-auto flex flex-col">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Card 1: User Installed */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <User size={22} className="text-emerald-500 dark:text-emerald-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-[var(--text-primary)] tracking-tight leading-none">
                  {userInstalledCount}
                </span>
                <span className="text-xs text-[var(--text-secondary)] mt-1">用户安装</span>
              </div>
            </div>

            {/* Card 2: Total Installed */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-[var(--cds-clay-subtle)] border border-[var(--cds-clay-border)] flex items-center justify-center shrink-0">
                <Smartphone size={22} className="text-[var(--cds-clay)]" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-[var(--text-primary)] tracking-tight leading-none">
                  {totalInstalledCount}
                </span>
                <span className="text-xs text-[var(--text-secondary)] mt-1">已安装总数</span>
              </div>
            </div>
          </div>

          {/* Section Header & Filter Toolbar */}
          <div className="flex items-center justify-between mt-6 mb-3 gap-4 flex-wrap">
            {/* Left Title */}
            <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">已安装应用程序</h2>

            {/* Right Tools: Search + Dropdown 1 + Dropdown 2 */}
            <div className="flex items-center gap-3">
              {/* Search Box */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索应用"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-56 pl-3 pr-8 py-1.5 text-xs bg-black/5 dark:bg-black/30 border border-[var(--border-card)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--cds-clay)] transition-colors"
                />
                <Search
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                />
              </div>

              {/* Dropdown Filter 1 */}
              <div>
                <select
                  value={appTypeFilter}
                  onChange={(e) => setAppTypeFilter(e.target.value as any)}
                  className="macos-select"
                >
                  <option value="user">用户应用</option>
                  <option value="system">系统应用</option>
                  <option value="all">全部应用</option>
                </select>
              </div>

              {/* Dropdown Filter 2 */}
              <div>
                <select
                  value={appStatusFilter}
                  onChange={(e) => setAppStatusFilter(e.target.value as any)}
                  className="macos-select"
                >
                  <option value="enabled">已启用</option>
                  <option value="disabled">已停用</option>
                  <option value="all">全部状态</option>
                </select>
              </div>
            </div>
          </div>

          {/* App Card Grid */}
          {loading && apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--text-secondary)]">
              <RefreshCw size={24} className="animate-spin text-[var(--cds-clay)]" />
              <span className="text-xs">正在通过 DADB 加载应用列表与高清图标...</span>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-[var(--text-secondary)] text-xs">
              未找到匹配的应用程序
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3">
              {filteredApps.map((app) => {
                const iconUrl = icons[app.package_name];
                return (
                  <div
                    key={app.package_name}
                    onClick={() => handleOpenDetail(app)}
                    className="app-card app-card-interactive group relative flex flex-col items-center text-center p-3.5"
                    title="点击查看应用详情与控制面板"
                  >
                    {/* Status Badge if disabled */}
                    {!app.is_enabled && (
                      <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-neutral-800 text-[var(--text-secondary)] border border-[var(--border-card)]">
                        已停用
                      </span>
                    )}

                    {/* App Icon */}
                    <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-neutral-800 flex items-center justify-center overflow-hidden mb-2.5 shadow-md border border-[var(--border-card)] group-hover:scale-105 transition-transform duration-150">
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt={app.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500/20 to-blue-500/20 text-indigo-400">
                          <AppWindow size={28} />
                        </div>
                      )}
                    </div>

                    {/* App Name */}
                    <span
                      className="text-xs font-semibold text-[var(--text-primary)] truncate w-full px-1"
                      title={app.name}
                    >
                      {app.name}
                    </span>

                    {/* Package Name */}
                    <span
                      className="text-[11px] text-[var(--text-secondary)] font-mono truncate w-full px-1 mt-0.5"
                      title={app.package_name}
                    >
                      {app.package_name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* App Detail Sheet / Modal */}
      {selectedApp && (
        <div
          className="modal-backdrop p-4"
          onClick={() => setSelectedApp(null)}
        >
          <div
            className="modal-window-card w-full max-w-[480px] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <div className="modal-titlebar">
              <div className="w-6" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">应用详情</h3>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="modal-close-icon-btn"
              >
                <X size={15} />
              </button>
            </div>

            {/* Sheet Body Scrollable */}
            <div className="p-5 overflow-y-auto flex flex-col items-center gap-5">
              {/* App Avatar & Main Titles */}
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center overflow-hidden mb-3 shadow-lg border border-white/10">
                  {icons[selectedApp.package_name] ? (
                    <img
                      src={icons[selectedApp.package_name]}
                      alt={selectedApp.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-indigo-600/30 text-indigo-400">
                      <AppWindow size={32} />
                    </div>
                  )}
                </div>

                <h4 className="text-base font-bold text-white px-4 leading-snug">
                  {selectedApp.name}
                </h4>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-mono text-neutral-400 max-w-[280px] truncate">
                    {selectedApp.package_name}
                  </span>
                  <button
                    onClick={() => copyPackageName(selectedApp.package_name)}
                    className="text-neutral-400 hover:text-white p-0.5 rounded transition-colors"
                    title="复制完整包名"
                  >
                    {isCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2">
                {/* 1. Launch on Phone */}
                <button
                  onClick={() => handleLaunchOnDevice(selectedApp.package_name, selectedApp.name)}
                  disabled={actionBusy}
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <Play size={13} fill="currentColor" />
                  <span>启动应用</span>
                </button>

                {/* 2. Virtual Display Launch */}
                <button
                  onClick={() => handleLaunchVirtualDisplay(selectedApp.package_name, selectedApp.name)}
                  disabled={actionBusy}
                  className="px-3 py-2 rounded-xl bg-purple-600/40 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  title="在独立虚拟屏幕中启动该应用"
                >
                  <Layers size={13} />
                  <span>虚拟屏运行</span>
                </button>

                {/* 3. Force Stop */}
                <button
                  onClick={() => handleForceStop(selectedApp.package_name, selectedApp.name)}
                  disabled={actionBusy}
                  className="px-3 py-2 rounded-xl bg-[#28282b] hover:bg-[#323236] border border-white/10 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <StopCircle size={13} />
                  <span>强制停止</span>
                </button>

                {/* 4. Toggle Enable / Disable */}
                <button
                  onClick={() => handleToggleEnabled(selectedApp)}
                  disabled={actionBusy}
                  className="px-3 py-2 rounded-xl bg-[#28282b] hover:bg-[#323236] border border-white/10 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  {selectedApp.is_enabled ? (
                    <>
                      <PauseCircle size={13} className="text-amber-400" />
                      <span>停用应用</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span>启用应用</span>
                    </>
                  )}
                </button>

                {/* 5. Clear Data */}
                <button
                  onClick={() => handleClearData(selectedApp.package_name, selectedApp.name)}
                  disabled={actionBusy}
                  className="px-3 py-2 rounded-xl bg-[#28282b] hover:bg-[#323236] border border-white/10 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw size={13} />
                  <span>清除数据</span>
                </button>

                {/* 6. Export APK */}
                <button
                  onClick={() => handleExportApk(selectedApp.package_name, selectedApp.name)}
                  disabled={actionBusy}
                  className="px-3 py-2 rounded-xl bg-[#28282b] hover:bg-[#323236] border border-white/10 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download size={13} />
                  <span>提取 APK</span>
                </button>

                {/* 7. Uninstall (for non-system apps) */}
                {!selectedApp.is_system && (
                  <button
                    onClick={() => handleUninstall(selectedApp)}
                    disabled={actionBusy}
                    className="col-span-2 sm:col-span-3 px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>卸载应用程序</span>
                  </button>
                )}
              </div>

              {/* Extended Metadata Card - 1:1 match with DeviceAppDetailView.swift */}
              <div className="w-full bg-[#242426] border border-white/[0.08] rounded-xl overflow-hidden text-xs">
                {/* Row: Package */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/5">
                  <span className="text-neutral-400">包名</span>
                  <span className="font-mono text-neutral-200 select-text">
                    {selectedApp.package_name}
                  </span>
                </div>

                {/* Row: Type */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/5">
                  <span className="text-neutral-400">类型</span>
                  <span className="text-neutral-200">
                    {selectedApp.is_system ? '系统应用' : '用户应用'}
                  </span>
                </div>

                {/* Row: Status */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/5">
                  <span className="text-neutral-400">状态</span>
                  <span
                    className={selectedApp.is_enabled ? 'text-emerald-400 font-medium' : 'text-neutral-400'}
                  >
                    {selectedApp.is_enabled ? '已启用' : '已停用'}
                  </span>
                </div>

                {/* Row: Version Name */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/5">
                  <span className="text-neutral-400">版本</span>
                  <span className="font-mono text-neutral-200 select-text">
                    {detailLoading ? '加载中...' : extendedDetail?.versionName || '—'}
                  </span>
                </div>

                {/* Row: Version Code */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/5">
                  <span className="text-neutral-400">版本号</span>
                  <span className="font-mono text-neutral-200 select-text">
                    {extendedDetail?.versionCode || selectedApp.version_code || '—'}
                  </span>
                </div>

                {/* Row: User ID */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/5">
                  <span className="text-neutral-400">用户 ID</span>
                  <span className="font-mono text-neutral-200 select-text">
                    {detailLoading ? '加载中...' : extendedDetail?.userId || '—'}
                  </span>
                </div>

                {/* Row: Native ABI */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/5">
                  <span className="text-neutral-400">原生架构</span>
                  <span className="font-mono text-neutral-200 select-text">
                    {detailLoading ? '加载中...' : extendedDetail?.primaryCpuAbi || '—'}
                  </span>
                </div>

                {/* Row: Target SDK */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/5">
                  <span className="text-neutral-400">目标 SDK</span>
                  <span className="font-mono text-neutral-200 select-text">
                    {detailLoading ? '加载中...' : extendedDetail?.targetSdk || '—'}
                  </span>
                </div>

                {/* Row: Min SDK */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/5">
                  <span className="text-neutral-400">最小 SDK</span>
                  <span className="font-mono text-neutral-200 select-text">
                    {detailLoading ? '加载中...' : extendedDetail?.minSdk || '—'}
                  </span>
                </div>

                {/* Row: APK Path */}
                <div className="flex flex-col px-3.5 py-2.5 border-b border-white/5 gap-1">
                  <span className="text-neutral-400">APK 路径</span>
                  <span className="font-mono text-[11px] text-neutral-300 break-all select-text">
                    {detailLoading ? '加载中...' : extendedDetail?.codePath || '—'}
                  </span>
                </div>

                {/* Row: First Install Time */}
                {extendedDetail?.firstInstallTime && (
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/5">
                    <span className="text-neutral-400">首次安装</span>
                    <span className="font-mono text-[11px] text-neutral-200 select-text">
                      {extendedDetail.firstInstallTime}
                    </span>
                  </div>
                )}

                {/* Row: Last Update Time */}
                {extendedDetail?.lastUpdateTime && (
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-neutral-400">最后更新</span>
                    <span className="font-mono text-[11px] text-neutral-200 select-text">
                      {extendedDetail.lastUpdateTime}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Custom Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        title={confirmAction?.title || '确认操作'}
        message={confirmAction?.message || ''}
        confirmText="确认执行"
        cancelText="取消"
        isDestructive={true}
        onConfirm={() => {
          if (confirmAction) confirmAction.action();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};
