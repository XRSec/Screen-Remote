import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DeviceSession, DeviceTransport } from '../../types';
import {
  Smartphone,
  ChevronRight,
  X,
  Check,
  Plus,
  Trash2,
  Usb,
  Wifi,
  Radio
} from 'lucide-react';

interface AddDeviceModalProps {
  onClose: () => void;
  onConnected: () => void;
  initialSession?: DeviceSession | null;
}

const ACCENT_COLORS = [
  { name: 'Indigo', hex: '#5e5ce6' },
  { name: 'Blue', hex: '#0a84ff' },
  { name: 'Cyan', hex: '#64d2ff' },
  { name: 'Green', hex: '#30d158' },
  { name: 'Orange', hex: '#ff9f0a' },
  { name: 'Purple', hex: '#bf5af2' },
];

export const AddDeviceModal: React.FC<AddDeviceModalProps> = ({
  onClose,
  onConnected,
  initialSession,
}) => {
  const isEditing = Boolean(initialSession);

  // Form states
  const [name, setName] = useState(initialSession?.name || '');
  const [accent, setAccent] = useState(initialSession?.accent || '#d97757');
  const [selectedGroup, setSelectedGroup] = useState<string>(
    initialSession?.group_ids?.[0] || '首页'
  );
  const [showingGroupSelector, setShowingGroupSelector] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<string[]>(['首页', '工作', '家庭', '测试']);
  const [newGroupName, setNewGroupName] = useState('');

  // Connections
  const [connections, setConnections] = useState<Array<{
    transport: DeviceTransport;
    host: string;
    port: number;
    serial: string;
    priority: number;
  }>>(
    initialSession?.connections?.map((c) => ({
      transport: c.transport || 'TCP/IP',
      host: c.host || '',
      port: c.port || 5555,
      serial: c.serial || '',
      priority: c.priority || 0,
    })) || [
      { transport: 'TCP/IP', host: '', port: 5555, serial: '', priority: 0 },
    ]
  );
  const [showingAddressEditor, setShowingAddressEditor] = useState(false);

  // Audio options
  const [enableAudio, setEnableAudio] = useState(
    initialSession?.scrcpy_options?.enable_audio ?? true
  );
  const [audioBitrate, setAudioBitrate] = useState(
    initialSession?.scrcpy_options?.audio_bitrate || '128K'
  );

  // Connection options
  const [compatibilityMode, setCompatibilityMode] = useState(false);
  const [gameMode, setGameMode] = useState(false);
  const [showFloatingBall, setShowFloatingBall] = useState(true);
  const [hardwareDecoding, setHardwareDecoding] = useState(true);

  // Video options
  const [maxSize, setMaxSize] = useState<string>(
    initialSession?.scrcpy_options?.max_size
      ? String(initialSession.scrcpy_options.max_size)
      : '0'
  );
  const [videoBitrate, setVideoBitrate] = useState<string>(
    initialSession?.scrcpy_options?.video_bitrate || '8M'
  );
  const [maxFPS, setMaxFPS] = useState<string>(
    initialSession?.scrcpy_options?.max_fps
      ? String(initialSession.scrcpy_options.max_fps)
      : '60'
  );

  // Other options
  const [clipboardSync, setClipboardSync] = useState(
    initialSession?.scrcpy_options?.clipboard_sync ?? true
  );
  const [turnScreenOff, setTurnScreenOff] = useState(
    initialSession?.scrcpy_options?.power_off_on_close ?? false
  );
  const [cleanupOnDisconnect, setCleanupOnDisconnect] = useState(
    initialSession?.scrcpy_options?.cleanup_on_disconnect ?? true
  );
  const [keepMacAwake, setKeepMacAwake] = useState(
    initialSession?.scrcpy_options?.keep_device_awake ?? true
  );

  // Virtual display
  const [newDisplayEnabled, setNewDisplayEnabled] = useState(
    initialSession?.scrcpy_options?.new_display_enabled ?? false
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step-by-step Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showingAddressEditor) {
          setShowingAddressEditor(false);
        } else if (showingGroupSelector) {
          setShowingGroupSelector(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showingAddressEditor, showingGroupSelector, onClose]);

  // Step-by-step outer backdrop click
  const handleOuterBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (showingAddressEditor) {
      setShowingAddressEditor(false);
    } else if (showingGroupSelector) {
      setShowingGroupSelector(false);
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('请输入会话名称');
      return;
    }

    setLoading(true);
    setError(null);

    const validConnections = connections.filter((c) => {
      if (!c) return false;
      const hostOk = Boolean(c.host && typeof c.host === 'string' && c.host.trim());
      const serialOk = Boolean(c.serial && typeof c.serial === 'string' && c.serial.trim());
      return hostOk || serialOk;
    });

    const targetSession: DeviceSession = {
      id: initialSession?.id || `session-${Date.now()}`,
      name: name.trim(),
      model: initialSession?.model || name.trim(),
      system_version: initialSession?.system_version || 'Android',
      battery: initialSession?.battery ?? 100,
      accent,
      is_connected: initialSession?.is_connected ?? false,
      active_serial: initialSession?.active_serial || validConnections[0]?.serial,
      active_transport: validConnections[0]?.transport || 'TCP/IP',
      connection_status: initialSession?.connection_status || 'disconnected',
      group_ids: [selectedGroup],
      connections: (validConnections.length > 0 ? validConnections : connections).map(
        (c, idx) => ({
          id: `conn-${idx}-${Date.now()}`,
          transport: c.transport,
          host: c.host,
          port: c.port,
          serial: c.serial,
          priority: c.priority,
        })
      ),
      scrcpy_options: {
        max_size: parseInt(maxSize, 10) || 0,
        video_bitrate: videoBitrate,
        max_fps: parseInt(maxFPS, 10) || 60,
        video_codec: initialSession?.scrcpy_options?.video_codec || 'h264',
        enable_audio: enableAudio,
        audio_codec: 'opus',
        audio_bitrate: audioBitrate,
        clipboard_sync: clipboardSync,
        keep_device_awake: keepMacAwake,
        power_off_on_close: turnScreenOff,
        cleanup_on_disconnect: cleanupOnDisconnect,
        new_display_enabled: newDisplayEnabled,
        new_display_width: 1200,
        new_display_height: 800,
        new_display_dpi: 280,
        virtual_display_system_decorations: false,
        preserve_virtual_display_content: false,
      },
    };

    try {
      await invoke('save_session', { session: targetSession });
      onConnected();
      onClose();
    } catch (e: any) {
      console.error('Failed to save session:', e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const primaryAddressDisplay = () => {
    if (!connections || !Array.isArray(connections)) return '未配置地址';
    const valid = connections.filter((c) => {
      if (!c) return false;
      const hostOk = Boolean(c.host && typeof c.host === 'string' && c.host.trim());
      const serialOk = Boolean(c.serial && typeof c.serial === 'string' && c.serial.trim());
      return hostOk || serialOk;
    });
    if (valid.length === 0) return '未配置地址';
    if (valid.length === 1) {
      const c = valid[0];
      if (c.transport === 'USB') return `USB (${c.serial || ''})`;
      return `${c.host || c.serial || '127.0.0.1'}:${c.port || 5555}`;
    }
    return `${valid.length} 个地址`;
  };

  return (
    <div className="modal-backdrop" onClick={handleOuterBackdropClick}>
      <div
        className="modal-window-card"
        style={{ width: '720px', height: '620px', maxWidth: '94vw', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Apple Style Sheet Titlebar */}
        <div className="modal-titlebar">
          <div className="flex items-center gap-3">
            <div className="app-icon-tile bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6]">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-white tracking-wide">
                {isEditing ? '编辑会话' : '添加会话'}
              </h2>
              <p className="text-[11px] text-[#98989f]">
                保存连接信息与会话偏好，随后可从侧边栏快速连接
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary px-3.5 py-1 text-xs"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="btn btn-primary px-4 py-1 text-xs font-semibold"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Form Body Scrollable Cards - Balanced 2 Columns */}
        <div className="modal-body-scroll p-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
            {/* COLUMN 1: 远程设备, 音频转发, 虚拟显示器 */}
            <div className="flex flex-col gap-3.5">
              {/* SECTION 1: 远程设备 */}
              <div className="macos-form-section">
                <div className="macos-form-section-header">远程设备</div>

                {/* 会话名称 */}
                <div className="macos-form-row">
                  <span className="macos-form-label">会话名称</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="如: Z5, Pixel 10..."
                    className="w-40 bg-black/25 border border-white/10 focus:border-[#0a84ff] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none transition-colors"
                  />
                </div>

                {/* 会话地址 */}
                <div
                  onClick={() => setShowingAddressEditor(true)}
                  className="macos-form-row cursor-pointer hover:bg-white/[0.03] transition-colors"
                >
                  <span className="macos-form-label">会话地址</span>
                  <div className="flex items-center gap-1.5 text-xs text-[#0a84ff] font-mono">
                    <span className="truncate max-w-[120px]">{primaryAddressDisplay()}</span>
                    <ChevronRight size={13} className="text-[#98989f] shrink-0" />
                  </div>
                </div>

                {/* 会话分组 */}
                <div
                  onClick={() => setShowingGroupSelector(true)}
                  className="macos-form-row cursor-pointer hover:bg-white/[0.03] transition-colors"
                >
                  <span className="macos-form-label">会话分组</span>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--cds-clay)] font-medium">
                    <span>{selectedGroup}</span>
                    <ChevronRight size={13} className="text-[#98989f] shrink-0" />
                  </div>
                </div>

                {/* 标记颜色 */}
                <div className="macos-form-row">
                  <span className="macos-form-label">标记颜色</span>
                  <div className="flex items-center gap-2">
                    {ACCENT_COLORS.map((c) => {
                      const isSelected = accent === c.hex;
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setAccent(c.hex)}
                          className="w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-sm"
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        >
                          {isSelected && <Check size={11} className="text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SECTION 2: 音频转发 */}
              <div className="macos-form-section">
                <div className="macos-form-section-header">音频转发</div>

                <div className="macos-form-row">
                  <span className="macos-form-label">启用音频</span>
                  <label className="macos-switch">
                    <input
                      type="checkbox"
                      checked={enableAudio}
                      onChange={(e) => setEnableAudio(e.target.checked)}
                    />
                    <span className="macos-switch-slider" />
                  </label>
                </div>

                {enableAudio && (
                  <div className="macos-form-row">
                    <span className="macos-form-label">音频码率</span>
                    <select
                      value={audioBitrate}
                      onChange={(e) => setAudioBitrate(e.target.value)}
                      className="macos-select"
                    >
                      <option value="64K">64 Kbps</option>
                      <option value="128K">128 Kbps (标准)</option>
                      <option value="192K">192 Kbps (高保真)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* SECTION 3: 虚拟显示器 */}
              <div className="macos-form-section">
                <div className="macos-form-section-header">虚拟显示器</div>

                <div className="macos-form-row">
                  <div>
                    <span className="macos-form-label">启动独立虚拟屏</span>
                    <span className="text-[10.5px] text-[#98989f] block mt-0.5">
                      创建不占用物理屏幕的副屏
                    </span>
                  </div>
                  <label className="macos-switch">
                    <input
                      type="checkbox"
                      checked={newDisplayEnabled}
                      onChange={(e) => setNewDisplayEnabled(e.target.checked)}
                    />
                    <span className="macos-switch-slider" />
                  </label>
                </div>
              </div>
            </div>

            {/* COLUMN 2: 连接选项, 视频画质, 设备行为与电源 */}
            <div className="flex flex-col gap-3.5">
              {/* SECTION 4: 连接选项 */}
              <div className="macos-form-section">
                <div className="macos-form-section-header">连接模式与解码</div>

                <div className="macos-form-row">
                  <span className="macos-form-label">兼容模式</span>
                  <label className="macos-switch">
                    <input
                      type="checkbox"
                      checked={compatibilityMode}
                      onChange={(e) => setCompatibilityMode(e.target.checked)}
                    />
                    <span className="macos-switch-slider" />
                  </label>
                </div>

                <div className="macos-form-row">
                  <span className="macos-form-label">游戏模式</span>
                  <label className="macos-switch">
                    <input
                      type="checkbox"
                      checked={gameMode}
                      onChange={(e) => setGameMode(e.target.checked)}
                    />
                    <span className="macos-switch-slider" />
                  </label>
                </div>

                <div className="macos-form-row">
                  <span className="macos-form-label">启用硬件解码</span>
                  <label className="macos-switch">
                    <input
                      type="checkbox"
                      checked={hardwareDecoding}
                      onChange={(e) => setHardwareDecoding(e.target.checked)}
                    />
                    <span className="macos-switch-slider" />
                  </label>
                </div>

                <div className="macos-form-row">
                  <span className="macos-form-label">显示悬浮控制球</span>
                  <label className="macos-switch">
                    <input
                      type="checkbox"
                      checked={showFloatingBall}
                      onChange={(e) => setShowFloatingBall(e.target.checked)}
                    />
                    <span className="macos-switch-slider" />
                  </label>
                </div>
              </div>

              {/* SECTION 5: 画面质量与视频编码 */}
              <div className="macos-form-section">
                <div className="macos-form-section-header">画面质量与编码</div>

                <div className="macos-form-row">
                  <span className="macos-form-label">最大分辨率</span>
                  <select
                    value={maxSize}
                    onChange={(e) => setMaxSize(e.target.value)}
                    className="macos-select"
                  >
                    <option value="0">原始尺寸 (原生)</option>
                    <option value="1920">1920P (高清)</option>
                    <option value="1080">1080P (清晰)</option>
                    <option value="720">720P (流畅)</option>
                  </select>
                </div>

                <div className="macos-form-row">
                  <span className="macos-form-label">视频码率</span>
                  <select
                    value={videoBitrate}
                    onChange={(e) => setVideoBitrate(e.target.value)}
                    className="macos-select"
                  >
                    <option value="2M">2 Mbps</option>
                    <option value="4M">4 Mbps</option>
                    <option value="8M">8 Mbps (标准)</option>
                    <option value="16M">16 Mbps</option>
                    <option value="30M">30 Mbps</option>
                  </select>
                </div>

                <div className="macos-form-row">
                  <span className="macos-form-label">最大帧率</span>
                  <select
                    value={maxFPS}
                    onChange={(e) => setMaxFPS(e.target.value)}
                    className="macos-select"
                  >
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS (推荐)</option>
                    <option value="90">90 FPS</option>
                    <option value="120">120 FPS</option>
                  </select>
                </div>
              </div>

              {/* SECTION 6: 设备交互与电源选项 */}
              <div className="macos-form-section">
                <div className="macos-form-section-header">交互与电源行为</div>

                <div className="macos-form-row">
                  <span className="macos-form-label">同步剪贴板</span>
                  <label className="macos-switch">
                    <input
                      type="checkbox"
                      checked={clipboardSync}
                      onChange={(e) => setClipboardSync(e.target.checked)}
                    />
                    <span className="macos-switch-slider" />
                  </label>
                </div>

                <div className="macos-form-row">
                  <span className="macos-form-label">连接后关闭屏幕</span>
                  <label className="macos-switch">
                    <input
                      type="checkbox"
                      checked={turnScreenOff}
                      onChange={(e) => setTurnScreenOff(e.target.checked)}
                    />
                    <span className="macos-switch-slider" />
                  </label>
                </div>

                <div className="macos-form-row">
                  <span className="macos-form-label">保持 Mac 唤醒</span>
                  <label className="macos-switch">
                    <input
                      type="checkbox"
                      checked={keepMacAwake}
                      onChange={(e) => setKeepMacAwake(e.target.checked)}
                    />
                    <span className="macos-switch-slider" />
                  </label>
                </div>

                <div className="macos-form-row">
                  <span className="macos-form-label">断开后清理后台</span>
                  <label className="macos-switch">
                    <input
                      type="checkbox"
                      checked={cleanupOnDisconnect}
                      onChange={(e) => setCleanupOnDisconnect(e.target.checked)}
                    />
                    <span className="macos-switch-slider" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info note */}
        <div className="modal-footer justify-between text-[11px] text-[#98989f]">
          <span>保存只会更新设备偏好配置，不会直接影响正在运行中的物理设备。</span>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="btn btn-primary px-4 py-1 text-xs"
          >
            {loading ? '保存中...' : '完成'}
          </button>
        </div>
      </div>

      {/* Address Editor Sub-Sheet - Independent Step-by-Step Level */}
      {showingAddressEditor && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowingAddressEditor(false);
            }
          }}
        >
          <div
            className="modal-window-card"
            style={{ width: '520px', maxWidth: '92vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-titlebar">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">会话连接地址</h3>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  支持配置多候选地址并在连接时竞速
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowingAddressEditor(false)}
                className="modal-close-icon-btn"
                title="返回编辑页面"
              >
                <X size={14} />
              </button>
            </div>

            <div className="modal-body-scroll p-4 flex flex-col gap-3">
              {connections.map((conn, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] flex flex-col gap-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {idx === 0 ? '首选连接' : `备用连接 ${idx}`}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-black/5 dark:bg-white/[0.08] text-[var(--text-secondary)] font-mono">
                        优先级 {idx}
                      </span>
                    </div>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setConnections(connections.filter((_, i) => i !== idx))
                        }
                        className="text-neutral-400 hover:text-red-400 p-1 cursor-pointer transition-colors"
                        title="移除备用连接"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Segmented Transport Selector */}
                  <div className="bg-black/5 dark:bg-black/25 p-1 rounded-lg border border-[var(--border-card)] flex gap-1">
                    {(['TCP/IP', 'USB', 'mDNS'] as DeviceTransport[]).map((t) => {
                      const isSel = conn.transport === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            const next = [...connections];
                            next[idx].transport = t;
                            setConnections(next);
                          }}
                          className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            isSel
                              ? 'bg-[var(--cds-clay)] text-white shadow-sm'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {t === 'USB' ? (
                            <Usb size={12} />
                          ) : t === 'mDNS' ? (
                            <Radio size={12} />
                          ) : (
                            <Wifi size={12} />
                          )}
                          <span>{t}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Inputs */}
                  {conn.transport === 'TCP/IP' ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[10px] text-[var(--text-secondary)]">主机 / IP 地址</label>
                        <input
                          type="text"
                          placeholder="192.168.1.100 或域名"
                          value={conn.host}
                          onChange={(e) => {
                            const next = [...connections];
                            next[idx].host = e.target.value;
                            setConnections(next);
                          }}
                          className="w-full bg-black/5 dark:bg-black/30 border border-[var(--border-card)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--cds-clay)]"
                        />
                      </div>
                      <div className="w-20 flex flex-col gap-1">
                        <label className="text-[10px] text-[var(--text-secondary)]">端口</label>
                        <input
                          type="number"
                          placeholder="5555"
                          value={conn.port}
                          onChange={(e) => {
                            const next = [...connections];
                            next[idx].port = parseInt(e.target.value, 10) || 5555;
                            setConnections(next);
                          }}
                          className="w-full bg-black/5 dark:bg-black/30 border border-[var(--border-card)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--cds-clay)]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--text-secondary)]">
                        {conn.transport === 'USB' ? 'USB 设备序列号 (Serial)' : 'mDNS 服务名称'}
                      </label>
                      <input
                        type="text"
                        placeholder={conn.transport === 'USB' ? '如: 10AEAG2YZS0020P' : '如: adb-10AEAG2YZS0020P'}
                        value={conn.serial}
                        onChange={(e) => {
                          const next = [...connections];
                          next[idx].serial = e.target.value;
                          setConnections(next);
                        }}
                        className="w-full bg-black/5 dark:bg-black/30 border border-[var(--border-card)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--cds-clay)]"
                      />
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setConnections([
                    ...connections,
                    {
                      transport: 'TCP/IP',
                      host: '',
                      port: 5555,
                      serial: '',
                      priority: connections.length,
                    },
                  ])
                }
                className="w-full py-2 border border-dashed border-[var(--border-card)] hover:border-[var(--cds-clay)] rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-1"
              >
                <Plus size={13} />
                <span>添加备用连接</span>
              </button>
            </div>

            <div className="modal-footer justify-end">
              <button
                type="button"
                onClick={() => setShowingAddressEditor(false)}
                className="btn btn-primary px-4 py-1 text-xs"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Selector Sub-Sheet - Independent Step-by-Step Level */}
      {showingGroupSelector && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowingGroupSelector(false);
          }}
        >
          <div
            className="modal-window-card"
            style={{ width: '420px', maxWidth: '92vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-titlebar">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">选择设备分组</h3>
              <button
                type="button"
                onClick={() => setShowingGroupSelector(false)}
                className="modal-close-icon-btn"
                title="返回编辑页面"
              >
                <X size={14} />
              </button>
            </div>

            <div className="modal-body-scroll p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-1.5 shadow-sm">
                {availableGroups.map((grp) => {
                  const isSel = selectedGroup === grp;
                  return (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => {
                        setSelectedGroup(grp);
                        setShowingGroupSelector(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isSel
                          ? 'bg-[var(--cds-clay-subtle)] text-[var(--cds-clay)] font-semibold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span>{grp}</span>
                      {isSel && <Check size={14} className="text-[var(--cds-clay)]" />}
                    </button>
                  );
                })}
              </div>

              {/* Add custom group */}
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  placeholder="新建分组名称..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newGroupName.trim()) {
                      const trimmed = newGroupName.trim();
                      if (!availableGroups.includes(trimmed)) {
                        setAvailableGroups([...availableGroups, trimmed]);
                      }
                      setSelectedGroup(trimmed);
                      setNewGroupName('');
                      setShowingGroupSelector(false);
                    }
                  }}
                  className="flex-1 bg-black/5 dark:bg-black/30 border border-[var(--border-card)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--cds-clay)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newGroupName.trim()) {
                      const trimmed = newGroupName.trim();
                      if (!availableGroups.includes(trimmed)) {
                        setAvailableGroups([...availableGroups, trimmed]);
                      }
                      setSelectedGroup(trimmed);
                      setNewGroupName('');
                      setShowingGroupSelector(false);
                    }
                  }}
                  disabled={!newGroupName.trim()}
                  className="btn btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  添加
                </button>
              </div>
            </div>

            <div className="modal-footer justify-end">
              <button
                type="button"
                onClick={() => setShowingGroupSelector(false)}
                className="btn btn-primary px-4 py-1 text-xs"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
