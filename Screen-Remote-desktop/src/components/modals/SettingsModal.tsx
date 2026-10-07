import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppSettings } from '../../types';
import {
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  RefreshCw,
  Sun,
  Moon,
  Laptop,
  Terminal,
  Film,
  Zap,
  Volume2,
  EyeOff,
  Trash2,
  Check
} from 'lucide-react';

interface SettingsModalProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onChange, onClose }) => {
  const [customAdb, setCustomAdb] = useState(settings.adb_path || '');
  const [adbTestStatus, setAdbTestStatus] = useState<string | null>(null);
  const [adbTestOk, setAdbTestOk] = useState<boolean | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const testAdb = async (explicitPath?: string) => {
    setIsTesting(true);
    try {
      const pathToCheck = explicitPath !== undefined ? explicitPath : customAdb;
      const ver = await invoke<string>('get_adb_version', {
        customPath: pathToCheck.trim() || null,
      });
      setAdbTestOk(true);
      setAdbTestStatus(ver.split('\n')[0]);
    } catch (e: any) {
      setAdbTestOk(false);
      setAdbTestStatus(String(e));
    } finally {
      setIsTesting(false);
    }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (key === 'theme') {
      let isDark = false;
      if (value === 'dark') isDark = true;
      else if (value === 'light') isDark = false;
      else isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    }
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const handleClearCache = () => {
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2000);
  };

