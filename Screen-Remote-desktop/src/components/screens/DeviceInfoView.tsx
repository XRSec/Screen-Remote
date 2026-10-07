import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AdbDevice, DeviceDetails } from '../../types';
import {
  ParsedFullDeviceInfo,
  parseFullDeviceInfo,
} from '../../types/deviceInfo';
import {
  RotateCw,
  Copy,
  Check,
  Smartphone,
  BatteryCharging,
  HardDrive,
  Wifi,
  Maximize2,
  Cpu,
  Server,
  FileText,
  AlertTriangle,
} from 'lucide-react';



interface DeviceInfoViewProps {
  device: AdbDevice;
  onRefreshTrigger?: () => void;
}

export const DeviceInfoView: React.FC<DeviceInfoViewProps> = ({ device }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<ParsedFullDeviceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deployMsg, setDeployMsg] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const isMounted = useRef(true);
  const copyTimeoutRef = useRef<number | null>(null);
  const copyAllTimeoutRef = useRef<number | null>(null);
  const deployTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (copyAllTimeoutRef.current) clearTimeout(copyAllTimeoutRef.current);
      if (deployTimeoutRef.current) clearTimeout(deployTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [device.serial]);

  const fetchDeviceInfo = async (silent = false) => {
    if (!device?.serial) return;
    if (!silent) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      // 优先调用 DADB helper 快照，并发/合并调用 get_device_details
      const [dadbResult, fbResult] = await Promise.allSettled([
        invoke<Record<string, string>>('get_device_info_dadb', {
          serial: device.serial,
          customPath: null,
        }),
        invoke<DeviceDetails>('get_device_details', {
          serial: device.serial,
          customPath: null,
        }),
      ]);

      const dadbSnapshot = dadbResult.status === 'fulfilled' ? dadbResult.value : null;
      const fallbackDetails = fbResult.status === 'fulfilled' ? fbResult.value : null;

      if (dadbResult.status === 'rejected') {
        console.warn('DADB get_device_info_dadb failed:', dadbResult.reason);
      }
      if (fbResult.status === 'rejected') {
        console.warn('Fallback get_device_details failed:', fbResult.reason);
      }

      if (!dadbSnapshot && !fallbackDetails) {
        throw new Error('未能从设备读取硬件与系统信息，请确认设备已正确连接并授权 USB / 网络调试。');
      }

      const parsed = parseFullDeviceInfo(dadbSnapshot, device, fallbackDetails);
      if (isMounted.current) setInfo(parsed);
    } catch (err: any) {
      console.error('Fetch device info failed:', err);
      if (isMounted.current) setError(err?.message || String(err));
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchDeviceInfo(false);
  }, [device.serial]);

  const copyText = (text: string, key: string, label?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (label) {
      setCopyFeedback(`已复制 ${label}`);
    }
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      if (isMounted.current) {
        setCopyFeedback(null);
        setCopiedKey(null);
      }
    }, 2000) as any;
  };

  const copyAllReport = () => {
    if (!info) return;
    const lines: string[] = [];
    lines.push(`# 设备硬件与系统报告 - ${info.hardware.brandModel || info.hardware.serial}`);
    lines.push(`- 生成时间: ${new Date().toLocaleString()}`);
    lines.push(`- 数据源: ${info.source === 'dadb' ? 'DADB 原生快照' : info.source === 'merged' ? 'DADB + 系统合并' : '系统标准 ADB'}`);
    lines.push('');

    lines.push('## 硬件与系统 (Hardware & System)');
    lines.push(`- 品牌型号: ${info.hardware.brandModel}`);
    lines.push(`- 序列号: ${info.hardware.serial}`);
    lines.push(`- SoC 芯片: ${info.hardware.soc}`);
    lines.push(`- 主板 Board: ${info.hardware.board}`);
    lines.push(`- CPU 处理器: ${info.hardware.cpu}`);
    lines.push(`- ABI 架构: ${info.hardware.abi}`);
    lines.push(`- Android 版本: ${info.hardware.androidVersion} (SDK ${info.hardware.sdkLevel})`);
    lines.push(`- 安全补丁: ${info.hardware.securityPatch}`);
    lines.push(`- 开机时长: ${info.hardware.uptime}`);
    lines.push(`- 基带版本: ${info.hardware.baseband}`);
    lines.push(`- 产品代号: ${info.hardware.productCodename}`);
    lines.push(`- 连接方式: ${info.hardware.connection}`);
    if (info.hardware.fingerprint) {
      lines.push(`- 系统指纹: ${info.hardware.fingerprint}`);
    }
    lines.push('');

    lines.push('## 屏幕与显示 (Display & Screen)');
    lines.push(`- 分辨率: ${info.display.resolution}`);
    lines.push(`- 屏幕密度: ${info.display.dpi}`);
    lines.push(`- 屏幕 PPI: ${info.display.ppi}`);
    lines.push(`- 屏幕物理尺寸: ${info.display.screenSize}`);
    lines.push(`- 当前刷新率: ${info.display.currentRate}`);
    lines.push(`- 支持的刷新率: ${info.display.supportedRates}`);
    lines.push('');

    lines.push('## 电池状态 (Battery & Power)');
    lines.push(`- 电量: ${info.battery.levelText}`);
    lines.push(`- 充放电状态: ${info.battery.status}`);
    lines.push(`- 电池健康度: ${info.battery.health}`);
    lines.push(`- 实时电压: ${info.battery.voltage}`);
    lines.push(`- 实时电流: ${info.battery.current}`);
    lines.push(`- 电池温度: ${info.battery.temperature}`);
    if (info.battery.cycleCount) {
      lines.push(`- 循环次数: ${info.battery.cycleCount}`);
    }
    lines.push('');

    lines.push('## 存储与内存 (Storage & Memory)');
    lines.push(`- 运行内存 RAM: ${info.storageMemory.ram.summary || info.storageMemory.ram.totalFormatted}`);
    lines.push(`- 内部存储 /data: ${info.storageMemory.storage.summary || info.storageMemory.storage.totalFormatted}`);
    lines.push('');

    lines.push('## 网络与蜂窝 (Network & Cellular)');
    if (info.network.cellular) lines.push(`- 蜂窝网络: ${info.network.cellular}`);
    if (info.network.carrier) lines.push(`- 运营商: ${info.network.carrier}`);
    if (info.network.pci) lines.push(`- 基站 PCI: ${info.network.pci}`);
    if (info.network.arfcn) lines.push(`- ARFCN: ${info.network.arfcn}`);
    if (info.network.rsrp) lines.push(`- 信号 RSRP: ${info.network.rsrp}`);
    if (info.network.rsrq) lines.push(`- 信号 RSRQ: ${info.network.rsrq}`);
    if (info.network.sinr) lines.push(`- 信噪比 SINR: ${info.network.sinr}`);
    if (info.network.ssid) lines.push(`- Wi-Fi SSID: ${info.network.ssid}`);
    if (info.network.bssid) lines.push(`- Wi-Fi BSSID: ${info.network.bssid}`);
    if (info.network.wifiSummary) lines.push(`- Wi-Fi 频段与速率: ${info.network.wifiSummary}`);
    if (info.network.defaultGateway) lines.push(`- 默认网关: ${info.network.defaultGateway}`);
    if (info.network.wirelessPort) lines.push(`- 无线调试端口: ${info.network.wirelessPort}`);
    if (info.network.wlanMac) lines.push(`- WLAN MAC: ${info.network.wlanMac}`);
    if (info.network.interfaces.length > 0) {
      lines.push('- 网卡接口:');
      info.network.interfaces.forEach((it) => {
        lines.push(`  * ${it.label} (${it.name}): ${it.ip}`);
      });
    }

    navigator.clipboard.writeText(lines.join('\n'));
    setCopyFeedback('已复制全部硬件诊断报告');
    if (copyAllTimeoutRef.current) clearTimeout(copyAllTimeoutRef.current);
    copyAllTimeoutRef.current = setTimeout(() => {
      if (isMounted.current) setCopyFeedback(null);
    }, 2500) as any;
  };

  const handleRedeployServer = async () => {
    setIsDeploying(true);
    setDeployMsg(null);
    try {
      const res = await invoke<string>('deploy_bundled_server', {
        serial: device.serial,
        customPath: null,
      });
      setDeployMsg(res);
      if (deployTimeoutRef.current) clearTimeout(deployTimeoutRef.current);
      deployTimeoutRef.current = setTimeout(() => { if (isMounted.current) setDeployMsg(null); }, 3500) as any;
    } catch (e: any) {
      setDeployMsg(`部署失败: ${e}`);
      if (deployTimeoutRef.current) clearTimeout(deployTimeoutRef.current);
      deployTimeoutRef.current = setTimeout(() => { if (isMounted.current) setDeployMsg(null); }, 4000) as any;
    } finally {
      if (isMounted.current) setIsDeploying(false);
    }
  };

  // 渲染单个信息行，支持带一键复制按钮与等宽样式
  const renderRow = (
    label: string,
    value: string | undefined | null,
    key: string,
    options?: {
      isMonospace?: boolean;
      badge?: { text: string; type: 'success' | 'info' | 'warning' | 'purple' };
    }
  ) => {
    if (!value || !value.trim()) return null;
    const isCopied = copiedKey === key;
    return (
      <div className="info-item-row" key={key}>
        <span className="info-item-label">{label}</span>
        <div className="info-item-content">
          {options?.badge && (
            <span className={`badge badge-${options.badge.type}`} style={{ marginRight: '4px' }}>
              {options.badge.text}
            </span>
          )}
          <span className={`info-item-val ${options?.isMonospace ? 'monospace' : ''}`}>
            {value}
          </span>
          <button
            className={`info-copy-button ${isCopied ? 'copied' : ''}`}
            onClick={() => copyText(value, key, label)}
            title={`复制 ${label}`}
            aria-label={`复制 ${label}`}
          >
            {isCopied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
    );
  };

  // 骨架屏加载状态
  if (loading && !info) {
    return (
      <div className="screen-workspace-scroll">
        <div className="device-info-page">
          <div className="device-info-topbar">
            <div className="skeleton-shimmer" style={{ width: '220px', height: '36px' }} />
            <div className="skeleton-shimmer" style={{ width: '120px', height: '30px' }} />
          </div>
          <div className="device-info-skeleton-container">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div className="skeleton-card" key={i}>
                <div className="skeleton-shimmer skeleton-line title" />
                <div className="skeleton-shimmer skeleton-line" style={{ width: '80%' }} />
                <div className="skeleton-shimmer skeleton-line" style={{ width: '92%' }} />
                <div className="skeleton-shimmer skeleton-line" style={{ width: '65%' }} />
                <div className="skeleton-shimmer skeleton-line" style={{ width: '85%' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 错误提示状态
  if (error && !info) {
    return (
      <div className="empty-state">
        <AlertTriangle size={36} color="var(--accent-orange)" />
        <p style={{ maxWidth: '420px', lineHeight: 1.5 }}>{error}</p>
        <button
          className="btn btn-primary btn-small"
          onClick={() => fetchDeviceInfo(false)}
          style={{ marginTop: '8px' }}
        >
          <RotateCw size={14} /> 重试读取
        </button>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="empty-state">
        <Smartphone size={36} color="var(--text-secondary)" />
        <p>暂无设备硬件信息</p>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => fetchDeviceInfo(false)}
          style={{ marginTop: '8px' }}
        >
          刷新
        </button>
      </div>
    );
  }

  const { hardware, display, battery, network, storageMemory } = info;

  // 辅助计算电池胶囊填充色彩
  const getBatteryColorClass = (pct: number | null) => {
    if (pct == null) return 'fill-green';
    if (pct <= 20) return 'fill-red';
    if (pct <= 45) return 'fill-orange';
    return 'fill-green';
  };

  // 辅助计算资源占用胶囊色彩
  const getUsageColorClass = (pct: number | null) => {
    if (pct == null) return 'fill-blue';
    if (pct >= 90) return 'fill-red';
    if (pct >= 75) return 'fill-orange';
    return 'fill-blue';
  };

  return (
    <div ref={scrollRef} className="screen-workspace-scroll">
      <div className="device-info-page">
        {/* 顶部概览与操作栏 */}
        <div className="device-info-topbar">
          <div className="device-info-hero-left">
            <div className="device-info-avatar">
              <Smartphone size={22} />
            </div>
            <div className="device-info-title-box">
              <div className="device-info-main-title">
                {hardware.brandModel || hardware.model || 'Android 设备'}
                <span className="status-dot online" title="设备在线并已授权" />
              </div>
              <div className="device-info-sub-meta">
                <span style={{ fontFamily: 'monospace' }}>{hardware.serial}</span>
                <span>•</span>
                <span>{hardware.connection}</span>
                {hardware.androidVersion && (
                  <>
                    <span>•</span>
                    <span className="badge badge-success">Android {hardware.androidVersion}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="device-info-topbar-actions">
            {copyFeedback && (
              <span style={{ fontSize: '12px', color: 'var(--accent-green)', fontWeight: 500, marginRight: '4px' }}>
                {copyFeedback}
              </span>
            )}
            <button
              className="btn btn-secondary btn-small"
              onClick={copyAllReport}
              title="复制全部硬件与系统诊断报告 (Markdown)"
            >
              <FileText size={13} />
              <span>复制诊断报告</span>
            </button>
            <button
              className="btn btn-secondary btn-small"
              onClick={() => fetchDeviceInfo(true)}
              disabled={isRefreshing}
              title="重新读取设备快照指标"
            >
              <RotateCw size={13} className={isRefreshing ? 'spin' : ''} />
              <span>{isRefreshing ? '读取中...' : '刷新'}</span>
            </button>
          </div>
        </div>

        {/* 卡片栅格系统 (1:1 对齐 macOS) */}
        <div className="device-info-grid-aligned">
          {/* 1. 硬件与系统 (Hardware & System) */}
          <div className="info-card-aligned app-card">
            <div className="info-card-header-aligned">
              <div className="info-card-header-left">
                <div className="info-card-icon-wrap" style={{ backgroundColor: 'rgba(0, 122, 255, 0.1)', color: 'var(--accent-blue)' }}>
                  <Cpu size={15} />
                </div>
                <span className="info-card-title-aligned">硬件规格与系统架构</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Hardware & System</span>
            </div>
            <div className="info-card-body-aligned">
              {renderRow('品牌型号', hardware.brandModel, 'brandModel')}
              {renderRow('SoC 芯片', hardware.soc, 'soc')}
              {renderRow('主板代号', hardware.board, 'board')}
              {renderRow('CPU 处理器', hardware.cpu, 'cpu')}
              {renderRow('ABI 架构', hardware.abi, 'abi')}
              {renderRow('Android 版本', hardware.androidVersion ? `Android ${hardware.androidVersion}` : '', 'androidVersion')}
              {renderRow('SDK 级别', hardware.sdkLevel ? `API ${hardware.sdkLevel}` : '', 'sdkLevel')}
              {renderRow('开机运行时间', hardware.uptime, 'uptime')}
              {renderRow('基带版本', hardware.baseband, 'baseband')}
              {renderRow('产品代号', hardware.productCodename, 'productCodename')}
              {renderRow('安全补丁', hardware.securityPatch, 'securityPatch')}
              {renderRow('序列号', hardware.serial, 'serial', { isMonospace: true })}
              {renderRow('连接通道', hardware.connection, 'connection')}
              {renderRow('系统指纹', hardware.fingerprint, 'fingerprint', { isMonospace: true })}
            </div>
          </div>

          {/* 2. 屏幕与显示 (Display & Screen) */}
          <div className="info-card-aligned app-card">
            <div className="info-card-header-aligned">
              <div className="info-card-header-left">
                <div className="info-card-icon-wrap" style={{ backgroundColor: 'rgba(255, 149, 0, 0.1)', color: 'var(--accent-orange)' }}>
                  <Maximize2 size={15} />
                </div>
                <span className="info-card-title-aligned">屏幕与显示分辨率</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Display & Screen</span>
            </div>
            <div className="info-card-body-aligned">
              {renderRow('物理分辨率', display.resolution, 'resolution')}
              {renderRow('屏幕像素密度', display.dpi, 'dpi')}
              {renderRow('显示 PPI', display.ppi, 'ppi')}
              {renderRow('物理屏幕尺寸', display.screenSize, 'screenSize')}
              {renderRow('当前刷新率', display.currentRate, 'currentRate', {
                badge: display.currentRate ? { text: display.currentRate, type: 'info' } : undefined,
              })}
              {renderRow('支持的刷新率', display.supportedRates, 'supportedRates')}
            </div>
          </div>

          {/* 3. 电池健康与电源 (Battery & Power) */}
          <div className="info-card-aligned app-card">
            <div className="info-card-header-aligned">
              <div className="info-card-header-left">
                <div className="info-card-icon-wrap" style={{ backgroundColor: 'rgba(52, 199, 89, 0.1)', color: 'var(--accent-green)' }}>
                  <BatteryCharging size={15} />
                </div>
                <span className="info-card-title-aligned">电池健康与电源状态</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Battery & Power</span>
            </div>
            <div className="info-card-body-aligned">
              {/* 电池电量进度条展示 */}
              <div className="resource-progress-block">
                <div className="resource-progress-header">
                  <span className="resource-progress-title">剩余电量</span>
                  <span className="resource-progress-val" style={{ color: 'var(--text-primary)' }}>
                    {battery.levelText || (battery.levelPercent != null ? `${battery.levelPercent}%` : '未知')}
                  </span>
                </div>
                <div className="resource-bar-track">
                  <div
                    className={`resource-bar-fill ${getBatteryColorClass(battery.levelPercent)}`}
                    style={{ width: `${Math.min(100, Math.max(0, battery.levelPercent ?? 0))}%` }}
                  />
                </div>
              </div>

              {renderRow('充放电状态', battery.status, 'status', {
                badge: battery.status ? {
                  text: battery.status,
                  type: battery.status === '充电中' ? 'success' : battery.status === '已充满' ? 'info' : 'warning',
                } : undefined,
              })}
              {renderRow('电池健康度', battery.health, 'health')}
              {renderRow('实时电压', battery.voltage, 'voltage')}
              {renderRow('实时电流', battery.current, 'current')}
              {renderRow('电池温度', battery.temperature, 'temperature')}
              {renderRow('循环次数', battery.cycleCount ? `${battery.cycleCount} 次` : '', 'cycleCount')}
            </div>
          </div>

          {/* 4. 存储与运行内存 (Storage & Memory) */}
          <div className="info-card-aligned app-card">
            <div className="info-card-header-aligned">
              <div className="info-card-header-left">
                <div className="info-card-icon-wrap" style={{ backgroundColor: 'rgba(10, 132, 255, 0.1)', color: 'var(--accent-blue)' }}>
                  <HardDrive size={15} />
                </div>
                <span className="info-card-title-aligned">运行内存与内置存储</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Storage & Memory</span>
            </div>
            <div className="info-card-body-aligned">
              {/* RAM 内存进度条 */}
              <div className="resource-progress-block">
                <div className="resource-progress-header">
                  <span className="resource-progress-title">运行内存 (RAM)</span>
                  <span className="resource-progress-val">
                    {storageMemory.ram.percent != null ? `${storageMemory.ram.percent}%` : ''}
                  </span>
                </div>
                <div className="resource-bar-track">
                  <div
                    className={`resource-bar-fill ${getUsageColorClass(storageMemory.ram.percent)}`}
                    style={{ width: `${Math.min(100, Math.max(0, storageMemory.ram.percent ?? 0))}%` }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  <span>已用: {storageMemory.ram.usedFormatted || '未知'}</span>
                  <span>总量: {storageMemory.ram.totalFormatted || '未知'}</span>
                </div>
              </div>

              {/* /data 内部存储进度条 */}
              <div className="resource-progress-block">
                <div className="resource-progress-header">
                  <span className="resource-progress-title">内部存储 (/data)</span>
                  <span className="resource-progress-val">
                    {storageMemory.storage.percent != null ? `${storageMemory.storage.percent}%` : ''}
                  </span>
                </div>
                <div className="resource-bar-track">
                  <div
                    className={`resource-bar-fill ${getUsageColorClass(storageMemory.storage.percent)}`}
                    style={{ width: `${Math.min(100, Math.max(0, storageMemory.storage.percent ?? 0))}%` }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  <span>已用: {storageMemory.storage.usedFormatted || '未知'}</span>
                  <span>总量: {storageMemory.storage.totalFormatted || '未知'}</span>
                </div>
              </div>

              {renderRow('内存可用空间', storageMemory.ram.availableFormatted, 'ramAvailable')}
              {renderRow('存储可用空间', storageMemory.storage.availableFormatted, 'storageAvailable')}
            </div>
          </div>

          {/* 5. 网络与蜂窝参数 (Network & Cellular) */}
          <div className="info-card-aligned app-card" style={{ gridColumn: '1 / -1' }}>
            <div className="info-card-header-aligned">
              <div className="info-card-header-left">
                <div className="info-card-icon-wrap" style={{ backgroundColor: 'rgba(88, 86, 214, 0.1)', color: '#5856d6' }}>
                  <Wifi size={15} />
                </div>
                <span className="info-card-title-aligned">网络与蜂窝参数</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Network & Cellular</span>
            </div>
            <div className="info-card-body-aligned">
              {renderRow('蜂窝网络与频段', network.cellular, 'cellular')}
              {renderRow('运营商名称', network.carrier, 'carrier')}
              {renderRow('物理基站识别 (PCI)', network.pci, 'pci')}
              {renderRow('频点编号 (ARFCN)', network.arfcn, 'arfcn')}
              {renderRow('参考信号接收功率 (RSRP)', network.rsrp, 'rsrp')}
              {renderRow('参考信号接收质量 (RSRQ)', network.rsrq, 'rsrq')}
              {renderRow('信号与干扰噪声比 (SINR)', network.sinr, 'sinr')}

              {renderRow('Wi-Fi SSID', network.ssid, 'ssid')}
              {renderRow('Wi-Fi 频段与协商速率', network.wifiSummary, 'wifiSummary')}
              {renderRow('Wi-Fi BSSID', network.bssid, 'bssid', { isMonospace: true })}
              {renderRow('WLAN MAC 地址', network.wlanMac, 'wlanMac', { isMonospace: true })}

              {/* 网卡 IP 列表 */}
              {network.interfaces.map((iface, idx) =>
                renderRow(
                  `${iface.label} (${iface.name})`,
                  iface.ip,
                  `iface-${idx}-${iface.name}`,
                  { isMonospace: true }
                )
              )}

              {renderRow('默认网关 (Gateway)', network.defaultGateway, 'defaultGateway', { isMonospace: true })}
              {renderRow('无线调试端口', network.wirelessPort, 'wirelessPort', { isMonospace: true })}

              {/* 重新推送 Scrcpy Server 辅助操作 */}
              <div className="info-item-row" style={{ alignItems: 'center' }}>
                <span className="info-item-label">内置 Scrcpy Server</span>
                <div className="info-item-content">
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={handleRedeployServer}
                    disabled={isDeploying}
                  >
                    <Server size={12} />
                    <span>{isDeploying ? '正在推送...' : '重新推送到设备'}</span>
                  </button>
                </div>
              </div>
              {deployMsg && (
                <div style={{ fontSize: '12px', color: 'var(--accent-green)', padding: '4px 0 8px', textAlign: 'right' }}>
                  {deployMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
