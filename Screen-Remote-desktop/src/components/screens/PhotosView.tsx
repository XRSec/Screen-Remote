import React, { useState, useEffect, useCallback } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { AdbDevice, FileNodeInfo } from '../../types';
import {
  Search,
  RotateCw,
  Download,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Image as ImageIcon,
  Video as VideoIcon,
  ExternalLink
} from 'lucide-react';

interface PhotosViewProps {
  device: AdbDevice;
  onNotify?: (msg: string, isError?: boolean) => void;
}

type PhotoCategory = 'recent' | 'screenshots' | 'camera';

interface CategoryDef {
  id: PhotoCategory;
  title: string;
  path: string;
  depth: number;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'recent', title: '最近', path: '/sdcard/DCIM', depth: 3 },
  { id: 'screenshots', title: '截图', path: '/sdcard/Pictures/Screenshots', depth: 1 },
  { id: 'camera', title: '相机', path: '/sdcard/DCIM/Camera', depth: 1 },
];

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'bmp', 'dng'];
const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'mov', 'webm', '3gp'];
const ALL_MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

interface MediaItem {
  id: string; // fullPath
  name: string;
  path: string;
  size: number;
  sizeText: string;
  isVideo: boolean;
  dateText: string;
  modifiedTimestamp: number;
}

// Format bytes into human readable format
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Get Mac user download directory
async function getDownloadsDir(): Promise<string> {
  try {
    const { downloadDir } = await import('@tauri-apps/api/path');
    const d = await downloadDir();
    if (d) return d.replace(/\/$/, '');
  } catch {
    // ignore
  }
  return '/tmp';
}

