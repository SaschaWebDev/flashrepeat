import type { CanvasElement } from '../../types';
import styles from './LayersPanel.module.css';

interface LayersPanelProps {
  elements: CanvasElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (elements: CanvasElement[]) => void;
}

export function LayersPanel({ elements, selectedId, onSelect, onChange }: LayersPanelProps) {
  const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex); // highest first

  function moveUp(id: string) {
    const idx = sorted.findIndex(e => e.id === id);
    if (idx <= 0) return;
    // Swap zIndex with element above
    const above = sorted[idx - 1];
    const current = sorted[idx];
    onChange(elements.map(el => {
      if (el.id === current.id) return { ...el, zIndex: above.zIndex };
      if (el.id === above.id) return { ...el, zIndex: current.zIndex };
      return el;
    }));
  }

  function moveDown(id: string) {
    const idx = sorted.findIndex(e => e.id === id);
    if (idx >= sorted.length - 1) return;
    const below = sorted[idx + 1];
    const current = sorted[idx];
    onChange(elements.map(el => {
      if (el.id === current.id) return { ...el, zIndex: below.zIndex };
      if (el.id === below.id) return { ...el, zIndex: current.zIndex };
      return el;
    }));
  }

  function deleteElement(id: string) {
    onChange(elements.filter(el => el.id !== id));
  }

  if (elements.length === 0) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Layers</div>
      <div className={styles.list}>
        {sorted.map((el, idx) => (
          <div
            key={el.id}
            className={`${styles.layer} ${selectedId === el.id ? styles.selected : ''}`}
            onClick={() => onSelect(el.id)}
          >
            <span className={styles.layerType}>
              {el.type === 'text' ? 'T' : 'IMG'}
            </span>
            <span className={styles.layerName}>
              {el.type === 'text'
                ? (el.content.slice(0, 20) || 'Empty text')
                : 'Image'}
            </span>
            <div className={styles.layerActions}>
              <button
                className={styles.layerBtn}
                onClick={e => { e.stopPropagation(); moveUp(el.id); }}
                disabled={idx === 0}
                title="Move up"
              >
                ^
              </button>
              <button
                className={styles.layerBtn}
                onClick={e => { e.stopPropagation(); moveDown(el.id); }}
                disabled={idx === sorted.length - 1}
                title="Move down"
              >
                v
              </button>
              <button
                className={styles.layerDeleteBtn}
                onClick={e => { e.stopPropagation(); deleteElement(el.id); }}
                title="Delete"
              >
                x
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
