import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { DeviceSession, AppSettings } from '../../types';
import { ScreenCanvas } from '../ScreenCanvas';
import {
  ExternalLink,
  ArrowDownToLine,
  Smartphone,
  Layers,
  X,
  Play,
  Maximize2,
  LayoutGrid,
  Radio,
} from 'lucide-react';

interface ActiveScreenTab {
  id: string;
  title: string;
  isVirtualDisplay: boolean;
  startApp?: string;
}

interface ScreensViewProps {
  session: DeviceSession;
  connectedSessions?: DeviceSession[];
  battery: number | null;
  settings: AppSettings;
  onOpenSettings: () => void;
  onStartSession?: (sessionId: string) => void;
  // External triggers for launching virtual display apps
  activeVirtualTabs?: ActiveScreenTab[];
  onCloseVirtualTab?: (id: string) => void;
  detachedScreens?: Set<string>;
  onPopOutScreen?: (screenId: string, title?: string) => void;
  onDockScreen?: (screenId: string) => void;
}

export const ScreensView: React.FC<ScreensViewProps> = ({
  session,
  activeVirtualTabs = [],
  onCloseVirtualTab,
  detachedScreens: externalDetachedScreens,
  onPopOutScreen,
  onDockScreen,
  onStartSession,
}) => {
  const [localDetachedScreens, setLocalDetachedScreens] = useState<Set<string>>(new Set());
  const [activeTabId, setActiveTabId] = useState<string>('primary');
  const [viewMode, setViewMode] = useState<'tab' | 'grid'>('tab');

  const detachedScreens = externalDetachedScreens ?? localDetachedScreens;
  const serial = session.active_serial || session.connections[0]?.serial || '';

  // Combine primary screen tab and any active virtual display tabs
  const tabs: ActiveScreenTab[] = useMemo(
    () => [
      {
        id: 'primary',
        title: session.name ? `${session.name} · 主屏幕` : '主屏幕',
        isVirtualDisplay: false,
      },
      ...activeVirtualTabs,
    ],
    [session.name, activeVirtualTabs]
  );

  // Auto-correct active tab if previous active tab was closed
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId('primary');
    }
  }, [tabs, activeTabId]);

  // Pop out screen into an independent lightweight child window
  const handlePopOut = useCallback(
    async (tab: ActiveScreenTab) => {
      if (onPopOutScreen) {
        onPopOutScreen(tab.id, `${session.name || 'Android'} - ${tab.title}`);
        return;
      }

      const isVirtual = tab.isVirtualDisplay;
      const width = isVirtual ? 1200 : 1080;
      const height = isVirtual ? 800 : 2400;

      try {
        await invoke('open_detached_screen_window', {
          sessionId: session.id,
          screenId: tab.id,
          title: `${session.name || 'Android'} - ${tab.title}`,
          width,
          height,
        });

        setLocalDetachedScreens((prev) => {
          const next = new Set(prev);
          next.add(tab.id);
          return next;
        });
      } catch (err) {
        console.error('Failed to open detached screen window:', err);
      }
    },
    [session.id, session.name, onPopOutScreen]
  );

  // Dock detached screen back to the main window
  const handleDock = useCallback(
    async (screenId: string) => {
      if (onDockScreen) {
        onDockScreen(screenId);
        return;
      }

      try {
        await invoke('close_detached_screen_window', {
          sessionId: session.id,
          screenId,
        });
      } catch (err) {
        console.error('Failed to close detached screen window:', err);
      }

      setLocalDetachedScreens((prev) => {
        const next = new Set(prev);
        next.delete(screenId);
        return next;
      });
    },
    [session.id, onDockScreen]
  );

  // Listen for detached window close events to automatically restore inline display
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    listen<{ session_id: string; screen_id: string }>('detached_screen_closed', (event) => {
      const { session_id, screen_id } = event.payload;
      if (session_id === session.id || session_id.startsWith(session.id)) {
        setLocalDetachedScreens((prev) => {
          if (!prev.has(screen_id)) return prev;
          const next = new Set(prev);
          next.delete(screen_id);
          return next;
        });
      }
    })
      .then((fn) => {
        if (!mounted) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch((err) => {
        console.error('Failed to register detached_screen_closed listener:', err);
      });

    return () => {
      mounted = false;
      if (unlisten) unlisten();
    };
  }, [session.id]);

  // Detached placeholder UI for tabs running in separate windows
  const renderDetachedPlaceholder = (tab: ActiveScreenTab) => (
    <div className="w-full h-full flex items-center justify-center p-6 select-none">
      <div className="max-w-md w-full p-8 rounded-3xl backdrop-blur-2xl bg-neutral-900/60 border border-white/10 shadow-2xl flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 mb-4 shadow-lg shadow-blue-500/10">
          <ExternalLink size={26} />
        </div>
        <h2 className="text-base font-semibold text-white tracking-tight mb-1.5">
          【{tab.title}】正在独立大窗中运行
        </h2>
        <p className="text-xs text-neutral-400 leading-relaxed max-w-sm mb-6">
          该屏幕已分离至独立窗口。您可以自由拖拽至副屏或随时点击收回主工作区。
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handlePopOut(tab)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <ExternalLink size={13} />
            <span>切换至该窗口</span>
          </button>
          <button
            type="button"
            onClick={() => handleDock(tab.id)}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-neutral-200 text-xs font-medium flex items-center gap-1.5 border border-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowDownToLine size={13} />
            <span>收回主窗口 (Dock)</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col w-full h-full bg-[#121214] overflow-hidden relative select-none">
      {/* 1. 多屏幕 / 虚拟屏标签页切换栏 (仅当存在多个屏幕时展示) */}
      {session.is_connected && tabs.length > 1 && (
        <div className="shrink-0 h-11 px-4 flex items-center justify-between border-b border-white/[0.08] bg-neutral-900/60 backdrop-blur-md z-30 select-none">
          {/* 标签页列表 */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {tabs.map((tab) => {
              const isActive = activeTabId === tab.id;
              const isDetached = detachedScreens.has(tab.id);
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-white/15 text-white font-semibold border-white/20 shadow-sm'
                      : 'bg-transparent text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] border-transparent'
                  }`}
                >
                  {tab.isVirtualDisplay ? (
                    <Layers size={13} className={isActive ? 'text-blue-400' : 'text-neutral-500'} />
                  ) : (
                    <Smartphone size={13} className={isActive ? 'text-emerald-400' : 'text-neutral-500'} />
                  )}
                  <span className="truncate max-w-[130px]">{tab.title}</span>

                  {isDetached && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-normal">
                      独立大窗
                    </span>
                  )}

                  {/* 弹出独立大窗快捷键 */}
                  {!isDetached && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePopOut(tab);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:bg-white/15 p-1 rounded-md text-neutral-400 hover:text-white transition-all cursor-pointer"
                      title="分离至独立大窗"
                    >
                      <ExternalLink size={11} />
                    </button>
                  )}

                  {/* 虚拟屏关闭按钮 */}
                  {tab.id !== 'primary' && onCloseVirtualTab && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseVirtualTab(tab.id);
                        if (activeTabId === tab.id) {
                          setActiveTabId('primary');
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-400 p-1 rounded-md text-neutral-400 transition-all cursor-pointer"
                      title="关闭虚拟屏"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 视图模式切换 (单屏专注 / 平铺并排) */}
          <div className="flex items-center gap-1 bg-white/[0.05] p-0.5 rounded-lg border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setViewMode('tab')}
              className={`px-2 py-1 rounded-md text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'tab' ? 'bg-blue-600 text-white shadow-sm font-medium' : 'text-neutral-400 hover:text-white'
              }`}
              title="单屏专注模式"
            >
              <Maximize2 size={11} />
              <span>单屏</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2 py-1 rounded-md text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm font-medium' : 'text-neutral-400 hover:text-white'
              }`}
              title="平铺多屏模式"
            >
              <LayoutGrid size={11} />
              <span>平铺</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. 屏幕展示核心容器 */}
      <div className="flex-1 w-full h-full overflow-hidden relative">
        {session.is_connected ? (
          tabs.length > 1 && viewMode === 'grid' ? (
            // 平铺模式 (多屏幕并排)
            <div className="w-full h-full flex flex-row flex-wrap items-center justify-center gap-6 p-4 overflow-auto">
              {tabs.map((tab) => {
                const isDetached = detachedScreens.has(tab.id);
                if (isDetached) {
                  return (
                    <div key={tab.id} className="shrink-0 max-h-full">
                      {renderDetachedPlaceholder(tab)}
                    </div>
                  );
                }
                return (
                  <div key={tab.id} className="shrink-0 h-full max-h-full flex items-center justify-center">
                    <ScreenCanvas
                      sessionId={session.id}
                      serial={serial}
                      sessionTitle={tab.title}
                      isVirtualDisplay={tab.isVirtualDisplay}
                      startApp={tab.startApp}
                      onClose={
                        tab.id !== 'primary' && onCloseVirtualTab
                          ? () => onCloseVirtualTab(tab.id)
                          : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            // 单屏模式 (单屏幕或标签切换激活屏，充满视界自适应居中)
            (() => {
              const currentTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
              const isDetached = detachedScreens.has(currentTab.id);
              if (isDetached) {
                return renderDetachedPlaceholder(currentTab);
              }
              return (
                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                  <ScreenCanvas
                    sessionId={session.id}
                    serial={serial}
                    sessionTitle={currentTab.title}
                    isVirtualDisplay={currentTab.isVirtualDisplay}
                    startApp={currentTab.startApp}
                    onClose={
                      currentTab.id !== 'primary' && onCloseVirtualTab
                        ? () => onCloseVirtualTab(currentTab.id)
                        : undefined
                    }
                  />
                </div>
              );
            })()
          )
        ) : (
          // 3. 干净利落、极简现代的空状态 (Empty State / No screen active)
          <div className="w-full h-full flex items-center justify-center p-6 relative overflow-hidden select-none">
            {/* 背景柔和微光 */}
            <div className="absolute w-[500px] h-[500px] bg-blue-600/[0.04] rounded-full blur-3xl pointer-events-none" />

            {/* 极简玻璃卡片 */}
            <div className="relative flex flex-col items-center max-w-sm w-full p-8 rounded-3xl backdrop-blur-2xl bg-neutral-900/60 border border-white/10 shadow-2xl text-center">
              {/* 呼吸感设备图标 */}
              <div className="relative mb-6">
                <div className="absolute -inset-3 bg-blue-500/15 rounded-full blur-lg animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/10">
                  <Smartphone size={32} strokeWidth={1.75} />
                </div>
              </div>

              <h2 className="text-base font-bold text-white tracking-tight mb-2">
                未开启屏幕投屏
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed mb-6">
                设备 <span className="text-neutral-200 font-medium">{session.name || 'Android 设备'}</span> 处于待机状态，点击下方按钮立即建立低延迟硬件加速投屏。
              </p>

              {/* 一键启动投屏按钮 */}
              <button
                type="button"
                onClick={() => {
                  if (onStartSession) {
                    onStartSession(session.id);
                  }
                }}
                className="w-full py-2.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Play size={14} fill="currentColor" />
                <span>立即启动投屏</span>
              </button>

              {/* 底部设备设备序列号信息 */}
              <div className="mt-5 flex items-center gap-1.5 text-[10px] text-neutral-500 font-mono">
                <Radio size={11} className="text-neutral-500" />
                <span>{serial || '未分配设备序列号'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreensView;