export const PhotosView: React.FC<PhotosViewProps> = ({ device, onNotify }) => {
  const [selectedCategory, setSelectedCategory] = useState<PhotoCategory>('recent');
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  // Fullscreen / HD Preview Modal State
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [previewSrcMap, setPreviewSrcMap] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadedPaths, setDownloadedPaths] = useState<Record<string, string>>({});

  // Delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);

  const currentCategoryDef =
    CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];

  const notify = (msg: string, isError = false) => {
    if (onNotify) {
      onNotify(msg, isError);
    } else {
      console.log(`[Photos] ${msg}`);
    }
  };

  // Load photos from Android device
  const loadPhotos = useCallback(async () => {
    if (!device?.serial) return;
    setLoading(true);
    setError(null);

    try {
      const category = currentCategoryDef;
      // Build find + stat command matching native PhotosView.swift
      const extFilters = ALL_MEDIA_EXTENSIONS
        .map((ext) => `-iname "*.${ext}"`)
        .join(' -o ');

      const findCmd = `[ -d "${category.path}" ] || exit 0; find "${category.path}" -maxdepth ${category.depth} -type f \\( ${extFilters} \\) -exec stat -c '%s|%Y|%n' {} \\; 2>/dev/null`;

      let parsedItems: MediaItem[] = [];

      try {
        const output = await invoke<string>('run_adb_shell_command', {
          serial: device.serial,
          command: findCmd,
          customPath: null,
        });

        if (output && output.trim()) {
          const lines = output.split(/\r?\n/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const parts = trimmed.split('|');
            if (parts.length >= 3) {
              const byteCount = parseInt(parts[0], 10) || 0;
              const timestamp = parseInt(parts[1], 10) || 0;
              const fullPath = parts.slice(2).join('|');
              const name = fullPath.split('/').pop() || '';
              if (!name || name.startsWith('.')) continue;

              const ext = name.split('.').pop()?.toLowerCase() || '';
              const isVideo = VIDEO_EXTENSIONS.includes(ext);

              const date = new Date(timestamp * 1000);
              const dateText = !isNaN(date.getTime())
                ? `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
                : '';

              parsedItems.push({
                id: fullPath,
                name,
                path: fullPath,
                size: byteCount,
                sizeText: formatFileSize(byteCount),
                isVideo,
                dateText,
                modifiedTimestamp: timestamp,
              });
            }
          }
        }
      } catch (cmdErr) {
        console.warn('find command execution failed, fallback to list_directory:', cmdErr);
      }

      // Fallback to list_directory if find command yielded no results or failed
      if (parsedItems.length === 0) {
        try {
          const list = await invoke<FileNodeInfo[]>('list_directory', {
            serial: device.serial,
            path: category.path,
            customPath: null,
          });

          for (const item of list) {
            if (item.is_dir) continue;
            const ext = item.name.split('.').pop()?.toLowerCase() || '';
            if (ALL_MEDIA_EXTENSIONS.includes(ext)) {
              parsedItems.push({
                id: item.path,
                name: item.name,
                path: item.path,
                size: item.size,
                sizeText: formatFileSize(item.size),
                isVideo: VIDEO_EXTENSIONS.includes(ext),
                dateText: item.modified_time ? item.modified_time.split(' ')[0] : '',
                modifiedTimestamp: 0,
              });
            }
          }
        } catch {
          // ignore fallback error
        }
      }

      // Sort by modified timestamp descending (newest first)
      parsedItems.sort((a, b) => b.modifiedTimestamp - a.modifiedTimestamp);

      setPhotos(parsedItems);
    } catch (err: any) {
      console.error('Failed to load photos:', err);
      setError(typeof err === 'string' ? err : '无法读取相册目录');
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [device.serial, currentCategoryDef]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos, selectedCategory]);

  // Load HD preview when previewItem changes
  useEffect(() => {
    if (!previewItem) {
      setPreviewError(null);
      return;
    }

    const item = previewItem;
    // Already in cache
    if (previewSrcMap[item.path]) return;

    let isMounted = true;
    setLoadingPreview(true);
    setPreviewError(null);

    const fetchPreview = async () => {
      try {
        const safeName = item.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const tempPath = `/tmp/screen_remote_prev_${safeName}`;
        await invoke('pull_file_from_device', {
          serial: device.serial,
          remotePath: item.path,
          localPath: tempPath,
          customPath: null,
        });

        if (!isMounted) return;
        const srcUrl = convertFileSrc(tempPath);
        setPreviewSrcMap((prev) => ({ ...prev, [item.path]: srcUrl }));
      } catch (err: any) {
        if (!isMounted) return;
        setPreviewError(typeof err === 'string' ? err : '高清预览加载失败');
      } finally {
        if (isMounted) setLoadingPreview(false);
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [previewItem, previewSrcMap, device.serial]);

  // Filtered photos based on search
  const filteredPhotos = photos.filter((item) => {
    if (!searchText.trim()) return true;
    return item.name.toLowerCase().includes(searchText.trim().toLowerCase());
  });

  // Handle single photo click: open HD preview modal
  const handlePhotoClick = (item: MediaItem) => {
    setSelectedPhotoId(item.id);
    setPreviewItem(item);
  };

  // Keyboard navigation for preview modal
  useEffect(() => {
    if (!previewItem) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewItem(null);
      } else if (e.key === 'ArrowLeft') {
        const curIdx = filteredPhotos.findIndex((p) => p.id === previewItem.id);
        if (curIdx > 0) {
          const prev = filteredPhotos[curIdx - 1];
          setSelectedPhotoId(prev.id);
          setPreviewItem(prev);
        }
      } else if (e.key === 'ArrowRight') {
        const curIdx = filteredPhotos.findIndex((p) => p.id === previewItem.id);
        if (curIdx >= 0 && curIdx < filteredPhotos.length - 1) {
          const next = filteredPhotos[curIdx + 1];
          setSelectedPhotoId(next.id);
          setPreviewItem(next);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewItem, filteredPhotos]);

  // Navigate to previous/next in preview modal
  const navigatePreview = (direction: 'prev' | 'next') => {
    if (!previewItem) return;
    const curIdx = filteredPhotos.findIndex((p) => p.id === previewItem.id);
    if (direction === 'prev' && curIdx > 0) {
      const prev = filteredPhotos[curIdx - 1];
      setSelectedPhotoId(prev.id);
      setPreviewItem(prev);
    } else if (direction === 'next' && curIdx < filteredPhotos.length - 1) {
      const next = filteredPhotos[curIdx + 1];
      setSelectedPhotoId(next.id);
      setPreviewItem(next);
    }
  };

  // Save to Mac downloads
  const handleSaveToMac = async (item: MediaItem) => {
    try {
      const dlDir = await getDownloadsDir();
      const localDest = `${dlDir}/${item.name}`;
      notify(`正在保存 ${item.name} 到 Mac...`);
      await invoke('pull_file_from_device', {
        serial: device.serial,
        remotePath: item.path,
        localPath: localDest,
        customPath: null,
      });
      notify(`已保存至: ${localDest}`);
      setDownloadedPaths((prev) => ({ ...prev, [item.path]: localDest }));
      try {
        await revealItemInDir(localDest);
      } catch {
        // ignore
      }
    } catch (err: any) {
      notify(`保存失败: ${err?.message || err}`, true);
    }
  };

  // Delete photo
  const executeDeletePhoto = async () => {
    if (!deleteTarget) return;
    try {
      await invoke('delete_remote_file', {
        serial: device.serial,
        path: deleteTarget.path,
        customPath: null,
      });
      notify(`已从设备删除: ${deleteTarget.name}`);
      if (previewItem?.id === deleteTarget.id) {
        setPreviewItem(null);
      }
      setDeleteTarget(null);
      loadPhotos();
    } catch (err: any) {
      notify(`删除失败: ${err?.message || err}`, true);
    }
  };

  const previewIndex = previewItem
    ? filteredPhotos.findIndex((p) => p.id === previewItem.id)
    : -1;

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] select-none overflow-hidden">
      {/* Top Toolbar matching native macOS Photos */}
      <div className="px-6 pt-4 pb-2 flex items-center justify-between shrink-0 gap-4">
        {/* Left: Native macOS Segmented Control */}
        <div className="topbar-tabs-track">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`topbar-tab-capsule ${isSelected ? 'active' : ''}`}
              >
                {cat.title}
              </button>
            );
          })}
        </div>

        {/* Right: Search Input + Refresh */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-56">
            <input
              type="text"
              placeholder="搜索照片"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full h-[28px] bg-[#222225] border border-white/10 rounded-md pl-3 pr-7 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchText ? (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X size={12} />
              </button>
            ) : (
              <Search
                size={13}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
              />
            )}
          </div>

          {photos.length > 0 && (
            <span className="text-[11px] text-neutral-400 font-mono bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
              {filteredPhotos.length}
            </span>
          )}

          <button
            onClick={loadPhotos}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-white/10 text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
            title="刷新"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto relative">
        {loading && photos.length === 0 ? (
          /* Loading State */
          <div className="flex flex-col items-center justify-center h-full min-h-[360px] text-neutral-400">
            <RotateCw size={24} className="animate-spin text-blue-500 mb-3" />
            <span className="text-xs text-neutral-400">正在扫描媒体文件...</span>
          </div>
        ) : error ? (
          /* Error State */
          <div className="flex flex-col items-center justify-center h-full min-h-[360px] text-neutral-400 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3 text-amber-500">
              <X size={22} />
            </div>
            <p className="text-xs text-neutral-300 mb-3">{error}</p>
            <button
              onClick={loadPhotos}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs text-white transition-colors"
            >
              重新加载
            </button>
          </div>
        ) : filteredPhotos.length === 0 ? (
          /* Empty State strictly matching native_tab_photos.png */
          <div className="flex flex-col items-center justify-center h-full min-h-[380px] text-center px-6">
            {searchText.trim() ? (
              <>
                <Search size={44} className="text-neutral-600 mb-3 stroke-[1.2]" />
                <h4 className="text-sm font-bold text-white mb-1">未找到匹配照片</h4>
                <p className="text-xs text-neutral-400 mb-3">
                  没有找到与 "{searchText}" 相关的照片
                </p>
                <button
                  onClick={() => setSearchText('')}
                  className="px-3 py-1 bg-white/10 hover:bg-white/15 text-xs text-white rounded-md transition-colors"
                >
                  清除搜索
                </button>
              </>
            ) : (
              <>
                {/* Native SF Symbol 'photo.on.rectangle.angled' SVG recreation */}
                <svg
                  className="w-14 h-14 text-neutral-600 mb-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="3" width="16" height="14" rx="2" opacity="0.5" />
                  <rect x="6" y="7" width="16" height="14" rx="2" fill="#18181a" />
                  <circle cx="10" cy="11" r="1.5" />
                  <path d="m22 17-5.5-5.5-4 4-2-2L6 18" />
                </svg>
                <h4 className="text-sm font-bold text-white mb-1">暂无照片</h4>
                <p className="text-xs text-neutral-400">已连接设备中的照片会显示在这里。</p>
              </>
            )}
          </div>
        ) : (
          /* Photos Grid matching native photoGridCard */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 p-5">
            {filteredPhotos.map((item) => {
              const isSelected = selectedPhotoId === item.id;
              const cachedSrc = previewSrcMap[item.path];

              return (
                <div
                  key={item.id}
                  onClick={() => handlePhotoClick(item)}
                  className={`group relative flex flex-col p-2 rounded-xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500 shadow-md ring-1 ring-blue-500'
                      : 'bg-[#232325]/70 hover:bg-[#28282a] border-white/5 hover:border-white/15'
                  }`}
                >
                  {/* Thumbnail / Media Container */}
                  <div className="relative aspect-square w-full rounded-lg bg-black/40 border border-white/5 flex items-center justify-center overflow-hidden mb-2">
                    {cachedSrc ? (
                      item.isVideo ? (
                        <video
                          src={cachedSrc}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={cachedSrc}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )
                    ) : item.isVideo ? (
                      <VideoIcon
                        size={30}
                        className="text-cyan-400/80 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <ImageIcon
                        size={30}
                        className="text-neutral-400/80 group-hover:scale-105 transition-transform"
                      />
                    )}

                    {item.isVideo && (
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-bold text-white tracking-wider font-mono">
                        MP4
                      </span>
                    )}

                    {/* Quick action buttons on hover */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveToMac(item);
                        }}
                        className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow transition-colors"
                        title="保存到 Mac"
                      >
                        <Download size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(item);
                        }}
                        className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg shadow transition-colors"
                        title="从设备删除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Metadata Below */}
                  <span
                    className="text-xs font-medium text-neutral-200 truncate"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-neutral-500 font-mono">
                    <span>{item.sizeText}</span>
                    <span>{item.dateText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* High Definition Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col select-none animate-in fade-in duration-150">
          {/* Top Bar of Modal */}
          <div className="h-12 px-6 border-b border-[var(--border-card)] bg-[var(--bg-card)] flex items-center justify-between shrink-0">
            {/* Left Info */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-md">
                {previewItem.name}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[var(--text-secondary)] font-mono">
                {previewItem.sizeText}
              </span>
              <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                {previewItem.dateText}
              </span>
            </div>

            {/* Right Action Tools */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => handleSaveToMac(previewItem)}
                className="btn btn-primary px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={13} />
                <span>保存到 Mac</span>
              </button>

              {downloadedPaths[previewItem.path] && (
                <button
                  onClick={() => revealItemInDir(downloadedPaths[previewItem.path])}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 text-neutral-300 hover:text-white rounded-lg text-xs flex items-center gap-1 transition-colors"
                  title="在 Finder 中显示"
                >
                  <ExternalLink size={12} />
                  <span>在 Finder 中显示</span>
                </button>
              )}

              <button
                onClick={() => setDeleteTarget(previewItem)}
                className="p-1.5 bg-white/10 hover:bg-red-600/30 text-neutral-300 hover:text-red-400 rounded-lg text-xs transition-colors"
                title="从设备删除"
              >
                <Trash2 size={14} />
              </button>

              <div className="w-[1px] h-4 bg-white/10 mx-1" />

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors"
                title={isFullscreen ? '退出全屏' : '全屏预览'}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>

              <button
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors"
                title="关闭 (ESC)"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Center Content Viewer */}
          <div className="flex-1 relative flex items-center justify-center p-6 overflow-hidden">
            {/* Left Chevron */}
            {previewIndex > 0 && (
              <button
                onClick={() => navigatePreview('prev')}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/10 text-white flex items-center justify-center transition-all z-10 shadow-lg active:scale-95"
                title="上一张 (方向键左)"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            {/* Right Chevron */}
            {previewIndex >= 0 && previewIndex < filteredPhotos.length - 1 && (
              <button
                onClick={() => navigatePreview('next')}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/10 text-white flex items-center justify-center transition-all z-10 shadow-lg active:scale-95"
                title="下一张 (方向键右)"
              >
                <ChevronRight size={20} />
              </button>
            )}

            {/* Media Rendering */}
            {loadingPreview ? (
              <div className="flex flex-col items-center justify-center text-neutral-400">
                <RotateCw size={28} className="animate-spin text-blue-500 mb-3" />
                <span className="text-xs text-neutral-400">正在从设备加载高清预览...</span>
              </div>
            ) : previewError ? (
              <div className="flex flex-col items-center justify-center text-neutral-400 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3 text-red-400">
                  <X size={20} />
                </div>
                <p className="text-xs text-neutral-300 mb-3">{previewError}</p>
                <button
                  onClick={() => handleSaveToMac(previewItem)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs"
                >
                  直接下载到本机查看
                </button>
              </div>
            ) : previewSrcMap[previewItem.path] ? (
              previewItem.isVideo ? (
                <video
                  src={previewSrcMap[previewItem.path]}
                  controls
                  autoPlay
                  className={`${
                    isFullscreen ? 'max-h-[92vh] max-w-[96vw]' : 'max-h-[75vh] max-w-[85vw]'
                  } rounded-lg shadow-2xl object-contain`}
                />
              ) : (
                <img
                  src={previewSrcMap[previewItem.path]}
                  alt={previewItem.name}
                  className={`${
                    isFullscreen ? 'max-h-[92vh] max-w-[96vw]' : 'max-h-[75vh] max-w-[85vw]'
                  } rounded-lg shadow-2xl object-contain`}
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center text-neutral-400">
                {previewItem.isVideo ? <VideoIcon size={64} /> : <ImageIcon size={64} />}
                <span className="text-xs mt-3 text-neutral-400">{previewItem.name}</span>
              </div>
            )}
          </div>

          {/* Bottom Info Status */}
          <div className="h-9 px-6 border-t border-white/10 bg-[#1e1e20]/80 flex items-center justify-between text-[11px] text-neutral-500 shrink-0 font-mono">
            <span className="truncate max-w-lg">{previewItem.path}</span>
            <div className="flex items-center gap-4">
              <span>
                {previewIndex + 1} / {filteredPhotos.length}
              </span>
              <span className="text-[10px] text-neutral-600 hidden sm:inline">
                ← 上一张 | 下一张 → | ESC 退出
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-96 bg-[#252528] border border-white/10 rounded-xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-semibold text-white mb-2">确认删除媒体</h3>
            <p className="text-xs text-neutral-300 mb-4 leading-relaxed">
              确定要从 Android 设备中永久删除 "{deleteTarget.name}" 吗？此操作无法撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-white/10 transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeDeletePhoto}
                className="px-4 py-1.5 rounded-lg text-xs bg-red-600 hover:bg-red-500 text-white font-medium transition-colors shadow-sm"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
