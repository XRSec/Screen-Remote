import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppSettings } from '../types';
import { Check, Terminal, Sun, Moon, Monitor } from 'lucide-react';

interface Props {
  settings: AppSettings;
  onChange: (newSettings: AppSettings) => void;
}

export const SettingsView: React.FC<Props> = ({ settings, onChange }) => {
  const [adbTestResult, setAdbTestResult] = useState<string | null>(null);
  const [adbTesting, setAdbTesting] = useState(false);

  const update = (patch: Partial<AppSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const testAdb = async () => {
    setAdbTesting(true);
    setAdbTestResult(null);
    try {
      const res = await invoke<string>('get_adb_version', {
        customPath: settings.adb_path || null,
      });
      setAdbTestResult(`✓ 检测成功: ${res.split('\n')[0]}`);
    } catch (e: any) {
      setAdbTestResult(`✗ 检测失败: ${e}`);
    } finally {
      setAdbTesting(false);
    }
  };

  return (
    <div>
      {/* 外观设置 */}
      <div className="card-section">
        <div className="section-title">界面外观</div>
        <div className="card">
          <div
            className="list-item"
            style={{ cursor: 'pointer' }}
            onClick={() => update({ theme: 'system' })}
          >
            <div className="list-item-left">
              <Monitor size={16} color="var(--text-secondary)" />
              <span>跟随系统外观</span>
            </div>
            <div className="list-item-right">
              {settings.theme === 'system' && <Check size={18} color="var(--accent-blue)" />}
            </div>
          </div>

          <div className="card-divider" />

          <div
            className="list-item"
            style={{ cursor: 'pointer' }}
            onClick={() => update({ theme: 'light' })}
          >
            <div className="list-item-left">
              <Sun size={16} color="var(--accent-orange)" />
              <span>浅色模式</span>
            </div>
            <div className="list-item-right">
              {settings.theme === 'light' && <Check size={18} color="var(--accent-blue)" />}
            </div>
          </div>

          <div className="card-divider" />

          <div
            className="list-item"
            style={{ cursor: 'pointer' }}
            onClick={() => update({ theme: 'dark' })}
          >
            <div className="list-item-left">
              <Moon size={16} color="var(--accent-blue)" />
              <span>深色模式</span>
            </div>
            <div className="list-item-right">
              {settings.theme === 'dark' && <Check size={18} color="var(--accent-blue)" />}
            </div>
          </div>
        </div>
      </div>

      {/* ADB 配置 */}
      <div className="card-section">
        <div className="section-title">ADB 执行路径配置</div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ marginBottom: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            默认将自动搜索系统 PATH 及 Android SDK platform-tools 路径。若有自定义 ADB 需求可在此指定绝对路径。
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              className="text-input"
              placeholder="留空则自动检测 (例如 /Users/.../platform-tools/adb)"
              style={{ flex: 1 }}
              value={settings.adb_path || ''}
              onChange={(e) => update({ adb_path: e.target.value || null })}
            />
            <button className="btn btn-secondary" onClick={testAdb} disabled={adbTesting}>
              <Terminal size={14} />
              测试路径
            </button>
          </div>
          {adbTestResult && (
            <div
              style={{
                marginTop: '12px',
                fontSize: '12px',
                color: adbTestResult.startsWith('✓') ? 'var(--accent-green)' : 'var(--accent-red)',
              }}
            >
              {adbTestResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
