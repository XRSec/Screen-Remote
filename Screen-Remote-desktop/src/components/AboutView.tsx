import React from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ExternalLink, Code2, Send, Heart, Layers } from 'lucide-react';

export const AboutView: React.FC = () => {
  const openLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div>
      {/* 品牌与说明卡片 */}
      <div className="card-section">
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: 'rgba(0, 122, 255, 0.1)',
              color: 'var(--accent-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}
          >
            <Layers size={32} />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Screen Remote Desktop
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            版本 1.0.0 · 基于 scrcpy 4.1 协议 · Tauri v2 (Rust + Web)
          </div>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-primary)',
              maxWidth: '520px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Screen Remote Desktop 采用现代跨平台混合架构：由 Tauri v2 驱动的超轻量控制面板负责设备发现与会话调度，远控页面直接绑定操作系统原生硬件管线 (macOS Metal / Windows DirectX)，实现毫秒级超低延迟、高刷新投屏与键鼠映射。
          </p>
        </div>
      </div>

      {/* 社区与支持 */}
      <div className="card-section">
        <div className="section-title">社区与支持</div>
        <div className="card">
          <div
            className="list-item"
            style={{ cursor: 'pointer' }}
            onClick={() => openLink('https://github.com/XRSec/Screen-Remote')}
          >
            <div className="list-item-left">
              <Code2 size={16} color="var(--accent-blue)" />
              <span style={{ color: 'var(--accent-blue)' }}>GitHub 开源仓库</span>
            </div>
            <div className="list-item-right">
              <ExternalLink size={14} color="var(--accent-blue)" />
            </div>
          </div>

          <div className="card-divider" />

          <div
            className="list-item"
            style={{ cursor: 'pointer' }}
            onClick={() => openLink('https://t.me/xrsec_chat')}
          >
            <div className="list-item-left">
              <Send size={16} color="var(--accent-blue)" />
              <span style={{ color: 'var(--accent-blue)' }}>Telegram 讨论组</span>
            </div>
            <div className="list-item-right">
              <ExternalLink size={14} color="var(--accent-blue)" />
            </div>
          </div>

          <div className="card-divider" />

          <div
            className="list-item"
            style={{ cursor: 'pointer' }}
            onClick={() => openLink('https://github.com/sponsors/XRSec')}
          >
            <div className="list-item-left">
              <Heart size={16} color="var(--accent-red)" />
              <span style={{ color: 'var(--accent-blue)' }}>赞助与支持项目</span>
            </div>
            <div className="list-item-right">
              <ExternalLink size={14} color="var(--accent-blue)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
