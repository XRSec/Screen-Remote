import React from 'react';
import { X, Copy, Terminal } from 'lucide-react';

interface SDLLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SDLLogModal: React.FC<SDLLogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-[#242426] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl h-[60vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1d1d1f] shrink-0">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-neutral-400" />
            <h2 className="text-sm font-semibold text-white">Diagnostics Log</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1 text-xs">
              <Copy size={12} /> Copy
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 p-2 bg-[#1e1e1e] overflow-y-auto font-mono text-[11px] text-neutral-300">
          <div className="text-neutral-500 mb-1">[Diagnostics Output]</div>
          <div className="text-green-400">INFO: System initialized...</div>
          <div className="text-blue-400">DEBUG: Scrcpy server starting...</div>
        </div>
      </div>
    </div>
  );
};
