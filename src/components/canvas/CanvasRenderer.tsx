import type { CanvasElement } from '../../types';
import styles from './CanvasRenderer.module.css';

interface CanvasRendererProps {
  elements: CanvasElement[];
  scale?: number;
  className?: string;
  editingId?: string | null;
}

export function CanvasRenderer({ elements, scale = 1, className, editingId }: CanvasRendererProps) {
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className={`${styles.renderer} ${className ?? ''}`}>
      {sorted.map(el => (
        <div
          key={el.id}
          className={styles.element}
          style={{
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.width}%`,
            height: `${el.height}%`,
            zIndex: el.zIndex,
          }}
        >
          {el.type === 'text' ? (
            <div
              className={styles.textContent}
              style={{
                fontSize: `${(el.fontSize ?? 18) * scale}px`,
                fontFamily: el.fontFamily ?? 'Inter, sans-serif',
                fontWeight: el.fontWeight ?? 'normal',
                fontStyle: el.fontStyle ?? 'normal',
                textAlign: el.textAlign ?? 'center',
                color: el.color ?? '#e8e8f0',
              }}
            >
              {el.id !== editingId && el.content}
            </div>
          ) : (
            <img
              className={styles.imageContent}
              src={el.content}
              alt=""
              draggable={false}
            />
          )}
        </div>
      ))}
      {/* A11y: hidden semantic layer for screen readers */}
      <div className={styles.a11yLayer} aria-live="polite">
        {sorted.map((el, i) => (
          <span key={el.id} tabIndex={i} className={styles.a11yElement}>
            {el.type === 'text' ? el.content : 'Image'}
          </span>
        ))}
      </div>
    </div>
  );
}
