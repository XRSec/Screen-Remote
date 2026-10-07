import React from 'react';
import { X } from 'lucide-react';

interface GroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-[#242426] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1d1d1f]">
          <h2 className="text-sm font-semibold text-white">Manage Device Groups</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 text-sm text-neutral-300">
          <p className="mb-4 text-xs text-neutral-400">Create, rename, select icons, and assign devices to groups.</p>
          <div className="border border-white/10 rounded-lg p-4 flex items-center justify-center bg-black/20 text-neutral-500">
            [Group List Placeholder]
          </div>
        </div>
        <div className="px-4 py-3 border-t border-white/10 bg-[#1d1d1f] flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
