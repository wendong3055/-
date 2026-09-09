'use client';

import { Children, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export function ResizableWorkspace({ children, hidden }: { children: ReactNode; hidden: boolean }) {
  const [width, setWidth] = useState(440);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const parts = Children.toArray(children);
  useEffect(() => {
    try { const saved = Number(localStorage.getItem('studio-controls-width')); if (saved >= 340 && saved <= 760) setWidth(saved); } catch { /* View preferences are optional. */ }
  }, []);
  function resize(next: number) {
    const available = root.current?.clientWidth || 1100;
    const value = Math.max(340, Math.min(760, available - 400, next));
    setWidth(value);
    try { localStorage.setItem('studio-controls-width', String(value)); } catch { /* Keep working without storage. */ }
  }
  return <div ref={root} className={`content-grid resizable-workspace ${hidden ? 'view-hidden' : ''}`} style={{ '--controls-width': `${width}px` } as CSSProperties}>
    {parts[0]}
    <div role="separator" tabIndex={0} aria-label="调整选项区与预览区宽度，左右方向键微调" aria-orientation="vertical" aria-valuenow={width} aria-valuemin={340} aria-valuemax={760} className="workspace-resizer" title="左右拖动调整宽度 · 双击恢复"
      onDoubleClick={() => resize(440)}
      onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); resize(width + (event.key === 'ArrowLeft' ? -20 : 20)); } if (event.key === 'Home') resize(440); }}
      onPointerDown={(event) => { if (event.button !== 0) return; drag.current = { x: event.clientX, width }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => { if (drag.current) resize(drag.current.width + event.clientX - drag.current.x); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}><span /></div>
    {parts[1]}
  </div>;
}
