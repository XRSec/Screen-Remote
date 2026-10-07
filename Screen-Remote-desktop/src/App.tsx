import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { DeviceSession, AppSection, AppSettings } from './types';
import { SidebarView } from './components/SidebarView';
import { TopBar } from './components/TopBar';
import { ContentUnavailableView } from './components/ContentUnavailableView';
import { HomeOverviewView } from './components/screens/HomeOverviewView';
import { ScreensView } from './components/screens/ScreensView';
import { DeviceInfoView } from './components/screens/DeviceInfoView';
import { DeviceUtilitiesView } from './components/screens/DeviceUtilitiesView';
import { DeviceFilesView } from './components/screens/DeviceFilesView';
import { DeviceAppsView } from './components/screens/DeviceAppsView';
import { DeviceProcessesView } from './components/screens/DeviceProcessesView';
import { DevicePortForwardView } from './components/screens/DevicePortForwardView';
import { NotificationsView } from './components/screens/NotificationsView';
import { MessagesView } from './components/screens/MessagesView';
import { PhotosView } from './components/screens/PhotosView';
import { SettingsModal } from './components/modals/SettingsModal';
import { AddDeviceModal } from './components/modals/AddDeviceModal';
import { VirtualDevicesModal } from './components/modals/VirtualDevicesModal';
import { CreateVirtualDeviceModal } from './components/modals/CreateVirtualDeviceModal';
import { AdbShellModal } from './components/modals/AdbShellModal';
import { RawAdbModal } from './components/modals/RawAdbModal';
import { DiagnosticsModal } from './components/modals/DiagnosticsModal';
import { DeviceDiscoveryModal } from './components/modals/DeviceDiscoveryModal';
import { DetachedScreenView } from './components/DetachedScreenView';
import { BottomStatusBar } from './components/BottomStatusBar';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import './App.css';

interface ActiveVirtualTab {
  id: string;
  title: string;
  isVirtualDisplay: boolean;
  startApp?: string;
}

