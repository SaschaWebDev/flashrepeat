import type { CanvasElement } from '../../types';
import styles from './ElementProperties.module.css';

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];

const FONT_FAMILIES = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Playfair', value: "'Playfair Display', serif" },
  { label: 'Fira Code', value: "'Fira Code', monospace" },
  { label: 'Lora', value: "'Lora', serif" },
  { label: 'Poppins', value: "'Poppins', sans-serif" },
  { label: 'Merriweather', value: "'Merriweather', serif" },
  { label: 'Space Mono', value: "'Space Mono', monospace" },
  { label: 'Nunito', value: "'Nunito', sans-serif" },
];

interface ElementPropertiesProps {
  element: CanvasElement;
  onChange: (updated: CanvasElement) => void;
  onDelete: () => void;
}

export function ElementProperties({ element, onChange, onDelete }: ElementPropertiesProps) {
  if (element.type !== 'text') {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.label}>Image</span>
          <button className={styles.deleteBtn} onClick={onDelete}>Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.label}>Text Properties</span>
        <button className={styles.deleteBtn} onClick={onDelete}>Delete</button>
      </div>

      <div className={styles.row}>
        <select
          className={styles.select}
          value={element.fontFamily ?? 'Inter, sans-serif'}
          onChange={e => onChange({ ...element, fontFamily: e.target.value })}
        >
          {FONT_FAMILIES.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.row}>
        <select
          className={styles.select}
          value={element.fontSize ?? 18}
          onChange={e => onChange({ ...element, fontSize: Number(e.target.value) })}
        >
          {FONT_SIZES.map(s => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>

        <button
          className={`${styles.toggleBtn} ${element.fontWeight === 'bold' ? styles.active : ''}`}
          onClick={() => onChange({ ...element, fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}
          title="Bold"
        >
          B
        </button>
        <button
          className={`${styles.toggleBtn} ${element.fontStyle === 'italic' ? styles.active : ''}`}
          onClick={() => onChange({ ...element, fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })}
          title="Italic"
        >
          <em>I</em>
        </button>
      </div>

      <div className={styles.row}>
        <button
          className={`${styles.alignBtn} ${(element.textAlign ?? 'center') === 'left' ? styles.active : ''}`}
          onClick={() => onChange({ ...element, textAlign: 'left' })}
          title="Align Left"
        >
          Left
        </button>
        <button
          className={`${styles.alignBtn} ${(element.textAlign ?? 'center') === 'center' ? styles.active : ''}`}
          onClick={() => onChange({ ...element, textAlign: 'center' })}
          title="Center"
        >
          Center
        </button>
        <button
          className={`${styles.alignBtn} ${(element.textAlign ?? 'center') === 'right' ? styles.active : ''}`}
          onClick={() => onChange({ ...element, textAlign: 'right' })}
          title="Align Right"
        >
          Right
        </button>
      </div>

      <div className={styles.row}>
        <label className={styles.colorLabel}>Color</label>
        <input
          type="color"
          className={styles.colorInput}
          value={element.color ?? '#e8e8f0'}
          onChange={e => onChange({ ...element, color: e.target.value })}
        />
      </div>
    </div>
  );
}

export { FONT_FAMILIES };
