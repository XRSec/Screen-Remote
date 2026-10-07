import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AdbDevice } from '../../types';
import { ArrowLeftRight, Trash2, Loader2, ArrowRight } from 'lucide-react';

interface DevicePortForwardViewProps {
  device: AdbDevice;
  onNotify: (msg: string, isError?: boolean) => void;
}

interface ForwardEntry {
  serial: string;
  local: string;
  remote: string;
}

export const DevicePortForwardView: React.FC<DevicePortForwardViewProps> = ({
  device,
  onNotify,
}) => {
  const [entries, setEntries] = useState<ForwardEntry[]>([]);
  const [localPort, setLocalPort] = useState('8080');
  const [remotePort, setRemotePort] = useState('8080');
  const [isLoading, setIsLoading] = useState(false);
  const [isOperating, setIsOperating] = useState(false);

  // Fetch list using run_raw_adb_command with "forward --list"
  const fetchRules = useCallback(async () => {
    if (!device?.serial) return;
    setIsLoading(true);
    try {
      const output = await invoke<string>('run_raw_adb_command', {
        args: ['-s', device.serial, 'forward', '--list'],
        customPath: null,
      });

      const parsed: ForwardEntry[] = [];
      const lines = output.split('\n');

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const fields = line.split(/\s+/);
        if (fields.length >= 3 && fields[0] === device.serial) {
          parsed.push({
            serial: fields[0],
            local: fields[1],
            remote: fields[2],
          });
        }
      }

      setEntries(parsed);
    } catch (e: any) {
      console.warn('Failed to list port forwards:', e);
      onNotify(`获取端口转发规则失败: ${e}`, true);
    } finally {
      setIsLoading(false);
    }
  }, [device?.serial]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Add forward rule using run_raw_adb_command with "forward tcp:local tcp:remote"
  const handleAddForward = async () => {
    const trimmedLocal = localPort.trim();
    const trimmedRemote = remotePort.trim();

    if (!trimmedLocal || !trimmedRemote) {
      onNotify('请输入有效的本地端口与设备端口', true);
      return;
    }

    const localSpec = trimmedLocal.startsWith('tcp:') ? trimmedLocal : `tcp:${trimmedLocal}`;
    const remoteSpec =
      trimmedRemote.startsWith('tcp:') || trimmedRemote.startsWith('localabstract:')
        ? trimmedRemote
        : `tcp:${trimmedRemote}`;

    setIsOperating(true);
    try {
      await invoke('run_raw_adb_command', {
        args: ['-s', device.serial, 'forward', localSpec, remoteSpec],
        customPath: null,
      });
      onNotify(`已添加端口转发: ${localSpec} -> ${remoteSpec}`);
      fetchRules();
    } catch (e: any) {
      onNotify(`添加端口转发失败: ${e}`, true);
    } finally {
      setIsOperating(false);
    }
  };

  // Remove forward rule using run_raw_adb_command with "forward --remove tcp:local"
  const handleRemoveForward = async (entry: ForwardEntry) => {
    setIsOperating(true);
    try {
      await invoke('run_raw_adb_command', {
        args: ['-s', device.serial, 'forward', '--remove', entry.local],
        customPath: null,
      });
      onNotify(`已移除端口转发: ${entry.local}`);
      fetchRules();
    } catch (e: any) {
      onNotify(`移除端口转发失败: ${e}`, true);
    } finally {
      setIsOperating(false);
    }
  };

  return (
    <div className="screen-workspace-scroll" style={{ padding: '24px 32px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        {/* Top Input Card matching native_tab_port_forward.png */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'flex-end',
            gap: '12px',
            padding: '12px 18px',
            backgroundColor: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            marginBottom: '20px',
          }}
        >
          {/* Local Port Field */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: '#8e8e93',
                marginBottom: '5px',
              }}
            >
              本机端口
            </div>
            <input
              type="text"
              value={localPort}
              onChange={(e) => setLocalPort(e.target.value)}
              placeholder="8080"
              style={{
                width: '88px',
                height: '26px',
                padding: '2px 8px',
                fontSize: '12.5px',
                backgroundColor: '#28282b',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '5px',
                color: '#ffffff',
                outline: 'none',
              }}
            />
          </div>

          {/* Arrow */}
          <div
            style={{
              color: '#8e8e93',
              paddingBottom: '5px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ArrowRight size={13} />
          </div>

          {/* Remote Port Field */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: '#8e8e93',
                marginBottom: '5px',
              }}
            >
              设备端口
            </div>
            <input
              type="text"
              value={remotePort}
              onChange={(e) => setRemotePort(e.target.value)}
              placeholder="8080"
              style={{
                width: '88px',
                height: '26px',
                padding: '2px 8px',
                fontSize: '12.5px',
                backgroundColor: '#28282b',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '5px',
                color: '#ffffff',
                outline: 'none',
              }}
            />
          </div>

          {/* Add Button */}
          <button
            type="button"
            onClick={handleAddForward}
            disabled={isOperating || !localPort.trim() || !remotePort.trim()}
            style={{
              height: '26px',
              padding: '0 14px',
              borderRadius: '5px',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              cursor: isOperating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isOperating) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)';
            }}
            onMouseLeave={(e) => {
              if (!isOperating) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            }}
          >
            {isOperating ? <Loader2 size={12} className="animate-spin" /> : '添加'}
          </button>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-white/50">
            <Loader2 size={14} className="animate-spin text-[#0a84ff]" />
            <span>正在读取端口转发规则...</span>
          </div>
        )}

        {/* Rules List Container Card matching native_tab_port_forward.png */}
        {!isLoading && entries.length === 0 ? (
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '60px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <ArrowLeftRight
              size={36}
              style={{ color: 'rgba(255, 255, 255, 0.2)', marginBottom: '12px' }}
            />
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.75)',
                marginBottom: '4px',
              }}
            >
              暂无活动端口转发规则
            </div>
            <div style={{ fontSize: '12px', color: '#8e8e93' }}>
              在上方输入本机端口与设备端口并点击“添加”以创建规则。
            </div>
          </div>
        ) : (
          !isLoading && (
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                overflow: 'hidden',
              }}
            >
              {entries.map((entry, idx) => (
                <React.Fragment key={`${entry.serial}-${entry.local}-${entry.remote}-${idx}`}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '11px 18px',
                      minHeight: '42px',
                    }}
                  >
                    {/* Blue Swap Arrow Icon */}
                    <div style={{ width: '26px', display: 'flex', alignItems: 'center' }}>
                      <ArrowLeftRight size={13.5} color="#0a84ff" />
                    </div>

                    {/* Monospaced Rule Text */}
                    <div
                      style={{
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                        fontSize: '12.5px',
                        color: 'rgba(255, 255, 255, 0.92)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <span>{entry.local}</span>
                      <span style={{ color: '#8e8e93' }}>→</span>
                      <span>{entry.remote}</span>
                    </div>

                    <div style={{ flex: 1 }} />

                    {/* Trash Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveForward(entry)}
                      title="移除此规则"
                      disabled={isOperating}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#8e8e93',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ff453a')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#8e8e93')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Row Divider with leading indent */}
                  {idx !== entries.length - 1 && (
                    <div
                      style={{
                        height: '0.5px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        marginLeft: '44px',
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
