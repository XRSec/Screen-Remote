import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AdbDevice, DeviceSession, DeviceTransport } from '../../types';
import {
  Radio,
  RefreshCw,
  X,
  Usb,
  Wifi,
  Plus,
  Check,
  Network,
  Smartphone,
  AlertCircle
} from 'lucide-react';

interface DiscoveredItem {
  id: string;
  name: string;
  address: string;
  transport: DeviceTransport;
  serial: string;
  status: string;
  isAdded: boolean;
}

interface DeviceDiscoveryModalProps {
  onClose: () => void;
  existingSessions: DeviceSession[];
  onAddSessionFromDiscovery: (session: Partial<DeviceSession>) => void;
}

export const DeviceDiscoveryModal: React.FC<DeviceDiscoveryModalProps> = ({
  onClose,
  existingSessions,
  onAddSessionFromDiscovery,
}) => {
  const [loading, setLoading] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredItem[]>([]);
  const [scanIpRange, setScanIpRange] = useState('');
  const [isScanningPorts, setIsScanningPorts] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Scan devices via adb list_devices and mdns services
  const runDiscovery = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const liveDevices = await invoke<AdbDevice[]>('list_devices', { customPath: null });

      const items: DiscoveredItem[] = [];

      for (const d of liveDevices) {
        const isWireless = d.is_wireless || d.serial.includes(':') || d.serial.includes('._tcp');
        const isMdns = d.serial.includes('._tcp') || d.serial.includes('adb-');
        const transport: DeviceTransport = isMdns ? 'mDNS' : isWireless ? 'TCP/IP' : 'USB';

        const friendlyName = d.model || d.product || (isWireless ? '无线 Android 设备' : 'USB Android 设备');

        // Check if already in existing sessions
        const isAlreadyAdded = existingSessions.some((s) => {
          return (
            s.connections.some((c) => c.serial === d.serial || (c.host && d.serial.includes(c.host))) ||
            s.active_serial === d.serial
          );
        });

        items.push({
          id: d.serial,
          name: friendlyName,
          address: d.serial,
          transport,
          serial: d.serial,
          status: d.state || '可连接',
          isAdded: isAlreadyAdded,
        });
      }

      setDiscoveredDevices(items);
    } catch (err: any) {
      console.error('Discovery failed:', err);
      setFeedback(`设备发现扫描失败: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [existingSessions]);

  useEffect(() => {
    runDiscovery();
  }, [runDiscovery]);

  const handleAdd = (item: DiscoveredItem) => {
    const isTcp = item.transport === 'TCP/IP';
    const host = isTcp ? item.address.split(':')[0] : '';
    const port = isTcp ? parseInt(item.address.split(':')[1] || '5555', 10) : 5555;

    const newSessionDraft: Partial<DeviceSession> = {
      name: item.name,
      model: item.name,
      is_connected: false,
      active_serial: item.serial,
      connections: [
        {
          id: `conn-${Date.now()}`,
          transport: item.transport,
          host,
          port,
          serial: item.serial,
          priority: 0,
        },
      ],
      scrcpy_options: {
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

    onAddSessionFromDiscovery(newSessionDraft);
    // Mark as added locally
    setDiscoveredDevices((prev) =>
      prev.map((d) => (d.id === item.id ? { ...d, isAdded: true } : d))
    );
  };

  const handleScanPort = async () => {
    if (!scanIpRange.trim()) return;
    setIsScanningPorts(true);
    setFeedback(null);
    try {
      // Connect to specified IP:port
      const target = scanIpRange.includes(':') ? scanIpRange : `${scanIpRange}:5555`;
      const res = await invoke<string>('connect_device', {
        address: target,
        customPath: null,
      });
      setFeedback(`扫描连接结果: ${res}`);
      runDiscovery();
    } catch (e: any) {
      setFeedback(`连接失败: ${e}`);
    } finally {
      setIsScanningPorts(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window-card"
        style={{ width: '680px', maxWidth: '95vw', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titlebar */}
        <div className="modal-titlebar">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Radio size={15} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">设备发现</h3>
              <p className="text-[11px] text-[#8e8e93]">
                查找通过 USB、TCP/IP 或 mDNS 连接的 Android 设备
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runDiscovery}
              disabled={loading}
              className="px-2.5 py-1 text-xs rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              title="重新扫描"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>刷新</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="modal-close-icon-btn"
              title="关闭"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body-scroll p-4 flex flex-col gap-4">
          {feedback && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Discovered Devices List */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">已发现的设备</span>
              <span className="text-[11px] text-[#8e8e93]">
                {loading ? '正在扫描设备...' : `发现 ${discoveredDevices.length} 台设备`}
              </span>
            </div>

            {discoveredDevices.length === 0 ? (
              <div className="p-8 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center text-center gap-2">
                <Smartphone size={32} className="text-neutral-500" />
                <span className="text-sm font-medium text-white">未找到未连接的设备</span>
                <span className="text-xs text-neutral-400 max-w-sm">
                  请确保设备已开启「开发者选项」和「USB 调试」并插好数据线，或在同一局域网下开启了无线调试。
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {discoveredDevices.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] border border-[var(--border-card)] flex items-center justify-between transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
                        {item.transport === 'USB' ? <Usb size={16} /> : <Wifi size={16} />}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">{item.name}</span>
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-black/5 dark:bg-white/[0.08] text-[var(--text-secondary)] font-mono">
                            {item.transport}
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--text-secondary)] font-mono">
                          {item.address}
                        </span>
                      </div>
                    </div>

                    <div>
                      {item.isAdded ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-500 bg-emerald-500/10 rounded-lg border border-emerald-500/20 font-medium">
                          <Check size={12} />
                          <span>已在会话中</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAdd(item)}
                          className="btn btn-primary px-3 py-1.5 text-xs font-medium cursor-pointer flex items-center gap-1.5"
                        >
                          <Plus size={13} />
                          <span>添加会话</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Network Port / Wireless ADB Manual Scan */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] flex flex-col gap-2.5 mt-2 shadow-sm">
            <div className="flex items-center gap-2">
              <Network size={14} className="text-blue-400" />
              <span className="text-xs font-semibold text-[var(--text-primary)]">手动网络连接 / 端口连接</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              输入局域网设备的 IP 地址和无线调试端口进行直连（例如 192.168.1.100:5555 或自定义端口）
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="192.168.x.x:5555"
                value={scanIpRange}
                onChange={(e) => setScanIpRange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanPort()}
                className="flex-1 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-black/30 border border-[var(--border-card)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleScanPort}
                disabled={isScanningPorts || !scanIpRange.trim()}
                className="btn btn-primary px-4 py-1.5 text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isScanningPorts && <RefreshCw size={12} className="animate-spin" />}
                <span>连接</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary px-4 py-1.5 text-xs"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
