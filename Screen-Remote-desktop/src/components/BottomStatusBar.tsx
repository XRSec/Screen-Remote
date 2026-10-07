import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DeviceSession } from '../types';
import {
  Terminal,
  Activity,
  Wifi,
  Usb,
  Radio
} from 'lucide-react';

interface BottomStatusBarProps {
  selectedSession: DeviceSession | null;
  batteryLevel: number | null;
  onOpenAdbShell?: () => void;
  onOpenDiagnostics?: () => void;
  onOpenSettings?: () => void;
}

export const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
  selectedSession,
  batteryLevel,
  onOpenAdbShell,
  onOpenDiagnostics,
  onOpenSettings,
}) => {
  const [adbVersion, setAdbVersion] = useState<string>('就绪');
  const [isAdbOk, setIsAdbOk] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    invoke<string>('get_adb_version', { customPath: null })
      .then((ver) => {
        if (!mounted) return;
        const firstLine = ver.split('\n')[0] || '';
        const match = firstLine.match(/version\s+([\d.]+)/i);
        setAdbVersion(match ? `v${match[1]}` : '已就绪');
        setIsAdbOk(true);
      })
      .catch(() => {
        if (!mounted) return;
        setAdbVersion('异常');
        setIsAdbOk(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const isConnected = selectedSession?.is_connected ?? false;
  const isWireless =
    selectedSession?.active_transport === 'TCP/IP' ||
    selectedSession?.active_transport === 'mDNS';

  return (
    <footer className="h-7 min-h-[28px] max-h-[28px] px-3 bg-[#111318] border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#94a3b8] select-none shrink-0 z-30 font-mono">
      {/* Left: Engine & Daemon Status Indicators */}
      <div className="flex items-center gap-3.5">
        {/* 1. ADB Daemon */}
        <div
          className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
          onClick={onOpenDiagnostics}
          title="ADB 守护进程状态 (点击查看诊断)"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isAdbOk
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]'
            }`}
          />
          <span className="text-white/80 font-semibold">ADB</span>
          <span className="text-[#64748b]">{adbVersion}</span>
          <span className="text-[#475569]">:5037</span>
        </div>

        <span className="text-white/10">|</span>

        {/* 2. Scrcpy Stream Engine */}
        <div
          className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
          onClick={onOpenSettings}
          title="Scrcpy 视频解码引擎配置"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
          <span className="text-white/80 font-semibold">Scrcpy</span>
          <span className="text-[#64748b]">v3.1</span>
          <span className="px-1 py-[1px] text-[9.5px] rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 font-sans">
            WebCodecs 硬解
          </span>
        </div>

        <span className="text-white/10">|</span>

        {/* 3. Active Link & Device Status */}
        {selectedSession ? (
          <div className="flex items-center gap-1.5">
            {isWireless ? (
              <Wifi size={12} className="text-blue-400" />
            ) : (
              <Usb size={12} className="text-blue-400" />
            )}
            <span className="text-white/90 truncate max-w-[140px] font-sans font-medium">
              {selectedSession.name}
            </span>
            <span
              className={`px-1 py-[1px] text-[9.5px] rounded font-sans ${
                isConnected
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  : 'bg-neutral-800 text-neutral-400 border border-white/5'
              }`}
            >
              {isConnected ? '在线调试' : '待机'}
            </span>
            {batteryLevel !== null && (
              <span className="text-[#64748b] font-sans">
                {batteryLevel}% 电量
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[#64748b]">
            <Radio size={11} />
            <span>无活动设备会话</span>
          </div>
        )}
      </div>

      {/* Right: Quick Tools & Diagnostics Entry */}
      <div className="flex items-center gap-2.5">
        {/* ADB Shell quick launch */}
        {selectedSession && isConnected && onOpenAdbShell && (
          <button
            type="button"
            onClick={onOpenAdbShell}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/[0.08] text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
            title="快捷打开 ADB Shell 终端控制台 (快捷键 Cmd+T)"
          >
            <Terminal size={12} className="text-blue-400" />
            <span className="font-sans text-[11px]">终端控制台</span>
          </button>
        )}

        {/* Diagnostics */}
        {onOpenDiagnostics && (
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/[0.08] text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
            title="查看系统调试与连接诊断"
          >
            <Activity size={12} className="text-emerald-400" />
            <span className="font-sans text-[11px]">诊断</span>
          </button>
        )}

        <span className="text-white/10">|</span>

        {/* App Version Tag */}
        <span className="text-[#475569] text-[10.5px]">Screen Remote Desktop</span>
      </div>
    </footer>
  );
};
