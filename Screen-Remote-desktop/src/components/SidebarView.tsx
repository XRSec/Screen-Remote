import React, { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { DeviceSession, AvdInfo, DeviceGroup } from '../types';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Play,
  Square,
  MoreHorizontal,
  Radio,
  Terminal,
  Home,
  Smartphone,
  Cpu,
  RefreshCw,
  Loader2,
  Battery,
  BatteryLow,
  BatteryMedium,
  Sliders,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';

interface SidebarViewProps {
  sessions: DeviceSession[];
  selectedSession: DeviceSession | null;
  onSelectSession: (session: DeviceSession) => void;
  batteries: Record<string, number | null>;
  onOpenAddDevice: () => void;
  onOpenDiscovery?: () => void;
  onOpenDiagnostics?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onReconnectSession?: (sessionId: string) => void;
  onEditSession?: (session: DeviceSession) => void;
  onOpenVirtualDevices?: () => void;
  groups?: DeviceGroup[];
}

export const SidebarView: React.FC<SidebarViewProps> = ({
  sessions,
  selectedSession,
  onSelectSession,
  batteries,
  onOpenAddDevice,
  onOpenDiscovery,
  onOpenDiagnostics,
  isCollapsed,
  onToggleCollapse,
  onReconnectSession,
  onEditSession,
  onOpenVirtualDevices,
  groups = [],
}) => {
  const [sessionsExpanded, setSessionsExpanded] = useState(true);
  const [virtualDevicesExpanded, setVirtualDevicesExpanded] = useState(false);
  const [avds, setAvds] = useState<AvdInfo[]>([]);
  const [loadingAvds, setLoadingAvds] = useState(false);
  const [hasLoadedAvds, setHasLoadedAvds] = useState(false);
  const [startingAvd, setStartingAvd] = useState<string | null>(null);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [selectedGroupName, setSelectedGroupName] = useState('首页');

  const startAvdTimerRef = useRef<number | null>(null);
  const groupMenuRef = useRef<HTMLDivElement | null>(null);

  // Close group menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setShowGroupMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const uniqueSessions = useMemo(() => {
    const seen = new Set<string>();
    const res: DeviceSession[] = [];
    for (const session of sessions) {
      const serialKey =
        session.active_serial || session.connections[0]?.serial || session.connections[0]?.host || '';
      const key = serialKey
        ? `serial:${serialKey}`
        : session.name && session.model
        ? `model:${session.name}:${session.model}`
        : `id:${session.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        res.push(session);
      } else {
        const existingIdx = res.findIndex((r) => {
          const rSerial =
            r.active_serial || r.connections[0]?.serial || r.connections[0]?.host || '';
          const rKey = rSerial
            ? `serial:${rSerial}`
            : r.name && r.model
            ? `model:${r.name}:${r.model}`
            : `id:${r.id}`;
          return rKey === key;
        });
        if (existingIdx !== -1 && !res[existingIdx].is_connected && session.is_connected) {
          res[existingIdx] = session;
        }
      }
    }
    return res;
  }, [sessions]);

  // Load AVDs on demand when user clicks expand
  const fetchAvds = () => {
    setLoadingAvds(true);
    invoke<AvdInfo[]>('list_avds')
      .then((res) => {
        setAvds(res || []);
        setHasLoadedAvds(true);
      })
      .catch((err) => {
        console.warn('Failed to list AVDs:', err);
        setAvds([]);
        setHasLoadedAvds(true);
      })
      .finally(() => {
        setLoadingAvds(false);
      });
  };

  const handleToggleVirtualDevices = () => {
    const next = !virtualDevicesExpanded;
    setVirtualDevicesExpanded(next);
    if (next && !hasLoadedAvds) {
      fetchAvds();
    }
  };

  useEffect(() => {
    return () => {
      if (startAvdTimerRef.current) clearTimeout(startAvdTimerRef.current);
    };
  }, []);

  const handleStartAvd = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStartingAvd(name);
    try {
      await invoke('start_avd', { name });
    } catch (err) {
      console.error('Failed to launch AVD:', err);
    } finally {
      startAvdTimerRef.current = setTimeout(() => {
        setStartingAvd(null);
        fetchAvds();
      }, 4000) as any;
    }
  };

  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('button, input, select, [data-no-drag]')) {
      getCurrentWindow().startDragging();
    }
  };

  const renderBatteryIndicator = (battery: number | null | undefined) => {
    if (battery === null || battery === undefined) return null;
    let colorClass = 'text-emerald-400';
    let Icon = Battery;
    if (battery <= 20) {
      colorClass = 'text-rose-400';
      Icon = BatteryLow;
    } else if (battery <= 50) {
      colorClass = 'text-amber-400';
      Icon = BatteryMedium;
    }

    return (
      <span className={`inline-flex items-center gap-1 text-[10.5px] font-mono ${colorClass}`}>
        <Icon size={11} className="shrink-0" />
        <span>{battery}%</span>
      </span>
    );
  };

  return (
    <aside
      className={`macos-sidebar flex flex-col h-screen select-none relative transition-all duration-200 border-r border-white/[0.08] bg-[#161618] dark:bg-[#161618] ${
        isCollapsed ? 'collapsed' : ''
      }`}
      style={{
        width: isCollapsed ? '60px' : '250px',
        minWidth: isCollapsed ? '60px' : '250px',
        maxWidth: isCollapsed ? '60px' : '250px',
        flexBasis: isCollapsed ? '60px' : '250px',
        flexShrink: 0,
      }}
    >
      {/* 顶部自适应标题与操作区 (清理硬编码 84px padding，采用优雅结构) */}
      <div
        className="h-12 min-h-12 px-3 flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02]"
        data-tauri-drag-region
        onMouseDown={handleDragMouseDown}
      >
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2 min-w-0" data-no-drag>
              <div className="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Smartphone size={13} />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[13px] font-semibold text-neutral-100 tracking-tight truncate">
                  设备列表
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium bg-white/[0.08] text-neutral-400">
                  {uniqueSessions.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1" data-no-drag>
              {onOpenDiscovery && (
                <button
                  type="button"
                  onClick={onOpenDiscovery}
                  className="w-7 h-7 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] flex items-center justify-center transition-all cursor-pointer"
                  title="刷新与设备发现"
                >
                  <RefreshCw size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={onOpenAddDevice}
                className="w-7 h-7 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 active:bg-blue-500/35 text-blue-400 border border-blue-500/30 flex items-center justify-center transition-all cursor-pointer"
                title="添加新设备会话"
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                onClick={onToggleCollapse}
                className="w-7 h-7 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] flex items-center justify-center transition-all cursor-pointer"
                title="收起侧边栏"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
          </>
        ) : (
          <div className="w-full flex items-center justify-center" data-no-drag>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] flex items-center justify-center transition-all cursor-pointer"
              title="展开侧边栏"
            >
              <PanelLeft size={16} />
            </button>
          </div>
        )}
      </div>

      {/* 主滚动区域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-3 select-none scrollbar-thin">
        {!isCollapsed ? (
          <>
            {/* SECTION 1: 设备会话列表 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 py-1">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 hover:text-neutral-200 tracking-wider uppercase transition-colors cursor-pointer"
                  onClick={() => setSessionsExpanded(!sessionsExpanded)}
                >
                  <ChevronDown
                    size={12}
                    className={`text-neutral-500 transition-transform duration-200 ${
                      !sessionsExpanded ? '-rotate-90' : ''
                    }`}
                  />
                  <span>已连接设备</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenAddDevice}
                  className="w-5 h-5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
                  title="新建设备连接"
                >
                  <Plus size={12} />
                </button>
              </div>

              {sessionsExpanded && (
                <div className="space-y-1 pt-0.5">
                  {uniqueSessions.length === 0 ? (
                    <div className="text-[11.5px] text-neutral-500 py-4 px-3 text-center rounded-xl bg-white/[0.02] border border-dashed border-white/[0.06]">
                      暂无设备，点击右上角「+」添加
                    </div>
                  ) : (
                    uniqueSessions.map((session) => {
                      const isSelected = selectedSession?.id === session.id;
                      const isConnected = session.is_connected;
                      const serial =
                        session.active_serial || session.connections[0]?.serial || '';
                      const battery = batteries[serial];
                      const subText =
                        session.model || serial || session.connections[0]?.host || 'USB/Network';

                      return (
                        <div
                          key={session.id}
                          onClick={() => onSelectSession(session)}
                          className={`group relative flex items-center justify-between p-2 rounded-xl transition-all duration-150 cursor-pointer border ${
                            isSelected
                              ? 'bg-blue-500/[0.12] border-blue-500/30 text-blue-400 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500/20'
                              : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.05] hover:border-white/[0.1] text-neutral-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* 设备图标容器与呼吸状态指示 */}
                            <div
                              className={`relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-white/[0.06] text-neutral-400 group-hover:text-neutral-200'
                              }`}
                            >
                              <Smartphone size={16} />
                              {/* 状态圆点：已连接翠绿呼吸，待命灰色 */}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#161618] ${
                                  isConnected
                                    ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                                    : 'bg-neutral-600'
                                }`}
                              >
                                {isConnected && (
                                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                                )}
                              </span>
                            </div>

                            {/* 设备文字详情 */}
                            <div className="flex flex-col min-w-0 flex-1 pr-1">
                              <span
                                className={`text-[12.5px] font-medium truncate leading-tight ${
                                  isSelected ? 'text-white font-semibold' : 'text-neutral-200'
                                }`}
                              >
                                {session.name || 'Android Device'}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                                <span className="text-[10.5px] text-neutral-400 truncate font-mono">
                                  {subText}
                                </span>
                                {isConnected && battery !== null && battery !== undefined && (
                                  <>
                                    <span className="text-neutral-600 text-[10px]">·</span>
                                    {renderBatteryIndicator(battery)}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 悬停浮现快捷操作区 */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onReconnectSession) onReconnectSession(session.id);
                              }}
                              className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                                isConnected
                                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30'
                                  : 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30'
                              }`}
                              title={isConnected ? '断开投屏会话' : '启动投屏会话'}
                            >
                              {isConnected ? (
                                <Square size={8} fill="currentColor" />
                              ) : (
                                <Play size={9} fill="currentColor" className="ml-0.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onEditSession) onEditSession(session);
                              }}
                              className="w-6 h-6 rounded-md bg-white/[0.08] hover:bg-white/[0.16] text-neutral-300 hover:text-white border border-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
                              title="编辑会话与参数"
                            >
                              <MoreHorizontal size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* SECTION 2: 虚拟设备 (AVD 模拟器) */}
            <div className="space-y-1 pt-1 border-t border-white/[0.06]">
              <div className="flex items-center justify-between px-2 py-1">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 hover:text-neutral-200 tracking-wider uppercase transition-colors cursor-pointer"
                  onClick={handleToggleVirtualDevices}
                >
                  <ChevronDown
                    size={12}
                    className={`text-neutral-500 transition-transform duration-200 ${
                      !virtualDevicesExpanded ? '-rotate-90' : ''
                    }`}
                  />
                  <span>虚拟设备 AVD</span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    ({avds.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onOpenVirtualDevices}
                  className="w-5 h-5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
                  title="管理与创建 AVD"
                >
                  <Plus size={12} />
                </button>
              </div>

              {virtualDevicesExpanded && (
                <div className="space-y-1 pt-0.5">
                  {loadingAvds ? (
                    <div className="text-[11px] text-neutral-400 py-3 px-2 text-center flex items-center justify-center gap-2">
                      <Loader2 size={13} className="animate-spin text-blue-400" />
                      <span>正在检测模拟器...</span>
                    </div>
                  ) : avds.length === 0 ? (
                    <div className="text-[11.5px] text-neutral-500 py-3 px-3 text-center rounded-xl bg-white/[0.02] border border-white/[0.05]">
                      未发现 AVD 模拟器
                    </div>
                  ) : (
                    avds.map((avd) => (
                      <div
                        key={avd.name}
                        className="group relative flex items-center justify-between p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.1] transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="relative w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                            <Cpu size={15} />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-[#161618] ${
                                avd.is_running
                                  ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]'
                                  : 'bg-neutral-600'
                              }`}
                            />
                          </div>

                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[12.5px] font-medium text-neutral-200 truncate leading-tight">
                              {avd.name.match(/^\d+$/) ? `Android ${avd.name}` : avd.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/[0.06] text-neutral-400 font-mono border border-white/[0.05]">
                                {avd.target ? avd.target.replace('android-', 'API ') : avd.abi}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleStartAvd(avd.name, e)}
                            disabled={startingAvd === avd.name}
                            className={`w-6 h-6 rounded-md bg-blue-500/15 hover:bg-blue-500/25 active:bg-blue-500/35 text-blue-400 border border-blue-500/30 flex items-center justify-center transition-colors cursor-pointer ${
                              startingAvd === avd.name ? '!opacity-100' : ''
                            }`}
                            title="启动模拟器"
                          >
                            {startingAvd === avd.name ? (
                              <Loader2 size={12} className="animate-spin text-emerald-400" />
                            ) : (
                              <Play size={9} fill="currentColor" className="ml-0.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={onOpenVirtualDevices}
                            className="w-6 h-6 rounded-md bg-white/[0.08] hover:bg-white/[0.16] text-neutral-300 hover:text-white border border-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
                            title="配置虚拟设备"
                          >
                            <Sliders size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  <div
                    onClick={onOpenVirtualDevices}
                    className="flex items-center justify-between px-2.5 py-1.5 text-[11px] text-neutral-400 hover:text-blue-400 hover:bg-white/[0.03] rounded-lg transition-colors cursor-pointer"
                  >
                    <span>管理虚拟设备...</span>
                    <ChevronRight size={11} className="opacity-60" />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* 折叠 Rail 模式：紧凑精巧图标列表 */
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              type="button"
              onClick={onOpenAddDevice}
              className="w-9 h-9 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
              title="添加新设备"
            >
              <Plus size={16} />
            </button>

            <div className="w-6 h-[1px] bg-white/[0.08] my-1" />

            {uniqueSessions.map((session) => {
              const isSelected = selectedSession?.id === session.id;
              const isConnected = session.is_connected;
              const serial =
                session.active_serial || session.connections[0]?.serial || '';
              const battery = batteries[serial];

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSelectSession(session)}
                  className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-sm shadow-blue-500/15 ring-1 ring-blue-500/30'
                      : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.06] text-neutral-400 hover:text-white'
                  }`}
                  title={`${session.name || 'Android Device'} (${
                    isConnected
                      ? battery !== null && battery !== undefined
                        ? `已连接 · ${battery}%`
                        : '已连接'
                      : '待命/未连接'
                  })`}
                >
                  <Smartphone size={18} />
                  <span
                    className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-[#161618] ${
                      isConnected
                        ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]'
                        : 'bg-neutral-600'
                    }`}
                  >
                    {isConnected && (
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部工具栏与分组选择 */}
      <div className="p-2 border-t border-white/[0.06] bg-white/[0.02]">
        {!isCollapsed ? (
          <div className="flex items-center gap-1.5">
            {/* 分组选择弹出菜单 */}
            <div className="relative flex-1 min-w-0" ref={groupMenuRef}>
              <button
                type="button"
                onClick={() => setShowGroupMenu(!showGroupMenu)}
                className="h-7 w-full px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-[11px] font-medium text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer border border-white/[0.06]"
                title="选择设备分组"
              >
                <Home size={12} className="text-blue-400 shrink-0" />
                <span className="truncate">{selectedGroupName}</span>
                <ChevronDown size={10} className="shrink-0 ml-auto opacity-50" />
              </button>

              {showGroupMenu && (
                <div className="absolute bottom-full left-0 mb-1.5 w-44 bg-[#202024]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1 z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroupName('首页');
                      setShowGroupMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                      selectedGroupName === '首页'
                        ? 'bg-blue-600 text-white'
                        : 'text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    首页
                  </button>
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupName(g.name);
                        setShowGroupMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        selectedGroupName === g.name
                          ? 'bg-blue-600 text-white'
                          : 'text-neutral-300 hover:bg-white/10'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 设备发现入口 */}
            {onOpenDiscovery && (
              <button
                type="button"
                onClick={onOpenDiscovery}
                className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-white/[0.05]"
                title="设备发现 (mDNS / USB / 局域网扫描)"
              >
                <Radio size={13} />
              </button>
            )}

            {/* 诊断日志 */}
            {onOpenDiagnostics && (
              <button
                type="button"
                onClick={onOpenDiagnostics}
                className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-white/[0.05]"
                title="诊断与日志 (SDLLog / Logcat)"
              >
                <Terminal size={13} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 items-center">
            {onOpenDiscovery && (
              <button
                type="button"
                onClick={onOpenDiscovery}
                className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/[0.05]"
                title="设备发现"
              >
                <Radio size={14} />
              </button>
            )}
            {onOpenDiagnostics && (
              <button
                type="button"
                onClick={onOpenDiagnostics}
                className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/[0.05]"
                title="诊断日志"
              >
                <Terminal size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 侧边微型浮动收缩把手 */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="sidebar-toggle-handle"
        title={isCollapsed ? '展开会话列表' : '收起会话列表'}
      >
        {isCollapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
      </button>
    </aside>
  );
};
