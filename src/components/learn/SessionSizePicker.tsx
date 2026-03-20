import { useState } from 'react';
import styles from './SessionSizePicker.module.css';

const SIZE_OPTIONS = [15, 30, 50, 100] as const;

interface SessionSizePickerProps {
  deckName: string;
  dueCount: number;
  totalActive: number;
  onStart: (size: number, reverse: boolean) => void;
  onCancel: () => void;
}

export function SessionSizePicker({
  deckName,
  dueCount,
  totalActive,
  onStart,
  onCancel,
}: SessionSizePickerProps) {
  const defaultSize = SIZE_OPTIONS.find(s => s >= dueCount) ?? SIZE_OPTIONS[0];
  const [selected, setSelected] = useState<number>(dueCount > 0 ? defaultSize : 15);
  const [reverse, setReverse] = useState(false);

  return (
    <div className={styles.picker}>
      <p className={styles.deckName}>{deckName}</p>
      <p className={styles.info}>
        {dueCount > 0 ? (
          <><strong>{dueCount}</strong> card{dueCount !== 1 ? 's' : ''} due now</>
        ) : (
          <>No cards due — practice ahead of schedule</>
        )}
        {' '}&middot; {totalActive} total
      </p>

      <div className={styles.options}>
        {SIZE_OPTIONS.filter(s => s <= totalActive).map(size => (
          <button
            key={size}
            className={`${styles.pill} ${selected === size ? styles.pillActive : ''}`}
            onClick={() => setSelected(size)}
          >
            {size}
          </button>
        ))}
        <button
          className={`${styles.pill} ${selected === totalActive && !SIZE_OPTIONS.includes(totalActive as typeof SIZE_OPTIONS[number]) ? styles.pillActive : ''}`}
          onClick={() => setSelected(totalActive)}
        >
          All ({totalActive})
        </button>
      </div>

      {/* Feature 7: Reverse mode toggle */}
      <label className={styles.reverseToggle}>
        <input
          type="checkbox"
          checked={reverse}
          onChange={e => setReverse(e.target.checked)}
          className={styles.reverseCheckbox}
        />
        <span className={styles.reverseLabel}>Reverse mode (answer → question)</span>
      </label>

      <div className={styles.actions}>
        <button className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button className={styles.startBtn} onClick={() => onStart(selected, reverse)}>
          Start Session
        </button>
      </div>
    </div>
  );
}
