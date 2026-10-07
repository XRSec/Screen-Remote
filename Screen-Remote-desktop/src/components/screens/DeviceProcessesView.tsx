import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AdbDevice } from '../../types';
import { Search, Activity, StopCircle, RefreshCw } from 'lucide-react';

interface DeviceProcessesViewProps {
  device: AdbDevice | { serial: string; id?: string };
  onNotify: (msg: string, isError?: boolean) => void;
}

interface ManagedProcess {
  pid: number;
  rssKilobytes: number;
  name: string;
  packageName: string;
  memoryFormatted: string;
}

// macOS style memory chip icon
const MemoryChipIcon: React.FC<{ className?: string }> = ({ className = 'text-blue-400' }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M7 18v3" />
    <path d="M12 18v3" />
    <path d="M17 18v3" />
    <path d="M7 3v3" />
    <path d="M12 3v3" />
    <path d="M17 3v3" />
  </svg>
);

export const DeviceProcessesView: React.FC<DeviceProcessesViewProps> = ({ device, onNotify }) => {
  const [processes, setProcesses] = useState<ManagedProcess[]>([]);
  const [memorySummary, setMemorySummary] = useState<string>('—');
  const [loading, setLoading] = useState(false);
  const [stoppingPid, setStoppingPid] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const serial = device?.serial || '';

  const formatByteCount = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const parseProcesses = (rawOutput: string): ManagedProcess[] => {
    const lines = rawOutput.split('\n');
    const result: ManagedProcess[] = [];

    // Skip the header line (PID RSS NAME)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = line.split(/\s+/);
      if (fields.length < 3) continue;

      const pid = parseInt(fields[0], 10);
      const rss = parseInt(fields[1], 10);
      if (isNaN(pid) || isNaN(rss)) continue;

      const name = fields.slice(2).join(' ');
      const packageName = name.split(':')[0] || name;

      // Filter: must contain dot and no slashes (Android App process convention)
      if (packageName.includes('.') && !packageName.includes('/')) {
        result.push({
          pid,
          rssKilobytes: rss,
          name,
          packageName,
          memoryFormatted: formatByteCount(rss * 1024),
        });
      }
    }

    // Sort descending by RSS memory
    result.sort((a, b) => b.rssKilobytes - a.rssKilobytes);
    return result;
  };

  const parseAvailableMemory = (meminfoPart: string): string => {
    const match = meminfoPart.match(/MemAvailable:\s+(\d+)\s+kB/i);
    if (match && match[1]) {
      const kb = parseInt(match[1], 10);
      if (!isNaN(kb)) {
        return formatByteCount(kb * 1024);
      }
    }
    return '—';
  };

  const fetchProcesses = useCallback(async () => {
    if (!serial) return;
    setLoading(true);
    try {
      // 1:1 match with macOS native: ManagementADB.shell("ps -A -o PID,RSS,NAME; echo __MEM__; grep -E '^MemTotal:|^MemAvailable:' /proc/meminfo")
      const output = await invoke<string>('run_adb_shell_command', {
        serial,
        command: "ps -A -o PID,RSS,NAME; echo __MEM__; grep -E '^MemTotal:|^MemAvailable:' /proc/meminfo",
        customPath: null,
      });

      const parts = output.split('__MEM__');
      const procPart = parts[0] || '';
      const memPart = parts[1] || '';

      const parsedProcs = parseProcesses(procPart);
      setProcesses(parsedProcs);

      const memAvail = parseAvailableMemory(memPart);
      setMemorySummary(memAvail);
    } catch (e: any) {
      console.warn('Native ps query failed, attempting standard list_processes fallback:', e);
      // Fallback if ps -A isn't supported on old Android versions
      try {
        const fallbackList = await invoke<any[]>('list_processes', {
          serial,
          customPath: null,
        });
        const converted = fallbackList
          .filter((p) => p.name.includes('.') && !p.name.includes('/'))
          .map((p) => ({
            pid: p.pid,
            rssKilobytes: 0,
            name: p.name,
            packageName: p.name.split(':')[0] || p.name,
            memoryFormatted: p.rss_mem || '—',
          }));
        setProcesses(converted);
      } catch (fallbackErr: any) {
        onNotify(`获取进程列表失败: ${fallbackErr || e}`, true);
      }
    } finally {
      setLoading(false);
    }
  }, [serial, onNotify]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  const handleStopProcess = async (proc: ManagedProcess) => {
    setStoppingPid(proc.pid);
    try {
      // am force-stop <package>
      await invoke('run_adb_shell_command', {
        serial,
        command: `am force-stop ${proc.packageName}`,
        customPath: null,
      });
      onNotify(`已强制停止进程: ${proc.name}`);
      // Refresh list
      await fetchProcesses();
    } catch (e: any) {
      onNotify(`停止应用进程失败: ${e}`, true);
    } finally {
      setStoppingPid(null);
    }
  };

  const filtered = processes.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.pid.toString().includes(search)
  );

  return (
    <div className="workspace-fixed-layout bg-[var(--bg-primary)] text-[var(--text-primary)] select-none">
      {/* Scrollable Container */}
      <div className="workspace-scroll-body p-6">
        <div className="max-w-[920px] mx-auto flex flex-col gap-4">
          {/* Top Metric Cards - 1:1 align with native_tab_processes.png */}
          <div className="grid grid-cols-2 gap-4">
            {/* Card 1: Running Apps */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-[var(--cds-clay-subtle)] border border-[var(--cds-clay-border)] flex items-center justify-center shrink-0">
                <Activity size={22} className="text-[var(--cds-clay)]" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-[var(--text-primary)] tracking-tight leading-none">
                  {processes.length}
                </span>
                <span className="text-xs text-[var(--text-secondary)] mt-1">运行中的应用</span>
              </div>
            </div>

            {/* Card 2: Available Memory */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-[var(--cds-clay-subtle)] border border-[var(--cds-clay-border)] flex items-center justify-center shrink-0">
                <MemoryChipIcon className="text-[var(--cds-clay)]" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-[var(--text-primary)] tracking-tight leading-none">
                  {memorySummary}
                </span>
                <span className="text-xs text-[var(--text-secondary)] mt-1">可用内存</span>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full">
            <input
              type="text"
              placeholder="搜索应用或进程"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3.5 pr-10 py-2 text-xs bg-black/5 dark:bg-black/30 border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--cds-clay)] transition-colors"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
              <Search size={15} className="text-[var(--text-secondary)]" />
            </div>
          </div>

          {/* Process Grid Area - 2 Columns */}
          {loading && processes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--text-secondary)]">
              <RefreshCw size={24} className="animate-spin text-[var(--cds-clay)]" />
              <span className="text-xs">正在分析设备进程与内存状态...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-[var(--text-secondary)] text-xs">
              无匹配的运行中应用或进程
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filtered.map((proc) => {
                const isStopping = stoppingPid === proc.pid;
                return (
                  <div
                    key={proc.pid}
                    className="group bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] border border-[var(--border-card)] rounded-xl px-3.5 py-2.5 flex items-center justify-between transition-colors shadow-sm"
                  >
                    {/* Left: App Icon + Process Name + PID */}
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                      <div className="w-6 h-6 rounded-md bg-[var(--cds-clay)] flex items-center justify-center shrink-0 shadow-sm">
                        <div className="w-2.5 h-2.5 rounded-[2px] bg-white/90" />
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span
                          className="text-xs font-semibold text-[var(--text-primary)] truncate"
                          title={proc.name}
                        >
                          {proc.name}
                        </span>
                        <span className="text-[11px] text-[var(--text-secondary)] font-mono mt-0.5">
                          PID {proc.pid.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Right: Memory Usage + Stop Button */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-neutral-400 font-mono">
                        {proc.memoryFormatted}
                      </span>
                      <button
                        onClick={() => handleStopProcess(proc)}
                        disabled={isStopping}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="强制停止该应用"
                      >
                        {isStopping ? (
                          <RefreshCw size={14} className="animate-spin text-red-400" />
                        ) : (
                          <StopCircle size={17} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
