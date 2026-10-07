import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ArrowLeft,
  Circle,
  Square,
  Power,
  Volume1,
  Volume2,
  VolumeX,
  RotateCw,
  SlidersHorizontal,
  Layers,
  Check,
  ChevronUp
} from 'lucide-react';

export type QualityPreset = 'original' | '1080p' | '720p';

interface ScreenFloatingToolbarProps {
  serial: string;
  onSendKey: (keycode: number) => void;
  isInspectorActive: boolean;
  onToggleInspector: () => void;
  currentQuality?: QualityPreset;
  onQualityChange?: (quality: QualityPreset) => void;
  className?: string;
  hasAudio?: boolean;
  volume?: number;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onVolumeChange?: (volume: number) => void;
}

export const ScreenFloatingToolbar: React.FC<ScreenFloatingToolbarProps> = ({
  serial,
  onSendKey,
  isInspectorActive,
  onToggleInspector,
  currentQuality = 'original',
  onQualityChange,
  className = '',
  hasAudio = false,
  volume = 1,
  isMuted = false,
  onToggleMute,
  onVolumeChange,
}) => {
  const [currentRotation, setCurrentRotation] = useState<number>(0);
  const [showRotationMenu, setShowRotationMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);

  const rotationMenuRef = useRef<HTMLDivElement | null>(null);
  const qualityMenuRef = useRef<HTMLDivElement | null>(null);
  const audioMenuRef = useRef<HTMLDivElement | null>(null);

  // Fetch current rotation on mount
  useEffect(() => {
    invoke<number>('get_screen_rotation', { serial, customPath: null })
      .then((rot) => setCurrentRotation(rot))
      .catch(() => {});
  }, [serial]);

  // Click outside listener for dropdown menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rotationMenuRef.current && !rotationMenuRef.current.contains(e.target as Node)) {
        setShowRotationMenu(false);
      }
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setShowQualityMenu(false);
      }
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setShowAudioMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Rotate screen handler
  const handleRotate = async (targetDegree: number) => {
    try {
      const rotCode = Math.floor((targetDegree % 360) / 90);
      await invoke('set_screen_rotation', {
        serial,
        rotation: rotCode,
        customPath: null,
      });
      setCurrentRotation(rotCode);
      setShowRotationMenu(false);
    } catch (err) {
      console.error('Failed to rotate screen:', err);
    }
  };

  const handleCycleRotation = () => {
    const nextRot = (currentRotation + 1) % 4;
    handleRotate(nextRot * 90);
  };

  const rotationAngle = (currentRotation * 90) % 360;

  return (
    <div
      className={`relative flex items-center gap-2 sm:gap-3 px-4 py-1.5 bg-neutral-900/90 hover:bg-neutral-900 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl select-none transition-all ${className}`}
    >
      {/* 1. Android Standard Navigation Keys */}
      <div className="flex items-center gap-1">
        {/* Back Key */}
        <button
          onClick={() => onSendKey(4)}
          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-full text-neutral-300 hover:text-white transition-colors"
          title="返回 (Back - Keycode 4 / 右键)"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Home Key */}
        <button
          onClick={() => onSendKey(3)}
          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-full text-neutral-300 hover:text-white transition-colors"
          title="主屏 (Home - Keycode 3)"
        >
          <Circle size={15} />
        </button>

        {/* Recents Key */}
        <button
          onClick={() => onSendKey(187)}
          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-full text-neutral-300 hover:text-white transition-colors"
          title="多任务 (App Switcher - Keycode 187)"
        >
          <Square size={14} />
        </button>
      </div>

      <div className="w-[1px] h-4 bg-white/15 mx-0.5" />

      {/* 2. Audio & Device Controls */}
      <div className="flex items-center gap-1">
        {/* Stream Audio Volume & Mute (Web Audio API) */}
        {hasAudio && (
          <div ref={audioMenuRef} className="relative flex items-center">
            <button
              onClick={onToggleMute}
              onMouseEnter={() => setShowAudioMenu(true)}
              className={`p-1.5 hover:bg-white/10 active:bg-white/20 rounded-full transition-colors ${
                isMuted || volume === 0
                  ? 'text-neutral-400 hover:text-white'
                  : 'text-blue-400 hover:text-blue-300'
              }`}
              title={
                isMuted
                  ? '原生音频已静音 (点击取消静音)'
                  : `原生音频 (${Math.round(volume * 100)}%) - 点击静音`
              }
            >
              {isMuted || volume === 0 ? (
                <VolumeX size={15} />
              ) : volume < 0.5 ? (
                <Volume1 size={15} />
              ) : (
                <Volume2 size={15} />
              )}
            </button>

            {/* Audio Volume Popover Slider */}
            {showAudioMenu && (
              <div
                onMouseLeave={() => setShowAudioMenu(false)}
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-36 bg-neutral-900/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl p-2.5 z-50 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-xs text-neutral-300">
                  <span className="font-medium">原生音频</span>
                  <span className="font-mono text-[11px] text-neutral-400">
                    {isMuted ? '静音' : `${Math.round(volume * 100)}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Device Volume Down */}
        <button
          onClick={() => onSendKey(25)}
          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-full text-neutral-300 hover:text-white transition-colors"
          title="系统音量减 (Device Volume Down - Keycode 25)"
        >
          <VolumeX size={15} />
        </button>

        {/* Device Volume Up */}
        <button
          onClick={() => onSendKey(24)}
          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-full text-neutral-300 hover:text-white transition-colors"
          title="系统音量加 (Device Volume Up - Keycode 24)"
        >
          <Volume2 size={15} />
        </button>

        {/* Power Key */}
        <button
          onClick={() => onSendKey(26)}
          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-full text-neutral-300 hover:text-white transition-colors"
          title="电源键 (Power - Keycode 26)"
        >
          <Power size={15} />
        </button>
      </div>

      <div className="w-[1px] h-4 bg-white/15 mx-0.5" />

      {/* 3. Screen Rotation Controls */}
      <div ref={rotationMenuRef} className="relative flex items-center">
        <button
          onClick={handleCycleRotation}
          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-full text-neutral-300 hover:text-white transition-colors flex items-center gap-1"
          title={`当前旋转: ${rotationAngle}° (点击顺时针旋转90°)`}
        >
          <RotateCw size={15} />
          <span className="text-[10px] font-mono text-neutral-400">{rotationAngle}°</span>
        </button>

        <button
          onClick={() => setShowRotationMenu(!showRotationMenu)}
          className="p-1 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition-colors ml-[-2px]"
          title="选择旋转角度"
        >
          <ChevronUp size={11} className={`transition-transform ${showRotationMenu ? 'rotate-180' : ''}`} />
        </button>

        {/* Rotation Preset Popover */}
        {showRotationMenu && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-32 bg-neutral-900/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl py-1 z-50 text-xs text-neutral-200">
            {[
              { label: '0° 竖屏', deg: 0 },
              { label: '90° 横屏', deg: 90 },
              { label: '180° 反向竖屏', deg: 180 },
              { label: '270° 反向横屏', deg: 270 },
            ].map((opt) => (
              <button
                key={opt.deg}
                onClick={() => handleRotate(opt.deg)}
                className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/10 text-left transition-colors ${
                  rotationAngle === opt.deg ? 'text-blue-400 font-medium' : ''
                }`}
              >
                <span>{opt.label}</span>
                {rotationAngle === opt.deg && <Check size={12} />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-[1px] h-4 bg-white/15 mx-0.5" />

      {/* 4. Quick Resolution / Quality Switcher */}
      <div ref={qualityMenuRef} className="relative flex items-center">
        <button
          onClick={() => setShowQualityMenu(!showQualityMenu)}
          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-full text-neutral-300 hover:text-white transition-colors flex items-center gap-1"
          title="画质与分辨率切换"
        >
          <SlidersHorizontal size={15} />
          <span className="text-[10px] uppercase font-mono text-neutral-400">
            {currentQuality === 'original' ? '原画' : currentQuality}
          </span>
        </button>

        {/* Quality Preset Popover */}
        {showQualityMenu && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-36 bg-neutral-900/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl py-1 z-50 text-xs text-neutral-200">
            <div className="px-3 py-1 text-[10px] font-semibold text-neutral-400 border-b border-white/10 uppercase tracking-wider">
              流分辨率预设
            </div>
            {[
              { id: 'original', label: '原画 (Native)', desc: '无缩放 / 最大清晰度' },
              { id: '1080p', label: '1080p (FHD)', desc: '1920×1080 / 流畅稳定' },
              { id: '720p', label: '720p (HD)', desc: '1280×720 / 极低延迟' },
            ].map((q) => (
              <button
                key={q.id}
                onClick={() => {
                  onQualityChange?.(q.id as QualityPreset);
                  setShowQualityMenu(false);
                }}
                className={`w-full flex flex-col px-3 py-1.5 hover:bg-white/10 text-left transition-colors ${
                  currentQuality === q.id ? 'text-blue-400' : ''
                }`}
              >
                <div className="flex items-center justify-between font-medium">
                  <span>{q.label}</span>
                  {currentQuality === q.id && <Check size={12} />}
                </div>
                <span className="text-[10px] text-neutral-500">{q.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-[1px] h-4 bg-white/15 mx-0.5" />

      {/* 5. UI Layout Inspector Toggle */}
      <button
        onClick={onToggleInspector}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
          isInspectorActive
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
            : 'text-neutral-300 hover:text-white hover:bg-white/10'
        }`}
        title={isInspectorActive ? '关闭布局审查器' : '开启 Android 布局审查器 (UI Inspector)'}
      >
        <Layers size={14} className={isInspectorActive ? 'text-white' : 'text-blue-400'} />
        <span className="hidden sm:inline">审查器</span>
      </button>
    </div>
  );
};
