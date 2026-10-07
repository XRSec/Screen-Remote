import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AdbDevice } from '../../types';
import {
  Bell,
  BellOff,
  Search,
  X,
  MessageSquare,
  ShieldAlert,
  Mail,
  Info,
  RotateCw,
} from 'lucide-react';

interface NotificationsViewProps {
  device: AdbDevice;
  onNotify?: (msg: string, isError?: boolean) => void;
}

export interface NotificationItem {
  id: string;
  app: string;
  pkg: string;
  title: string;
  body: string;
  time: string;
  timestamp: number;
  iconType: 'message' | 'mail' | 'system' | 'generic';
  color: string;
}

const COLOR_PALETTE = [
  '#0a84ff', // Blue
  '#30d158', // Green
  '#ff9f0a', // Orange
  '#ff453a', // Red
  '#bf5af2', // Purple
  '#5e5ce6', // Indigo
  '#64d2ff', // Cyan
  '#ff375f', // Pink
];

function getAppColor(pkg: string): string {
  const lower = pkg.toLowerCase();
  if (lower.includes('forwarder') || lower.includes('sms') || lower.includes('message')) return '#30d158';
  if (lower.includes('system') || lower === 'android') return '#0a84ff';
  if (lower.includes('mail') || lower.includes('email') || lower.includes('gmail')) return '#bf5af2';
  if (lower.includes('bank') || lower.includes('alipay') || lower.includes('pay')) return '#ff9f0a';

  let hash = 0;
  for (let i = 0; i < pkg.length; i++) {
    hash = (hash << 5) - hash + pkg.charCodeAt(i);
    hash |= 0;
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

function getAppIconType(pkg: string): 'message' | 'mail' | 'system' | 'generic' {
  const lower = pkg.toLowerCase();
  if (
    lower.includes('sms') ||
    lower.includes('message') ||
    lower.includes('forwarder') ||
    lower.includes('chat') ||
    lower.includes('mms') ||
    lower.includes('wechat')
  ) {
    return 'message';
  }
  if (lower.includes('mail') || lower.includes('email') || lower.includes('gmail')) {
    return 'mail';
  }
  if (lower.includes('system') || lower === 'android' || lower.includes('security')) {
    return 'system';
  }
  return 'generic';
}

function getFriendlyAppName(pkg: string, fallbackChannel?: string): string {
  const lower = pkg.toLowerCase();
  if (lower === 'android') return '系统通知';
  if (lower.includes('systemui')) return '系统界面';
  if (lower.includes('forwarder')) return '短信转发器';
  if (lower.includes('wechat') || lower.includes('tencent.mm')) return '微信';
  if (lower.includes('messaging') || lower.includes('.mms')) return '信息';
  if (lower.includes('telecom') || lower.includes('phone')) return '电话';
  if (lower.includes('android.gm') || lower.includes('mail')) return '邮件';

  if (fallbackChannel && fallbackChannel.length > 0 && fallbackChannel.length < 20) {
    return fallbackChannel;
  }

  const parts = pkg.split('.');
  const last = parts[parts.length - 1];
  return last.charAt(0).toUpperCase() + last.slice(1);
}

function formatNotificationTime(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return '刚刚';
  const date = new Date(timestamp);
  const now = new Date();

  const isToday = now.toDateString() === date.toDateString();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  if (isToday) {
    return `${hours}:${minutes}`;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) {
    return `昨天 ${hours}:${minutes}`;
  }

  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}-${day}`;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ device, onNotify }) => {
  const [searchText, setSearchText] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const parseNotificationDump = (output: string): NotificationItem[] => {
    if (!output || !output.includes('NotificationRecord(')) {
      return [];
    }

    const items: NotificationItem[] = [];
    const recordBlocks = output.split(/NotificationRecord\(/g).slice(1);

    for (const block of recordBlocks) {
      const pkgMatch = block.match(/pkg=([^\s:]+)/);
      const keyMatch = block.match(/key=([^\s:]+)/);
      const idMatch = block.match(/id=([^\s:]+)/);

      // Title: android.title=String (...) or android.title=...
      const titleMatch =
        block.match(/android\.title=String \((.*?)\)/) ||
        block.match(/android\.title=([^\n]+)/);

      // Body: android.bigText, android.text, or tickerText
      const bodyMatch =
        block.match(/android\.bigText=String \((.*?)\)/) ||
        block.match(/android\.text=String \((.*?)\)/) ||
        block.match(/tickerText=([^\n]+)/);

      // Channel name
      const channelMatch = block.match(/mName=([^,]+)/);

      // Timestamp
      const whenMatch = block.match(/when=(\d+)/) || block.match(/mRankingTimeMs=(\d+)/);

      const pkg = pkgMatch ? pkgMatch[1] : 'unknown';
      const key = keyMatch ? keyMatch[1] : idMatch ? idMatch[1] : `notif-${items.length}`;
      let title = titleMatch ? titleMatch[1].trim() : '';
      let body = bodyMatch ? bodyMatch[1].trim() : '';
      const channel = channelMatch ? channelMatch[1].trim() : '';
      const timestamp = whenMatch ? Number(whenMatch[1]) : 0;

      // Clean up "null" or empty strings
      if (title === 'null') title = '';
      if (body === 'null') body = '';

      // Skip records without meaningful content
      if (!title && !body) continue;

      // Avoid duplicates
      if (items.some((i) => i.id === key)) continue;

      const appName = getFriendlyAppName(pkg, channel);
      const color = getAppColor(pkg);
      const iconType = getAppIconType(pkg);
      const time = formatNotificationTime(timestamp);

      items.push({
        id: key,
        app: appName,
        pkg,
        title: title || appName,
        body: body || title || '无详细内容',
        time,
        timestamp,
        iconType,
        color,
      });
    }

    return items;
  };

  const fetchNotifications = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const output = await invoke<string>('run_adb_shell_command', {
          serial: device.serial,
          command: 'dumpsys notification --noredact 2>/dev/null || dumpsys notification',
          customPath: null,
        });

        const parsed = parseNotificationDump(output);
        setNotifications(parsed);
      } catch (err: any) {
        if (!silent && onNotify) {
          onNotify(`拉取通知失败: ${err?.message || err}`, true);
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [device.serial, onNotify]
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const normalizedQuery = searchText.trim().toLowerCase();

  const filteredNotifications = notifications.filter((item) => {
    if (!normalizedQuery) return true;
    return (
      item.app.toLowerCase().includes(normalizedQuery) ||
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.body.toLowerCase().includes(normalizedQuery) ||
      item.pkg.toLowerCase().includes(normalizedQuery)
    );
  });

  const handleDismiss = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await invoke('run_adb_shell_command', {
        serial: device.serial,
        command: `cmd notification cancel '${id}' 2>/dev/null`,
        customPath: null,
      });
    } catch {
      // Ignore ADB dismissal error
    }
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const notificationsCountText = (() => {
    const totalCount = notifications.length;
    if (!normalizedQuery) {
      if (totalCount === 1) return '共 1 条通知';
      return `共 ${totalCount} 条通知`;
    }
    const matchCount = filteredNotifications.length;
    if (matchCount === 1) {
      return `找到 1 条通知（共 ${totalCount} 条）`;
    }
    return `找到 ${matchCount} 条通知（共 ${totalCount} 条）`;
  })();

  const renderNotificationIcon = (type: NotificationItem['iconType']) => {
    switch (type) {
      case 'message':
        return <MessageSquare size={20} className="text-white" />;
      case 'mail':
        return <Mail size={20} className="text-white" />;
      case 'system':
        return <ShieldAlert size={20} className="text-white" />;
      default:
        return <Bell size={20} className="text-white" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] select-none overflow-y-auto">
      <div className="w-full max-w-[880px] mx-auto p-6 md:p-8 flex flex-col gap-5 min-h-full">
        {/* Top Search Bar */}
        <div className="w-full flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索通知"
              className="w-full h-[34px] bg-black/5 dark:bg-white/[0.055] hover:bg-black/10 dark:hover:bg-white/[0.08] border border-[var(--border-card)] focus:border-[var(--cds-clay)] rounded-lg pl-3.5 pr-9 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none transition-colors"
            />
            {searchText ? (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-white transition-colors p-0.5"
                title="清除"
              >
                <X size={14} />
              </button>
            ) : (
              <Search
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e8e93] pointer-events-none"
              />
            )}
          </div>

          <button
            onClick={() => fetchNotifications(false)}
            disabled={isLoading}
            className="h-[34px] w-[34px] rounded-lg bg-white/[0.055] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-[#8e8e93] hover:text-white transition-colors shrink-0 disabled:opacity-40"
            title="拉取最新状态栏通知"
          >
            <RotateCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Content Area */}
        {notifications.length === 0 ? (
          /* 1:1 Native Empty State */
          <div className="flex-1 flex flex-col items-center justify-center min-h-[360px] text-center p-8 my-auto">
            <div className="text-[#8e8e93] opacity-85 mb-3 flex items-center justify-center">
              <BellOff size={44} strokeWidth={1.5} />
            </div>
            <h3 className="text-[17px] font-semibold text-white mb-1">暂无通知</h3>
            <p className="text-[13px] text-[#8e8e93] max-w-[340px] leading-relaxed">
              已连接设备中的通知会显示在这里。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Count & Clear All Bar */}
            <div className="flex items-center justify-between text-[13px] pt-1">
              <div className="flex items-center gap-1.5 font-medium text-[var(--accent-blue)]">
                <Bell size={14} className="fill-current" />
                <span>{notificationsCountText}</span>
              </div>
              <button
                onClick={handleClearAll}
                className="text-[#8e8e93] hover:text-white transition-colors cursor-pointer text-[13px]"
              >
                清空全部
              </button>
            </div>

            {/* Filtered List or No Results */}
            {filteredNotifications.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[260px] text-center p-8">
                <div className="text-[#8e8e93] opacity-85 mb-3 flex items-center justify-center">
                  <Search size={44} strokeWidth={1.5} />
                </div>
                <h3 className="text-[17px] font-semibold text-[var(--text-primary)] mb-1">无搜索结果</h3>
                <p className="text-[13px] text-[var(--text-secondary)] max-w-sm mb-4">搜索通知</p>
                <button
                  onClick={() => setSearchText('')}
                  className="btn btn-secondary px-3 py-1 text-xs"
                >
                  清除
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3.5 p-4 bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] border border-[var(--border-card)] rounded-xl transition-all shadow-sm"
                  >
                    {/* App Icon Tile */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                      style={{ backgroundColor: item.color }}
                    >
                      {renderNotificationIcon(item.iconType)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium">
                          <span className="font-semibold text-[var(--text-primary)]">{item.app}</span>
                          <span>·</span>
                          <span>{item.time}</span>
                        </div>
                        <button
                          onClick={() => handleDismiss(item.id)}
                          className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                          title="清除"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <h4 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">{item.title}</h4>
                      <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed break-words">{item.body}</p>
                      {item.iconType === 'message' && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#8e8e93] mt-2">
                          <Info size={12} />
                          <span>无法在此回复</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
