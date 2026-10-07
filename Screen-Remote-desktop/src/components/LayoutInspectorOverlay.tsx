import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  RemoteUiLayoutSnapshot,
  RemoteUiLayoutNode,
  RemoteUiLayoutNodeKind,
} from '../types';
import {
  RefreshCw,
  X,
  Copy,
  Check,
  Layers,
  Code,
  Tag,
  Crosshair,
} from 'lucide-react';

interface LayoutInspectorOverlayProps {
  serial: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  resolution: { width: number; height: number };
  onClose: () => void;
}

// Color palette 1:1 aligned with macOS ScreenLayoutInspectorNodeView
export const KIND_COLORS: Record<RemoteUiLayoutNodeKind, string> = {
  input: '#4caf50',     // Green
  button: '#64b5f6',    // Sky Blue
  text: '#ffd54f',      // Gold Yellow
  toggle: '#ff8a65',    // Orange
  image: '#ba68c8',     // Purple
  container: '#90a4ae', // Blue Gray
  other: '#e0e0e0',     // Light Gray
};

export const KIND_LABELS: Record<RemoteUiLayoutNodeKind, string> = {
  input: '输入框',
  button: '按钮',
  text: '文本',
  toggle: '选择/开关',
  image: '图片',
  container: '容器',
  other: '组件',
};

