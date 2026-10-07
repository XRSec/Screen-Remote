import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AppSection } from '../types';
import {
  Home,
  Monitor,
  Info,
  Wrench,
  Folder,
  Layers,
  Activity,
  ArrowLeftRight,
  Bell,
  MessageSquare,
  Image,
  RotateCw,
  Settings,
  Smartphone
} from 'lucide-react';

interface TopBarProps {
  currentSection: AppSection;
  onSelectSection: (section: AppSection) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenSettings: () => void;
  hasSelectedDevice: boolean;
  selectedDeviceName?: string;
  isDeviceConnected?: boolean;
}

interface SectionItem {
  id: AppSection;
  title: string;
  tooltip: string;
  icon: React.ReactNode;
}

const SECTIONS: SectionItem[] = [
  { id: 'home', title: '概览', tooltip: '主页与设备概览', icon: <Home size={13.5} /> },
  { id: 'screens', title: '屏幕', tooltip: '实时屏幕投屏', icon: <Monitor size={13.5} /> },
  { id: 'deviceInfo', title: '信息', tooltip: '硬件与系统信息', icon: <Info size={13.5} /> },
  { id: 'utilities', title: '工具', tooltip: '实用工具箱', icon: <Wrench size={13.5} /> },
  { id: 'apps', title: '应用', tooltip: '应用程序管理', icon: <Layers size={13.5} /> },
  { id: 'files', title: '文件', tooltip: '文件系统浏览器', icon: <Folder size={13.5} /> },
  { id: 'processes', title: '进程', tooltip: '进程管理器', icon: <Activity size={13.5} /> },
  { id: 'portForward', title: '端口', tooltip: '端口转发规则', icon: <ArrowLeftRight size={13.5} /> },
  { id: 'notifications', title: '通知', tooltip: '设备通知推送', icon: <Bell size={13.5} /> },
  { id: 'messages', title: '消息', tooltip: '短信与即时消息', icon: <MessageSquare size={13.5} /> },
  { id: 'photos', title: '相册', tooltip: '媒体相册浏览器', icon: <Image size={13.5} /> },
];

const REFRESHABLE_SECTIONS = [
  'home',
  'files',
  'apps',
  'processes',
  'deviceInfo',
  'notifications',
  'messages',
  'photos',
  'portForward',
];

export const TopBar: React.FC<TopBarProps> = ({
  currentSection,
  onSelectSection,
  onRefresh,
  isRefreshing,
  onOpenSettings,
  hasSelectedDevice,
  selectedDeviceName,
  isDeviceConnected,
}) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      e.button === 0 &&
      !(e.target as HTMLElement).closest('button, input, select, [data-no-drag]')
    ) {
      getCurrentWindow().startDragging();
    }
  };

  const isRefreshable = REFRESHABLE_SECTIONS.includes(currentSection) && hasSelectedDevice;

  return (
    <header
      className="h-12 min-h-12 px-3.5 flex items-center justify-between border-b border-white/[0.08] bg-[#161618] dark:bg-[#161618] w-full select-none shrink-0 gap-3 relative z-30"
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
    >
      {/* 左侧：当前设备状态指示药丸 */}
      <div className="flex items-center shrink-0 min-w-0" data-no-drag>
        {selectedDeviceName ? (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] backdrop-blur-md shadow-sm transition-all"
            title={`当前设备: ${selectedDeviceName} (${isDeviceConnected ? '已连接' : '待命'})`}
          >
            <Smartphone size={13} className="text-neutral-400 shrink-0" />
            <div className="relative flex items-center justify-center shrink-0">
              <span
                className={`w-2 h-2 rounded-full ${
                  isDeviceConnected
                    ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                    : 'bg-neutral-500'
                }`}
              />
              {isDeviceConnected && (
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-60" />
              )}
            </div>
            <span className="text-[12px] font-semibold text-neutral-100 truncate max-w-[130px]">
              {selectedDeviceName}
            </span>
            <span className="text-[10px] font-mono text-neutral-400">
              {isDeviceConnected ? '在线' : '离线'}
            </span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.05] text-neutral-400 text-[11.5px]">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
            <span>未连接设备</span>
          </div>
        )}
      </div>

      {/* 中间：现代分段控制滑动标签栏 (Segmented Track) */}
      <div className="flex-1 flex items-center justify-center min-w-0 overflow-x-auto no-scrollbar py-0.5">
        <div
          className="inline-flex items-center p-1 rounded-xl bg-black/40 border border-white/[0.08] backdrop-blur-md shadow-inner gap-0.5"
          data-no-drag
        >
          {SECTIONS.map((sec) => {
            const isSelected = currentSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                data-no-drag
                onClick={() => onSelectSection(sec.id)}
                className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] transition-all duration-150 select-none whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/35 shadow-sm shadow-blue-500/10'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] border border-transparent font-medium'
                }`}
                title={sec.tooltip}
              >
                <span
                  className={`shrink-0 transition-colors ${
                    isSelected ? 'text-blue-400' : 'text-neutral-400'
                  }`}
                >
                  {sec.icon}
                </span>
                <span>{sec.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 右侧：操作按钮组 (刷新与偏好设置) */}
      <div className="flex items-center gap-1.5 shrink-0" data-no-drag>
        {isRefreshable && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.08] text-neutral-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40"
            title="刷新当前页面数据"
          >
            <RotateCw
              size={13.5}
              className={`transition-transform duration-300 ${
                isRefreshing ? 'animate-spin text-blue-400' : ''
              }`}
            />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.08] text-neutral-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
          title="全局偏好设置"
        >
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
};