function MainWindow() {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<DeviceSession | null>(null);
  const [currentSection, setCurrentSection] = useState<AppSection>('home');
  const [activeVirtualTabs, setActiveVirtualTabs] = useState<ActiveVirtualTab[]>([]);
  const [batteries, setBatteries] = useState<Record<string, number | null>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [detachedScreens, setDetachedScreens] = useState<Set<string>>(new Set());
  // const [allSelected, setAllSelected] = useState(false);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [editingSession, setEditingSession] = useState<DeviceSession | null>(null);
  const [showVirtualDevicesModal, setShowVirtualDevicesModal] = useState(false);
  const [showCreateVirtualDeviceModal, setShowCreateVirtualDeviceModal] = useState(false);
  const [showAdbShell, setShowAdbShell] = useState(false);
  const [showRawAdb, setShowRawAdb] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);

  // Floating Notification
  const [notification, setNotification] = useState<{ text: string; isError: boolean } | null>(null);

  // Settings
  const [settings, setSettings] = useState<AppSettings>({
    adb_path: null,
    theme: 'system',
    language: 'zh-CN',
    max_fps: 60,
    bit_rate_mbps: 8,
    max_size: 0,
    video_codec: 'h264',
    audio_enabled: true,
    stay_awake: true,
    turn_screen_off: false,
    only_new_frame: true,
  });

  const notify = (text: string, isError = false) => {
    setNotification({ text, isError });
    setTimeout(() => {
      setNotification((curr) => (curr?.text === text ? null : curr));
    }, 3500);
  };

  // Load Settings
  useEffect(() => {
    invoke<AppSettings>('get_settings')
      .then((loaded) => setSettings(loaded))
      .catch((err) => console.error('Failed to load settings:', err));
  }, []);

  const handleSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings);
    invoke('save_settings', { settings: newSettings }).catch((err) =>
      console.error('Failed to save settings:', err)
    );
  };

  // Theme synchronization
  useEffect(() => {
    const applyTheme = () => {
      let isDark = false;
      if (settings.theme === 'dark') {
        isDark = true;
      } else if (settings.theme === 'light') {
        isDark = false;
      } else {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [settings.theme]);

  // Fetch & Synchronize Sessions with live devices
  const isFetchingRef = useRef(false);
  const fetchSessions = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);
    try {
      const synced = await invoke<DeviceSession[]>('sync_sessions_with_live_devices', { customPath: null });
      setSessions(synced);

      // Fetch battery for connected sessions
      const batMap: Record<string, number | null> = {};
      for (const s of synced) {
        if (s.is_connected && s.active_serial) {
          try {
            const bat = await invoke<number | null>('get_battery_info', {
              serial: s.active_serial,
              customPath: null,
            });
            batMap[s.active_serial] = bat;
          } catch {
            batMap[s.active_serial] = null;
          }
        }
      }
      setBatteries(batMap);

      // Auto-select first connected session or maintain selection
      setSelectedSession((curr) => {
        if (!curr && synced.length > 0) {
          const firstConnected = synced.find((s) => s.is_connected) || synced[0];
          return firstConnected;
        }
        if (curr) {
          const matched = synced.find((s) => s.id === curr.id);
          return matched || (synced.length > 0 ? synced[0] : null);
        }
        return null;
      });
    } catch (e) {
      console.error('Failed to sync sessions:', e);
    } finally {
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Reconnect / Race Session connection candidates
  const handleReconnectSession = async (sessionId: string) => {
    notify(`正在并发竞速会话候选地址...`);
    try {
      const [winnerSerial, transport] = await invoke<[string, string]>('resolve_and_connect_session', {
        sessionId,
        customPath: null,
      });
      notify(`连接成功: ${transport} (${winnerSerial})`);
      fetchSessions();
    } catch (e: any) {
      notify(`会话连接失败: ${e}`, true);
      fetchSessions();
    }
  };

  // Launch Virtual Display for an App
  const handleLaunchVirtualDisplay = (packageName: string, appName: string) => {
    const tabId = `${packageName}-${Date.now()}`;
    const newTab: ActiveVirtualTab = {
      id: tabId,
      title: `${appName} (虚拟屏)`,
      isVirtualDisplay: true,
      startApp: packageName,
    };
    setActiveVirtualTabs((prev) => [...prev, newTab]);
    setCurrentSection('screens');
    notify(`已在独立虚拟屏幕中启动 ${appName}`);
  };

  const handleCloseVirtualTab = (tabId: string) => {
    setActiveVirtualTabs((prev) => prev.filter((t) => t.id !== tabId));
  };

  // Listen for detached window close events to automatically restore inline display
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;
    listen<{ session_id: string; screen_id: string }>('detached_screen_closed', (event) => {
      const { screen_id } = event.payload;
      setDetachedScreens((prev) => {
        const next = new Set(prev);
        next.delete(screen_id);
        return next;
      });
    }).then((fn) => {
      if (!mounted) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      mounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  const handlePopOutScreen = async (screenId: string = 'primary', title?: string) => {
    if (!selectedSession) return;
    try {
      await invoke('open_detached_screen_window', {
        sessionId: selectedSession.id,
        screenId,
        title: title || `${selectedSession.name || 'Android'} - 主屏幕`,
        width: 1080,
        height: 2400,
      });
      setDetachedScreens((prev) => new Set(prev).add(screenId));
      notify('已弹出独立窗口');
    } catch (e) {
      console.error('Failed to open detached window:', e);
      notify(`弹出独立窗口失败: ${e}`, true);
    }
  };

  const handleDockScreen = async (screenId: string = 'primary') => {
    if (!selectedSession) return;
    try {
      await invoke('close_detached_screen_window', {
        sessionId: selectedSession.id,
        screenId,
      });
    } catch (e) {
      console.error('Failed to close detached window:', e);
    } finally {
      setDetachedScreens((prev) => {
        const next = new Set(prev);
        next.delete(screenId);
        return next;
      });
      notify('已收回主窗口');
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;

      if (e.key === '1') {
        e.preventDefault();
        setCurrentSection('screens');
      } else if (e.key === '2') {
        e.preventDefault();
        setCurrentSection('deviceInfo');
      } else if (e.key === '3') {
        e.preventDefault();
        setCurrentSection('utilities');
      } else if (e.key === '4') {
        e.preventDefault();
        setCurrentSection('files');
      } else if (e.key === '5') {
        e.preventDefault();
        setCurrentSection('apps');
      } else if (e.key === '6') {
        e.preventDefault();
        setCurrentSection('processes');
      } else if (e.key === '7') {
        e.preventDefault();
        setCurrentSection('portForward');
      } else if (e.key === '8') {
        e.preventDefault();
        setCurrentSection('notifications');
      } else if (e.key === '9') {
        e.preventDefault();
        setCurrentSection('messages');
      } else if (e.key === '0') {
        e.preventDefault();
        setCurrentSection('photos');
      } else if (e.key === ',') {
        e.preventDefault();
        setShowSettings((s) => !s);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowAddDevice(true);
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setShowAdbShell((s) => !s);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setShowRawAdb((s) => !s);
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        setShowVirtualDevicesModal((s) => !s);
      } else if (e.key === 's' || e.key === 'S' || e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setIsCollapsed((c) => !c);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAddSessionFromDiscovery = async (draft: Partial<DeviceSession>) => {
    const newSession: DeviceSession = {
      id: `session-${Date.now()}`,
      name: draft.name || 'Android Device',
      model: draft.model || 'Android',
      system_version: 'Android',
      battery: 100,
      accent: '#0a84ff',
      is_connected: false,
      active_serial: draft.active_serial,
      active_transport: draft.connections?.[0]?.transport || 'USB',
      connection_status: 'disconnected',
      group_ids: ['home'],
      connections: draft.connections || [],
      scrcpy_options: draft.scrcpy_options || {
        max_size: 0,
        video_bitrate: '4M',
        max_fps: 60,
        video_codec: 'h264',
        enable_audio: true,
        audio_codec: 'opus',
        audio_bitrate: '128K',
        clipboard_sync: true,
        keep_device_awake: false,
        power_off_on_close: false,
        cleanup_on_disconnect: true,
        new_display_enabled: false,
        new_display_width: 1200,
        new_display_height: 800,
        new_display_dpi: 280,
        virtual_display_system_decorations: false,
        preserve_virtual_display_content: false,
      },
    };
    try {
      await invoke('save_session', { session: newSession });
      notify(`已成功添加会话: ${newSession.name}`);
      fetchSessions();
    } catch (e: any) {
      notify(`添加会话失败: ${e}`, true);
    }
  };

  const activeSerial = selectedSession?.active_serial || selectedSession?.connections[0]?.serial || '';
  const batteryLevel = activeSerial ? batteries[activeSerial] ?? null : null;

  

  // Adapter device object for tabs requiring adb serial
  const activeDeviceAdapter = useMemo<any>(() => {
    return selectedSession
      ? {
          serial: activeSerial,
          state: selectedSession.is_connected ? 'device' : 'offline',
          model: selectedSession.model || selectedSession.name,
          device: selectedSession.name,
          is_wireless: selectedSession.active_transport === 'TCP/IP' || selectedSession.active_transport === 'mDNS',
        }
      : null;
  }, [
    selectedSession?.id,
    selectedSession?.is_connected,
    selectedSession?.model,
    selectedSession?.name,
    selectedSession?.active_transport,
    activeSerial
  ]);

  return (
    <div
      className="macos-app-container"
      onMouseDown={() => {
        window.getSelection()?.removeAllRanges();
      }}
    >
      {/* 1. Left Native macOS Sidebar */}
      <SidebarView
        sessions={sessions}
        selectedSession={selectedSession}
        onSelectSession={(s) => setSelectedSession(s)}
        batteries={batteries}
        onOpenAddDevice={() => {
          setEditingSession(null);
          setShowAddDevice(true);
        }}
        onOpenDiscovery={() => setShowDiscovery(true)}
        onOpenDiagnostics={() => setShowDiagnostics(true)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        onReconnectSession={handleReconnectSession}
        onEditSession={(s) => {
          setEditingSession(s);
          setShowAddDevice(true);
        }}
        onOpenVirtualDevices={() => setShowVirtualDevicesModal(true)}
      />

      {/* 2. Main Work Area */}
      <main className="macos-main-viewport">
        {/* TopBar */}
        <TopBar
          currentSection={currentSection}
          onSelectSection={(sec) => setCurrentSection(sec)}
          onRefresh={fetchSessions}
          isRefreshing={isRefreshing}
          onOpenSettings={() => setShowSettings(true)}
          hasSelectedDevice={selectedSession !== null}
          selectedDeviceName={selectedSession?.name}
          isDeviceConnected={selectedSession?.is_connected}
        />

        {/* Floating Toast Notification */}
        {notification && (
          <div className={`macos-floating-toast ${notification.isError ? 'toast-error' : 'toast-success'}`}>
            {notification.isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            <span>{notification.text}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="macos-content-container">
          {currentSection === 'home' ? (
            <HomeOverviewView
              selectedSession={selectedSession}
              sessions={sessions}
              onSelectSession={(s) => setSelectedSession(s)}
              onNavigateSection={(sec) => setCurrentSection(sec)}
              onStartScreenSession={handleReconnectSession}
              onOpenAddDevice={() => {
                setEditingSession(null);
                setShowAddDevice(true);
              }}
              onOpenAdbShell={() => setShowAdbShell(true)}
              onEditSession={(s) => {
                setEditingSession(s);
                setShowAddDevice(true);
              }}
              batteryLevel={batteryLevel}
            />
          ) : !selectedSession ? (
            <ContentUnavailableView
              onAddDevice={() => {
                setEditingSession(null);
                setShowAddDevice(true);
              }}
            />
          ) : currentSection === 'screens' ? (
            <ScreensView
              session={selectedSession}
              battery={batteryLevel}
              settings={settings}
              onOpenSettings={() => setShowSettings(true)}
              onStartSession={handleReconnectSession}
              activeVirtualTabs={activeVirtualTabs}
              onCloseVirtualTab={handleCloseVirtualTab}
              detachedScreens={detachedScreens}
              onPopOutScreen={handlePopOutScreen}
              onDockScreen={handleDockScreen}
            />
          ) : !selectedSession.is_connected ? (
            <ContentUnavailableView
              title="需要连接设备"
              detail={`请先连接设备【${selectedSession.name}】，再使用该管理工具。`}
              actionTitle="立即连接设备"
              onAction={() => handleReconnectSession(selectedSession.id)}
            />
          ) : (
            <>
              {currentSection === 'deviceInfo' && activeDeviceAdapter && (
                <DeviceInfoView device={activeDeviceAdapter} />
              )}

              {currentSection === 'utilities' && activeDeviceAdapter && (
                <DeviceUtilitiesView device={activeDeviceAdapter} onNotify={notify} />
              )}

              {currentSection === 'files' && activeDeviceAdapter && (
                <DeviceFilesView device={activeDeviceAdapter} onNotify={notify} />
              )}

              {currentSection === 'apps' && activeDeviceAdapter && (
                <DeviceAppsView
                  device={activeDeviceAdapter}
                  onNotify={notify}
                  onLaunchVirtualDisplay={handleLaunchVirtualDisplay}
                />
              )}

              {currentSection === 'processes' && activeDeviceAdapter && (
                <DeviceProcessesView device={activeDeviceAdapter} onNotify={notify} />
              )}

              {currentSection === 'portForward' && activeDeviceAdapter && (
                <DevicePortForwardView device={activeDeviceAdapter} onNotify={notify} />
              )}

              {currentSection === 'notifications' && activeDeviceAdapter && (
                <NotificationsView device={activeDeviceAdapter} />
              )}

              {currentSection === 'messages' && activeDeviceAdapter && (
                <MessagesView device={activeDeviceAdapter} />
              )}

              {currentSection === 'photos' && activeDeviceAdapter && (
                <PhotosView device={activeDeviceAdapter} onNotify={notify} />
              )}
            </>
          )}
        </div>

        {/* 3. Bottom Professional Status Bar */}
        <BottomStatusBar
          selectedSession={selectedSession}
          batteryLevel={batteryLevel}
          onOpenAdbShell={() => setShowAdbShell(true)}
          onOpenDiagnostics={() => setShowDiagnostics(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      </main>

      {/* Modals */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAddDevice && (
        <AddDeviceModal
          initialSession={editingSession}
          onClose={() => {
            setShowAddDevice(false);
            setEditingSession(null);
          }}
          onConnected={fetchSessions}
        />
      )}

      {showVirtualDevicesModal && (
        <VirtualDevicesModal
          onClose={() => setShowVirtualDevicesModal(false)}
          onCreateNew={() => {
            setShowVirtualDevicesModal(false);
            setShowCreateVirtualDeviceModal(true);
          }}
        />
      )}

      {showCreateVirtualDeviceModal && (
        <CreateVirtualDeviceModal
          onClose={() => setShowCreateVirtualDeviceModal(false)}
          onCreated={() => {
            setShowCreateVirtualDeviceModal(false);
            setShowVirtualDevicesModal(true);
          }}
        />
      )}

      {showAdbShell && (
        <AdbShellModal
          serial={activeSerial}
          isOpen={showAdbShell}
          onClose={() => setShowAdbShell(false)}
          onNotify={notify}
        />
      )}

      {showRawAdb && (
        <RawAdbModal
          serial={activeSerial}
          isOpen={showRawAdb}
          onClose={() => setShowRawAdb(false)}
          onNotify={notify}
        />
      )}

      {showDiagnostics && (
        <DiagnosticsModal
          onClose={() => setShowDiagnostics(false)}
          activeSerial={activeSerial}
        />
      )}

      {showDiscovery && (
        <DeviceDiscoveryModal
          onClose={() => setShowDiscovery(false)}
          existingSessions={sessions}
          onAddSessionFromDiscovery={handleAddSessionFromDiscovery}
        />
      )}
    </div>
  );
}

export function App() {
  const isDetached = new URLSearchParams(window.location.search).get('detached') === 'true';

  if (isDetached) {
    return <DetachedScreenView />;
  }

  return <MainWindow />;
}

export default App;