export const LayoutInspectorOverlay: React.FC<LayoutInspectorOverlayProps> = ({
  serial,
  canvasRef,
  resolution,
  onClose,
}) => {
  const [snapshot, setSnapshot] = useState<RemoteUiLayoutSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hoveredNode, setHoveredNode] = useState<RemoteUiLayoutNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<RemoteUiLayoutNode | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Position & layout measurement relative to canvas
  const [canvasRect, setCanvasRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>({ left: 0, top: 0, width: 0, height: 0 });

  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Fetch UI Automator layout dump from Tauri backend
  const fetchLayout = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await invoke<RemoteUiLayoutSnapshot>('dump_remote_ui_layout', {
        serial,
        customPath: null,
      });
      setSnapshot(res);
    } catch (err: any) {
      console.error('Failed to dump remote UI layout:', err);
      setError(typeof err === 'string' ? err : err.message || '抓取远程 UI 层次失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLayout();
  }, [serial]);

  // Update canvas bounds to overlay accurately
  const updateCanvasBounds = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const parent = canvas.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();

    setCanvasRect({
      left: rect.left - parentRect.left,
      top: rect.top - parentRect.top,
      width: rect.width,
      height: rect.height,
    });
  };

  useEffect(() => {
    updateCanvasBounds();
    window.addEventListener('resize', updateCanvasBounds);
    const interval = setInterval(updateCanvasBounds, 500);
    return () => {
      window.removeEventListener('resize', updateCanvasBounds);
      clearInterval(interval);
    };
  }, [canvasRef]);

  // Viewport bounds and scale factors
  const { scaleX, scaleY, viewport } = useMemo(() => {
    const vp = snapshot?.viewportBounds || {
      left: 0,
      top: 0,
      right: resolution.width || 1080,
      bottom: resolution.height || 2400,
      width: resolution.width || 1080,
      height: resolution.height || 2400,
    };
    const sX = canvasRect.width > 0 ? canvasRect.width / Math.max(vp.width, 1) : 1;
    const sY = canvasRect.height > 0 ? canvasRect.height / Math.max(vp.height, 1) : 1;
    return { scaleX: sX, scaleY: sY, viewport: vp };
  }, [snapshot, canvasRect, resolution]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  const getNodeColor = (node: RemoteUiLayoutNode) => {
    if (!node.enabled) return '#9e9e9e';
    return KIND_COLORS[node.kind] || '#e0e0e0';
  };

  const getShortClassName = (className: string) => {
    const parts = className.split('.');
    return parts[parts.length - 1] || className;
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-30 pointer-events-none select-none overflow-hidden"
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 right-4 z-50 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-1.5 mr-2 text-xs font-medium text-neutral-300">
          <Layers size={14} className="text-blue-400" />
          <span>UI 审查器</span>
          {snapshot && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
              {snapshot.nodes.length} 节点
            </span>
          )}
        </div>

        <button
          onClick={fetchLayout}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-white/10 hover:bg-white/15 active:bg-white/20 disabled:opacity-50 rounded-lg transition-colors"
          title="重新抓取布局快照"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-blue-400' : ''} />
          <span>刷新</span>
        </button>

        <button
          onClick={onClose}
          className="p-1 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
          title="关闭 UI 审查器"
        >
          <X size={15} />
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-40 pointer-events-auto gap-3">
          <div className="p-3 bg-neutral-900/90 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-2">
            <RefreshCw size={24} className="animate-spin text-blue-400" />
            <span className="text-xs text-neutral-200">正在 dump Android UIAutomator 节点树...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-md p-3 bg-red-950/90 border border-red-500/30 rounded-xl text-xs text-red-200 shadow-xl flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            onClick={fetchLayout}
            className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[11px] whitespace-nowrap"
          >
            重试
          </button>
        </div>
      )}

      {/* Canvas Matching Overlay Viewport */}
      {canvasRect.width > 0 && snapshot && (
        <div
          className="absolute pointer-events-auto"
          style={{
            left: `${canvasRect.left}px`,
            top: `${canvasRect.top}px`,
            width: `${canvasRect.width}px`,
            height: `${canvasRect.height}px`,
          }}
        >
          {snapshot.nodes.map((node, index) => {
            const left = (node.bounds.left - viewport.left) * scaleX;
            const top = (node.bounds.top - viewport.top) * scaleY;
            const width = Math.max(node.bounds.width * scaleX, 1);
            const height = Math.max(node.bounds.height * scaleY, 1);

            const color = getNodeColor(node);
            const isHovered = hoveredNode === node;
            const isSelected = selectedNode === node;

            const isEffectiveChecked =
              node.checked ||
              node.selected ||
              node.contentDescription.includes('已选中') ||
              node.contentDescription.includes('已勾选');

            return (
              <div
                key={`${node.packageName}-${node.className}-${index}-${node.bounds.left}-${node.bounds.top}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(node);
                }}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => {
                  if (hoveredNode === node) setHoveredNode(null);
                }}
                className={`absolute cursor-pointer transition-all ${
                  isSelected
                    ? 'ring-2 ring-yellow-400 ring-offset-1 z-30 shadow-lg'
                    : isHovered
                    ? 'z-20 ring-1 ring-white/80 shadow-md'
                    : 'z-10'
                }`}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  backgroundColor: isHovered
                    ? `${color}28`
                    : isSelected
                    ? `${color}38`
                    : `${color}0D`,
                  border: `${node.focused || isSelected ? 2 : 1}px solid ${color}`,
                  borderRadius: '2px',
                }}
              >
                {/* Node Label Badge */}
                {node.label && width > 28 && height > 16 && (
                  <div
                    className="absolute top-0.5 left-0.5 px-1 py-0.2 text-[9px] font-medium leading-none text-black rounded truncate max-w-[90%] shadow-sm pointer-events-none"
                    style={{
                      backgroundColor: color,
                      opacity: 0.92,
                    }}
                    title={node.label}
                  >
                    {node.enabled ? node.label : `${node.label} [off]`}
                  </div>
                )}

                {/* Toggle Indicator */}
                {node.kind === 'toggle' && (
                  <div className="absolute right-1 top-1 text-[10px] pointer-events-none">
                    {isEffectiveChecked ? (
                      <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block border border-white" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-sm bg-neutral-600 inline-block border border-neutral-400" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Hover Tooltip */}
      {hoveredNode && !selectedNode && (
        <div
          className="absolute z-50 pointer-events-none bg-neutral-900/95 border border-white/20 backdrop-blur-md rounded-lg p-2.5 shadow-2xl text-white text-xs max-w-xs transition-all duration-75"
          style={{
            left: Math.min(
              Math.max(
                (hoveredNode.bounds.left - viewport.left) * scaleX + canvasRect.left,
                16
              ),
              window.innerWidth - 300
            ),
            top: Math.max(
              (hoveredNode.bounds.top - viewport.top) * scaleY + canvasRect.top - 70,
              16
            ),
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getNodeColor(hoveredNode) }}
            />
            <span className="font-semibold text-xs text-white">
              {getShortClassName(hoveredNode.className)}
            </span>
            <span
              className="text-[10px] px-1 py-0.2 rounded font-medium ml-auto"
              style={{
                backgroundColor: `${getNodeColor(hoveredNode)}33`,
                color: getNodeColor(hoveredNode),
              }}
            >
              {KIND_LABELS[hoveredNode.kind]}
            </span>
          </div>

          {hoveredNode.resourceId && (
            <div className="text-[11px] font-mono text-neutral-300 truncate">
              {hoveredNode.resourceId}
            </div>
          )}

          {(hoveredNode.text || hoveredNode.contentDescription) && (
            <div className="text-[11px] text-neutral-400 truncate mt-0.5">
              "{hoveredNode.text || hoveredNode.contentDescription}"
            </div>
          )}

          <div className="text-[10px] font-mono text-neutral-500 mt-1 flex items-center justify-between border-t border-white/10 pt-1">
            <span>
              [{hoveredNode.bounds.left}, {hoveredNode.bounds.top}]-[{hoveredNode.bounds.right}, {hoveredNode.bounds.bottom}]
            </span>
            <span className="text-neutral-400">
              {hoveredNode.bounds.width}×{hoveredNode.bounds.height}
            </span>
          </div>
        </div>
      )}

      {/* Selected Node Detail Drawer / Card */}
      {selectedNode && (
        <div className="absolute bottom-4 right-4 z-50 pointer-events-auto w-96 bg-neutral-900/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-neutral-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-neutral-800/50">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-md"
                style={{ backgroundColor: getNodeColor(selectedNode) }}
              />
              <span className="font-semibold text-sm text-white truncate max-w-[200px]">
                {getShortClassName(selectedNode.className)}
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: `${getNodeColor(selectedNode)}33`,
                  color: getNodeColor(selectedNode),
                }}
              >
                {KIND_LABELS[selectedNode.kind]}
              </span>
            </div>

            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {/* Resource ID */}
            {selectedNode.resourceId && (
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-neutral-400 mb-1">
                  <span className="text-[11px] font-medium flex items-center gap-1">
                    <Tag size={12} className="text-blue-400" /> Resource ID
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedNode.resourceId, 'resId')}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    {copiedKey === 'resId' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'resId' ? '已复制' : '复制'}
                  </button>
                </div>
                <div className="font-mono text-xs text-white break-all select-text">
                  {selectedNode.resourceId}
                </div>
              </div>
            )}

            {/* Text / Label */}
            {(selectedNode.text || selectedNode.label) && (
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-neutral-400 mb-1">
                  <span className="text-[11px] font-medium">Text (文本)</span>
                  <button
                    onClick={() => copyToClipboard(selectedNode.text || selectedNode.label, 'text')}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    {copiedKey === 'text' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'text' ? '已复制' : '复制'}
                  </button>
                </div>
                <div className="text-xs text-white break-all select-text">
                  {selectedNode.text || selectedNode.label}
                </div>
              </div>
            )}

            {/* Content Description */}
            {selectedNode.contentDescription && (
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-neutral-400 mb-1">
                  <span className="text-[11px] font-medium">Content-Description</span>
                  <button
                    onClick={() => copyToClipboard(selectedNode.contentDescription, 'desc')}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    {copiedKey === 'desc' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'desc' ? '已复制' : '复制'}
                  </button>
                </div>
                <div className="text-xs text-white break-all select-text">
                  {selectedNode.contentDescription}
                </div>
              </div>
            )}

            {/* XPath */}
            {selectedNode.xpath && (
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-neutral-400 mb-1">
                  <span className="text-[11px] font-medium flex items-center gap-1">
                    <Code size={12} className="text-purple-400" /> XPath
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedNode.xpath || '', 'xpath')}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    {copiedKey === 'xpath' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'xpath' ? '已复制' : '复制'}
                  </button>
                </div>
                <div className="font-mono text-[11px] text-neutral-300 break-all select-text bg-black/30 p-1.5 rounded">
                  {selectedNode.xpath}
                </div>
              </div>
            )}

            {/* Class & Package */}
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 space-y-2">
              <div>
                <div className="flex items-center justify-between text-neutral-400 mb-0.5">
                  <span className="text-[11px]">Class Name</span>
                  <button
                    onClick={() => copyToClipboard(selectedNode.className, 'class')}
                    className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
                  >
                    {copiedKey === 'class' ? <Check size={11} /> : <Copy size={11} />}
                    {copiedKey === 'class' ? '已复制' : '复制'}
                  </button>
                </div>
                <div className="font-mono text-[11px] text-neutral-200 select-text break-all">
                  {selectedNode.className}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-neutral-400 mb-0.5">Package</div>
                <div className="font-mono text-[11px] text-neutral-300 select-text break-all">
                  {selectedNode.packageName}
                </div>
              </div>
            </div>

            {/* Bounds & Dimensions */}
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-[11px] font-medium flex items-center gap-1">
                  <Crosshair size={12} className="text-green-400" /> Bounds (坐标宽高)
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `[${selectedNode.bounds.left},${selectedNode.bounds.top}][${selectedNode.bounds.right},${selectedNode.bounds.bottom}]`,
                      'bounds'
                    )
                  }
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                >
                  {copiedKey === 'bounds' ? <Check size={12} /> : <Copy size={12} />}
                  {copiedKey === 'bounds' ? '已复制' : '复制'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="bg-black/30 p-1.5 rounded font-mono text-[11px]">
                  <span className="text-neutral-500">坐标: </span>
                  {selectedNode.bounds.left}, {selectedNode.bounds.top}
                </div>
                <div className="bg-black/30 p-1.5 rounded font-mono text-[11px]">
                  <span className="text-neutral-500">宽高: </span>
                  {selectedNode.bounds.width} × {selectedNode.bounds.height}
                </div>
              </div>
            </div>

            {/* Flags & State Badges */}
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <div className="text-[11px] font-medium text-neutral-400 mb-2">交互状态与属性</div>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    selectedNode.clickable
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  clickable: {String(selectedNode.clickable)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    selectedNode.enabled
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  enabled: {String(selectedNode.enabled)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    selectedNode.focusable
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  focusable: {String(selectedNode.focusable)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    selectedNode.focused
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  focused: {String(selectedNode.focused)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    selectedNode.checkable
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  checkable: {String(selectedNode.checkable)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    selectedNode.checked
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  checked: {String(selectedNode.checked)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    selectedNode.scrollable
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  scrollable: {String(selectedNode.scrollable)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    selectedNode.password
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  password: {String(selectedNode.password)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
