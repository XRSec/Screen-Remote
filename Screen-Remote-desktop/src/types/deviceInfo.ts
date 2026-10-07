import { AdbDevice, DeviceDetails } from '../types';

export type RemoteDeviceField =
  | 'model'
  | 'manufacturer'
  | 'soc_model'
  | 'android_version'
  | 'sdk'
  | 'uptime'
  | 'baseband'
  | 'product_code_name'
  | 'security_patch'
  | 'serial'
  | 'resolution'
  | 'density'
  | 'display_metrics'
  | 'display_info'
  | 'network_interfaces'
  | 'default_route'
  | 'mobile_network_type'
  | 'carrier_names'
  | 'signal_strength'
  | 'cell_identity'
  | 'wifi_info'
  | 'memory'
  | 'data_filesystem'
  | 'battery_cycle'
  | 'battery'
  | 'voltage_now'
  | 'battery_current_now'
  | 'battery_current_average'
  | 'sysfs_current'
  | 'abi'
  | 'board'
  | 'fingerprint'
  | 'wireless_port'
  | 'cpu_count'
  | 'cpu_max_frequency';

export interface HardwareSystemInfo {
  brandModel: string;
  manufacturer: string;
  model: string;
  soc: string;
  board: string;
  cpu: string;
  cpuCores: number | null;
  cpuFrequency: string;
  abi: string;
  fingerprint: string;
  androidVersion: string;
  sdkLevel: string;
  securityPatch: string;
  uptime: string;
  baseband: string;
  productCodename: string;
  serial: string;
  connection: string;
}

export interface DisplayScreenInfo {
  resolution: string;
  dpi: string;
  ppi: string;
  screenSize: string;
  currentRate: string;
  supportedRates: string;
}

export interface BatteryPowerInfo {
  levelPercent: number | null;
  levelText: string;
  status: string;
  health: string;
  voltage: string;
  voltageMv: number | null;
  current: string;
  temperature: string;
  cycleCount: string;
}

export interface NetworkInterfaceItem {
  name: string;
  ip: string;
  label: string;
}

export interface NetworkCellularInfo {
  cellular: string;
  networkType: string;
  carrier: string;
  pci: string;
  arfcn: string;
  rsrp: string;
  rsrq: string;
  sinr: string;
  ssid: string;
  bssid: string;
  wifiSummary: string;
  interfaces: NetworkInterfaceItem[];
  defaultGateway: string;
  wirelessPort: string;
  wlanMac: string;
}

export interface ResourceUsage {
  usedBytes: number | null;
  totalBytes: number | null;
  availableBytes: number | null;
  usedFormatted: string;
  totalFormatted: string;
  availableFormatted: string;
  percent: number | null;
  summary: string;
}

export interface StorageMemoryInfo {
  ram: ResourceUsage;
  storage: ResourceUsage;
}

export interface ParsedFullDeviceInfo {
  hardware: HardwareSystemInfo;
  display: DisplayScreenInfo;
  battery: BatteryPowerInfo;
  network: NetworkCellularInfo;
  storageMemory: StorageMemoryInfo;
  source: 'dadb' | 'fallback' | 'merged';
}

// ----------------- Regex & Parser Helpers -----------------

export function capturesFirst(text: string, regex: RegExp): string[] | null {
  const match = text.match(regex);
  if (!match) return null;
  return match.slice(1);
}

export function capture(text: string, regex: RegExp): string | null {
  const matches = capturesFirst(text, regex);
  return matches && matches.length > 0 ? matches[0] : null;
}

export function captures(text: string, regex: RegExp): string[] {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const re = new RegExp(regex.source, flags);
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== undefined) {
      results.push(m[1]);
    }
  }
  return results;
}

export function keyValueBlock(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return result;
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx !== -1) {
      const k = line.substring(0, idx).trim();
      const v = line.substring(idx + 1).trim();
      if (k) result[k] = v;
    }
  }
  return result;
}

