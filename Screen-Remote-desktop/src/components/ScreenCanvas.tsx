import React, { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { NativeSessionInfo } from '../types';
import { AudioPlayer } from '../utils/audioPlayer';
import {
  RefreshCw,
  Volume1,
  Volume2,
  VolumeX,
  ArrowLeft,
  Home,
  Power,
  RotateCw,
  Glasses,
  ExternalLink,
  MoreHorizontal,
  Square,
  Check,
} from 'lucide-react';
import { LayoutInspectorOverlay } from './LayoutInspectorOverlay';

export type QualityPreset = 'original' | 'extreme' | '1080p' | '720p';

interface ScreenCanvasProps {
  sessionId: string;
  serial: string;
  sessionTitle?: string;
  isVirtualDisplay?: boolean;
  startApp?: string;
  onClose?: () => void;
  hideHeader?: boolean;
}

export const ScreenCanvas: React.FC<ScreenCanvasProps> = ({
  sessionId,
  serial,
  sessionTitle,
  isVirtualDisplay = false,
  startApp,
  onClose,
  hideHeader: _hideHeader = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paramsMenuRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const decoderRef = useRef<VideoDecoder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isClosingRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolution, setResolution] = useState<{ width: number; height: number }>({
    width: isVirtualDisplay ? 1200 : 1080,
    height: isVirtualDisplay ? 800 : 2400,
  });
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [fps, setFps] = useState(0);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [quality, setQuality] = useState<QualityPreset>('original');
  const [showParamsMenu, setShowParamsMenu] = useState(false);
  const [screenshotNotification, setScreenshotNotification] = useState<string | null>(null);

  // Native audio states
  const [hasAudio, setHasAudio] = useState(false);
  const [audioCodec, setAudioCodec] = useState('opus');
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // WebSocket reconnect backoff state
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // Close params dropdown when clicking outside
  useEffect(() => {
    if (!showParamsMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (paramsMenuRef.current && !paramsMenuRef.current.contains(e.target as Node)) {
        setShowParamsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showParamsMenu]);

  const ensureAudioResumed = useCallback(() => {
    audioPlayerRef.current?.resume();
  }, []);

  // Send control message over WebSocket
  const sendControl = useCallback(
    (event: Record<string, any>) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(event));
      } else {
        invoke('send_native_control_event', { sessionId, event }).catch(() => {});
      }
    },
    [sessionId]
  );

  // Coordinate mapping from Canvas element client position to Device Display resolution
  const getDeviceCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = resolution.width / rect.width;
      const scaleY = resolution.height / rect.height;
      const x = Math.max(0, Math.min(resolution.width, Math.round((e.clientX - rect.left) * scaleX)));
      const y = Math.max(0, Math.min(resolution.height, Math.round((e.clientY - rect.top) * scaleY)));
      return { x, y };
    },
    [resolution]
  );

  useEffect(() => {
    let isCancelled = false;
    let frameCount = 0;
    let fpsInterval: number;
    let streamPort = 0;
    let isDecoderConfigured = false;
    let decoder: VideoDecoder | null = null;
    let savedConfig: Uint8Array | null = null;
    let hasDecodedKeyFrame = false;
    isClosingRef.current = false;

    async function initSession() {
      try {
        setLoading(true);
        setError(null);

        // 1. Launch native scrcpy session on backend
        const sessionInfo = await invoke<NativeSessionInfo>('start_native_screen_session', {
          sessionId,
          isVirtualDisplay,
          startApp: startApp || null,
          customPath: null,
        });

        if (isCancelled) return;

        streamPort = sessionInfo.stream_port;
        setResolution({ width: sessionInfo.width, height: sessionInfo.height });

        if (sessionInfo.has_audio) {
          setHasAudio(true);
          const codec = sessionInfo.audio_codec || 'opus';
          setAudioCodec(codec);
          if (!audioPlayerRef.current) {
            const player = new AudioPlayer(codec);
            player.setVolume(volume);
            player.setMuted(isMuted);
            audioPlayerRef.current = player;
          }
        }

        // 2. Initialize Hardware-Accelerated WebCodecs VideoDecoder
        if (!('VideoDecoder' in window)) {
          throw new Error('WebCodecs VideoDecoder is not supported in this webview runtime.');
        }

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        decoder = new VideoDecoder({
          output: (frame: VideoFrame) => {
            if (!canvas || !ctx) {
              frame.close();
              return;
            }
            if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
              canvas.width = frame.displayWidth;
              canvas.height = frame.displayHeight;
            }
            ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
            frame.close();
            frameCount++;
          },
          error: (err) => {
            console.error('WebCodecs VideoDecoder error:', err);
          },
        });

        decoderRef.current = decoder;

        // FPS counter
        fpsInterval = window.setInterval(() => {
          setFps(frameCount);
          frameCount = 0;
        }, 1000);

        // 3. Connect to local WebSocket stream with exponential backoff
        connectStreamWs(0);
      } catch (err: any) {
        if (!isCancelled) {
          setError(typeof err === 'string' ? err : err.message || 'Failed to start screen session');
          setLoading(false);
        }
      }
    }

    function connectStreamWs(attempt: number) {
      if (isCancelled || isClosingRef.current || !streamPort) return;

      const wsUrl = `ws://127.0.0.1:${streamPort}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCancelled) return;
        setLoading(false);
        setReconnecting(false);
        setReconnectAttempt(0);
        setError(null);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          // JSON Control/Metadata Message
          try {
            const meta = JSON.parse(event.data);
            if (meta.type === 'init' || meta.type === 'resize') {
              setResolution({ width: meta.width, height: meta.height });
            }
            if (meta.type === 'init' && meta.has_audio) {
              setHasAudio(true);
              const codec = meta.audio_codec || 'opus';
              setAudioCodec(codec);
              if (!audioPlayerRef.current) {
                const player = new AudioPlayer(codec);
                player.setVolume(volume);
                player.setMuted(isMuted);
                audioPlayerRef.current = player;
              }
            }
          } catch {}
          return;
        }

        // Binary Frame Packet:
        // [0]: 1 (video) or 2 (audio)
        // [1]: is_config (1/0)
        // [2]: is_key (1/0)
        // [3..11]: pts (u64 BE)
        // [11..]: payload
        const buffer = event.data as ArrayBuffer;
        if (buffer.byteLength < 11) return;

        const view = new DataView(buffer);
        const packetType = view.getUint8(0);
        const isConfig = view.getUint8(1) === 1;
        const isKey = view.getUint8(2) === 1;
        const pts = Number(view.getBigUint64(3));
        const payload = new Uint8Array(buffer, 11);

        if (packetType === 1) {
          if (!decoder) return;

          // 1. Parameter Set / Config NALU (SPS/PPS): save and configure, DO NOT decode as frame
          if (isConfig) {
            savedConfig = payload;
            try {
              if (decoder.state !== 'configured') {
                decoder.configure({
                  codec: 'avc1.64002a',
                  optimizeForLatency: true,
                  hardwareAcceleration: 'prefer-hardware',
                });
              }
              isDecoderConfigured = true;
            } catch (cfgErr) {
              console.warn('VideoDecoder configure error:', cfgErr);
            }
            return;
          }

          // 2. Ensure decoder is configured
          if (!isDecoderConfigured || decoder.state !== 'configured') {
            try {
              decoder.configure({
                codec: 'avc1.64002a',
                optimizeForLatency: true,
                hardwareAcceleration: 'prefer-hardware',
              });
              isDecoderConfigured = true;
            } catch (cfgErr) {
              console.warn('VideoDecoder configure error:', cfgErr);
            }
          }

          // 3. Decode Keyframe (prepend SPS/PPS parameter set for self-contained Annex-B frame)
          if (isKey) {
            let frameData = payload;
            if (savedConfig) {
              const combined = new Uint8Array(savedConfig.length + payload.length);
              combined.set(savedConfig, 0);
              combined.set(payload, savedConfig.length);
              frameData = combined;
            }
            try {
              const chunk = new EncodedVideoChunk({
                type: 'key',
                timestamp: pts,
                data: frameData,
              });
              decoder.decode(chunk);
              hasDecodedKeyFrame = true;
            } catch (e: any) {
              console.error('Keyframe decode failed:', e?.name, e?.message);
            }
            return;
          }

          // 4. Decode Delta frame (only after at least one keyframe has been decoded)
          if (!hasDecodedKeyFrame) {
            return;
          }

          try {
            const chunk = new EncodedVideoChunk({
              type: 'delta',
              timestamp: pts,
              data: payload,
            });
            decoder.decode(chunk);
          } catch (e: any) {
            console.error('Delta frame decode failed:', e?.name, e?.message);
          }
        } else if (packetType === 2) {
          if (audioPlayerRef.current) {
            audioPlayerRef.current.feedAudio(payload, pts, isConfig);
          }
        }
      };

      ws.onerror = (e) => {
        console.warn('Screen stream websocket error:', e);
      };

      ws.onclose = () => {
        if (isCancelled || isClosingRef.current) return;
        const nextAttempt = attempt + 1;
        const delay = Math.min(500 * Math.pow(1.5, attempt), 5000);
        setReconnecting(true);
        setReconnectAttempt(nextAttempt);
        console.log(`WebSocket disconnected. Reconnecting attempt ${nextAttempt} in ${Math.round(delay)}ms...`);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectStreamWs(nextAttempt);
        }, delay);
      };
    }

    initSession();

    return () => {
      isCancelled = true;
      isClosingRef.current = true;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      clearInterval(fpsInterval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (decoderRef.current) {
        decoderRef.current.close();
        decoderRef.current = null;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.destroy();
        audioPlayerRef.current = null;
      }
      invoke('stop_native_screen_session', { sessionId }).catch(() => {});
    };
  }, [sessionId, serial, isVirtualDisplay, startApp]);

  // Touch handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    ensureAudioResumed();
    if (e.button !== 0) return; // Only primary mouse button
    setIsMouseDown(true);
    const { x, y } = getDeviceCoords(e);
    sendControl({ type: 'touch', action: 0, x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDown) return;
    const { x, y } = getDeviceCoords(e);
    sendControl({ type: 'touch', action: 2, x, y });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDown) return;
    setIsMouseDown(false);
    const { x, y } = getDeviceCoords(e);
    sendControl({ type: 'touch', action: 1, x, y });
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    ensureAudioResumed();
    const { x, y } = getDeviceCoords(e as any);
    const h = -Math.round(e.deltaX);
    const v = -Math.round(e.deltaY);
    sendControl({ type: 'scroll', x, y, h, v });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    ensureAudioResumed();
    // Right click sends Android BACK button
    sendControl({ type: 'key', action: 0, keycode: 4 });
    setTimeout(() => sendControl({ type: 'key', action: 1, keycode: 4 }), 50);
  };

  // Android Navigation bar key events
  const triggerKey = (keycode: number) => {
    ensureAudioResumed();
    sendControl({ type: 'key', action: 0, keycode });
    setTimeout(() => sendControl({ type: 'key', action: 1, keycode }), 50);
  };

  const homeTimerRef = useRef<number | null>(null);
  const homeLongPressedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (homeTimerRef.current) clearTimeout(homeTimerRef.current);
    };
  }, []);

  // Home button press handling (single press = HOME, long press = screenshot)
  const handleHomeMouseDown = () => {
    ensureAudioResumed();
    homeLongPressedRef.current = false;
    homeTimerRef.current = window.setTimeout(async () => {
      homeLongPressedRef.current = true;
      try {
        const dataUrl = await invoke<string>('capture_screenshot', { serial, customPath: null });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `screenshot_${serial}_${Date.now()}.png`;
        a.click();
        setScreenshotNotification('屏幕截图已保存至下载目录');
        setTimeout(() => setScreenshotNotification(null), 2500);
      } catch (err) {
        console.error('Screenshot capture failed:', err);
      }
    }, 1200);
  };

  const handleHomeMouseUp = () => {
    if (homeTimerRef.current) {
      clearTimeout(homeTimerRef.current);
      homeTimerRef.current = null;
    }
    if (!homeLongPressedRef.current) {
      triggerKey(3);
    }
  };

  const handleDetach = async () => {
    try {
      await invoke('open_detached_screen_window', {
        sessionId,
        screenId: isVirtualDisplay ? 'virtual' : 'main',
        title: sessionTitle || (isVirtualDisplay ? `虚拟屏 (${startApp || 'App'})` : `屏幕 (${serial})`),
        width: resolution.width,
        height: resolution.height,
      });
    } catch (err) {
      console.error('Failed to open detached window:', err);
    }
  };

  const handleRotate = async () => {
    try {
      const currentRot = await invoke<number>('get_screen_rotation', { serial, customPath: null });
      const nextRot = (currentRot + 1) % 4;
      await invoke('set_screen_rotation', { serial, rotation: nextRot, customPath: null });
    } catch (err) {
      console.error('Failed to rotate screen:', err);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-hidden bg-transparent select-none group"
    >
      {/* 1. 顶部悬浮工具栏 (Floating Island HUD) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full backdrop-blur-xl bg-neutral-900/80 border border-white/10 shadow-2xl shadow-black/80 text-white transition-all duration-300 hover:bg-neutral-900/95 hover:border-white/20">
        {/* 关闭按钮 */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 hover:bg-rose-500/30 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
            title="关闭/停止投屏"
          >
            <Square size={8} fill="currentColor" />
          </button>
        )}

        {/* 会话名称 */}
        <span className="text-xs font-semibold text-neutral-100 truncate max-w-[130px] sm:max-w-[180px] tracking-tight">
          {sessionTitle || (isVirtualDisplay ? `虚拟屏 (${startApp || 'App'})` : `屏幕 (${serial})`)}
        </span>

        {/* 呼吸状态灯与已连接字样 */}
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium text-emerald-400/90 text-[11px]">已连接</span>
        </div>

        {/* 实时 FPS 徽标 */}
        {fps > 0 && (
          <div className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 font-semibold tracking-wider">
            {fps} FPS
          </div>
        )}

        {/* 重连中状态指示 */}
        {reconnecting && (
          <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30 flex items-center gap-1 animate-pulse shrink-0">
            <RefreshCw size={10} className="animate-spin" /> 重连中 ({reconnectAttempt})
          </span>
        )}

        {/* 分隔细线 */}
        <div className="w-[1px] h-3.5 bg-white/15 mx-0.5" />

        {/* 工具按键组 */}
        <div className="flex items-center gap-1 shrink-0 relative">
          {/* UI 布局审查器 */}
          <button
            type="button"
            onClick={() => setIsInspectorOpen((prev) => !prev)}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isInspectorOpen
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-neutral-300 hover:text-white hover:bg-white/10'
            }`}
            title="UI 布局审查器 (Glasses)"
          >
            <Glasses size={14} />
          </button>

          {/* 旋转屏幕 (90°) */}
          <button
            type="button"
            onClick={handleRotate}
            className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            title="旋转屏幕 (90°)"
          >
            <RotateCw size={13} />
          </button>

          {/* 独立窗口弹出 */}
          <button
            type="button"
            onClick={handleDetach}
            className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            title="弹出至独立窗口"
          >
            <ExternalLink size={13} />
          </button>

          {/* 画质与参数配置菜单 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowParamsMenu((prev) => !prev)}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                showParamsMenu
                  ? 'bg-white/20 text-white'
                  : 'text-neutral-300 hover:text-white hover:bg-white/10'
              }`}
              title="画质与配置参数"
            >
              <MoreHorizontal size={14} />
            </button>

            {/* 画质参数下拉卡片 (Floating Card) */}
            {showParamsMenu && (
              <div
                ref={paramsMenuRef}
                className="absolute right-0 top-full mt-2.5 w-72 rounded-2xl backdrop-blur-2xl bg-neutral-900/95 border border-white/15 shadow-2xl p-3 z-50 text-xs text-neutral-200 select-none animate-in fade-in zoom-in-95 duration-150"
              >
                {/* 顶部标题行 */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                  <span className="font-semibold text-white tracking-wide text-[11px] uppercase">
                    投屏画质与控制参数
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono">
                    {resolution.width} × {resolution.height}
                  </span>
                </div>

                {/* 预设模式切换 */}
                <div className="mb-3">
                  <div className="text-[10px] text-neutral-400 font-medium mb-1.5 px-0.5">预设模式</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'original', name: '原画', desc: '最高画质 / 无损', badge: '16 Mbps' },
                      { id: 'extreme', name: '极速', desc: '超低延迟 / 竞技', badge: '120 FPS' },
                      { id: '1080p', name: '高清', desc: '平衡推荐 / 1080P', badge: '8 Mbps' },
                      { id: '720p', name: '省流', desc: '流畅省流 / 720P', badge: '4 Mbps' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setQuality(item.id as QualityPreset);
                        }}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          quality === item.id
                            ? 'bg-blue-600/20 border-blue-500/60 text-white shadow-sm shadow-blue-500/10'
                            : 'bg-white/[0.03] border-white/[0.06] text-neutral-300 hover:bg-white/[0.07] hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs">{item.name}</span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                              quality === item.id ? 'bg-blue-500/30 text-blue-300' : 'bg-white/5 text-neutral-400'
                            }`}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-400 mt-0.5 truncate">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 实时性能指标卡片 */}
                <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-3 flex items-center justify-between text-[11px]">
                  <div>
                    <div className="text-[10px] text-neutral-400">渲染帧率</div>
                    <div className="font-mono font-semibold text-emerald-400 text-xs mt-0.5">{fps} FPS</div>
                  </div>
                  <div className="w-[1px] h-6 bg-white/10" />
                  <div>
                    <div className="text-[10px] text-neutral-400">分辨率</div>
                    <div className="font-mono text-neutral-200 text-xs mt-0.5">
                      {resolution.width} × {resolution.height}
                    </div>
                  </div>
                  <div className="w-[1px] h-6 bg-white/10" />
                  <div>
                    <div className="text-[10px] text-neutral-400">音频状态</div>
                    <div className="font-mono text-neutral-200 text-xs mt-0.5">
                      {hasAudio ? audioCodec.toUpperCase() : '未开启'}
                    </div>
                  </div>
                </div>

                {/* 音频控制 */}
                {hasAudio && (
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-neutral-400 font-medium">设备音频输出</span>
                      <button
                        type="button"
                        onClick={() => {
                          ensureAudioResumed();
                          const nextMuted = !isMuted;
                          setIsMuted(nextMuted);
                          audioPlayerRef.current?.setMuted(nextMuted);
                        }}
                        className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                          isMuted
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-white/5 text-neutral-300 hover:text-white'
                        }`}
                      >
                        {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        <span>{isMuted ? '已静音' : '开启中'}</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 px-1">
                      <Volume1 size={13} className="text-neutral-400" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          ensureAudioResumed();
                          const v = parseFloat(e.target.value);
                          setVolume(v);
                          if (isMuted) setIsMuted(false);
                          audioPlayerRef.current?.setVolume(v);
                          audioPlayerRef.current?.setMuted(false);
                        }}
                        className="w-full accent-blue-500 h-1.5 bg-neutral-700/80 rounded-lg cursor-pointer"
                      />
                      <Volume2 size={13} className="text-neutral-400" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. 截屏成功浮动通知 Toast */}
      {screenshotNotification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full backdrop-blur-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-1.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <Check size={13} className="text-emerald-400" />
          <span>{screenshotNotification}</span>
        </div>
      )}

      {/* 3. 核心投屏渲染区域 (居中、自适应、保持宽高比、无假外壳) */}
      <div
        className="relative flex items-center justify-center shadow-2xl rounded-xl ring-1 ring-white/10 bg-black overflow-hidden"
        style={{
          aspectRatio: `${resolution.width} / ${resolution.height}`,
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm z-20 gap-3">
            <RefreshCw size={28} className="animate-spin text-blue-400" />
            <span className="text-xs font-medium text-neutral-300 tracking-wide">
              正在建立低延迟硬件加速渲染...
            </span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-20 gap-2 p-6 text-center">
            <div className="text-red-400 font-semibold text-sm">视频流启动失败</div>
            <div className="text-xs text-neutral-400 max-w-md">{error}</div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-md"
            >
              重试连接
            </button>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={resolution.width}
          height={resolution.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
          className="w-full h-full object-contain cursor-pointer block"
          style={{
            aspectRatio: `${resolution.width} / ${resolution.height}`,
          }}
        />

        {/* Remote UI Layout Inspector Overlay */}
        {isInspectorOpen && (
          <LayoutInspectorOverlay
            serial={serial}
            canvasRef={canvasRef}
            resolution={resolution}
            onClose={() => setIsInspectorOpen(false)}
          />
        )}
      </div>

      {/* 4. 底部悬浮导航控制坞 (Floating Navigation Pill) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-3 py-1.5 backdrop-blur-md bg-black/60 border border-white/10 rounded-full shadow-2xl shadow-black/80 text-neutral-300 select-none transition-all duration-200 hover:bg-black/80 hover:border-white/20">
        {/* 返回键 */}
        <button
          type="button"
          onClick={() => triggerKey(4)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/15 active:scale-90 transition-all cursor-pointer"
          title="返回 (Back, Keycode 4)"
        >
          <ArrowLeft size={15} />
        </button>

        {/* 主屏幕 (Home, 长按截屏) */}
        <button
          type="button"
          onMouseDown={handleHomeMouseDown}
          onMouseUp={handleHomeMouseUp}
          className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/15 active:scale-90 transition-all cursor-pointer"
          title="主屏幕 (短按 Home，长按截屏)"
        >
          <Home size={15} />
        </button>

        {/* 近期任务 / 多任务 */}
        <button
          type="button"
          onClick={() => triggerKey(187)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/15 active:scale-90 transition-all cursor-pointer"
          title="近期任务 (Recents, Keycode 187)"
        >
          <Square size={13} />
        </button>

        {/* 分隔细线 */}
        <div className="w-[1px] h-3.5 bg-white/15 mx-1" />

        {/* 电源 / 锁屏 */}
        <button
          type="button"
          onClick={() => triggerKey(26)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/15 active:scale-90 transition-all cursor-pointer"
          title="电源 / 锁屏 (Power, Keycode 26)"
        >
          <Power size={13} />
        </button>

        {/* 音量 - */}
        <button
          type="button"
          onClick={() => triggerKey(25)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/15 active:scale-90 transition-all cursor-pointer"
          title="音量 - (Volume Down, Keycode 25)"
        >
          <Volume1 size={14} />
        </button>

        {/* 音量 + */}
        <button
          type="button"
          onClick={() => triggerKey(24)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/15 active:scale-90 transition-all cursor-pointer"
          title="音量 + (Volume Up, Keycode 24)"
        >
          <Volume2 size={14} />
        </button>
      </div>
    </div>
  );
};
