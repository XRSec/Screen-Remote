import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Terminal,
  Search,
  Copy,
  Check,
  Trash2,
  RotateCw,
  X
} from 'lucide-react';

export type SDLLogTag =
  | 'all'
  | 'connection'
  | 'adb'
  | 'scrcpy_server'
  | 'video'
  | 'audio'
  | 'control'
  | 'socks'
  | 'render'
  | 'apps'
  | 'files'
  | 'device'
  | 'other';

export interface SDLLogEntry {
  id: string;
  timestamp: string;
  tag: SDLLogTag;
  message: string;
}

interface DiagnosticsModalProps {
  onClose: () => void;
  activeSerial?: string;
}

const TAG_COLORS: Record<string, string> = {
  connection: '#0a84ff', // blue
  adb: '#30d158', // green
  scrcpy_server: '#ff9f0a', // orange
  video: '#bf5af2', // purple
  audio: '#32ade6', // cyan
  control: '#ff375f', // pink
  socks: '#5856d6', // indigo
  render: '#64d2ff', // light blue
  apps: '#30b0c7', // teal
  files: '#ffd60a', // yellow
  device: '#34c759', // mint
  other: '#8e8e93', // gray
};

// Global log storage for the desktop session
let globalSessionLogs: SDLLogEntry[] = [
  {
    id: 'init-1',
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    tag: 'other',
    message: 'Application diagnostics stream initialized.',
  },
  {
    id: 'init-2',
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    tag: 'connection',
    message: 'Native desktop engine ready (Tauri v2 + WebCodecs).',
  },
];

