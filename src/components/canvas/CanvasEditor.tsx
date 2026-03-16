import { useState, useRef, useCallback, useEffect } from 'react';
import type { CanvasElement } from '../../types';
import { CanvasRenderer } from './CanvasRenderer';
import styles from './CanvasEditor.module.css';

const MAX_ELEMENTS = 25;

interface CanvasEditorProps {
  elements: CanvasElement[];
  onChange: (elements: CanvasElement[]) => void;
  scale: number;
}

type DragState = {
  type: 'move';
  elementId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
} | {
  type: 'resize';
  elementId: string;
  handle: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
};

export function CanvasEditor({ elements, onChange, scale }: CanvasEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const selected = elements.find(e => e.id === selectedId) ?? null;

  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const toPercent = useCallback((px: number, dimension: number) => {
    return (px / dimension) * 100;
  }, []);

  function handleCanvasClick(e: React.MouseEvent) {
    if (e.target === canvasRef.current) {
      setSelectedId(null);
      setEditingId(null);
    }
  }

  function handleElementPointerDown(e: React.PointerEvent, el: CanvasElement) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(el.id);

    const rect = getCanvasRect();
    if (!rect) return;

    dragRef.current = {
      type: 'move',
      elementId: el.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    const rect = getCanvasRect();
    if (!rect) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (drag.type === 'move') {
      const newX = Math.max(0, Math.min(100, drag.origX + toPercent(dx, rect.width)));
      const newY = Math.max(0, Math.min(100, drag.origY + toPercent(dy, rect.height)));

      onChange(elements.map(el =>
        el.id === drag.elementId ? { ...el, x: newX, y: newY } : el
      ));
    } else if (drag.type === 'resize') {
      const dxPct = toPercent(dx, rect.width);
      const dyPct = toPercent(dy, rect.height);

      let newX = drag.origX;
      let newY = drag.origY;
      let newW = drag.origW;
      let newH = drag.origH;

      const handle = drag.handle;

      if (handle.includes('e')) {
        newW = Math.max(5, drag.origW + dxPct);
      }
      if (handle.includes('w')) {
        const delta = Math.min(dxPct, drag.origW - 5);
        newX = drag.origX + delta;
        newW = drag.origW - delta;
      }
      if (handle.includes('s')) {
        newH = Math.max(5, drag.origH + dyPct);
      }
      if (handle.includes('n')) {
        const delta = Math.min(dyPct, drag.origH - 5);
        newY = drag.origY + delta;
        newH = drag.origH - delta;
      }

      onChange(elements.map(el =>
        el.id === drag.elementId ? { ...el, x: newX, y: newY, width: newW, height: newH } : el
      ));
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleResizePointerDown(e: React.PointerEvent, el: CanvasElement, handle: string) {
    e.stopPropagation();
    e.preventDefault();

    dragRef.current = {
      type: 'resize',
      elementId: el.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      origW: el.width,
      origH: el.height,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleDoubleClick(el: CanvasElement) {
    if (el.type === 'text') {
      setEditingId(el.id);
    }
  }

  function handleTextChange(id: string, content: string) {
    onChange(elements.map(el =>
      el.id === id ? { ...el, content } : el
    ));
  }

  function handleTextBlur() {
    setEditingId(null);
  }

  function handleTextKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setEditingId(null);
    }
  }

  // Keyboard delete
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (selectedId && !editingId && (e.key === 'Delete' || e.key === 'Backspace')) {
        onChange(elements.filter(el => el.id !== selectedId));
        setSelectedId(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingId, elements, onChange]);

  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const handles = ['nw', 'ne', 'sw', 'se'];

  return (
    <div
      ref={canvasRef}
      className={styles.canvas}
      onClick={handleCanvasClick}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <CanvasRenderer elements={elements} scale={scale} />

      {/* Interactive overlays */}
      {sorted.map(el => (
        <div
          key={`overlay-${el.id}`}
          className={`${styles.overlay} ${selectedId === el.id ? styles.selected : ''}`}
          style={{
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.width}%`,
            height: `${el.height}%`,
            zIndex: el.zIndex + 100,
          }}
          onPointerDown={e => handleElementPointerDown(e, el)}
          onDoubleClick={() => handleDoubleClick(el)}
        >
          {editingId === el.id && el.type === 'text' && (
            <textarea
              className={styles.inlineEditor}
              value={el.content}
              onChange={e => handleTextChange(el.id, e.target.value)}
              onBlur={handleTextBlur}
              onKeyDown={handleTextKeyDown}
              autoFocus
              style={{
                fontSize: `${(el.fontSize ?? 18) * scale}px`,
                fontFamily: el.fontFamily ?? 'Inter, sans-serif',
                fontWeight: el.fontWeight ?? 'normal',
                fontStyle: el.fontStyle ?? 'normal',
                textAlign: el.textAlign ?? 'center',
                color: el.color ?? '#e8e8f0',
              }}
            />
          )}

          {selectedId === el.id && !editingId && handles.map(h => (
            <div
              key={h}
              className={`${styles.handle} ${styles[`handle_${h}`]}`}
              onPointerDown={e => handleResizePointerDown(e, el, h)}
            />
          ))}
        </div>
      ))}

      {elements.length === 0 && (
        <div className={styles.emptyHint}>
          Add a text or image element to get started
        </div>
      )}

      {elements.length >= MAX_ELEMENTS && (
        <div className={styles.capWarning}>
          Element limit reached ({MAX_ELEMENTS})
        </div>
      )}
    </div>
  );
}

export { MAX_ELEMENTS };