export function uniqueList(raw: string, separator = ' / ', filterUnknown = false): string {
  if (!raw) return '';
  const parts = raw.split(',').map((s) => s.trim()).filter((s) => {
    if (!s) return false;
    if (filterUnknown && ['unknown', '(unknown)', 'n/a'].includes(s.toLowerCase())) return false;
    return true;
  });
  return Array.from(new Set(parts)).join(separator);
}

export function formatUptime(raw: string): string {
  if (!raw) return '';
  const first = raw.trim().split(/\s+/)[0];
  const val = parseFloat(first);
  if (isNaN(val) || !isFinite(val) || val < 0) return '';
  const seconds = Math.floor(val);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) {
    return `${days}天 ${hours}小时`;
  }
  if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

export function formatCPU(countStr?: string, freqStr?: string): string {
  const cores = countStr?.trim() ? parseInt(countStr.trim(), 10) : NaN;
  const khz = freqStr?.trim() ? parseFloat(freqStr.trim()) : NaN;
  const freqText = !isNaN(khz) && khz > 0 ? `${(khz / 1_000_000).toFixed(2)} GHz` : '';
  if (!isNaN(cores) && cores > 0 && freqText) {
    return `${cores} 核 / ${freqText}`;
  }
  if (!isNaN(cores) && cores > 0) {
    return `${cores} 核`;
  }
  return freqText;
}

export function formatFrequencyGhz(freqStr?: string): string {
  const khz = freqStr?.trim() ? parseFloat(freqStr.trim()) : NaN;
  if (!isNaN(khz) && khz > 0) {
    return `${(khz / 1_000_000).toFixed(2)} GHz`;
  }
  return '';
}

export function wmValue(raw: string): string {
  if (!raw) return '';
  const parts = raw.split(': ');
  return (parts[parts.length - 1] || raw).trim();
}

export function resolutionPixels(raw: string): [number, number] | null {
  const m = raw.match(/^(\d+)x(\d+)$/);
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  return w > 0 && h > 0 ? [w, h] : null;
}

