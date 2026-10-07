import React from 'react';
import { Smartphone, Plus } from 'lucide-react';

interface ContentUnavailableViewProps {
  icon?: React.ReactNode;
  title?: string;
  detail?: string;
  actionTitle?: string;
  onAction?: () => void;
  onAddDevice?: () => void;
}

export const ContentUnavailableView: React.FC<ContentUnavailableViewProps> = ({
  icon,
  title = '未选择设备',
  detail = '请在左侧侧边栏中选择一个已连接的 Android 设备，以查看设备硬件、管理应用与文件、或启动远程投屏。',
  actionTitle,
  onAction,
  onAddDevice,
}) => {
  return (
    <div className="content-unavailable-container">
      <div className="content-unavailable-box">
        <div className="content-unavailable-icon">
          {icon || <Smartphone size={44} strokeWidth={1.5} />}
        </div>
        <h2 className="content-unavailable-title">{title}</h2>
        <p className="content-unavailable-detail">{detail}</p>
        {onAddDevice && (
          <button className="btn btn-primary" onClick={onAddDevice} style={{ marginTop: '12px' }}>
            <Plus size={14} />
            <span>连接新设备</span>
          </button>
        )}
        {actionTitle && onAction && (
          <button className="btn btn-secondary" onClick={onAction} style={{ marginTop: '12px' }}>
            <span>{actionTitle}</span>
          </button>
        )}
      </div>
    </div>
  );
};
