import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Terminal, Play, Trash2, Copy, Check, X } from 'lucide-react';

interface AdbShellModalProps {
  serial: string;
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (msg: string, isError?: boolean) => void;
}

const COMMON_COMMANDS = [
  { label: '电池状态', cmd: 'dumpsys battery' },
  { label: '系统属性', cmd: 'getprop ro.product.model; getprop ro.build.version.release' },
  { label: '网络接口', cmd: 'ip addr show' },
  { label: '第三方应用', cmd: 'pm list packages -3' },
  { label: '当前屏幕尺寸', cmd: 'wm size; wm density' },
  { label: 'Top 进程', cmd: 'top -n 1 -m 10' },
];

export const AdbShellModal: React.FC<AdbShellModalProps> = ({
  serial,
  isOpen,
  onClose,
  onNotify,
}) => {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && !output) {
      setOutput(`ADB Shell connected to ${serial}\nType command below and press Enter to execute.\n\n`);
    }
  }, [isOpen, serial]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleExecute = async (cmdToRun?: string) => {
    const targetCmd = (cmdToRun !== undefined ? cmdToRun : command).trim();
    if (!targetCmd || loading) return;

    setLoading(true);
    setOutput((prev) => `${prev}$ ${targetCmd}\n`);
    setCommand('');

    try {
      const res = await invoke<string>('run_adb_shell_command', {
        serial,
        command: targetCmd,
        customPath: null,
      });
      setOutput((prev) => `${prev}${res.trim()}\n\n`);
    } catch (err: any) {
      setOutput((prev) => `${prev}Error: ${err}\n\n`);
      if (onNotify) onNotify(`Shell 失败: ${err}`, true);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div className="relative flex flex-col w-full max-w-3xl h-[620px] bg-[#1e1e20] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-neutral-200 cursor-default">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#262629] border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg">
              <Terminal size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>ADB Shell 控制台</span>
                <span className="text-[11px] font-mono font-normal text-neutral-400">({serial})</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
              title="复制全部终端输出"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
            <button
              type="button"
              onClick={() => setOutput('')}
              className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
              title="清空输出"
            >
              <Trash2 size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
              title="关闭"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-[#18181a] border-b border-white/5 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-neutral-400 shrink-0 mr-1">快捷命令:</span>
          {COMMON_COMMANDS.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={loading}
              onClick={() => handleExecute(item.cmd)}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white/5 hover:bg-white/10 hover:text-white text-neutral-300 transition-colors shrink-0 border border-white/5"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Terminal Output Body */}
        <div className="flex-1 p-4 bg-[#121214] font-mono text-xs text-neutral-300 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
          {output}
          <div ref={terminalEndRef} />
        </div>

        {/* Command Input Footer */}
        <div className="flex items-center gap-2 p-3 bg-[#1e1e20] border-t border-white/10">
          <span className="text-blue-400 font-mono text-sm pl-1">$</span>
          <input
            type="text"
            value={command}
            disabled={loading}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleExecute();
              }
            }}
            placeholder="输入 Android Shell 指令，按 Enter 执行 (如 getprop, pm, am, logcat)..."
            className="flex-1 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 font-mono"
            autoFocus
          />
          <button
            type="button"
            disabled={loading || !command.trim()}
            onClick={() => handleExecute()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow transition-colors"
          >
            <Play size={12} fill="currentColor" />
            <span>执行</span>
          </button>
        </div>
      </div>
    </div>
  );
};