export function logDiagnostic(tag: SDLLogTag, message: string) {
  const entry: SDLLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    tag,
    message,
  };
  globalSessionLogs.push(entry);
  if (globalSessionLogs.length > 2000) {
    globalSessionLogs = globalSessionLogs.slice(-1500);
  }
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  onClose,
  activeSerial,
}) => {
  const [activeTab, setActiveTab] = useState<'sdl' | 'logcat'>('sdl');
  const [logs, setLogs] = useState<SDLLogEntry[]>([...globalSessionLogs]);
  const [selectedTag, setSelectedTag] = useState<SDLLogTag>('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Logcat states
  const [logcatText, setLogcatText] = useState('');
  const [logcatLoading, setLogcatLoading] = useState(false);
  const [logcatLines, setLogcatLines] = useState(300);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll down when logs update
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, logcatText, autoScroll]);

  // Periodic poll for app logs
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs([...globalSessionLogs]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch device logcat
  const fetchLogcat = async () => {
    if (!activeSerial) {
      setLogcatText('未连接设备，请先连接并选择设备以提取 Logcat。');
      return;
    }
    setLogcatLoading(true);
    try {
      const output = await invoke<string>('dump_logcat', {
        serial: activeSerial,
        lines: logcatLines,
        customPath: null,
      });
      setLogcatText(output || '（日志为空）');
      logDiagnostic('adb', `Dumped ${logcatLines} lines of Logcat for ${activeSerial}`);
    } catch (err: any) {
      setLogcatText(`获取 Logcat 失败: ${err}`);
      logDiagnostic('adb', `Failed to dump Logcat: ${err}`);
    } finally {
      setLogcatLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logcat' && activeSerial && !logcatText) {
      fetchLogcat();
    }
  }, [activeTab, activeSerial]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchTag = selectedTag === 'all' || log.tag === selectedTag;
    const matchSearch =
      !search ||
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      log.tag.toLowerCase().includes(search.toLowerCase());
    return matchTag && matchSearch;
  });

  const handleCopy = () => {
    if (activeTab === 'sdl') {
      const text = filteredLogs
        .map((l) => `${l.timestamp} [${l.tag}] ${l.message}`)
        .join('\n');
      navigator.clipboard.writeText(text);
    } else {
      navigator.clipboard.writeText(logcatText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (activeTab === 'sdl') {
      globalSessionLogs = [];
      setLogs([]);
    } else {
      setLogcatText('');
    }
  };

  const TAGS: Array<{ id: SDLLogTag; label: string }> = [
    { id: 'all', label: '全部' },
    { id: 'connection', label: '连接' },
    { id: 'adb', label: 'ADB' },
    { id: 'scrcpy_server', label: 'Scrcpy' },
    { id: 'video', label: '视频' },
    { id: 'audio', label: '音频' },
    { id: 'control', label: '控制' },
    { id: 'apps', label: '应用' },
    { id: 'files', label: '文件' },
    { id: 'device', label: '设备' },
    { id: 'other', label: '其他' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window-card"
        style={{ width: '920px', height: '620px', maxWidth: '95vw', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titlebar */}
        <div className="modal-titlebar">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Terminal size={15} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">诊断与日志</h3>
              <p className="text-[11px] text-[#8e8e93]">
                查看会话连接、Scrcpy 服务器与设备端诊断信息
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-white/[0.06] border border-[var(--border-card)]">
              <button
                type="button"
                onClick={() => setActiveTab('sdl')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                  activeTab === 'sdl'
                    ? 'bg-[var(--cds-clay)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                引擎诊断 (SDL)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('logcat')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                  activeTab === 'logcat'
                    ? 'bg-[var(--cds-clay)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                设备 Logcat
              </button>
            </div>

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

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--divider-color)] bg-black/5 dark:bg-white/[0.02]">
          {activeTab === 'sdl' ? (
            <div className="flex items-center gap-2 overflow-x-auto flex-1 mr-4 py-0.5 scrollbar-none">
              {TAGS.map((t) => {
                const isSelected = selectedTag === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTag(t.id)}
                    className={`px-2 py-0.5 text-[11px] rounded-full transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--cds-clay)] text-white font-semibold shadow-sm'
                        : 'bg-black/5 dark:bg-white/[0.06] hover:bg-black/10 dark:hover:bg-white/[0.12] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span>抓取行数:</span>
              <select
                value={logcatLines}
                onChange={(e) => setLogcatLines(Number(e.target.value))}
                className="bg-neutral-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
              >
                <option value={100}>100 行</option>
                <option value={300}>300 行</option>
                <option value={800}>800 行</option>
                <option value={1500}>1500 行</option>
              </select>
              <button
                type="button"
                onClick={fetchLogcat}
                disabled={logcatLoading}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer"
              >
                <RotateCw size={12} className={logcatLoading ? 'animate-spin' : ''} />
                <span>刷新 Logcat</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {activeTab === 'sdl' && (
              <div className="relative w-44">
                <Search size={12} className="absolute left-2.5 top-2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="过滤日志..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 rounded-md bg-white/[0.06] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1 text-xs rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              title="复制全部可见日志"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              <span>{copied ? '已复制' : '复制'}</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1 text-xs rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-red-400 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="清除日志"
            >
              <Trash2 size={12} />
              <span>清空</span>
            </button>
          </div>
        </div>

        {/* Log Viewer Content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed select-text bg-[#0e0e10] text-[#e0e0e0]"
        >
          {activeTab === 'sdl' ? (
            filteredLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-neutral-500 select-none">
                无匹配的诊断日志
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filteredLogs.map((log) => {
                  const tagColor = TAG_COLORS[log.tag] || '#8e8e93';
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-2.5 py-0.5 px-1.5 rounded hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="text-neutral-500 shrink-0 select-none">
                        {log.timestamp}
                      </span>
                      <span
                        className="px-1.5 py-0.2 rounded text-[10px] font-semibold shrink-0 select-none"
                        style={{
                          backgroundColor: `${tagColor}22`,
                          color: tagColor,
                          border: `1px solid ${tagColor}44`,
                        }}
                      >
                        {log.tag}
                      </span>
                      <span className="text-neutral-200 break-all whitespace-pre-wrap flex-1">
                        {log.message}
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <pre className="whitespace-pre-wrap break-all text-neutral-300">
              {logcatText || (logcatLoading ? '正在读取设备 Logcat...' : '暂无 Logcat 输出')}
            </pre>
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-white/[0.02] text-[11px] text-neutral-400">
          <span>
            {activeTab === 'sdl'
              ? `显示 ${filteredLogs.length} 条记录 (总计 ${logs.length})`
              : `设备序列号: ${activeSerial || '未选择'}`}
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-neutral-800"
            />
            <span>自动滚动至底部</span>
          </label>
        </div>
      </div>
    </div>
  );
};
