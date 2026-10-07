import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AdbDevice } from '../../types';
import {
  Search,
  ArrowUp,
  SquarePen,
  MessageCircle,
  RotateCw,
  X,
} from 'lucide-react';

interface MessagesViewProps {
  device: AdbDevice;
  onNotify?: (msg: string, isError?: boolean) => void;
}

export interface ChatMessage {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
  timestamp: number;
}

export interface ConversationItem {
  id: string;
  threadId: string;
  address: string;
  name: string;
  initials: string;
  preview: string;
  time: string;
  timestamp: number;
  color: string;
  unread: boolean;
  messages: ChatMessage[];
}

const COLOR_PALETTE = [
  '#0a84ff', // Blue
  '#30d158', // Green
  '#ff9f0a', // Orange
  '#bf5af2', // Purple
  '#ff375f', // Pink
  '#64d2ff', // Light Blue
  '#ffd60a', // Yellow
  '#5e5ce6', // Indigo
];

function getConversationColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

function extractInitials(name: string, address: string): string {
  const target = (name && name !== address ? name : address).trim();
  if (!target) return '信';

  // Check if Chinese
  const chineseChars = target.match(/[\u4e00-\u9fa5]/g);
  if (chineseChars && chineseChars.length > 0) {
    if (chineseChars.length >= 2) {
      return chineseChars.slice(-2).join('');
    }
    return chineseChars[0];
  }

  // Check if English letters
  const letters = target.match(/[a-zA-Z]/g);
  if (letters && letters.length > 0) {
    return letters.slice(0, 2).join('').toUpperCase();
  }

  // Numeric (e.g. 10086 -> 10)
  const numbers = target.replace(/\D/g, '');
  if (numbers.length >= 2) {
    return numbers.slice(0, 2);
  }

  return target.slice(0, 2);
}

function deriveFriendlyName(address: string, body?: string): string {
  const cleanAddr = address.trim();

  if (cleanAddr === '10086') return '中国移动 (10086)';
  if (cleanAddr === '10000') return '中国电信 (10000)';
  if (cleanAddr === '10010') return '中国联通 (10010)';

  // Try extracting brand from signature in body, e.g. 【中国农业银行】
  if (body) {
    const signatureMatch = body.match(/^【([^】]+)】/);
    if (signatureMatch) {
      const sig = signatureMatch[1];
      if (sig.length <= 10) {
        return `${sig}`;
      }
    }
  }

  return cleanAddr || '未知发件人';
}

