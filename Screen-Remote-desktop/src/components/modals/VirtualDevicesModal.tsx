import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AvdInfo, SystemImageInfo } from '../../types';
import { ConfirmModal } from './ConfirmModal';
import {
  Smartphone,
  Plus,
  RotateCw,
  Sliders,
  Play,
  Trash2,
  CheckCircle2,
  Lock,
  Download,
  Search
} from 'lucide-react';

interface VirtualDevicesModalProps {
  onClose: () => void;
  onCreateNew: () => void;
}

export const VirtualDevicesModal: React.FC<VirtualDevicesModalProps> = ({
  onClose,
  onCreateNew,
}) => {
  const [activeTab, setActiveTab] = useState<'myDevices' | 'systemImages'>('myDevices');
  const [devices, setDevices] = useState<AvdInfo[]>([]);
  const [images, setImages] = useState<SystemImageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingDevice, setStartingDevice] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [avds, sysImages] = await Promise.all([
        invoke<AvdInfo[]>('list_avds'),
        invoke<SystemImageInfo[]>('list_installed_system_images'),
      ]);
      setDevices(avds);
      setImages(sysImages);
    } catch (e) {
      console.error('Failed to load virtual devices data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleStartAvd = async (name: string) => {
    setStartingDevice(name);
    try {
      await invoke('start_avd', { name });
    } catch (e) {
      console.error('Failed to start AVD:', e);
    } finally {
      setTimeout(() => setStartingDevice(null), 3000);
    }
  };

  const handleDeleteAvd = (name: string) => {
    setDeleteConfirmName(name);
  };

  const executeDeleteAvd = async (name: string) => {
    try {
      await invoke('delete_avd', { name });
      setDevices((prev) => prev.filter((d) => d.name !== name));
    } catch (e) {
      console.error('Failed to delete AVD:', e);
    }
  };

  return (
    <div
      onClick={onClose}
      className="modal-backdrop select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-window-card w-full max-w-[800px] h-[650px] max-h-[90vh]"
      >
        {/* Top Header Bar */}
        <div className="modal-titlebar">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-wide">虚拟设备管理</h2>
            <p className="text-[11px] text-[var(--text-secondary)]">管理 Android 系统镜像与已配置的 AVD 模拟器</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCreateNew}
              className="btn btn-primary px-3 py-1.5 text-xs font-medium cursor-pointer"
            >
              <Plus size={13} /> 创建设备
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-black/5 dark:bg-white/[0.08] rounded-md border border-[var(--border-card)] transition-colors cursor-pointer"
              title="刷新"
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="btn btn-secondary px-3.5 py-1.5 text-xs cursor-pointer"
            >
              完成
            </button>
          </div>
        </div>

        {/* Segmented Control Tabs */}
        <div className="px-6 py-2.5 border-b border-[var(--divider-color)] bg-[var(--bg-card)] flex items-center gap-3 shrink-0">
          <span className="text-xs font-medium text-[var(--text-secondary)]">视图分类</span>
          <div className="flex-1 max-w-sm flex items-center bg-black/5 dark:bg-black/25 p-1 rounded-lg border border-[var(--border-card)]">
            <button
              onClick={() => setActiveTab('myDevices')}
              className={`flex-1 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                activeTab === 'myDevices'
                  ? 'bg-[var(--cds-clay)] text-white shadow-sm font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              我的设备
            </button>
            <button
              onClick={() => setActiveTab('systemImages')}
              className={`flex-1 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                activeTab === 'systemImages'
                  ? 'bg-[var(--cds-clay)] text-white shadow-sm font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              系统镜像
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="modal-body-scroll p-6 flex flex-col gap-4">
          {activeTab === 'myDevices' ? (
            /* Tab 1: 我的设备 */
            <div className="flex flex-col gap-3">
              {devices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)] text-xs gap-3">
                  <Smartphone size={32} className="opacity-40" />
                  <span>未发现已创建的虚拟设备，点击右上角「创建设备」新建。</span>
                </div>
              ) : (
                devices.map((dev) => (
                  <div
                    key={dev.name}
                    className="flex items-center justify-between p-3.5 bg-[var(--bg-card)] border border-[var(--border-card)] hover:border-[var(--border-strong)] rounded-xl transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-[var(--cds-clay-subtle)] border border-[var(--cds-clay-border)] flex items-center justify-center text-[var(--cds-clay)]">
                        <Smartphone size={22} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[var(--text-primary)]">{dev.name}</div>
                        <div className="text-[11px] text-[var(--text-secondary)] font-mono">{dev.target}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="p-2 text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-700 rounded-lg transition-colors"
                        title="配置"
                      >
                        <Sliders size={14} />
                      </button>
                      <button
                        onClick={() => handleStartAvd(dev.name)}
                        disabled={startingDevice === dev.name}
                        className="p-2 text-neutral-200 hover:text-white bg-neutral-800/80 hover:bg-neutral-700 active:bg-neutral-600 rounded-lg transition-colors"
                        title="启动模拟器"
                      >
                        <Play
                          size={14}
                          className={startingDevice === dev.name ? 'animate-pulse text-green-400' : ''}
                        />
                      </button>
                      <button
                        onClick={() => handleDeleteAvd(dev.name)}
                        className="p-2 text-red-400/80 hover:text-red-400 bg-neutral-800/80 hover:bg-neutral-700 rounded-lg transition-colors"
                        title="删除设备"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Tab 2: 系统镜像 */
            <div className="flex flex-col gap-4">
              {/* Search and Filters Bar */}
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    placeholder="搜索系统镜像..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/5 dark:bg-black/30 border border-[var(--border-card)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--cds-clay)]"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span>设备形态</span>
                      <select className="macos-select py-1 text-[11px]">
                        <option>全部</option>
                        <option>手机</option>
                        <option>平板</option>
                        <option>电视</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span>API</span>
                      <select className="macos-select py-1 text-[11px]">
                        <option>全部</option>
                        <option>API 33</option>
                        <option>API 24</option>
                        <option>API 23</option>
                        <option>API 21</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span>服务</span>
                      <select className="bg-[#242424] border border-white/10 rounded px-2 py-0.5 text-[11px] text-white outline-none cursor-pointer">
                        <option>全部</option>
                        <option>AOSP</option>
                        <option>Google APIs</option>
                        <option>Google Play</option>
                      </select>
                    </div>
                  </div>

                  <span className="text-[11px] text-neutral-500">
                    {images.length} 个镜像
                  </span>
                </div>
              </div>

              {/* Section: 已安装 */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                  <CheckCircle2 size={13} className="text-neutral-400" /> 已安装
                </div>

                <div className="flex flex-col gap-2">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className="flex items-center justify-between p-3.5 bg-[#202020] border border-white/5 rounded-xl shadow-sm"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
                          <Smartphone size={22} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{img.display_name}</div>
                          <div className="text-[11px] text-neutral-400">{img.path}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[11px] text-green-400 font-medium">
                          <CheckCircle2 size={12} /> 已安装
                        </span>
                        <Lock size={12} className="text-neutral-500" />
                        <button
                          disabled
                          className="px-3 py-1 bg-neutral-800 text-neutral-500 text-xs rounded-md border border-white/5 cursor-not-allowed"
                        >
                          移除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section: 可供下载 */}
              <div className="flex flex-col gap-2 pt-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                  <Download size={13} className="text-neutral-400" /> 可供下载
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between p-3.5 bg-[#202020] border border-white/5 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <Smartphone size={22} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          API canary-20260909 · google_apis_ps16k · arm64-v8a
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          16 KB Page Size Google APIs ARM 64 v8a System Image
                        </div>
                      </div>
                    </div>

                    <button className="px-3.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded-md border border-white/10 transition-colors">
                      下载
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteConfirmName)}
        title="删除虚拟设备"
        message={`确定要删除虚拟设备 "${deleteConfirmName}" 吗？该模拟器镜像和用户数据将被永久移除，此操作无法撤销。`}
        confirmText="删除设备"
        cancelText="取消"
        isDestructive={true}
        onConfirm={() => {
          if (deleteConfirmName) executeDeleteAvd(deleteConfirmName);
        }}
        onCancel={() => setDeleteConfirmName(null)}
      />
    </div>
  );
};
