import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AdbDevice } from '../types';
import { DeviceWorkspace } from './DeviceWorkspace';
import { 
  Smartphone, 
  Wifi, 
  Usb, 
  RotateCw, 
  Play, 
  Square, 
  BatteryCharging, 
  Plus, 
  Laptop,
  CheckCircle2,
  AlertCircle,
  Sliders
} from 'lucide-react';

export const DevicesView: React.FC = () => {
  const [devices, setDevices] = useState<AdbDevice[]>([]);
  const [activeSessions, setActiveSessions] = useState<string[]>([]);
  const [batteries, setBatteries] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [connectAddress, setConnectAddress] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<AdbDevice | null>(null);

  const fetchDevices = async () => {
    setLoading(true);
    setConnectError(null);
    try {
      const devs = await invoke<AdbDevice[]>('list_devices', { customPath: null });
      setDevices(devs);

      const active = await invoke<string[]>('get_active_sessions');
      setActiveSessions(active);

      // Fetch battery for each ready device
      const batMap: Record<string, number | null> = {};
      for (const dev of devs) {
        if (dev.state === 'device') {
          try {
            const bat = await invoke<number | null>('get_battery_info', {
              serial: dev.serial,
              customPath: null,
            });
            batMap[String(dev.serial)] = bat;
          } catch {
            batMap[String(dev.serial)] = null;
          }
        }
      }
      setBatteries(batMap);

      // Keep selected device synced
      if (selectedDevice) {
        const stillPresent = devs.find((d) => d.serial === selectedDevice.serial);
        if (stillPresent) {
          setSelectedDevice(stillPresent);
        }
      }
    } catch (e: any) {
      console.error('Failed to list devices:', e);
      setConnectError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectWireless = async () => {
    if (!connectAddress.trim()) return;
    setLoading(true);
    setConnectError(null);
    try {
      await invoke('connect_device', { address: connectAddress.trim(), customPath: null });
      setConnectAddress('');
      await fetchDevices();
    } catch (e: any) {
      setConnectError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (serial: string) => {
    try {
      await invoke('disconnect_device', { address: serial, customPath: null });
      if (selectedDevice?.serial === serial) {
        setSelectedDevice(null);
      }
      await fetchDevices();
    } catch (e: any) {
      console.error('Disconnect failed:', e);
    }
  };

  const handleStartSession = async (serial: string) => {
    try {
      await invoke('start_session', { serial });
      const active = await invoke<string[]>('get_active_sessions');
      setActiveSessions(active);
    } catch (e: any) {
      alert(`启动远控失败: ${e}`);
    }
  };

  const handleStopSession = async (serial: string) => {
    try {
      await invoke('stop_session', { serial });
      const active = await invoke<string[]>('get_active_sessions');
      setActiveSessions(active);
    } catch (e: any) {
      console.error('Stop session failed:', e);
    }
  };

  // If a device is selected, render the dedicated workspace
  if (selectedDevice) {
    return (
      <DeviceWorkspace
        device={selectedDevice}
        onBack={() => setSelectedDevice(null)}
        activeSessions={activeSessions}
        onStartSession={handleStartSession}
        onStopSession={handleStopSession}
      />
    );
  }

  return (
    <div>
      {/* Top action section */}
      <div className="card-section">
        <div className="section-title">无线连接与设备发现</div>
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              className="text-input"
              placeholder="输入设备 IP:端口 (例 192.168.1.100:5555)"
              style={{ flex: 1 }}
              value={connectAddress}
              onChange={(e) => setConnectAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnectWireless()}
            />
            <button className="btn btn-primary" onClick={handleConnectWireless} disabled={loading}>
              <Plus size={15} />
              连接设备
            </button>
            <button className="btn btn-secondary" onClick={fetchDevices} disabled={loading}>
              <RotateCw size={14} className={loading ? 'spin' : ''} />
              刷新
            </button>
          </div>
          {connectError && (
            <div style={{ marginTop: '10px', color: 'var(--accent-red)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} />
              {connectError}
            </div>
          )}
        </div>
      </div>

      {/* Devices list section */}
      <div className="card-section">
        <div className="section-title">已连接设备 ({devices.length})</div>
        {devices.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Laptop size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
            <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
              暂未检测到在线设备
            </div>
            <div style={{ fontSize: '13px' }}>
              请使用 USB 数据线连接手机并开启 USB 调试，或通过上方输入局域网 IP 进行无线配对。
            </div>
          </div>
        ) : (
          devices.map((dev) => {
            const serialStr = String(dev.serial);
            const isSessionActive = activeSessions.includes(serialStr);
            const battery = batteries[serialStr];

            return (
              <div key={serialStr} className="device-card">
                <div className="device-info" onClick={() => setSelectedDevice(dev)} style={{ cursor: 'pointer' }}>
                  <div className="device-icon-box">
                    <Smartphone size={24} />
                  </div>
                  <div className="device-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="device-model">{dev.model || dev.device || 'Android Device'}</span>
                      {dev.is_wireless ? (
                        <span className="badge badge-online">
                          <Wifi size={11} /> Wi-Fi
                        </span>
                      ) : (
                        <span className="badge badge-online">
                          <Usb size={11} /> USB
                        </span>
                      )}
                      {battery != null && (
                        <span className="badge badge-online" style={{ color: 'var(--text-secondary)' }}>
                          <BatteryCharging size={12} color="var(--accent-green)" /> {battery}%
                        </span>
                      )}
                    </div>
                    <div className="device-subtext">
                      <span>序列号: {serialStr}</span>
                      <span>·</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} color="var(--accent-green)" />
                        {dev.state === 'device' ? '就绪' : dev.state}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                    onClick={() => setSelectedDevice(dev)}
                  >
                    <Sliders size={13} />
                    管理工作台
                  </button>

                  {isSessionActive ? (
                    <button className="btn btn-danger" onClick={() => handleStopSession(serialStr)}>
                      <Square size={14} />
                      停止远控
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => handleStartSession(serialStr)}>
                      <Play size={14} fill="white" />
                      启动远控
                    </button>
                  )}

                  {dev.is_wireless && (
                    <button className="btn btn-secondary" onClick={() => handleDisconnect(serialStr)}>
                      断开
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