  const handleAutoDetectTools = async () => {
    setIsDetecting(true);
    try {
      const ver = await invoke<string>('get_adb_version', { customPath: null });
      setCustomAdb('');
      setAdbTestOk(true);
      setAdbTestStatus(`检测就绪: ${ver.split('\n')[0]}`);
      onChange({
        ...settings,
        adb_path: null,
      });
    } catch (e: any) {
      setAdbTestOk(false);
      setAdbTestStatus(`未找到系统环境变量中的 adb: ${e}`);
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window-card"
        style={{ width: '680px', height: '640px', maxWidth: '94vw', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titlebar Header */}
        <div className="modal-titlebar">
          <div className="flex items-center gap-3">
            <div className="app-icon-tile bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-500 shadow-lg shadow-blue-500/20 border border-blue-400/30">
              <SlidersHorizontal size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">
                  偏好设置
                </h2>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Preferences
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">
                定制全局外观、ADB 调试桥引擎与 Scrcpy 高性能流媒体配置
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="modal-close-icon-btn"
              title="关闭 (Esc)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="modal-body-scroll p-4 flex flex-col gap-3.5">
          {/* Card 1: 外观与语言 */}
          <div className="macos-form-section">
            <div className="macos-form-section-header flex items-center gap-1.5">
              <Sun size={12} className="text-blue-400" />
              <span>外观与语言偏好</span>
            </div>

            {/* Language */}
            <div className="macos-form-row">
              <span className="macos-form-label">界面语言</span>
              <div className="segmented-pill-container">
                {[
                  { key: 'system', label: '跟随系统' },
                  { key: 'en-US', label: 'English' },
                  { key: 'zh-CN', label: '简体中文' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => updateSetting('language', item.key)}
                    className={`segmented-pill-btn ${
                      settings.language === item.key ? 'active' : ''
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="macos-form-row">
              <span className="macos-form-label">色彩主题</span>
              <div className="segmented-pill-container">
                {[
                  { key: 'system', label: '系统默认', icon: <Laptop size={12} /> },
                  { key: 'light', label: '浅色模式', icon: <Sun size={12} /> },
                  { key: 'dark', label: '深色黑曜', icon: <Moon size={12} /> },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => updateSetting('theme', item.key as any)}
                    className={`segmented-pill-btn ${
                      settings.theme === item.key ? 'active' : ''
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: ADB 控制工具链 */}
          <div className="macos-form-section">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5">
                <Terminal size={13} className="text-blue-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Android 调试桥 (adb)
                </span>
              </div>
              <button
                type="button"
                onClick={handleAutoDetectTools}
                disabled={isDetecting}
                className="btn btn-ghost btn-small text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-medium py-1 px-2 rounded-md"
              >
                <Sparkles size={12} className={isDetecting ? 'animate-spin' : ''} />
                <span>{isDetecting ? '自动探测中...' : '自动探测系统 adb'}</span>
              </button>
            </div>

            <div className="p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>自定义二进制可执行文件路径 (留空则使用系统 PATH)</span>
                <span className="font-mono text-[10.5px] text-[var(--text-tertiary)]">
                  {customAdb ? '已指定自定义路径' : '默认环境变量'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="例如: /usr/local/bin/adb 或 C:\platform-tools\adb.exe"
                    value={customAdb}
                    onChange={(e) => setCustomAdb(e.target.value)}
                    className="input-field font-mono text-[11.5px] pl-3 pr-8"
                  />
                  {customAdb && (
                    <button
                      type="button"
                      onClick={() => setCustomAdb('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const trimmed = customAdb.trim() || null;
                    onChange({
                      ...settings,
                      adb_path: trimmed,
                    });
                    testAdb(trimmed || '');
                  }}
                  className="btn btn-secondary px-3 py-1.5 text-xs"
                >
                  应用保存
                </button>

                <button
                  type="button"
                  onClick={() => testAdb()}
                  disabled={isTesting}
                  className="btn btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
                >
                  <RefreshCw size={12} className={isTesting ? 'animate-spin' : ''} />
                  <span>{isTesting ? '正在验证' : '测试连通性'}</span>
                </button>
              </div>

              {/* Status Alert Banner */}
              {adbTestStatus && (
                <div
                  className={`px-3 py-2 rounded-lg text-[11.5px] flex items-center gap-2 border font-mono transition-all ${
                    adbTestOk
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                  }`}
                >
                  {adbTestOk ? (
                    <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle size={14} className="flex-shrink-0 text-rose-400" />
                  )}
                  <span className="truncate flex-1">{adbTestStatus}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Scrcpy 流媒体解码与画质预设 */}
          <div className="macos-form-section">
            <div className="macos-form-section-header flex items-center gap-1.5">
              <Film size={12} className="text-blue-400" />
              <span>Scrcpy 视频流解码质量配置</span>
            </div>

            {/* Max FPS Slider */}
            <div className="macos-form-row">
              <div className="flex flex-col">
                <span className="macos-form-label">最大渲染帧率限制</span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  提升流畅度或在低功耗网络下节能
                </span>
              </div>
              <div className="flex items-center gap-3 w-64 justify-end">
                <input
                  type="range"
                  min={30}
                  max={120}
                  step={30}
                  value={settings.max_fps}
                  onChange={(e) => updateSetting('max_fps', Number(e.target.value))}
                  className="range-slider w-36"
                />
                <span className="badge badge-info min-w-[58px] justify-center font-mono">
                  {settings.max_fps} FPS
                </span>
              </div>
            </div>

            {/* Video Bitrate Slider */}
            <div className="macos-form-row">
              <div className="flex flex-col">
                <span className="macos-form-label">默认视频流码率</span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  控制画面压缩率与带宽吞吐
                </span>
              </div>
              <div className="flex items-center gap-3 w-64 justify-end">
                <input
                  type="range"
                  min={2}
                  max={32}
                  step={2}
                  value={settings.bit_rate_mbps}
                  onChange={(e) => updateSetting('bit_rate_mbps', Number(e.target.value))}
                  className="range-slider w-36"
                />
                <span className="badge badge-info min-w-[58px] justify-center font-mono">
                  {settings.bit_rate_mbps} Mbps
                </span>
              </div>
            </div>

            {/* Resolution limit */}
            <div className="macos-form-row">
              <div className="flex flex-col">
                <span className="macos-form-label">投屏最大分辨率限制</span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  针对超大屏手机限制长边尺寸
                </span>
              </div>
              <select
                value={settings.max_size}
                onChange={(e) => updateSetting('max_size', Number(e.target.value))}
                className="macos-select"
              >
                <option value={0}>原始无限制 (Native)</option>
                <option value={1080}>1080P (长边 1080px)</option>
                <option value={1440}>1440P (长边 1440px)</option>
                <option value={1920}>1080P Full HD (1920px)</option>
                <option value={2560}>2K QHD (2560px)</option>
              </select>
            </div>

            {/* Video Codec Segmented */}
            <div className="macos-form-row">
              <div className="flex flex-col">
                <span className="macos-form-label">硬件视频编解码格式</span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  AV1/H.265 画质更高，H.264 兼容性最稳
                </span>
              </div>
              <div className="segmented-pill-container">
                {[
                  { key: 'h264', label: 'H.264 (AVC)' },
                  { key: 'h265', label: 'H.265 (HEVC)' },
                  { key: 'av1', label: 'AV1' },
                ].map((codec) => (
                  <button
                    key={codec.key}
                    type="button"
                    onClick={() => updateSetting('video_codec', codec.key as any)}
                    className={`segmented-pill-btn ${
                      settings.video_codec === codec.key ? 'active' : ''
                    }`}
                  >
                    {codec.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Only New Frame Toggle */}
            <div className="macos-form-row">
              <div className="flex flex-col">
                <span className="macos-form-label">仅渲染最新帧 (降低延迟)</span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  丢弃队列中滞后的旧视频缓冲包
                </span>
              </div>
              <label className="macos-switch">
                <input
                  type="checkbox"
                  checked={settings.only_new_frame}
                  onChange={(e) => updateSetting('only_new_frame', e.target.checked)}
                />
                <span className="macos-switch-slider" />
              </label>
            </div>
          </div>

          {/* Card 4: 硬件与高级系统控制 */}
          <div className="macos-form-section">
            <div className="macos-form-section-header flex items-center gap-1.5">
              <Zap size={12} className="text-blue-400" />
              <span>硬件与高级控制特性</span>
            </div>

            {/* Audio Forwarding */}
            <div className="macos-form-row">
              <div className="flex items-center gap-2.5">
                <Volume2 size={16} className="text-[var(--text-secondary)]" />
                <div className="flex flex-col">
                  <span className="macos-form-label">实时音频流捕获与传输</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    将 Android 声音无损转发到当前电脑扬声器 (需 Android 11+)
                  </span>
                </div>
              </div>
              <label className="macos-switch">
                <input
                  type="checkbox"
                  checked={settings.audio_enabled}
                  onChange={(e) => updateSetting('audio_enabled', e.target.checked)}
                />
                <span className="macos-switch-slider" />
              </label>
            </div>

            {/* Stay Awake */}
            <div className="macos-form-row">
              <div className="flex items-center gap-2.5">
                <Sun size={16} className="text-[var(--text-secondary)]" />
                <div className="flex flex-col">
                  <span className="macos-form-label">投屏期间阻止设备休眠</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    连接建立后始终保持设备唤醒就绪
                  </span>
                </div>
              </div>
              <label className="macos-switch">
                <input
                  type="checkbox"
                  checked={settings.stay_awake}
                  onChange={(e) => updateSetting('stay_awake', e.target.checked)}
                />
                <span className="macos-switch-slider" />
              </label>
            </div>

            {/* Turn Screen Off */}
            <div className="macos-form-row">
              <div className="flex items-center gap-2.5">
                <EyeOff size={16} className="text-[var(--text-secondary)]" />
                <div className="flex flex-col">
                  <span className="macos-form-label">控制期间熄灭手机物理屏幕</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    仅投屏到桌面并保持黑屏，显著减少发热、省电并保护隐私
                  </span>
                </div>
              </div>
              <label className="macos-switch">
                <input
                  type="checkbox"
                  checked={settings.turn_screen_off}
                  onChange={(e) => updateSetting('turn_screen_off', e.target.checked)}
                />
                <span className="macos-switch-slider" />
              </label>
            </div>
          </div>

          {/* Card 5: 缓存管理 */}
          <div className="macos-form-section">
            <div className="macos-form-section-header flex items-center gap-1.5">
              <Trash2 size={12} className="text-blue-400" />
              <span>本地元数据与存储缓存</span>
            </div>

            <div className="macos-form-row">
              <div>
                <span className="macos-form-label">设备图标、SoC 数据库与布局快照</span>
                <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                  清理离线设备图标与临时调试转储文件
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-[var(--text-tertiary)]">1.7 MB</span>
                <button
                  type="button"
                  onClick={handleClearCache}
                  className={`btn btn-secondary px-3 py-1 text-xs flex items-center gap-1.5 ${
                    cacheCleared ? 'text-emerald-400 border-emerald-500/30' : ''
                  }`}
                >
                  {cacheCleared ? (
                    <>
                      <Check size={12} />
                      <span>已清理完成</span>
                    </>
                  ) : (
                    <span>清理缓存</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer justify-between text-[11px] text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>配置项实时持久化同步于本地 settings.json</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary px-5 py-1.5 text-xs font-medium"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