export function physicalDpi(raw: string): [number, number] | null {
  if (!raw) return null;
  let m = raw.match(/xDpi=([0-9]+(?:\.[0-9]+)?).*?yDpi=([0-9]+(?:\.[0-9]+)?)/i);
  if (m) {
    const xDpi = parseFloat(m[1]);
    const yDpi = parseFloat(m[2]);
    if (xDpi >= 50 && xDpi <= 2000 && yDpi >= 50 && yDpi <= 2000) {
      return [xDpi, yDpi];
    }
  }
  m = raw.match(/\(([0-9]+(?:\.[0-9]+)?)\s*x\s*([0-9]+(?:\.[0-9]+)?)\)\s*dpi/i);
  if (m) {
    const xDpi = parseFloat(m[1]);
    const yDpi = parseFloat(m[2]);
    if (xDpi >= 50 && xDpi <= 2000 && yDpi >= 50 && yDpi <= 2000) {
      return [xDpi, yDpi];
    }
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (isNaN(bytes) || bytes < 0) return '';
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = bytes / 1_048_576;
  return `${mb.toFixed(1)} MB`;
}

export function parseInterfaces(raw: string): NetworkInterfaceItem[] {
  if (!raw) return [];
  const entries: { name: string; ip: string }[] = [];
  let ifconfigInterface = '';
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    // 匹配 ip -4 addr: 3: wlan0: ... inet 192.168.1.100/24 ...
    const ipAddrMatch = line.match(/^\d+:\s+([^:@\s]+)(?:@[^:\s]+)?\s+.*\binet\s+([0-9.]+)(?:\/\d+)?\b/i);
    if (ipAddrMatch) {
      entries.push({ name: ipAddrMatch[1], ip: ipAddrMatch[2] });
      continue;
    }
    // 匹配 ifconfig 格式
    if (line.length > 0 && !/\s/.test(line[0])) {
      ifconfigInterface = line.split(/[: ]/)[0] || '';
    }
    if (ifconfigInterface) {
      const addrMatch = line.match(/\binet(?:\s+addr:|\s+)([0-9.]+)\b/i);
      if (addrMatch) {
        entries.push({ name: ifconfigInterface, ip: addrMatch[1] });
      }
    }
  }

  const seen = new Set<string>();
  const filtered = entries.filter((e) => {
    if (e.name === 'lo' || e.ip.startsWith('127.')) return false;
    const key = `${e.name}|${e.ip}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const getOrder = (name: string) => {
    if (/^(wlan|wifi)\d+$/i.test(name)) return 0;
    if (/^(ap|softap|swlan)\d*$/i.test(name)) return 1;
    if (/^(rndis|usb)\d*$/i.test(name)) return 2;
    return 3;
  };

  filtered.sort((a, b) => {
    const orderA = getOrder(a.name);
    const orderB = getOrder(b.name);
    if (orderA === orderB) return a.name.localeCompare(b.name);
    return orderA - orderB;
  });

  return filtered.map((item) => {
    let label = '接口 IP';
    if (/^(wlan|wifi)\d+$/i.test(item.name)) {
      label = 'Wi-Fi IP';
    } else if (/^(ap|softap|swlan)\d*$/i.test(item.name)) {
      label = '热点 IP';
    } else if (/^(rndis|usb)\d*$/i.test(item.name)) {
      label = 'USB 共享 IP';
    }
    return {
      name: item.name,
      ip: item.ip,
      label,
    };
  });
}

export function parseDefaultGateway(raw: string): string {
  if (!raw) return '';
  const lines = raw.split(/\r?\n/);
  const defLine = lines.find((l) => l.trim().startsWith('default'));
  if (defLine) {
    const via = capture(defLine, /\bvia\s+(\S+)/i) || '';
    const dev = capture(defLine, /\bdev\s+(\S+)/i) || '';
    if (via && dev) return `${via} (${dev})`;
    return via || dev;
  }
  for (const line of lines) {
    const cols = line.trim().split(/\s+/);
    if (cols.length >= 4 && cols[1] === '00000000') {
      const flags = parseInt(cols[3], 16);
      if (!isNaN(flags) && (flags & 0x2) !== 0) {
        const hex = cols[2];
        if (hex.length === 8) {
          const bytes: number[] = [];
          for (let i = 0; i < 8; i += 2) {
            bytes.push(parseInt(hex.substring(i, i + 2), 16));
          }
          const ip = bytes.reverse().join('.');
          return `${ip} (${cols[0]})`;
        }
      }
    }
  }
  return '';
}

export function validPort(raw: string): string {
  const p = parseInt(raw, 10);
  return !isNaN(p) && p > 0 ? String(p) : '';
}

// ----------------- Main Parsers -----------------

export function parseFullDeviceInfo(
  dadbSnapshot: Record<string, string> | null,
  device: AdbDevice,
  fallbackDetails?: DeviceDetails | null
): ParsedFullDeviceInfo {
  const snap = dadbSnapshot || {};
  const fb = fallbackDetails || null;
  const isDadbValid = dadbSnapshot && Object.keys(dadbSnapshot).length > 5;

  // 1. Hardware & System
  const manufacturer = snap['manufacturer']?.trim() || fb?.manufacturer?.trim() || fb?.brand?.trim() || '';
  const model = snap['model']?.trim() || fb?.model?.trim() || device.model?.trim() || '';
  const brandModel = [manufacturer, model].filter(Boolean).join(' ') || (fb?.brand && fb?.model ? `${fb.brand} ${fb.model}` : fb?.model || '');
  const board = snap['board']?.trim() || fb?.board?.trim() || '';
  const soc = snap['soc_model']?.trim() || board;
  const androidVersion = snap['android_version']?.trim() || fb?.android_version?.trim() || '';
  const sdkLevel = snap['sdk']?.trim() || fb?.sdk_version?.trim() || '';
  const uptime = formatUptime(snap['uptime'] || '');
  const baseband = uniqueList(snap['baseband'] || '', ' / ');
  const productCodename = snap['product_code_name']?.trim() || fb?.build_id?.trim() || '';
  const securityPatch = snap['security_patch']?.trim() || fb?.security_patch?.trim() || '';
  const serial = snap['serial']?.trim() || fb?.serial?.trim() || device.serial;
  const connectionType = device.is_wireless ? 'Wi-Fi / TCP' : 'USB / OTG';
  const connection = `${connectionType} / ${serial}`;
  const cpu = formatCPU(snap['cpu_count'], snap['cpu_max_frequency']);
  const cpuCores = snap['cpu_count'] ? parseInt(snap['cpu_count'].trim(), 10) : null;
  const cpuFrequency = formatFrequencyGhz(snap['cpu_max_frequency']);
  const abi = snap['abi']?.trim() || '';
  const fingerprint = snap['fingerprint']?.trim() || '';

  const hardware: HardwareSystemInfo = {
    brandModel,
    manufacturer,
    model,
    soc,
    board,
    cpu,
    cpuCores: isNaN(cpuCores as any) ? null : cpuCores,
    cpuFrequency,
    abi,
    fingerprint,
    androidVersion,
    sdkLevel,
    securityPatch,
    uptime,
    baseband,
    productCodename,
    serial,
    connection,
  };

  // 2. Display & Screen
  const resolution = wmValue(snap['resolution'] || fb?.screen_size || '');
  const rawDensity = wmValue(snap['density'] || fb?.screen_density || '');
  const dpi = rawDensity ? `${rawDensity} DPI` : '';
  const dpiPair = physicalDpi(snap['display_metrics'] || '');
  const ppi = dpiPair ? `${Math.round((dpiPair[0] + dpiPair[1]) / 2)} PPI` : '';
  let screenSize = '';
  const pixels = resolutionPixels(resolution);
  if (pixels && dpiPair && dpiPair[0] > 0 && dpiPair[1] > 0) {
    const diagonal = Math.hypot(pixels[0] / dpiPair[0], pixels[1] / dpiPair[1]);
    if (isFinite(diagonal) && diagonal > 0) {
      screenSize = `${diagonal.toFixed(2)} 英寸`;
    }
  }
  const displayInfo = snap['display_info'] || '';
  const currentFps = capture(displayInfo, /renderFrameRate\s*([0-9]+(?:\.[0-9]+)?)/i);
  const currentRate = currentFps ? `${Math.round(parseFloat(currentFps))} Hz` : '';

  let rates: string[] = [];
  const directRates = capture(displayInfo, /supportedRefreshRates\s*\[([^\]]+)\]/i);
  if (directRates) {
    rates = directRates.split(',').map((s) => s.trim());
  } else {
    rates = captures(displayInfo, /fps=([0-9]+(?:\.[0-9]+)?)/i);
  }
  const supportedNums = Array.from(
    new Set(
      rates
        .map((r) => parseFloat(r))
        .filter((n) => !isNaN(n) && n > 0)
        .map((n) => Math.round(n).toString())
    )
  ).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const supportedRates = supportedNums.length > 0 ? `${supportedNums.join('/')} Hz` : '';

  const display: DisplayScreenInfo = {
    resolution,
    dpi,
    ppi,
    screenSize,
    currentRate,
    supportedRates,
  };

  // 3. Battery & Power
  const batteryKv = keyValueBlock(snap['battery'] || '');
  let levelPercent: number | null = null;
  if (batteryKv['level']) {
    const p = parseInt(batteryKv['level'], 10);
    if (!isNaN(p)) levelPercent = p;
  } else if (fb?.battery_level != null) {
    levelPercent = fb.battery_level;
  }
  const levelText = levelPercent !== null ? `${levelPercent}%` : '';

  let status = '';
  switch (batteryKv['status']) {
    case '2': status = '充电中'; break;
    case '3': status = '放电中'; break;
    case '4': status = '未充电'; break;
    case '5': status = '已充满'; break;
    default:
      if (fb?.battery_status) status = fb.battery_status;
      break;
  }

  let health = '';
  switch (batteryKv['health']) {
    case '2': health = '良好'; break;
    case '3': health = '过热'; break;
    case '4': health = '损坏'; break;
    case '5': health = '过压'; break;
    case '7': health = '过冷'; break;
    default:
      if (fb?.battery_health) health = fb.battery_health;
      break;
  }

  const voltCandidates = [
    batteryKv['voltage'],
    snap['voltage_now'],
    fb?.battery_voltage?.toString(),
  ].filter(Boolean);
  let voltVal: number | null = null;
  for (const c of voltCandidates) {
    const parsed = parseInt(c!, 10);
    if (!isNaN(parsed) && parsed > 0) {
      voltVal = parsed;
      break;
    }
  }
  let voltage = '';
  let voltageMv: number | null = null;
  if (voltVal !== null) {
    const mV = voltVal >= 100_000 ? voltVal / 1_000 : voltVal;
    voltageMv = Math.round(mV);
    voltage = `${voltageMv} mV (${(voltageMv / 1000).toFixed(2)} V)`;
  }

  const curCandidates = [
    batteryKv['current now'],
    batteryKv['current average'],
    snap['battery_current_now'],
    snap['battery_current_average'],
    snap['sysfs_current'],
  ].filter(Boolean);
  let curVal: number | null = null;
  for (const c of curCandidates) {
    const parsed = parseInt(c!, 10);
    if (!isNaN(parsed) && parsed !== 0) {
      curVal = parsed;
      break;
    }
  }
  let current = '';
  if (curVal !== null) {
    const abs = Math.abs(curVal);
    const mA = abs >= 1_000_000_000 ? abs / 1_000_000 : abs >= 10_000 ? abs / 1_000 : abs;
    const sign = curVal < 0 ? '-' : '+';
    current = `${sign}${Math.round(mA)} mA`;
  }

  let temperature = '';
  if (batteryKv['temperature']) {
    const t = parseFloat(batteryKv['temperature']);
    if (!isNaN(t)) {
      temperature = `${(t / 10).toFixed(1)} °C`;
    }
  } else if (fb?.battery_temperature != null) {
    temperature = `${fb.battery_temperature} °C`;
  }

  const cycle = snap['battery_cycle']?.trim();
  const cycleCount = cycle && cycle !== '0' ? cycle : '';

  const battery: BatteryPowerInfo = {
    levelPercent,
    levelText,
    status,
    health,
    voltage,
    voltageMv,
    current,
    temperature,
    cycleCount,
  };

  // 4. Network & Cellular
  const networkType = uniqueList(snap['mobile_network_type'] || '', ', ', true);
  const carrier = uniqueList(snap['carrier_names'] || '', ', ', true);
  const cellId = snap['cell_identity'] || '';
  const bandsRaw = capture(cellId, /mBands\s*=\s*\[([^\]]+)\]/i);
  const bands = bandsRaw ? bandsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  let cellular = '';
  if (bands.length > 0) {
    if (/nr/i.test(networkType)) {
      cellular = [networkType, bands.map((b) => `n${b}`).join(', ')].filter(Boolean).join(' ');
    } else {
      cellular = [networkType, bands.map((b) => (b.toLowerCase().startsWith('b') ? b : `B${b}`)).join(', ')].filter(Boolean).join(' ');
    }
  } else {
    cellular = networkType;
  }

  const pci = capture(cellId, /mPci\s*=\s*([*\d]+)/i) || '';
  const arfcn = capture(cellId, /mNrArfcn\s*=\s*([*\d]+)/i) || capture(cellId, /mEarfcn\s*=\s*([*\d]+)/i) || '';

  const signalRaw = snap['signal_strength'] || '';
  const metric = (regex: RegExp, unit: string): string => {
    const v = capture(signalRaw, regex);
    if (!v || v === '2147483647') return '';
    return `${v} ${unit}`;
  };
  const formatSinr = (rawStr: string): string => {
    if (!rawStr || rawStr === '2147483647') return '';
    const val = parseInt(rawStr, 10);
    if (isNaN(val)) return '';
    return Math.abs(val) >= 100 ? `${(val / 10).toFixed(1)} dB` : `${val} dB`;
  };

  let rsrp = metric(/ssRsrp\s*=\s*(-?\d+)/i, 'dBm');
  let rsrq = metric(/ssRsrq\s*=\s*(-?\d+)/i, 'dB');
  let sinr = formatSinr(capture(signalRaw, /ssSinr\s*=\s*(-?\d+)/i) || '');
  if (!rsrp && !rsrq && !sinr) {
    rsrp = metric(/rsrp\s*=\s*(-?\d+)/i, 'dBm');
    rsrq = metric(/rsrq\s*=\s*(-?\d+)/i, 'dB');
    sinr = formatSinr(capture(signalRaw, /rssnr\s*=\s*(-?\d+)/i) || '');
  }

  const wifiInfo = snap['wifi_info'] || '';
  let rawSSID = capture(wifiInfo, /SSID:\s*"?(.*?)(?:"?\s*,|\s+BSSID:|$)/i) || '';
  if (['<unknown ssid>', '<none>', 'null'].includes(rawSSID.toLowerCase())) {
    rawSSID = '';
  }
  let rawBSSID = capture(wifiInfo, /BSSID:\s*([^,]+)/i) || '';
  if (['<none>', 'null'].includes(rawBSSID.toLowerCase())) {
    rawBSSID = '';
  }
  const wifiFreq = capture(wifiInfo, /Frequency:\s*([0-9]+)\s*MHz/i);
  const wifiFreqStr = wifiFreq ? `${wifiFreq} MHz` : '';
  const wifiSpeed = capture(wifiInfo, /Link speed:\s*([0-9]+)\s*Mbps/i);
  const wifiSpeedStr = wifiSpeed ? `${wifiSpeed} Mbps` : '';
  const wifiSummary = [wifiFreqStr, wifiSpeedStr].filter(Boolean).join(' / ');

  let interfaces = parseInterfaces(snap['network_interfaces'] || '');
  if (interfaces.length === 0 && fb?.wifi_ip && fb.wifi_ip !== 'Not connected') {
    interfaces = [{ name: 'wlan0', ip: fb.wifi_ip, label: 'Wi-Fi IP' }];
  }
  const defaultGateway = parseDefaultGateway(snap['default_route'] || '');
  const wirelessPort = validPort(snap['wireless_port'] || '');
  const wlanMac = fb?.wifi_mac || '';

  const network: NetworkCellularInfo = {
    cellular,
    networkType,
    carrier,
    pci,
    arfcn,
    rsrp,
    rsrq,
    sinr,
    ssid: rawSSID,
    bssid: rawBSSID,
    wifiSummary,
    interfaces,
    defaultGateway,
    wirelessPort,
    wlanMac,
  };

  // 5. Storage & Memory
  // RAM
  const memKv = keyValueBlock(snap['memory'] || '');
  let ramTotalBytes: number | null = null;
  let ramAvailableBytes: number | null = null;
  let ramUsedBytes: number | null = null;
  let ramPercent: number | null = null;

  if (memKv['MemTotal']) {
    const kb = parseInt(memKv['MemTotal'].split(/\s+/)[0], 10);
    if (!isNaN(kb) && kb > 0) ramTotalBytes = kb * 1024;
  }
  if (memKv['MemAvailable']) {
    const kb = parseInt(memKv['MemAvailable'].split(/\s+/)[0], 10);
    if (!isNaN(kb) && kb >= 0) ramAvailableBytes = kb * 1024;
  }
  if (ramTotalBytes !== null && ramAvailableBytes !== null) {
    ramUsedBytes = ramTotalBytes - ramAvailableBytes;
    ramPercent = Math.min(100, Math.max(0, Math.round((ramUsedBytes / ramTotalBytes) * 100)));
  }

  let ramUsedFormatted = ramUsedBytes !== null ? formatBytes(ramUsedBytes) : '';
  let ramTotalFormatted = ramTotalBytes !== null ? formatBytes(ramTotalBytes) : (fb?.ram_total || '');
  let ramAvailableFormatted = ramAvailableBytes !== null ? formatBytes(ramAvailableBytes) : (fb?.ram_available || fb?.ram_free || '');

  // Fallback parsing for RAM if dadb didn't have numbers
  if (ramPercent === null && fb) {
    const parseGb = (s: string) => {
      const match = s.match(/([0-9.]+)\s*GB/i);
      return match ? parseFloat(match[1]) * 1_073_741_824 : null;
    };
    const t = parseGb(fb.ram_total);
    const a = parseGb(fb.ram_available || fb.ram_free);
    if (t !== null && a !== null) {
      ramTotalBytes = t;
      ramAvailableBytes = a;
      ramUsedBytes = Math.max(0, t - a);
      ramPercent = Math.round((ramUsedBytes / t) * 100);
      ramUsedFormatted = formatBytes(ramUsedBytes);
    }
  }

  const ramSummary =
    ramTotalFormatted && ramUsedFormatted
      ? `已用 ${ramUsedFormatted} / 总共 ${ramTotalFormatted} (${ramPercent ?? 0}%)`
      : ramTotalFormatted
      ? `总共 ${ramTotalFormatted}`
      : '';

  const ram: ResourceUsage = {
    usedBytes: ramUsedBytes,
    totalBytes: ramTotalBytes,
    availableBytes: ramAvailableBytes,
    usedFormatted: ramUsedFormatted,
    totalFormatted: ramTotalFormatted,
    availableFormatted: ramAvailableFormatted,
    percent: ramPercent,
    summary: ramSummary,
  };

  // Storage (/data)
  let storageTotalBytes: number | null = null;
  let storageUsedBytes: number | null = null;
  let storageAvailableBytes: number | null = null;
  let storagePercent: number | null = null;

  const dataFs = snap['data_filesystem'] || '';
  if (dataFs) {
    for (const line of dataFs.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      // e.g. /dev/block/dm-4 241940984 62453896 179354140 26% /data
      if (parts.length >= 5 && parts[parts.length - 1].endsWith('/data')) {
        const totalKb = parseInt(parts[1], 10);
        const usedKb = parseInt(parts[2], 10);
        const availKb = parseInt(parts[3], 10);
        if (!isNaN(totalKb) && totalKb > 0) storageTotalBytes = totalKb * 1024;
        if (!isNaN(usedKb) && usedKb >= 0) storageUsedBytes = usedKb * 1024;
        if (!isNaN(availKb) && availKb >= 0) storageAvailableBytes = availKb * 1024;
        break;
      }
    }
  }

  if (storageTotalBytes !== null && storageUsedBytes !== null) {
    storagePercent = Math.min(100, Math.max(0, Math.round((storageUsedBytes / storageTotalBytes) * 100)));
  }

  let storageUsedFormatted = storageUsedBytes !== null ? formatBytes(storageUsedBytes) : (fb?.storage_used || '');
  let storageTotalFormatted = storageTotalBytes !== null ? formatBytes(storageTotalBytes) : (fb?.storage_total || '');
  let storageAvailableFormatted = storageAvailableBytes !== null ? formatBytes(storageAvailableBytes) : (fb?.storage_free || '');

  if (storagePercent === null && fb?.storage_percent) {
    const p = parseInt(fb.storage_percent.replace('%', '').trim(), 10);
    if (!isNaN(p)) storagePercent = p;
  }

  const storageSummary =
    storageTotalFormatted && storageUsedFormatted
      ? `已用 ${storageUsedFormatted} / 总共 ${storageTotalFormatted} (${storagePercent ?? 0}%)`
      : storageTotalFormatted
      ? `总共 ${storageTotalFormatted}`
      : '';

  const storage: ResourceUsage = {
    usedBytes: storageUsedBytes,
    totalBytes: storageTotalBytes,
    availableBytes: storageAvailableBytes,
    usedFormatted: storageUsedFormatted,
    totalFormatted: storageTotalFormatted,
    availableFormatted: storageAvailableFormatted,
    percent: storagePercent,
    summary: storageSummary,
  };

  const storageMemory: StorageMemoryInfo = {
    ram,
    storage,
  };

  const source: 'dadb' | 'fallback' | 'merged' = isDadbValid && fb ? 'merged' : isDadbValid ? 'dadb' : 'fallback';

  return {
    hardware,
    display,
    battery,
    network,
    storageMemory,
    source,
  };
}
