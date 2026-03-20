import { useState, useRef, useEffect } from 'react';
import styles from './ImportMenu.module.css';

export type ImportType = 'youtube' | 'csv' | 'anki';

interface ImportMenuProps {
  onSelect: (type: ImportType) => void;
}

export function ImportMenu({ onSelect }: ImportMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function handleSelect(type: ImportType) {
    setOpen(false);
    onSelect(type);
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button className={styles.trigger} onClick={() => setOpen((prev) => !prev)}>
        Import <span className={styles.arrow}>▼</span>
      </button>
      {open && (
        <div className={styles.dropdown}>
          <button className={styles.option} onClick={() => handleSelect('youtube')}>
            From YouTube
          </button>
          <button className={styles.option} onClick={() => handleSelect('csv')}>
            CSV File
          </button>
          <button className={styles.option} onClick={() => handleSelect('anki')}>
            Anki Deck (.apkg)
          </button>
        </div>
      )}
    </div>
  );
}
