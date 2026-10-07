import React from 'react';
import { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  onChange: (newSettings: AppSettings) => void;
}

export const SessionConfigView: React.FC<Props> = ({ settings, onChange }) => {
  const update = (patch: Partial<AppSettings>) => {
    onChange({ ...settings, ...patch });
  };

  return (
    <div className="flex flex-col gap-4 p-4 text-sm text-neutral-200">
      <div className="bg-[#242426] border border-white/10 rounded-xl p-4">
        <h3 className="font-semibold mb-3">Video & Encoding</h3>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span>Resolution</span>
            <select className="bg-[#2e2e32] px-2 py-1 rounded" value={settings.max_size} onChange={e => update({max_size: Number(e.target.value)})}>
              <option value={0}>Native</option>
              <option value={1920}>1080p</option>
              <option value={1280}>720p</option>
              <option value={854}>480p</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <span>Max FPS</span>
            <select className="bg-[#2e2e32] px-2 py-1 rounded" value={settings.max_fps} onChange={e => update({max_fps: Number(e.target.value)})}>
              <option value={0}>No Limit</option>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
              <option value={120}>120</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <span>Video Codec</span>
            <select className="bg-[#2e2e32] px-2 py-1 rounded" value={settings.video_codec || 'h264'} onChange={e => update({video_codec: e.target.value as 'h264'|'h265'|'av1'})}>
              <option value="h264">H.264</option>
              <option value="h265">H.265</option>
              <option value="av1">AV1</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <span>Video Bitrate (Mbps)</span>
            <input type="number" className="bg-[#2e2e32] px-2 py-1 rounded w-24 text-right" value={settings.bit_rate_mbps} onChange={e => update({bit_rate_mbps: Number(e.target.value)})} />
          </div>
        </div>
      </div>

      <div className="bg-[#242426] border border-white/10 rounded-xl p-4">
        <h3 className="font-semibold mb-3">Audio</h3>
        <div className="flex flex-col gap-3">
          <label className="flex justify-between items-center cursor-pointer">
            <span>Enable Audio Streaming</span>
            <input type="checkbox" checked={settings.audio_enabled} onChange={e => update({audio_enabled: e.target.checked})} />
          </label>
        </div>
      </div>

      <div className="bg-[#242426] border border-white/10 rounded-xl p-4">
        <h3 className="font-semibold mb-3">Behavior & Display</h3>
        <div className="flex flex-col gap-3">
          <label className="flex justify-between items-center cursor-pointer">
            <span>Turn screen off</span>
            <input type="checkbox" checked={settings.turn_screen_off} onChange={e => update({turn_screen_off: e.target.checked})} />
          </label>
          <label className="flex justify-between items-center cursor-pointer">
            <span>Stay awake</span>
            <input type="checkbox" checked={settings.stay_awake} onChange={e => update({stay_awake: e.target.checked})} />
          </label>
        </div>
      </div>
    </div>
  );
};
