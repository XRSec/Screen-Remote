import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { AdbDevice, FileNodeInfo } from '../../types';
import {
  Folder,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  ChevronRight,
  ChevronUp,
  Search,
  FileText,
  File,
  RotateCw,
  X,
  AlertCircle,
  HardDrive,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Video,
  Music,
  Check
} from 'lucide-react';

interface DeviceFilesViewProps {
  device: AdbDevice;
  onNotify?: (msg: string, isError?: boolean) => void;
}

interface DirectoryColumnState {
  path: string;
  entries: FileNodeInfo[];
  loading: boolean;
  error: string | null;
}

const ROOT_PATH = '/sdcard';

// Format bytes into readable format
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Get file category & description by extension
function getFileTypeInfo(filename: string): { typeName: string; iconType: string } {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp', 'svg'].includes(ext)) {
    return { typeName: `${ext.toUpperCase()} 图像`, iconType: 'image' };
  }
  if (['mp4', 'mkv', 'mov', 'avi', 'webm', '3gp', 'flv'].includes(ext)) {
    return { typeName: `${ext.toUpperCase()} 视频`, iconType: 'video' };
  }
  if (['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a'].includes(ext)) {
    return { typeName: `${ext.toUpperCase()} 音频`, iconType: 'audio' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
    return { typeName: `${ext.toUpperCase()} 压缩档案`, iconType: 'archive' };
  }
  if (ext === 'apk') {
    return { typeName: 'Android 应用程序包 (APK)', iconType: 'apk' };
  }
  if (['txt', 'log', 'md', 'json', 'xml', 'yaml', 'yml', 'csv'].includes(ext)) {
    return { typeName: `${ext.toUpperCase()} 文档`, iconType: 'text' };
  }
  if (['sh', 'py', 'js', 'ts', 'java', 'kt', 'c', 'cpp', 'rs', 'html', 'css'].includes(ext)) {
    return { typeName: `${ext.toUpperCase()} 源代码`, iconType: 'code' };
  }
  return { typeName: ext ? `${ext.toUpperCase()} 文件` : '未知文件', iconType: 'file' };
}

// Default Mac download directory resolver
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

