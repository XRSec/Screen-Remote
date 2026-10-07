import React from 'react';

export type StatusType = 'online' | 'offline' | 'working' | 'connecting' | 'warning' | 'error' | 'success';

export interface StatusBadgeProps {
  status: StatusType;
  text?: string;
  className?: string;
}

const getStatusColor = (status: StatusType) => {
  switch (status) {
    case 'online':
    case 'success':
      return 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]';
    case 'offline':
      return 'bg-neutral-500';
    case 'working':
    case 'connecting':
    case 'warning':
      return 'bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,0.5)]';
    case 'error':
      return 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]';
    default:
      return 'bg-neutral-500';
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text, className = '' }) => {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/20 border border-white/10 ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(status)}`} />
      {text && <span className="text-[11px] font-medium text-white/90">{text}</span>}
    </div>
  );
};
