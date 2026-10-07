import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AdbDevice } from '../../types';
import { ConfirmModal } from '../modals/ConfirmModal';
import {
  Wifi,
  Camera,
  RotateCcw,
  ShieldCheck,
  ArrowUpDown,
  SlidersHorizontal,
  Moon,
  Sun,
  Power,
  Terminal,
  Wrench,
  ChevronRight,
  X,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface DeviceUtilitiesViewProps {
  device: AdbDevice;
  onNotify: (msg: string, isError?: boolean) => void;
}

type UtilitySheetType =
  | 'fixedPort'
  | 'screenshot'
  | 'reboot'
  | 'activation'
  | 'density'
  | 'resolution'
  | 'animation'
  | 'standby';

interface UtilitySnapshot {
  wirelessPort: string;
  density: string;
  resolutionWidth: string;
  resolutionHeight: string;
  windowAnimationScale: string;
  transitionAnimationScale: string;
  animatorDurationScale: string;
  installedPackages: Set<string>;
}

const DEFAULT_SNAPSHOT: UtilitySnapshot = {
  wirelessPort: '',
  density: '480',
  resolutionWidth: '1080',
  resolutionHeight: '2400',
  windowAnimationScale: '1.0',
  transitionAnimationScale: '1.0',
  animatorDurationScale: '1.0',
  installedPackages: new Set<string>(),
};

const ACTIVATION_TARGETS = [
  {
    id: 'moe.shizuku.privileged.api',
    title: 'Shizuku',
    desc: '以系统服务权限运行应用指令',
    command:
      '$(pm path moe.shizuku.privileged.api | sed "s#package:##;s#/base.apk#/lib/$(getprop ro.product.cpu.abi | sed \\"s/arm64-v8a/arm64/\\")/libshizuku.so#")',
  },
  {
    id: 'me.piebridge.brevent',
    title: 'Brevent (黑阈)',
    desc: '阻断后台唤醒与耗电应用',
    command: 'sh /data/data/me.piebridge.brevent/brevent.sh',
  },
  {
    id: 'com.catchingnow.icebox',
    title: '冰箱 (Ice Box)',
    desc: '一键冻结不常用后台软件',
    command: 'sh /storage/emulated/0/Android/data/com.catchingnow.icebox/files/start.sh',
  },
  {
    id: 'com.aistra.hail',
    title: 'Hail (冻结应用)',
    desc: '开放源代码的冻结/解冻管理',
    command: 'dpm set-device-owner com.aistra.hail/.receiver.DeviceAdminReceiver',
  },
  {
    id: 'com.omarea.vtools',
    title: 'Scene (工具箱)',
    desc: '调度与性能调试增强工具',
    command:
      'sh /sdcard/Android/data/com.omarea.vtools/files/scene_daemon || sh /data/data/com.omarea.vtools/files/scene_daemon',
  },
];

const RESOLUTION_PRESETS = [
  { label: '1080 x 2400 (20:9 FHD+)', w: '1080', h: '2400' },
  { label: '1080 x 2340 (19.5:9)', w: '1080', h: '2340' },
  { label: '1440 x 3200 (20:9 2K)', w: '1440', h: '3200' },
  { label: '720 x 1600 (20:9 HD+)', w: '720', h: '1600' },
  { label: '1080 x 1920 (16:9 标准)', w: '1080', h: '1920' },
];

export const DeviceUtilitiesView: React.FC<DeviceUtilitiesViewProps> = ({ device, onNotify }) => {
  const [snapshot, setSnapshot] = useState<UtilitySnapshot>(DEFAULT_SNAPSHOT);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSheet, setActiveSheet] = useState<UtilitySheetType | null>(null);
  const [confirmReboot, setConfirmReboot] = useState<{ mode: string; label: string } | null>(null);

  // Sheet states
  const [fixedPort, setFixedPort] = useState('5555');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [densityInput, setDensityInput] = useState('480');
  const [resWidth, setResWidth] = useState('1080');
  const [resHeight, setResHeight] = useState('2400');
  const [winAnim, setWinAnim] = useState('1.0');
  const [transAnim, setTransAnim] = useState('1.0');
  const [durAnim, setDurAnim] = useState('1.0');
  const [actionLoading, setActionLoading] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // Load device snapshot data
  const refreshSnapshot = useCallback(async () => {
    if (!device?.serial) return;
    setIsRefreshing(true);
    try {
      const command = `
        echo PORT=$(getprop service.adb.tcp.port);
        echo DENSITY=$(wm density | tail -n 1 | sed 's/.*: //');
        echo SIZE=$(wm size | tail -n 1 | sed 's/.*: //');
        echo WINDOW=$(settings get global window_animation_scale);
        echo TRANSITION=$(settings get global transition_animation_scale);
        echo ANIMATOR=$(settings get global animator_duration_scale);
        pm list packages | grep -E '^package:(moe.shizuku.privileged.api|me.piebridge.brevent|com.catchingnow.icebox|com.aistra.hail|com.omarea.vtools)$' || true
      `;
      const output = await invoke<string>('run_adb_shell_command', {
        serial: device.serial,
        command,
        customPath: null,
      });

      const values: Record<string, string> = {};
      const packages = new Set<string>();

      for (const rawLine of output.split('\n')) {
        const line = rawLine.trim();
        if (line.startsWith('package:')) {
          packages.add(line.slice(8).trim());
        } else if (line.includes('=')) {
          const idx = line.indexOf('=');
          const key = line.slice(0, idx).trim();
          const val = line.slice(idx + 1).trim();
          values[key] = val;
        }
      }

      const rawPort = (values['PORT'] || '').replace('-1', '').trim();
      const rawDensity = (values['DENSITY'] || '').trim();
      const rawSize = (values['SIZE'] || '').trim();
      const sizeParts = rawSize.split('x');

      if (!isMounted.current) return;
      setSnapshot({
        wirelessPort: rawPort,
        density: rawDensity || '480',
        resolutionWidth: sizeParts[0] || '1080',
        resolutionHeight: sizeParts[1] || '2400',
        windowAnimationScale: values['WINDOW'] || '1.0',
        transitionAnimationScale: values['TRANSITION'] || '1.0',
        animatorDurationScale: values['ANIMATOR'] || '1.0',
        installedPackages: packages,
      });
    } catch (e: any) {
      console.warn('Failed to load device utility snapshot:', e);
    } finally {
      if (isMounted.current) setIsRefreshing(false);
    }
  }, [device?.serial]);

  useEffect(() => {
    refreshSnapshot();
  }, [refreshSnapshot]);

  // Open specific sheet
  const handleOpenSheet = (type: UtilitySheetType) => {
    switch (type) {
      case 'fixedPort':
        setFixedPort(snapshot.wirelessPort || '5555');
        setActiveSheet('fixedPort');
        break;
      case 'screenshot':
        setActiveSheet('screenshot');
        handleCaptureScreenshot();
        break;
      case 'reboot':
        setActiveSheet('reboot');
        break;
      case 'activation':
        setActiveSheet('activation');
        break;
      case 'density':
        setDensityInput(snapshot.density || '480');
        setActiveSheet('density');
        break;
      case 'resolution':
        setResWidth(snapshot.resolutionWidth || '1080');
        setResHeight(snapshot.resolutionHeight || '2400');
        setActiveSheet('resolution');
        break;
      case 'animation':
        setWinAnim(snapshot.windowAnimationScale || '1.0');
        setTransAnim(snapshot.transitionAnimationScale || '1.0');
        setDurAnim(snapshot.animatorDurationScale || '1.0');
        setActiveSheet('animation');
        break;
      case 'standby':
        setActiveSheet('standby');
        break;
    }
  };

  // 1. Fixed Port Action
  const handleApplyFixedPort = async () => {
    const portNum = parseInt(fixedPort, 10);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      onNotify('请输入有效的端口号 (1024 - 65535)', true);
      return;
    }
    setActionLoading(true);
    try {
      await invoke('run_raw_adb_command', {
        args: ['-s', device.serial, 'tcpip', String(portNum)],
        customPath: null,
      });
      if (!isMounted.current) return;
      onNotify(`无线调试端口已设置为: ${portNum}`);
      setActiveSheet(null);
      refreshSnapshot();
    } catch (e: any) {
      onNotify(`设置无线端口失败: ${e}`, true);
    } finally {
      if (isMounted.current) setActionLoading(false);
    }
  };

  // 2. Screenshot Action
  const handleCaptureScreenshot = async () => {
    setIsCapturingScreenshot(true);
    try {
      const dataUrl = await invoke<string>('capture_screenshot', {
        serial: device.serial,
        customPath: null,
      });
      if (!isMounted.current) return;
      setScreenshotData(dataUrl);
      onNotify('屏幕截图获取成功');
    } catch (e: any) {
      onNotify(`截图失败: ${e}`, true);
    } finally {
      if (isMounted.current) setIsCapturingScreenshot(false);
    }
  };

  // 3. Reboot Action
  const handleReboot = (mode: string, label: string) => {
    setConfirmReboot({ mode, label });
  };

  const executeReboot = async (mode: string, label: string) => {
    setActionLoading(true);
    try {
      if (mode === 'powerOff') {
        await invoke('run_adb_shell_command', {
          serial: device.serial,
          command: 'reboot -p',
          customPath: null,
        });
      } else {
        await invoke('reboot_device', {
          serial: device.serial,
          mode: mode === 'system' ? 'system' : mode,
          customPath: null,
        });
      }
      if (!isMounted.current) return;
      onNotify(`已向设备发送 ${label} 指令`);
      setActiveSheet(null);
    } catch (e: any) {
      onNotify(`指令发送失败: ${e}`, true);
    } finally {
      if (isMounted.current) setActionLoading(false);
    }
  };

  // 4. Activate App Action
  const handleActivateApp = async (target: typeof ACTIVATION_TARGETS[0]) => {
    setActionLoading(true);
    try {
      const out = await invoke<string>('run_adb_shell_command', {
        serial: device.serial,
        command: target.command,
        customPath: null,
      });
      onNotify(`已向设备执行激活命令: ${target.title}`);
      console.log('Activation output:', out);
    } catch (e: any) {
      onNotify(`激活 ${target.title} 失败: ${e}`, true);
    } finally {
      if (isMounted.current) setActionLoading(false);
    }
  };

  // 5. Density Action
  const handleApplyDensity = async () => {
    const val = parseInt(densityInput, 10);
    if (isNaN(val) || val < 72 || val > 1000) {
      onNotify('DPI 数值必须介于 72 到 1000 之间', true);
      return;
    }
    setActionLoading(true);
    try {
      await invoke('run_adb_shell_command', {
        serial: device.serial,
        command: `wm density ${val}`,
        customPath: null,
      });
      onNotify(`DPI 已修改为: ${val}`);
      setActiveSheet(null);
      refreshSnapshot();
    } catch (e: any) {
      onNotify(`修改 DPI 失败: ${e}`, true);
    } finally {
      if (isMounted.current) setActionLoading(false);
    }
  };

  const handleResetDensity = async () => {
    setActionLoading(true);
    try {
      await invoke('run_adb_shell_command', {
        serial: device.serial,
        command: 'wm density reset',
        customPath: null,
      });
      if (!isMounted.current) return;
      onNotify('已恢复默认屏幕 DPI');
      setActiveSheet(null);
      refreshSnapshot();
    } catch (e: any) {
      onNotify(`重置 DPI 失败: ${e}`, true);
    } finally {
      if (isMounted.current) setActionLoading(false);
    }
  };

  // 6. Resolution Action
  const handleApplyResolution = async () => {
    const w = parseInt(resWidth, 10);
    const h = parseInt(resHeight, 10);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      onNotify('请输入有效的分辨率宽高数值', true);
      return;
    }
    setActionLoading(true);
    try {
      await invoke('run_adb_shell_command', {
        serial: device.serial,
        command: `wm size ${w}x${h}`,
        customPath: null,
      });
      if (!isMounted.current) return;
      onNotify(`分辨率已修改为: ${w} x ${h}`);
      setActiveSheet(null);
      refreshSnapshot();
    } catch (e: any) {
      onNotify(`修改分辨率失败: ${e}`, true);
    } finally {
      if (isMounted.current) setActionLoading(false);
    }
  };

  const handleResetResolution = async () => {
    setActionLoading(true);
    try {
      await invoke('run_adb_shell_command', {
        serial: device.serial,
        command: 'wm size reset',
        customPath: null,
      });
      if (!isMounted.current) return;
      onNotify('已恢复默认屏幕分辨率');
      setActiveSheet(null);
      refreshSnapshot();
    } catch (e: any) {
      onNotify(`重置分辨率失败: ${e}`, true);
    } finally {
      if (isMounted.current) setActionLoading(false);
    }
  };

  // 7. Animation Action
  const handleApplyAnimation = async (w?: string, t?: string, d?: string) => {
    const finalW = w !== undefined ? w : winAnim;
    const finalT = t !== undefined ? t : transAnim;
    const finalD = d !== undefined ? d : durAnim;

    setActionLoading(true);
    try {
      const command = `settings put global window_animation_scale ${finalW}; settings put global transition_animation_scale ${finalT}; settings put global animator_duration_scale ${finalD}`;
      await invoke('run_adb_shell_command', {
        serial: device.serial,
        command,
        customPath: null,
      });
      if (!isMounted.current) return;
      onNotify(`动画缩放已应用: 窗口 ${finalW}x, 过渡 ${finalT}x, 时长 ${finalD}x`);
      setActiveSheet(null);
      refreshSnapshot();
    } catch (e: any) {
      onNotify(`修改动画缩放失败: ${e}`, true);
    } finally {
      if (isMounted.current) setActionLoading(false);
    }
  };

  // 8. Standby Action
  const handleStandby = async (action: 'sleep' | 'wake') => {
    setActionLoading(true);
    try {
      const keycode = action === 'sleep' ? 223 : 224;
      await invoke('run_adb_shell_command', {
        serial: device.serial,
        command: `input keyevent ${keycode}`,
        customPath: null,
      });
      if (!isMounted.current) return;
      onNotify(action === 'sleep' ? '已下发熄灭屏幕指令' : '已下发唤醒屏幕指令');
    } catch (e: any) {
      onNotify(`操作失败: ${e}`, true);
    } finally {
      if (isMounted.current) setActionLoading(false);
    }
  };

  // 8 Cards Configuration strictly matching native_tab_utilities.png
  const utilityCards = [
    {
      type: 'fixedPort' as UtilitySheetType,
      title: '固定无线调试端口',
      detail: snapshot.wirelessPort
        ? `当前无线调试端口: ${snapshot.wirelessPort}`
        : '当前无线调试端口: 未配置 (建议 5555)',
      icon: <Wifi size={20} color="#0a84ff" />,
    },
    {
      type: 'screenshot' as UtilitySheetType,
      title: '设备截图',
      detail: '截取设备屏幕并预览，然后打开或保存 PNG。',
      icon: <Camera size={20} color="#0a84ff" />,
    },
    {
      type: 'reboot' as UtilitySheetType,
      title: '高级重启',
      detail: '重启、关机，或进入 Recovery、Fastboot 模式。',
      icon: <RotateCcw size={20} color="#0a84ff" />,
    },
    {
      type: 'activation' as UtilitySheetType,
      title: '激活应用',
      detail: '检测 Shizuku、Brevent 和冰箱，并运行受支持的激活命令。',
      icon: <ShieldCheck size={20} color="#0a84ff" />,
    },
    {
      type: 'density' as UtilitySheetType,
      title: '修改 DPI',
      detail: `当前 DPI: ${snapshot.density || '480'}`,
      icon: (
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#0a84ff',
            letterSpacing: '-0.5px',
          }}
        >
          大小
        </span>
      ),
    },
    {
      type: 'resolution' as UtilitySheetType,
      title: '修改分辨率',
      detail: `当前分辨率: ${snapshot.resolutionWidth || '1080'} x ${snapshot.resolutionHeight || '2400'}`,
      icon: <ArrowUpDown size={20} color="#0a84ff" />,
    },
    {
      type: 'animation' as UtilitySheetType,
      title: '动画缩放',
      detail: '分别设置窗口、过渡和动画时长缩放。',
      icon: <SlidersHorizontal size={20} color="#0a84ff" />,
    },
    {
      type: 'standby' as UtilitySheetType,
      title: '熄屏待机',
      detail: '选择熄灭或唤醒设备屏幕，不结束当前会话。',
      icon: <Moon size={20} color="#0a84ff" />,
    },
  ];

  return (
    <div className="screen-workspace-scroll p-6">
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        {/* Loading header banner */}
        {isRefreshing && (
          <div className="flex items-center justify-center gap-2 mb-4 text-xs text-white/50">
            <Loader2 size={13} className="animate-spin text-[#0a84ff]" />
            <span>正在读取设备快照...</span>
          </div>
        )}

        {/* 2-Column 8-Card Grid strictly matching native_tab_utilities.png */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '14px',
          }}
        >
          {utilityCards.map((card) => (
            <button
              key={card.type}
              type="button"
              onClick={() => handleOpenSheet(card.type)}
              className="app-card app-card-interactive flex items-center gap-3.5 p-4 text-left transition-all cursor-pointer"
            >
              {/* Icon Container */}
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                {card.icon}
              </div>

              {/* Title & Detail */}
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-[var(--text-primary)] leading-snug">
                  {card.title}
                </div>
                <div
                  className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed mt-0.5 truncate"
                  title={card.detail}
                >
                  {card.detail}
                </div>
              </div>

              {/* Right Chevron */}
              <ChevronRight
                size={14}
                className="text-[var(--text-secondary)] opacity-50 shrink-0"
              />
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          MODALS / SHEETS (macOS Native Dialog Style)
         ========================================================================= */}
      {activeSheet && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              setActiveSheet(null);
            }
          }}
        >
          <div
            className="modal-window-card"
            style={{
              width: activeSheet === 'screenshot' ? '600px' : '480px',
              maxWidth: '92vw',
            }}
          >
            {/* Sheet Title Bar */}
            <div className="modal-titlebar">
              <span>
                {activeSheet === 'fixedPort' && '固定无线调试端口'}
                {activeSheet === 'screenshot' && '屏幕截图已就绪'}
                {activeSheet === 'reboot' && '高级重启'}
                {activeSheet === 'activation' && '激活应用'}
                {activeSheet === 'density' && '修改 DPI'}
                {activeSheet === 'resolution' && '修改分辨率'}
                {activeSheet === 'animation' && '动画缩放'}
                {activeSheet === 'standby' && '熄屏待机'}
              </span>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setActiveSheet(null)}
                disabled={actionLoading}
              >
                <X size={15} />
              </button>
            </div>

            {/* Sheet Content Body */}
            <div className="modal-body-scroll">
              {/* 1. Fixed Port Sheet */}
              {activeSheet === 'fixedPort' && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-[#8e8e93] leading-relaxed">
                    将无线调试端口固定为指定数值（通常为 5555）。部分设备重启后可能需要重新执行端口固定。
                  </p>
                  <div>
                    <label className="text-xs text-[#8e8e93] block mb-1 font-medium">
                      设备端口 (Device Port)
                    </label>
                    <input
                      type="number"
                      className="modal-input w-full"
                      placeholder="5555"
                      value={fixedPort}
                      onChange={(e) => setFixedPort(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#8e8e93]">快捷填充:</span>
                    {['5555', '30610', '38888', '55555'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        className="px-2 py-0.5 rounded text-[11px] bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                        onClick={() => setFixedPort(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => setActiveSheet(null)}
                      disabled={actionLoading}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      onClick={handleApplyFixedPort}
                      disabled={actionLoading || !fixedPort.trim()}
                    >
                      {actionLoading ? <Loader2 size={13} className="animate-spin" /> : '应用'}
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Screenshot Sheet */}
              {activeSheet === 'screenshot' && (
                <div className="flex flex-col gap-4 items-center">
                  {isCapturingScreenshot ? (
                    <div className="py-16 flex flex-col items-center gap-3 text-white/60">
                      <Loader2 size={32} className="animate-spin text-[#0a84ff]" />
                      <span className="text-xs">正在截取设备屏幕...</span>
                    </div>
                  ) : screenshotData ? (
                    <>
                      <div
                        style={{
                          backgroundColor: '#000000',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          maxHeight: '400px',
                          width: '100%',
                        }}
                      >
                        <img
                          src={screenshotData}
                          alt="Screenshot"
                          style={{
                            maxHeight: '380px',
                            objectFit: 'contain',
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between w-full pt-2">
                        <button
                          type="button"
                          className="btn btn-secondary btn-small flex items-center gap-1.5"
                          onClick={handleCaptureScreenshot}
                          disabled={isCapturingScreenshot}
                        >
                          <RefreshCw size={13} />
                          <span>重新截图</span>
                        </button>
                        <div className="flex items-center gap-2">
                          <a
                            href={screenshotData}
                            download={`Screen Remote - ${device.serial} - ${Date.now()}.png`}
                            className="btn btn-primary btn-small flex items-center gap-1.5"
                          >
                            <Download size={13} />
                            <span>保存 PNG</span>
                          </a>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-12 text-center text-xs text-rose-400">
                      未能抓取设备屏幕，请确认设备屏幕未处于锁定或黑屏保护状态。
                    </div>
                  )}
                </div>
              )}

              {/* 3. Advanced Reboot Sheet */}
              {activeSheet === 'reboot' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-[#8e8e93] leading-relaxed">
                    选择重启模式。重启过程中设备连接将断开。
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] border border-[var(--border-card)] text-left transition cursor-pointer"
                      onClick={() => handleReboot('system', '普通重启')}
                      disabled={actionLoading}
                    >
                      <RotateCcw size={18} className="text-blue-400" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-[var(--text-primary)]">普通重启</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">正常重新启动 Android 系统</div>
                      </div>
                      <ChevronRight size={14} className="text-[var(--text-secondary)] opacity-50" />
                    </button>

                    <button
                      type="button"
                      className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] hover:bg-rose-500/10 border border-[var(--border-card)] hover:border-rose-500/30 text-left transition cursor-pointer"
                      onClick={() => handleReboot('powerOff', '关机')}
                      disabled={actionLoading}
                    >
                      <Power size={18} className="text-rose-500" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-rose-500">关机</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">关闭设备电源</div>
                      </div>
                      <ChevronRight size={14} className="text-[var(--text-secondary)] opacity-50" />
                    </button>

                    <button
                      type="button"
                      className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] hover:bg-amber-500/10 border border-[var(--border-card)] hover:border-amber-500/30 text-left transition cursor-pointer"
                      onClick={() => handleReboot('recovery', 'Recovery 模式')}
                      disabled={actionLoading}
                    >
                      <Wrench size={18} className="text-amber-500" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-amber-500">Recovery 模式</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">重启进入系统恢复模式</div>
                      </div>
                      <ChevronRight size={14} className="text-[var(--text-secondary)] opacity-50" />
                    </button>

                    <button
                      type="button"
                      className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] hover:bg-indigo-500/10 border border-[var(--border-card)] hover:border-indigo-500/30 text-left transition cursor-pointer"
                      onClick={() => handleReboot('bootloader', 'Fastboot 模式')}
                      disabled={actionLoading}
                    >
                      <Terminal size={18} className="text-indigo-400" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-indigo-400">Fastboot 模式</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">重启进入 Bootloader / Fastboot 刷机模式</div>
                      </div>
                      <ChevronRight size={14} className="text-[var(--text-secondary)] opacity-50" />
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Activate Apps Sheet */}
              {activeSheet === 'activation' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    检测设备上已安装的工具应用并下发激活命令。
                  </p>
                  <div className="flex flex-col gap-2">
                    {ACTIVATION_TARGETS.map((target) => {
                      const isInstalled = snapshot.installedPackages.has(target.id);
                      return (
                        <div
                          key={target.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <ShieldCheck
                              size={18}
                              className={isInstalled ? 'text-emerald-500' : 'text-neutral-400'}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-[var(--text-primary)]">
                                  {target.title}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                                    isInstalled
                                      ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/25'
                                      : 'bg-black/5 dark:bg-white/5 text-[var(--text-secondary)] border border-[var(--border-card)]'
                                  }`}
                                >
                                  {isInstalled ? '已安装' : '未安装'}
                                </span>
                              </div>
                              <div className="text-[11px] text-[var(--text-secondary)]">{target.desc}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => handleActivateApp(target)}
                            disabled={actionLoading}
                          >
                            一键激活
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. Density Sheet */}
              {activeSheet === 'density' && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-[#8e8e93] leading-relaxed">
                    修改屏幕像素密度 (DPI)。过大或过小可能导致系统界面异常。
                  </p>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-[#8e8e93] font-medium">DPI 数值</label>
                      <span className="text-xs font-mono text-white/80">{densityInput}</span>
                    </div>
                    <input
                      type="range"
                      min="160"
                      max="720"
                      step="10"
                      value={densityInput}
                      onChange={(e) => setDensityInput(e.target.value)}
                      className="w-full accent-[#0a84ff]"
                    />
                    <input
                      type="number"
                      className="modal-input w-full mt-2"
                      value={densityInput}
                      onChange={(e) => setDensityInput(e.target.value)}
                      placeholder="480"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8e8e93] mb-1.5 font-medium">常用预设:</div>
                    <div className="flex flex-wrap gap-2">
                      {['320', '360', '400', '440', '480', '560'].map((d) => (
                        <button
                          key={d}
                          type="button"
                          className="px-2.5 py-1 rounded text-xs bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                          onClick={() => setDensityInput(d)}
                        >
                          {d} DPI
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={handleResetDensity}
                      disabled={actionLoading}
                    >
                      恢复默认
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      onClick={handleApplyDensity}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 size={13} className="animate-spin" /> : '应用'}
                    </button>
                  </div>
                </div>
              )}

              {/* 6. Resolution Sheet */}
              {activeSheet === 'resolution' && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-[#8e8e93] leading-relaxed">
                    修改设备显示分辨率。过高可能影响性能，过低可能导致部分界面无法正常显示。
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#8e8e93] block mb-1 font-medium">
                        宽度 (Width)
                      </label>
                      <input
                        type="number"
                        className="modal-input w-full"
                        value={resWidth}
                        onChange={(e) => setResWidth(e.target.value)}
                        placeholder="1080"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#8e8e93] block mb-1 font-medium">
                        高度 (Height)
                      </label>
                      <input
                        type="number"
                        className="modal-input w-full"
                        value={resHeight}
                        onChange={(e) => setResHeight(e.target.value)}
                        placeholder="2400"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8e8e93] mb-1.5 font-medium">常用预设:</div>
                    <div className="flex flex-col gap-1.5">
                      {RESOLUTION_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          className="flex justify-between items-center px-3 py-1.5 rounded text-xs bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                          onClick={() => {
                            setResWidth(p.w);
                            setResHeight(p.h);
                          }}
                        >
                          <span>{p.label}</span>
                          <span className="font-mono text-white/50">{p.w}x{p.h}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={handleResetResolution}
                      disabled={actionLoading}
                    >
                      恢复默认
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      onClick={handleApplyResolution}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 size={13} className="animate-spin" /> : '应用'}
                    </button>
                  </div>
                </div>
              )}

              {/* 7. Animation Sheet */}
              {activeSheet === 'animation' && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-[#8e8e93] leading-relaxed">
                    分别设置窗口、过渡和动画时长缩放。较低的缩放比例可使设备界面响应更迅速。
                  </p>
                  {/* Presets */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded text-xs bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                      onClick={() => {
                        setWinAnim('0.0');
                        setTransAnim('0.0');
                        setDurAnim('0.0');
                        handleApplyAnimation('0.0', '0.0', '0.0');
                      }}
                    >
                      关闭动画 (0x)
                    </button>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded text-xs bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                      onClick={() => {
                        setWinAnim('0.5');
                        setTransAnim('0.5');
                        setDurAnim('0.5');
                        handleApplyAnimation('0.5', '0.5', '0.5');
                      }}
                    >
                      流畅加速 (0.5x)
                    </button>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded text-xs bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                      onClick={() => {
                        setWinAnim('1.0');
                        setTransAnim('1.0');
                        setDurAnim('1.0');
                        handleApplyAnimation('1.0', '1.0', '1.0');
                      }}
                    >
                      系统默认 (1.0x)
                    </button>
                  </div>
                  <div className="flex flex-col gap-3 pt-2">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-[#8e8e93]">窗口动画缩放</label>
                        <span className="text-xs font-mono text-white/80">{winAnim}x</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.25"
                        value={winAnim}
                        onChange={(e) => setWinAnim(e.target.value)}
                        className="w-full accent-[#0a84ff]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-[#8e8e93]">过渡动画缩放</label>
                        <span className="text-xs font-mono text-white/80">{transAnim}x</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.25"
                        value={transAnim}
                        onChange={(e) => setTransAnim(e.target.value)}
                        className="w-full accent-[#0a84ff]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-[#8e8e93]">动画时长缩放</label>
                        <span className="text-xs font-mono text-white/80">{durAnim}x</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.25"
                        value={durAnim}
                        onChange={(e) => setDurAnim(e.target.value)}
                        className="w-full accent-[#0a84ff]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => setActiveSheet(null)}
                      disabled={actionLoading}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      onClick={() => handleApplyAnimation()}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 size={13} className="animate-spin" /> : '应用'}
                    </button>
                  </div>
                </div>
              )}

              {/* 8. Standby Sheet */}
              {activeSheet === 'standby' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-[#8e8e93] leading-relaxed">
                    选择熄灭或唤醒设备屏幕，不结束当前会话。
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition"
                      onClick={() => handleStandby('sleep')}
                      disabled={actionLoading}
                    >
                      <Moon size={18} className="text-[#0a84ff]" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-white">熄灭屏幕 (Sleep)</div>
                        <div className="text-[11px] text-[#8e8e93]">
                          关闭屏幕背光与显示 (KEYCODE_SLEEP 223)
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-white/30" />
                    </button>

                    <button
                      type="button"
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition"
                      onClick={() => handleStandby('wake')}
                      disabled={actionLoading}
                    >
                      <Sun size={18} className="text-amber-400" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-white">唤醒屏幕 (Wake)</div>
                        <div className="text-[11px] text-[#8e8e93]">
                          点亮屏幕并恢复显示 (KEYCODE_WAKEUP 224)
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-white/30" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal for destructive actions */}
      <ConfirmModal
        isOpen={Boolean(confirmReboot)}
        title="确认执行系统指令"
        message={`确定将设备重启至 ${confirmReboot?.label || ''} 吗？执行期间当前连接与投屏将会断开。`}
        confirmText="确认执行"
        cancelText="取消"
        isDestructive={true}
        onConfirm={() => {
          if (confirmReboot) {
            executeReboot(confirmReboot.mode, confirmReboot.label);
          }
        }}
        onCancel={() => setConfirmReboot(null)}
      />
    </div>
  );
};