export const DeviceFilesView: React.FC<DeviceFilesViewProps> = ({ device, onNotify }) => {
  // Navigation & Columns
  const [columns, setColumns] = useState<DirectoryColumnState[]>([
    { path: ROOT_PATH, entries: [], loading: true, error: null },
  ]);
  const [selectedPaths, setSelectedPaths] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<FileNodeInfo | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<Record<string, FileNodeInfo>>({});
  const [searchText, setSearchText] = useState('');

  // Modals state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadLocalPath, setUploadLocalPath] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<FileNodeInfo[] | null>(null);

  // Horizontal scroll container reference
  const columnsContainerRef = useRef<HTMLDivElement | null>(null);

  // Active directory path is the path of the last column
  const activeDirectoryPath = columns.length > 0 ? columns[columns.length - 1].path : ROOT_PATH;

  const notify = (msg: string, isError = false) => {
    if (onNotify) {
      onNotify(msg, isError);
    } else {
      console.log(`[Files] ${msg}`);
    }
  };

  // Load a column's directory contents
  const loadDirectory = useCallback(
    async (dirPath: string, colIndex: number) => {
      setColumns((prev) => {
        const next = [...prev];
        if (next[colIndex]) {
          next[colIndex] = { ...next[colIndex], loading: true, error: null };
        }
        return next;
      });

      try {
        const list = await invoke<FileNodeInfo[]>('list_directory', {
          serial: device.serial,
          path: dirPath,
          customPath: null,
        });

        // Sort: directories first, then alphabetical
        const sorted = [...list].sort((a, b) => {
          if (a.is_dir === b.is_dir) {
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          }
          return a.is_dir ? -1 : 1;
        });

        setColumns((prev) => {
          const next = [...prev];
          if (next[colIndex]) {
            next[colIndex] = {
              path: dirPath,
              entries: sorted,
              loading: false,
              error: null,
            };
          }
          return next;
        });
      } catch (err: any) {
        const errorMsg = typeof err === 'string' ? err : err?.message || '读取目录失败';
        setColumns((prev) => {
          const next = [...prev];
          if (next[colIndex]) {
            next[colIndex] = {
              ...next[colIndex],
              loading: false,
              error: errorMsg,
            };
          }
          return next;
        });
      }
    },
    [device.serial]
  );

  // Initial load
  useEffect(() => {
    setColumns([{ path: ROOT_PATH, entries: [], loading: true, error: null }]);
    setSelectedPaths({});
    setSelectedFile(null);
    setSelectedEntries({});
    loadDirectory(ROOT_PATH, 0);
  }, [device.serial, loadDirectory]);

  // Scroll to right when new columns open
  useEffect(() => {
    if (columnsContainerRef.current) {
      columnsContainerRef.current.scrollTo({
        left: columnsContainerRef.current.scrollWidth,
        behavior: 'smooth',
      });
    }
  }, [columns.length, selectedFile]);

  // Handle entry click
  const handleEntryClick = (entry: FileNodeInfo, colIndex: number) => {
    const column = columns[colIndex];
    if (!column) return;

    // Update selection map: mark this entry as selected in this column
    const nextSelectedPaths = { ...selectedPaths };
    // Clear selections in columns to the right
    columns.slice(colIndex + 1).forEach((c) => {
      delete nextSelectedPaths[c.path];
    });
    nextSelectedPaths[column.path] = entry.path;
    setSelectedPaths(nextSelectedPaths);

    if (entry.is_dir) {
      // Truncate columns to colIndex + 1
      const truncated = columns.slice(0, colIndex + 1);
      const newPath = entry.path;
      // Append new column for directory
      setColumns([
        ...truncated,
        { path: newPath, entries: [], loading: true, error: null },
      ]);
      setSelectedFile(null);
      loadDirectory(newPath, colIndex + 1);
    } else {
      // Non-directory file clicked: truncate columns to colIndex + 1 and show file detail
      const truncated = columns.slice(0, colIndex + 1);
      setColumns(truncated);
      setSelectedFile(entry);
    }
  };

  // Toggle batch selection checkbox
  const handleToggleCheckbox = (e: React.MouseEvent, entry: FileNodeInfo) => {
    e.stopPropagation();
    setSelectedEntries((prev) => {
      const next = { ...prev };
      if (next[entry.path]) {
        delete next[entry.path];
      } else {
        next[entry.path] = entry;
      }
      return next;
    });
  };

  // Click on empty space in a column to deselect subsequent columns
  const handleColumnBackgroundClick = (colIndex: number) => {
    const column = columns[colIndex];
    if (!column) return;
    if (colIndex === columns.length - 1 && !selectedFile) return;

    const truncated = columns.slice(0, colIndex + 1);
    setColumns(truncated);
    setSelectedFile(null);

    const nextSelectedPaths = { ...selectedPaths };
    delete nextSelectedPaths[column.path];
    columns.slice(colIndex + 1).forEach((c) => {
      delete nextSelectedPaths[c.path];
    });
    setSelectedPaths(nextSelectedPaths);
  };

  // Navigate up one level
  const handleNavigateUp = () => {
    if (selectedFile) {
      setSelectedFile(null);
      return;
    }
    if (columns.length > 1) {
      const truncated = columns.slice(0, columns.length - 1);
      setColumns(truncated);
      setSearchText('');
      return;
    }
    // At root column: go to parent directory if possible
    const current = activeDirectoryPath;
    if (current === '/' || current === '') return;
    const trimmed = current.replace(/\/$/, '');
    const lastSlash = trimmed.lastIndexOf('/');
    const parent = lastSlash >= 0 ? trimmed.substring(0, lastSlash) || '/' : '/';
    setColumns([{ path: parent, entries: [], loading: true, error: null }]);
    setSelectedPaths({});
    setSelectedFile(null);
    setSearchText('');
    loadDirectory(parent, 0);
  };

  // Jump to breadcrumb path
  const handleBreadcrumbClick = (targetPath: string) => {
    // Check if targetPath matches one of the existing columns
    const matchIndex = columns.findIndex((c) => c.path === targetPath);
    if (matchIndex >= 0) {
      setColumns(columns.slice(0, matchIndex + 1));
      setSelectedFile(null);
    } else {
      setColumns([{ path: targetPath, entries: [], loading: true, error: null }]);
      setSelectedPaths({});
      setSelectedFile(null);
      loadDirectory(targetPath, 0);
    }
    setSearchText('');
  };

  // Single file download to Mac Downloads
  const handleDownloadFile = async (entry: FileNodeInfo) => {
    try {
      const dlDir = await getDownloadsDir();
      const localDest = `${dlDir}/${entry.name}`;
      notify(`正在下载: ${entry.name}...`);
      await invoke('pull_file_from_device', {
        serial: device.serial,
        remotePath: entry.path,
        localPath: localDest,
        customPath: null,
      });
      notify(`文件已下载至: ${localDest}`);
      try {
        await revealItemInDir(localDest);
      } catch {
        // ignore
      }
    } catch (err: any) {
      notify(`下载失败: ${err?.message || err}`, true);
    }
  };

  // Batch download selected entries
  const handleDownloadSelected = async () => {
    const items = Object.values(selectedEntries);
    if (items.length === 0) return;
    try {
      const dlDir = await getDownloadsDir();
      notify(`正在下载 ${items.length} 个文件...`);
      for (const item of items) {
        const localDest = `${dlDir}/${item.name}`;
        await invoke('pull_file_from_device', {
          serial: device.serial,
          remotePath: item.path,
          localPath: localDest,
          customPath: null,
        });
      }
      notify(`批量下载完成，已保存至 ${dlDir}`);
      setSelectedEntries({});
    } catch (err: any) {
      notify(`批量下载失败: ${err?.message || err}`, true);
    }
  };

  // Delete file or folder
  const handleDeleteItem = (entry: FileNodeInfo) => {
    setDeleteConfirmTarget([entry]);
  };

  // Batch delete selected entries
  const handleDeleteSelected = () => {
    const items = Object.values(selectedEntries);
    if (items.length === 0) return;
    setDeleteConfirmTarget(items);
  };

  // Confirm delete execution
  const executeDelete = async () => {
    if (!deleteConfirmTarget || deleteConfirmTarget.length === 0) return;
    try {
      for (const item of deleteConfirmTarget) {
        await invoke('delete_remote_file', {
          serial: device.serial,
          path: item.path,
          customPath: null,
        });
      }
      notify(`已删除 ${deleteConfirmTarget.length} 个项目`);
      setDeleteConfirmTarget(null);
      setSelectedEntries({});
      if (selectedFile && deleteConfirmTarget.some((t) => t.path === selectedFile.path)) {
        setSelectedFile(null);
      }
      // Refresh current columns
      columns.forEach((c, idx) => {
        loadDirectory(c.path, idx);
      });
    } catch (err: any) {
      notify(`删除失败: ${err?.message || err}`, true);
    }
  };

  // Create folder
  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name || name.includes('/')) return;
    const targetDir = activeDirectoryPath.endsWith('/')
      ? `${activeDirectoryPath}${name}`
      : `${activeDirectoryPath}/${name}`;
    try {
      await invoke('create_remote_dir', {
        serial: device.serial,
        path: targetDir,
        customPath: null,
      });
      notify(`文件夹已创建: ${name}`);
      setNewFolderName('');
      setShowNewFolderModal(false);
      // Reload the active column
      loadDirectory(activeDirectoryPath, columns.length - 1);
    } catch (err: any) {
      notify(`创建文件夹失败: ${err?.message || err}`, true);
    }
  };

  // Upload file (push)
  const handleUploadFile = async () => {
    const local = uploadLocalPath.trim();
    if (!local) return;
    const fileName = local.split(/[/\\]/).pop() || 'upload_file';
    const remoteDest = activeDirectoryPath.endsWith('/')
      ? `${activeDirectoryPath}${fileName}`
      : `${activeDirectoryPath}/${fileName}`;

    setIsUploading(true);
    try {
      await invoke('push_file_to_device', {
        serial: device.serial,
        localPath: local,
        remotePath: remoteDest,
        customPath: null,
      });
      notify(`文件上传成功: ${fileName}`);
      setUploadLocalPath('');
      setShowUploadModal(false);
      loadDirectory(activeDirectoryPath, columns.length - 1);
    } catch (err: any) {
      notify(`上传失败: ${err?.message || err}`, true);
    } finally {
      setIsUploading(false);
    }
  };

  // Parse path breadcrumbs
  const pathSegments = activeDirectoryPath.split('/').filter(Boolean);

  // Render icon based on entry type
  const renderEntryIcon = (entry: FileNodeInfo) => {
    if (entry.is_dir) {
      return (
        <Folder
          size={16}
          className="text-[#0a84ff] fill-[#0a84ff] shrink-0"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(10, 132, 255, 0.2))' }}
        />
      );
    }
    const { iconType } = getFileTypeInfo(entry.name);
    switch (iconType) {
      case 'image':
        return <ImageIcon size={15} className="text-pink-400 shrink-0" />;
      case 'video':
        return <Video size={15} className="text-cyan-400 shrink-0" />;
      case 'audio':
        return <Music size={15} className="text-amber-400 shrink-0" />;
      case 'apk':
        return <HardDrive size={15} className="text-emerald-400 shrink-0" />;
      case 'archive':
        return <FileArchive size={15} className="text-orange-400 shrink-0" />;
      case 'code':
        return <FileCode size={15} className="text-purple-400 shrink-0" />;
      case 'text':
        return <FileText size={15} className="text-neutral-400 shrink-0" />;
      default:
        return <File size={15} className="text-neutral-400 shrink-0" />;
    }
  };

  const selectedCount = Object.keys(selectedEntries).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] select-none overflow-hidden">
      {/* Top Toolbar matching macOS Finder */}
      <div className="h-12 px-4 border-b border-[var(--divider-color)] bg-[var(--bg-sidebar)] flex items-center justify-between shrink-0 gap-3">
        {/* Left Side: Up Button + Monospace Path / Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0 overflow-hidden">
          {/* Back/Up button '^' */}
          <button
            onClick={handleNavigateUp}
            disabled={activeDirectoryPath === '/' || (activeDirectoryPath === ROOT_PATH && columns.length === 1 && !selectedFile)}
            className={`w-7 h-7 flex items-center justify-center rounded-md border border-[var(--border-card)] text-[var(--text-secondary)] transition-all shrink-0 ${
              activeDirectoryPath === '/' || (activeDirectoryPath === ROOT_PATH && columns.length === 1 && !selectedFile)
                ? 'opacity-30 cursor-not-allowed bg-black/5 dark:bg-white/[0.02]'
                : 'bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-95 shadow-sm'
            }`}
            title="返回上一级"
          >
            <ChevronUp size={15} strokeWidth={2.2} />
          </button>

          {/* Breadcrumbs Path */}
          <div className="flex items-center font-mono text-xs text-[var(--text-secondary)] truncate py-1 px-2.5 bg-black/5 dark:bg-white/[0.04] rounded-md border border-[var(--border-card)]">
            <span
              onClick={() => handleBreadcrumbClick('/')}
              className="hover:text-[var(--cds-clay)] cursor-pointer transition-colors"
            >
              /
            </span>
            {pathSegments.map((seg, idx) => {
              const fullP = '/' + pathSegments.slice(0, idx + 1).join('/');
              const isLast = idx === pathSegments.length - 1;
              return (
                <React.Fragment key={fullP}>
                  <span className="text-[var(--text-muted)] mx-0.5">/</span>
                  <span
                    onClick={() => handleBreadcrumbClick(fullP)}
                    className={`cursor-pointer transition-colors ${
                      isLast
                        ? 'text-[var(--text-primary)] font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--cds-clay)]'
                    }`}
                    title={fullP}
                  >
                    {seg}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Center/Actions: Batch Tools + New Folder + Upload */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedCount > 0 && (
            <div className="flex items-center gap-1.5 bg-blue-600/15 border border-blue-500/30 px-2 py-1 rounded-md">
              <span className="text-xs text-blue-400 font-medium mr-1">
                已选 {selectedCount} 项
              </span>
              <button
                onClick={handleDownloadSelected}
                className="w-6 h-6 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                title="下载所选项到本机"
              >
                <Download size={13} />
              </button>
              <button
                onClick={handleDeleteSelected}
                className="w-6 h-6 flex items-center justify-center rounded bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white transition-colors"
                title="删除所选项目"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}

          {/* New folder button */}
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-white/10 bg-[#28282a] hover:bg-white/15 text-neutral-300 hover:text-white transition-all shadow-sm active:scale-95"
            title="新建文件夹"
          >
            <FolderPlus size={14} />
          </button>

          {/* Upload file button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-white/10 bg-[#28282a] hover:bg-white/15 text-neutral-300 hover:text-white transition-all shadow-sm active:scale-95"
            title="上传文件到当前目录"
          >
            <Upload size={14} />
          </button>
        </div>

        {/* Right Side: Search Input */}
        <div className="relative w-48 shrink-0">
          <input
            type="text"
            placeholder="搜索文件"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full h-7 bg-[#232325] border border-white/10 rounded-md pl-3 pr-7 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
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
      </div>

      {/* Main Miller Columns Container */}
      <div
        ref={columnsContainerRef}
        className="flex-1 flex flex-row overflow-x-auto overflow-y-hidden divide-x divide-[var(--divider-color)] bg-[var(--bg-primary)]"
      >
        {columns.map((col, colIndex) => {
          const isCurrentActiveCol = colIndex === columns.length - 1;
          const filteredEntries =
            isCurrentActiveCol && searchText.trim()
              ? col.entries.filter((item) =>
                  item.name.toLowerCase().includes(searchText.trim().toLowerCase())
                )
              : col.entries;

          return (
            <div
              key={col.path}
              className="w-[300px] min-w-[300px] max-w-[300px] flex flex-col h-full bg-[var(--bg-primary)] relative group/col select-none"
              onClick={() => handleColumnBackgroundClick(colIndex)}
            >
              {/* Column Content */}
              {col.loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-neutral-400">
                  <RotateCw size={20} className="animate-spin text-blue-500 mb-2" />
                  <span className="text-xs text-neutral-500">加载中...</span>
                </div>
              ) : col.error ? (
                <div className="flex-1 p-4 flex flex-col items-center justify-center text-center">
                  <AlertCircle size={28} className="text-red-400 mb-2" />
                  <p className="text-xs text-neutral-300 mb-3">{col.error}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadDirectory(col.path, colIndex);
                    }}
                    className="px-3 py-1 bg-white/10 hover:bg-white/15 rounded text-xs text-white"
                  >
                    重试
                  </button>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto py-1 px-1">
                  {filteredEntries.length === 0 ? (
                    <div className="py-8 text-center text-neutral-500 text-xs">
                      {searchText ? '无匹配文件' : '此目录为空'}
                    </div>
                  ) : (
                    filteredEntries.map((entry) => {
                      const isSelected = selectedPaths[col.path] === entry.path;
                      const isBatchSelected = !!selectedEntries[entry.path];

                      return (
                        <div
                          key={entry.path}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEntryClick(entry, colIndex);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (!entry.is_dir) {
                              handleDownloadFile(entry);
                            }
                          }}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition-colors mb-0.5 ${
                            isSelected
                              ? 'bg-blue-600/25 text-white font-medium shadow-sm'
                              : isBatchSelected
                              ? 'bg-blue-500/10 text-neutral-200'
                              : 'hover:bg-white/[0.06] text-neutral-300'
                          }`}
                        >
                          {/* Checkbox */}
                          <div
                            onClick={(e) => handleToggleCheckbox(e, entry)}
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isBatchSelected
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'border-white/20 hover:border-white/40 bg-white/[0.02]'
                            }`}
                          >
                            {isBatchSelected && <Check size={10} strokeWidth={3} />}
                          </div>

                          {/* File / Folder Icon */}
                          <div className="w-5 flex items-center justify-center shrink-0">
                            {renderEntryIcon(entry)}
                          </div>

                          {/* Name */}
                          <span
                            className="truncate flex-1 text-[12px] leading-tight"
                            title={entry.name}
                          >
                            {entry.name}
                          </span>

                          {/* Trailing indicator: Right chevron for folder, size for file */}
                          {entry.is_dir ? (
                            <ChevronRight
                              size={13}
                              className={`shrink-0 ${
                                isSelected ? 'text-blue-300' : 'text-neutral-500'
                              }`}
                            />
                          ) : (
                            <span className="text-[10px] text-neutral-500 shrink-0 font-mono">
                              {formatFileSize(entry.size)}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* File Detail Preview Column (when a file is selected) */}
        {selectedFile && (
          <div className="w-[320px] min-w-[300px] max-w-[340px] flex flex-col h-full bg-[var(--bg-card)] border-l border-[var(--divider-color)] p-6 items-center overflow-y-auto shrink-0 select-text">
            {/* File Icon */}
            <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center mt-4 mb-3 shadow-inner">
              {(() => {
                const { iconType } = getFileTypeInfo(selectedFile.name);
                switch (iconType) {
                  case 'image':
                    return <ImageIcon size={44} className="text-pink-400" />;
                  case 'video':
                    return <Video size={44} className="text-cyan-400" />;
                  case 'audio':
                    return <Music size={44} className="text-amber-400" />;
                  case 'apk':
                    return <HardDrive size={44} className="text-emerald-400" />;
                  case 'archive':
                    return <FileArchive size={44} className="text-orange-400" />;
                  case 'code':
                    return <FileCode size={44} className="text-purple-400" />;
                  default:
                    return <FileText size={44} className="text-neutral-400" />;
                }
              })()}
            </div>

            {/* File Name */}
            <h3
              className="text-sm font-semibold text-white text-center break-all mb-4 px-2 leading-snug"
              title={selectedFile.name}
            >
              {selectedFile.name}
            </h3>

            {/* Metadata Card */}
            <div className="w-full bg-[#242427] border border-white/5 rounded-xl p-4 space-y-2.5 text-xs shadow-sm mb-6">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">文件类型</span>
                <span className="text-neutral-200 font-medium">
                  {getFileTypeInfo(selectedFile.name).typeName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">文件大小</span>
                <span className="text-neutral-200 font-mono">
                  {formatFileSize(selectedFile.size)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">修改时间</span>
                <span className="text-neutral-200 font-mono text-[11px]">
                  {selectedFile.modified_time || '未知'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">文件权限</span>
                <span className="text-neutral-300 font-mono text-[11px]">
                  {selectedFile.permissions || '-'}
                </span>
              </div>
              <div className="pt-2 border-t border-white/5 flex flex-col gap-1">
                <span className="text-neutral-400 text-[11px]">设备完整路径</span>
                <span className="text-neutral-300 font-mono text-[10px] break-all bg-black/30 p-1.5 rounded">
                  {selectedFile.path}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-2.5 select-none">
              <button
                onClick={() => handleDownloadFile(selectedFile)}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-98"
              >
                <Download size={14} />
                <span>下载文件到本机</span>
              </button>

              <button
                onClick={() => handleDeleteItem(selectedFile)}
                className="w-full py-2 px-4 bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors active:scale-98"
              >
                <Trash2 size={14} />
                <span>从设备删除</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-96 bg-[#252528] border border-white/10 rounded-xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-semibold text-white mb-1">新建文件夹</h3>
            <p className="text-xs text-neutral-400 mb-3 font-mono break-all">
              目标路径: {activeDirectoryPath}
            </p>
            <input
              type="text"
              placeholder="请输入文件夹名称"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setShowNewFolderModal(false);
              }}
              className="w-full bg-[#1c1c1e] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-white/10 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium transition-colors shadow-sm"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-[440px] bg-[#252528] border border-white/10 rounded-xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-semibold text-white mb-1">上传文件到设备</h3>
            <p className="text-xs text-neutral-400 mb-3 font-mono break-all">
              目标路径: {activeDirectoryPath}
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">
                  Mac 本地文件绝对路径:
                </label>
                <input
                  type="text"
                  placeholder="如 /Users/xr/Downloads/app.apk"
                  value={uploadLocalPath}
                  onChange={(e) => setUploadLocalPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUploadFile();
                    if (e.key === 'Escape') setShowUploadModal(false);
                  }}
                  className="w-full bg-[#1c1c1e] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              {/* Quick suggestions */}
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                <span>快捷填入:</span>
                <button
                  onClick={() => setUploadLocalPath('/Users/xr/Downloads/')}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-neutral-300 font-mono text-[10px]"
                >
                  ~/Downloads
                </button>
                <button
                  onClick={() => setUploadLocalPath('/Users/xr/Desktop/')}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-neutral-300 font-mono text-[10px]"
                >
                  ~/Desktop
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadLocalPath('');
                }}
                disabled={isUploading}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-white/10 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleUploadFile}
                disabled={!uploadLocalPath.trim() || isUploading}
                className="px-4 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {isUploading ? (
                  <>
                    <RotateCw size={12} className="animate-spin" />
                    <span>上传中...</span>
                  </>
                ) : (
                  <span>上传 (Push)</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-96 bg-[#252528] border border-white/10 rounded-xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-semibold text-white mb-2">确认删除</h3>
            <p className="text-xs text-neutral-300 mb-4 leading-relaxed">
              {deleteConfirmTarget.length === 1
                ? `确定从 Android 设备删除 "${deleteConfirmTarget[0].name}" 吗？此操作无法撤销。`
                : `确定删除所选的 ${deleteConfirmTarget.length} 个项目吗？此操作无法撤销。`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-white/10 transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeDelete}
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
