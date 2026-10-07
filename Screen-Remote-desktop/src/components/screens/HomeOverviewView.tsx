import React from 'react';
import { DeviceSession, AppSection } from '../../types';
import {
  Monitor,
  Smartphone,
  Info,
  Wrench,
  Layers,
  Folder,
  Play,
  Terminal,
  Settings,
  BatteryCharging,
  Wifi,
  Usb,
  Plus,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';

interface HomeOverviewViewProps {
  selectedSession: DeviceSession | null;
  sessions: DeviceSession[];
  onSelectSession: (session: DeviceSession) => void;
  onNavigateSection: (section: AppSection) => void;
  onStartScreenSession: (sessionId: string) => void;
  onOpenAddDevice: () => void;
  onOpenAdbShell: () => void;
  onEditSession?: (session: DeviceSession) => void;
  batteryLevel: number | null;
}

export const HomeOverviewView: React.FC<HomeOverviewViewProps> = ({
  selectedSession,
  sessions,
  onSelectSession,
  onNavigateSection,
  onStartScreenSession,
  onOpenAddDevice,
  onOpenAdbShell,
  onEditSession,
  batteryLevel,
}) => {
  const isConnected = selectedSession?.is_connected ?? false;
  const isWireless =
    selectedSession?.active_transport === 'TCP/IP' ||
    selectedSession?.active_transport === 'mDNS';

  return (
    <div className="screen-workspace-scroll">
      <div className="screen-workspace-centered flex flex-col gap-6 max-w-[940px] pb-12">
        {/* TOP: Hero Card for Selected Device */}
        {selectedSession ? (
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] p-6 shadow-xl">
            {/* Ambient colorful glow behind device icon */}
            <div
              className="absolute -top-16 -left-16 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-20"
              style={{ backgroundColor: selectedSession.accent || 'var(--cds-clay)' }}
            />

            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 z-10">
              {/* Left Info Column */}
              <div className="flex items-center gap-4.5 min-w-0">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-black/20 border border-white/10"
                  style={{
                    background: `linear-gradient(135deg, var(--cds-clay), #e08264)`,
                  }}
                >
                  <Smartphone size={32} />
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight truncate">
                      {selectedSession.name}
                    </h1>
                    {/* Status Badge */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        isConnected
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                          : 'bg-neutral-500/15 text-neutral-400 border-neutral-500/20'
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          isConnected
                            ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]'
                            : 'bg-neutral-400'
                        }`}
                      />
                      <span>{isConnected ? '已建立 ADB 调试' : '离线 / 待连接'}</span>
                    </div>

                    {/* Transport Badge */}
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-black/5 dark:bg-white/[0.06] text-[var(--text-secondary)] font-mono border border-[var(--border-card)]">
                      {isWireless ? <Wifi size={11} /> : <Usb size={11} />}
                      <span>{selectedSession.active_transport || 'TCP/IP'}</span>
                    </div>

                    {/* Battery Badge */}
                    {batteryLevel !== null && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-mono border border-emerald-500/20">
                        <BatteryCharging size={11} />
                        <span>{batteryLevel}%</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] font-mono truncate mt-1">
                    型号: {selectedSession.model || 'Android'} · 序列号:{' '}
                    {selectedSession.active_serial || selectedSession.connections[0]?.serial || selectedSession.connections[0]?.host || '未解析'}
                  </p>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onStartScreenSession(selectedSession.id);
                    onNavigateSection('screens');
                  }}
                  className="btn btn-primary px-4 py-2 text-xs font-semibold shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-2"
                >
                  <Play size={14} fill="currentColor" />
                  <span>启动实时投屏</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateSection('deviceInfo')}
                  className="btn btn-secondary px-3.5 py-2 text-xs font-medium cursor-pointer flex items-center gap-1.5"
                  title="查看完整硬件参数"
                >
                  <Info size={14} />
                  <span>硬件参数</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateSection('utilities')}
                  className="btn btn-secondary px-3.5 py-2 text-xs font-medium cursor-pointer flex items-center gap-1.5"
                  title="屏幕优化与系统工具"
                >
                  <Wrench size={14} />
                  <span>实用工具</span>
                </button>

                {onEditSession && (
                  <button
                    type="button"
                    onClick={() => onEditSession(selectedSession)}
                    className="btn btn-secondary px-3.5 py-2 text-xs font-medium cursor-pointer flex items-center gap-1.5"
                    title="编辑会话与投屏参数"
                  >
                    <Settings size={14} />
                    <span>配置会话</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="app-card flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="app-icon-tile bg-gradient-to-br from-blue-500 to-indigo-600">
                <Smartphone size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">未选择任何设备</h2>
                <p className="text-xs text-[#98989f]">
                  请从左侧列表选择一个会话，或点击右侧按钮添加新设备。
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenAddDevice}
              className="btn btn-primary px-4 py-2 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>添加设备会话</span>
            </button>
          </div>
        )}

        {/* SECTION 2: 6 Core Capability Matrix Cards */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              核心功能与控制中心
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Card 1: 屏幕投屏 */}
            <div
              onClick={() => onNavigateSection('screens')}
              className="app-card app-card-interactive flex flex-col justify-between p-4.5 group"
            >
              <div className="flex items-start justify-between">
                <div className="app-icon-tile bg-gradient-to-br from-[#0a84ff] to-[#0071e3]">
                  <Monitor size={20} />
                </div>
                <ChevronRight size={14} className="text-neutral-500 group-hover:text-[var(--text-primary)] transition-colors" />
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">远程屏幕投屏</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  原生 Scrcpy 超低延迟传输，支持键鼠触控、悬浮控制器与独立大窗
                </p>
              </div>
            </div>

            {/* Card 2: 设备信息 */}
            <div
              onClick={() => onNavigateSection('deviceInfo')}
              className="app-card app-card-interactive flex flex-col justify-between p-4.5 group"
            >
              <div className="flex items-start justify-between">
                <div className="app-icon-tile bg-gradient-to-br from-[#5e5ce6] to-[#4745d4]">
                  <Info size={20} />
                </div>
                <ChevronRight size={14} className="text-neutral-500 group-hover:text-[var(--text-primary)] transition-colors" />
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">硬件与系统详情</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  SoC 平台、分辨率、DPI、电池健康度、内存占用及各网卡 IP 地址
                </p>
              </div>
            </div>

            {/* Card 3: 实用工具 */}
            <div
              onClick={() => onNavigateSection('utilities')}
              className="app-card app-card-interactive flex flex-col justify-between p-4.5 group"
            >
              <div className="flex items-start justify-between">
                <div className="app-icon-tile bg-gradient-to-br from-[#ff9f0a] to-[#d68000]">
                  <Wrench size={20} />
                </div>
                <ChevronRight size={14} className="text-neutral-500 group-hover:text-[var(--text-primary)] transition-colors" />
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">系统优化与工具</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  动态 DPI 与分辨率切换、动画缩放、屏幕常亮及高级重启模式
                </p>
              </div>
            </div>

            {/* Card 4: 应用管理 */}
            <div
              onClick={() => onNavigateSection('apps')}
              className="app-card app-card-interactive flex flex-col justify-between p-4.5 group"
            >
              <div className="flex items-start justify-between">
                <div className="app-icon-tile bg-gradient-to-br from-[#30d158] to-[#25a244]">
                  <Layers size={20} />
                </div>
                <ChevronRight size={14} className="text-neutral-500 group-hover:text-[var(--text-primary)] transition-colors" />
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">应用程序管理器</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  查看已安装用户与系统应用、拖拽安装 APK、一键提取或停用冻结
                </p>
              </div>
            </div>

            {/* Card 5: 文件管理 */}
            <div
              onClick={() => onNavigateSection('files')}
              className="app-card app-card-interactive flex flex-col justify-between p-4.5 group"
            >
              <div className="flex items-start justify-between">
                <div className="app-icon-tile bg-gradient-to-br from-[#64d2ff] to-[#0a84ff]">
                  <Folder size={20} />
                </div>
                <ChevronRight size={14} className="text-neutral-500 group-hover:text-[var(--text-primary)] transition-colors" />
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">文件系统浏览器</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  macOS Finder 式分栏浏览设备存储，支持快速文件上传与批量拉取
                </p>
              </div>
            </div>

            {/* Card 6: 终端与控制 */}
            <div
              onClick={onOpenAdbShell}
              className="app-card app-card-interactive flex flex-col justify-between p-4.5 group"
            >
              <div className="flex items-start justify-between">
                <div className="app-icon-tile bg-gradient-to-br from-[#bf5af2] to-[#9934c9]">
                  <Terminal size={20} />
                </div>
                <ChevronRight size={14} className="text-neutral-500 group-hover:text-[var(--text-primary)] transition-colors" />
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">ADB 交互控制台</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  直接在终端中运行调试指令、捕获 Logcat、执行自定义自动化脚本
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: All Configured Device Sessions Strip */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              全部设备会话 ({sessions.length})
            </span>
            <button
              type="button"
              onClick={onOpenAddDevice}
              className="text-xs text-[var(--cds-clay)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <Plus size={12} />
              <span>添加新设备</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {sessions.map((s) => {
              const isCurr = selectedSession?.id === s.id;
              const isConn = s.is_connected;
              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSession(s)}
                  className={`app-card app-card-interactive p-4 flex items-center justify-between ${
                    isCurr ? 'ring-1 ring-[var(--cds-clay)] bg-[var(--cds-clay-subtle)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: s.accent || 'var(--cds-clay)' }}
                    >
                      <Smartphone size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {s.name}
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)] truncate">
                        {isConn ? '在线 · 可投屏' : '离线'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartScreenSession(s.id);
                        onNavigateSection('screens');
                      }}
                      className="w-7 h-7 rounded-full bg-white/[0.08] dark:bg-white/[0.08] hover:bg-white/[0.2] flex items-center justify-center text-[var(--text-primary)] cursor-pointer transition-colors"
                      title="快速投屏"
                    >
                      <Play size={10} fill="currentColor" className="text-[var(--cds-clay)] ml-0.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 4: Engine Readiness Status Bar */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] flex items-center justify-between flex-wrap gap-3 text-xs text-[var(--text-secondary)] shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>ADB 调试桥: <strong className="text-[var(--text-primary)] font-medium">就绪</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>Scrcpy 协议服务: <strong className="text-[var(--text-primary)] font-medium">v4.1 就绪</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>WebCodecs 硬件加速: <strong className="text-[var(--text-primary)] font-medium">已激活</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>虚拟设备 (AVD): <strong className="text-[var(--text-primary)] font-medium">已支持</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
