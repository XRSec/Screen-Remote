import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ScreenCanvas } from './ScreenCanvas';
import { AppSettings } from '../types';
import {
  MoreHorizontal,
  RotateCw,
  Maximize2,
  Glasses,
  ChevronRight,
  Check,
  ArrowDownToLine
} from 'lucide-react';

export const DetachedScreenView: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('sessionId') || '';
  const screenId = params.get('screenId') || 'primary';
  const title = params.get('title') || 'Z5';
  const isVirtualDisplay =
    params.get('isVirtualDisplay') === 'true' ||
    (screenId !== 'primary' && !screenId.startsWith('primary'));
  const startApp = params.get('startApp') || undefined;
  const initialSerial = params.get('serial') || '';
  const [serial, setSerial] = useState(initialSerial);

  // If serial not passed in URL, load from sessions
  useEffect(() => {
    if (!serial && sessionId) {
      invoke<any[]>('get_sessions')
        .then((sessions) => {
          const matched = sessions.find((s) => s.id === sessionId);
          if (matched) {
            const resolved = matched.active_serial || matched.connections?.[0]?.serial;
            if (resolved) setSerial(resolved);
          }
        })
        .catch((err) => console.error('Failed to load session serial:', err));
    }
  }, [sessionId, serial]);

  // Menu popover state
  const [showMenu, setShowMenu] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [currentQuality, setCurrentQuality] = useState('1080P');
  const [currentFPS, setCurrentFPS] = useState(60);
  const [currentBitrate, setCurrentBitrate] = useState('4M');
  const [rotation, setRotation] = useState(0);
  const [showInspector, setShowInspector] = useState(false);

  // Sync theme
  useEffect(() => {
    invoke<AppSettings>('get_settings')
      .then((loaded) => {
        const theme = loaded.theme;
        let isDark = false;
        if (theme === 'dark') {
          isDark = true;
        } else if (theme === 'light') {
          isDark = false;
        } else {
          isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        if (isDark) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      })
      .catch(() => {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      });
  }, []);

  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('button, input, [data-no-drag]')) {
      getCurrentWindow().startDragging();
    }
  };

  const handleRotate = async () => {
    const next = (rotation + 90) % 360;
    setRotation(next);
    if (serial) {
      invoke('set_screen_rotation', { serial, rotation: next }).catch(() => {});
    }
  };

  const handleDockToMain = useCallback(async () => {
    try {
      await invoke('close_detached_screen_window', { sessionId, screenId });
    } catch {
      try {
        await getCurrentWindow().close();
      } catch (e) {
        console.error('Failed to close detached screen window:', e);
      }
    }
  }, [sessionId, screenId]);

  // Compute session identifier for Canvas
  const canvasSessionId =
    isVirtualDisplay && !sessionId.includes('-vd-')
      ? `${sessionId}-vd-${screenId}`
      : sessionId;

  return (
    <div className="relative flex flex-col w-screen h-screen bg-[#000000] overflow-hidden select-none">
      {/* Top Native-style macOS Window Chrome Bar (Screenshot 2) */}
      <header
        className="flex items-center justify-between px-3 h-9 bg-black/80 backdrop-blur z-30 shrink-0 select-none border-b border-white/5"
        data-tauri-drag-region
        onMouseDown={handleDragMouseDown}
      >
        {/* Left: Spacer to clear native traffic lights */}
        <div className="flex items-center gap-2">
          <div className="w-16 h-4" data-tauri-drag-region onMouseDown={handleDragMouseDown} />
          <span className="text-xs font-bold text-white tracking-wide">{title}</span>
        </div>

        {/* Right action icons (Screenshot 2) */}
        <div className="flex items-center gap-1.5" data-no-drag>
          {/* Privacy / Layout Inspector Sunglasses Icon */}
          <button
            type="button"
            onClick={() => setShowInspector(!showInspector)}
            className={`p-1 rounded hover:bg-white/10 transition-colors ${
              showInspector ? 'text-blue-400 bg-white/10' : 'text-neutral-400 hover:text-white'
            }`}
            title="布局审查 / 隐私模式"
          >
            <Glasses size={14} />
          </button>

          {/* Orientation toggle */}
          <button
            type="button"
            onClick={handleRotate}
            className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="切换屏幕方向"
          >
            <div className="w-3.5 h-3.5 border border-current rounded-[2px]" />
          </button>

          {/* Rotate 90° */}
          <button
            type="button"
            onClick={handleRotate}
            className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="顺时针旋转 90°"
          >
            <RotateCw size={14} />
          </button>

          {/* Fullscreen / Zoom */}
          <button
            type="button"
            onClick={() => getCurrentWindow().toggleMaximize()}
            className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="缩放自适应"
          >
            <Maximize2 size={13} />
          </button>

          {/* Circle Ellipsis Menu Button (Screenshot 2) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                showMenu ? 'bg-white/20 text-white' : 'text-neutral-300 hover:text-white hover:bg-white/10'
              }`}
              title="会话参数设置"
            >
              <MoreHorizontal size={14} />
            </button>

            {/* Cascading Parameters Menu Popover (Screenshot 2) */}
            {showMenu && (
              <div
                className="absolute right-0 top-8 z-50 w-44 bg-[#1f1f20]/95 backdrop-blur-xl border border-white/15 rounded-lg shadow-2xl py-1 text-xs text-neutral-200 select-none"
                onMouseLeave={() => {
                  setShowMenu(false);
                  setActiveSubmenu(null);
                }}
              >
                {/* 画质 > */}
                <div
                  className="relative px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer group"
                  onMouseEnter={() => setActiveSubmenu('quality')}
                >
                  <span>画质</span>
                  <ChevronRight size={12} className="text-neutral-400 group-hover:text-white" />

                  {activeSubmenu === 'quality' && (
                    <div className="absolute left-full top-0 ml-1 w-36 bg-[#1f1f20]/95 backdrop-blur-xl border border-white/15 rounded-lg shadow-2xl py-1">
                      {['流畅 720P', '高清 1080P', '超清 1920P', '原始尺寸'].map((q) => (
                        <div
                          key={q}
                          onClick={() => {
                            setCurrentQuality(q.replace(/[^0-9P]/g, '') || q);
                            setShowMenu(false);
                          }}
                          className="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer"
                        >
                          <span>{q}</span>
                          {(currentQuality.includes('1080') && q.includes('1080')) ||
                          (currentQuality.includes('720') && q.includes('720')) ? (
                            <Check size={12} />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 最大帧率 > */}
                <div
                  className="relative px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer group"
                  onMouseEnter={() => setActiveSubmenu('fps')}
                >
                  <span>最大帧率</span>
                  <ChevronRight size={12} className="text-neutral-400 group-hover:text-white" />

                  {activeSubmenu === 'fps' && (
                    <div className="absolute left-full top-0 ml-1 w-32 bg-[#1f1f20]/95 backdrop-blur-xl border border-white/15 rounded-lg shadow-2xl py-1">
                      {[30, 60, 90, 120].map((f) => (
                        <div
                          key={f}
                          onClick={() => {
                            setCurrentFPS(f);
                            setShowMenu(false);
                          }}
                          className="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer"
                        >
                          <span>{f} FPS</span>
                          {currentFPS === f && <Check size={12} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 视频码率 > */}
                <div
                  className="relative px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer group"
                  onMouseEnter={() => setActiveSubmenu('bitrate')}
                >
                  <span>视频码率</span>
                  <ChevronRight size={12} className="text-neutral-400 group-hover:text-white" />

                  {activeSubmenu === 'bitrate' && (
                    <div className="absolute left-full top-0 ml-1 w-32 bg-[#1f1f20]/95 backdrop-blur-xl border border-white/15 rounded-lg shadow-2xl py-1">
                      {['2M', '4M', '8M', '12M', '20M', '40M'].map((b) => (
                        <div
                          key={b}
                          onClick={() => {
                            setCurrentBitrate(b);
                            setShowMenu(false);
                          }}
                          className="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer"
                        >
                          <span>{b}</span>
                          {currentBitrate === b && <Check size={12} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 视频 > */}
                <div className="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer group">
                  <span>视频</span>
                  <ChevronRight size={12} className="text-neutral-400 group-hover:text-white" />
                </div>

                <div className="w-full h-[1px] bg-white/10 my-1" />

                {/* 音频 > */}
                <div className="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer group">
                  <span>音频</span>
                  <ChevronRight size={12} className="text-neutral-400 group-hover:text-white" />
                </div>

                {/* 连接选项 > */}
                <div className="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer group">
                  <span>连接选项</span>
                  <ChevronRight size={12} className="text-neutral-400 group-hover:text-white" />
                </div>

                {/* 其他选项 > */}
                <div className="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer group">
                  <span>其他选项</span>
                  <ChevronRight size={12} className="text-neutral-400 group-hover:text-white" />
                </div>

                {/* 虚拟显示 > */}
                <div className="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer group">
                  <span>虚拟显示</span>
                  <ChevronRight size={12} className="text-neutral-400 group-hover:text-white" />
                </div>

                <div className="w-full h-[1px] bg-white/10 my-1" />

                {/* Dock back button */}
                <div
                  onClick={handleDockToMain}
                  className="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <ArrowDownToLine size={13} />
                  <span>收回主窗口 (Dock)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Canvas Viewport */}
      <div className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center">
        <ScreenCanvas
          sessionId={canvasSessionId}
          serial={serial}
          sessionTitle={title}
          isVirtualDisplay={isVirtualDisplay}
          startApp={startApp}
          onClose={handleDockToMain}
        />
      </div>
    </div>
  );
};