function formatMessageTime(timestamp: number): string {
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

  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekDays[date.getDay()];
  }

  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}-${day}`;
}

export const MessagesView: React.FC<MessagesViewProps> = ({ device, onNotify }) => {
  const [searchText, setSearchText] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isComposingNew, setIsComposingNew] = useState(false);
  const [newRecipient, setNewRecipient] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const parseSmsQuery = (output: string): ConversationItem[] => {
    if (!output || !output.includes('Row:')) {
      return [];
    }

    const rowRegex =
      /(?:^|\n)Row:\s*\d+\s+_id=([^,]+),\s*thread_id=([^,]+),\s*address=([^,]*),\s*body=([\s\S]*?),\s*date=(\d+),\s*type=(\d+),\s*read=(\d+)(?=\nRow:|$)/g;

    const threadMap = new Map<string, { address: string; messages: ChatMessage[] }>();

    let match;
    while ((match = rowRegex.exec(output)) !== null) {
      const id = match[1].trim();
      const threadId = match[2].trim() !== 'NULL' && match[2].trim() !== 'null' ? match[2].trim() : '';
      const address = match[3].trim();
      const body = match[4].trim();
      const timestamp = Number(match[5].trim()) || 0;
      const typeNum = match[6].trim();
      const readNum = match[7].trim();

      const sender: 'me' | 'them' = typeNum === '2' ? 'me' : 'them';
      const isRead = readNum === '1';

      const key = threadId || address || id;

      if (!threadMap.has(key)) {
        threadMap.set(key, {
          address: address || '未知发件人',
          messages: [],
        });
      }

      const thread = threadMap.get(key)!;
      if (!thread.address && address) {
        thread.address = address;
      }

      thread.messages.push({
        id: `msg-${id}`,
        sender,
        text: body,
        time: formatMessageTime(timestamp),
        timestamp,
      });

      // Track read status if unread
      if (!isRead) {
        (thread as any).unread = true;
      }
    }

    const convList: ConversationItem[] = [];

    for (const [key, thread] of threadMap.entries()) {
      if (thread.messages.length === 0) continue;

      // Sort messages oldest to newest
      thread.messages.sort((a, b) => a.timestamp - b.timestamp);

      const lastMsg = thread.messages[thread.messages.length - 1];
      const friendlyName = deriveFriendlyName(thread.address, lastMsg?.text);
      const initials = extractInitials(friendlyName, thread.address);
      const color = getConversationColor(thread.address || key);

      convList.push({
        id: key,
        threadId: key,
        address: thread.address,
        name: friendlyName,
        initials,
        preview: lastMsg ? lastMsg.text : '',
        time: lastMsg ? lastMsg.time : '',
        timestamp: lastMsg ? lastMsg.timestamp : 0,
        color,
        unread: !!(thread as any).unread,
        messages: thread.messages,
      });
    }

    // Sort conversations newest first
    convList.sort((a, b) => b.timestamp - a.timestamp);

    return convList;
  };

  const fetchSms = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const output = await invoke<string>('run_adb_shell_command', {
          serial: device.serial,
          command:
            "content query --uri content://sms --projection _id,thread_id,address,body,date,type,read --sort 'date DESC'",
          customPath: null,
        });

        const parsed = parseSmsQuery(output);
        setConversations(parsed);

        // Keep selection or pick first
        setSelectedId((prev) => {
          if (prev && parsed.some((c) => c.id === prev)) {
            return prev;
          }
          return parsed.length > 0 ? parsed[0].id : '';
        });
      } catch (err: any) {
        if (!silent && onNotify) {
          onNotify(`读取短信库失败: ${err?.message || err}`, true);
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [device.serial, onNotify]
  );

  useEffect(() => {
    fetchSms();
  }, [fetchSms]);

  useEffect(() => {
    scrollToBottom('auto');
  }, [selectedId, isComposingNew]);

  const normalizedQuery = searchText.trim().toLowerCase();

  const filteredConversations = conversations.filter((c) => {
    if (!normalizedQuery) return true;
    return (
      c.name.toLowerCase().includes(normalizedQuery) ||
      c.address.toLowerCase().includes(normalizedQuery) ||
      c.preview.toLowerCase().includes(normalizedQuery) ||
      c.messages.some((m) => m.text.toLowerCase().includes(normalizedQuery))
    );
  });

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  const handleSendMessage = async () => {
    const textToSend = replyText.trim();
    if (!textToSend) return;

    if (isComposingNew) {
      const recipient = newRecipient.trim();
      if (!recipient) {
        onNotify?.('请输入收件人号码', true);
        return;
      }

      const newMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'me',
        text: textToSend,
        time: '刚刚',
        timestamp: Date.now(),
      };

      const newConv: ConversationItem = {
        id: `thread-${Date.now()}`,
        threadId: `thread-${Date.now()}`,
        address: recipient,
        name: deriveFriendlyName(recipient),
        initials: extractInitials(recipient, recipient),
        preview: textToSend,
        time: '刚刚',
        timestamp: Date.now(),
        color: getConversationColor(recipient),
        unread: false,
        messages: [newMsg],
      };

      setConversations((prev) => [newConv, ...prev]);
      setSelectedId(newConv.id);
      setIsComposingNew(false);
      setNewRecipient('');
      setReplyText('');

      // Attempt to invoke intent on device
      try {
        const escaped = textToSend.replace(/"/g, '\\"');
        await invoke('run_adb_shell_command', {
          serial: device.serial,
          command: `am start -a android.intent.action.SENDTO -d sms:${recipient} --es sms_body "${escaped}" --ez exit_on_sent true 2>/dev/null`,
          customPath: null,
        });
      } catch {
        // Silent catch
      }
      return;
    }

    if (!selectedConversation) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      text: textToSend,
      time: '刚刚',
      timestamp: Date.now(),
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === selectedConversation.id) {
          return {
            ...c,
            preview: textToSend,
            time: '刚刚',
            timestamp: Date.now(),
            messages: [...c.messages, newMsg],
          };
        }
        return c;
      })
    );

    setReplyText('');
    setTimeout(() => scrollToBottom(), 50);

    // Attempt to invoke SMS intent or command on device
    try {
      const targetAddr = selectedConversation.address || selectedConversation.name;
      const escaped = textToSend.replace(/"/g, '\\"');
      await invoke('run_adb_shell_command', {
        serial: device.serial,
        command: `am start -a android.intent.action.SENDTO -d sms:${targetAddr} --es sms_body "${escaped}" --ez exit_on_sent true 2>/dev/null`,
        customPath: null,
      });
    } catch {
      // Silent catch
    }
  };

  const handleStartCompose = () => {
    setIsComposingNew(true);
    setNewRecipient('');
    setReplyText('');
  };

  return (
    <div className="flex-1 flex h-full bg-[var(--bg-primary)] text-[var(--text-primary)] select-none overflow-hidden">
      {/* Left Column: Conversation List */}
      <div className="w-[280px] min-w-[280px] max-w-[280px] border-r border-[var(--divider-color)] flex flex-col bg-[var(--bg-sidebar)] shrink-0 h-full">
        {/* Top Header: Search Box & New Conversation Button */}
        <div className="p-3 border-b border-[var(--divider-color)] flex items-center gap-2 shrink-0">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="搜索消息"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full h-[34px] bg-black/5 dark:bg-white/[0.055] hover:bg-black/10 dark:hover:bg-white/[0.08] border border-[var(--border-card)] focus:border-[var(--cds-clay)] rounded-lg pl-3 pr-8 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none transition-colors"
            />
            {searchText ? (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-0.5"
                title="清除"
              >
                <X size={13} />
              </button>
            ) : (
              <Search
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none"
              />
            )}
          </div>

          {/* New Conversation Button */}
          <button
            onClick={handleStartCompose}
            className={`w-[34px] h-[34px] rounded-lg border border-[var(--border-card)] flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
              isComposingNew
                ? 'bg-[var(--cds-clay)] text-white'
                : 'bg-black/5 dark:bg-white/[0.055] hover:bg-black/10 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="新建会话"
          >
            <SquarePen size={15} />
          </button>
        </div>

        {/* Conversation List / Left Empty State */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            /* 1:1 Left Empty State */
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
              <div className="text-[#8e8e93] opacity-85 mb-3 flex items-center justify-center">
                <MessageCircle size={44} strokeWidth={1.5} />
              </div>
              <h3 className="text-[17px] font-semibold text-white mb-1">暂无消息</h3>
              <p className="text-[13px] text-[#8e8e93] max-w-[220px] leading-relaxed">
                已连接设备中的消息会显示在这里。
              </p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8e8e93]">未找到相关消息</div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredConversations.map((item) => {
                const isSelected = !isComposingNew && item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setIsComposingNew(false);
                    }}
                    className={`w-full p-2.5 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent-blue)]/15 text-white'
                        : 'hover:bg-white/[0.04] text-neutral-300'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${item.color}b3, ${item.color})`,
                      }}
                    >
                      {item.initials}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span
                          className={`text-[13px] truncate ${
                            item.unread ? 'font-bold text-white' : 'font-medium text-neutral-200'
                          }`}
                        >
                          {item.name}
                        </span>
                        <span className="text-[11px] text-[#8e8e93] shrink-0 ml-1.5">{item.time}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[12px] text-[#8e8e93] truncate leading-tight pr-1">
                          {item.preview}
                        </p>
                        {item.unread && (
                          <span className="w-2 h-2 rounded-full bg-[var(--accent-blue)] shrink-0" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Message Detail & Bubble Stream */}
      <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden">
        {isComposingNew ? (
          /* Composing New Message */
          <>
            <div className="h-14 px-6 border-b border-[var(--divider-color)] flex items-center gap-3.5 bg-[var(--bg-card)] shrink-0">
              <div className="text-[13px] text-[var(--text-secondary)] font-medium shrink-0">收件人:</div>
              <input
                type="text"
                autoFocus
                placeholder="输入手机号或联系人..."
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none"
              />
              <button
                onClick={() => setIsComposingNew(false)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                取消
              </button>
            </div>

            <div className="flex-1 p-6 flex items-center justify-center text-center text-[var(--text-secondary)] text-xs">
              在下方输入消息并发送以开启新会话
            </div>

            {/* Input Bar */}
            <div className="p-3 px-5 border-t border-[var(--divider-color)] bg-[var(--bg-card)] shrink-0 flex items-center gap-2.5">
              <input
                type="text"
                placeholder="发送短信..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 h-[36px] bg-white/[0.08] hover:bg-white/[0.1] focus:bg-white/[0.12] border border-white/[0.12] focus:border-[var(--accent-blue)] rounded-full px-4 text-[13px] text-white placeholder-[#8e8e93] outline-none transition-colors"
              />
              <button
                onClick={handleSendMessage}
                disabled={!replyText.trim() || !newRecipient.trim()}
                className="w-[34px] h-[34px] rounded-full bg-[var(--accent-blue)] hover:bg-[#0071e3] disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors shadow-sm"
                title="发送"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </>
        ) : selectedConversation ? (
          /* Active Selected Conversation */
          <>
            {/* Header */}
            <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#202022] shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${selectedConversation.color}b3, ${selectedConversation.color})`,
                  }}
                >
                  {selectedConversation.initials}
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-white tracking-wide">
                    {selectedConversation.name}
                  </h3>
                  <span className="text-[11px] text-[#8e8e93]">
                    {selectedConversation.address && selectedConversation.address !== selectedConversation.name
                      ? `${selectedConversation.address} · 短信 (SMS)`
                      : '短信 (SMS)'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => fetchSms(false)}
                disabled={isLoading}
                className="p-2 rounded-lg text-[#8e8e93] hover:text-white hover:bg-white/5 transition-colors"
                title="重新读取短信"
              >
                <RotateCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Message Bubble Stream */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-3.5">
              {selectedConversation.messages.map((msg) => {
                const isMe = msg.sender === 'me';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[72%] ${
                      isMe ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div
                      className={`px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                        isMe
                          ? 'bg-[var(--accent-blue)] text-white rounded-[18px] rounded-br-[4px]'
                          : 'bg-[#2c2c2e] text-[#f2f2f7] border border-white/[0.08] rounded-[18px] rounded-bl-[4px]'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-[#8e8e93] mt-1 px-1">{msg.time}</span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 px-5 border-t border-white/10 bg-[#1c1c1e] shrink-0 flex items-center gap-2.5">
              <input
                type="text"
                placeholder="发送短信..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 h-[36px] bg-white/[0.08] hover:bg-white/[0.1] focus:bg-white/[0.12] border border-white/[0.12] focus:border-[var(--accent-blue)] rounded-full px-4 text-[13px] text-white placeholder-[#8e8e93] outline-none transition-colors"
              />
              <button
                onClick={handleSendMessage}
                disabled={!replyText.trim()}
                className="w-[34px] h-[34px] rounded-full bg-[var(--accent-blue)] hover:bg-[#0071e3] disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors shadow-sm"
                title="发送"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </>
        ) : (
          /* 1:1 Right Empty State (no conversation selected or no conversations) */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto">
            <div className="text-[#8e8e93] opacity-85 mb-3 flex items-center justify-center">
              <MessageCircle size={44} strokeWidth={1.5} />
            </div>
            <h3 className="text-[17px] font-semibold text-white mb-1">暂无消息</h3>
            <p className="text-[13px] text-[#8e8e93] max-w-[320px] leading-relaxed">
              已连接设备中的消息会显示在这里。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
