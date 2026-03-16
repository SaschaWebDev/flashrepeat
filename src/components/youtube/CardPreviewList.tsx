import { useState } from 'react';
import styles from './CardPreviewList.module.css';

interface CardPair {
  front: string;
  back: string;
}

interface CardPreviewListProps {
  cards: CardPair[];
  selected: Set<number>;
  onToggle: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function CardPreviewList({
  cards,
  selected,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: CardPreviewListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div>
      <div className={styles.selectBar}>
        <span>{selected.size} of {cards.length} selected</span>
        <div className={styles.selectActions}>
          <button className={styles.selectBtn} onClick={onSelectAll}>
            Select all
          </button>
          <button className={styles.selectBtn} onClick={onDeselectAll}>
            Deselect all
          </button>
        </div>
      </div>
      <div className={styles.list}>
        {cards.map((card, i) => {
          const isSelected = selected.has(i);
          const isExpanded = expandedIndex === i;
          return (
            <div
              key={i}
              className={`${styles.cardItem} ${!isSelected ? styles.cardItemDeselected : ''}`}
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
            >
              <div
                className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(i);
                }}
                role="checkbox"
                aria-checked={isSelected}
              >
                {isSelected ? '✓' : ''}
              </div>
              <div className={styles.cardText}>
                <div className={styles.front}>{card.front}</div>
                <div className={`${styles.back} ${!isExpanded ? styles.backCollapsed : ''}`}>
                  {card.back}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
