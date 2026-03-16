import { useState } from 'react';
import type { Card, Rating } from '../../types';
import { RATINGS } from '../../types';
import { CanvasRenderer } from '../canvas/CanvasRenderer';
import styles from './StudyCard.module.css';

interface StudyCardProps {
  card: Card;
  onRate: (rating: Rating) => void;
  onFlag?: () => void;
  isFlagged?: boolean;
  progress: { current: number; total: number };
  showCelebration?: boolean;
}

export function StudyCard({ card, onRate, onFlag, isFlagged, progress, showCelebration }: StudyCardProps) {
  const [revealed, setRevealed] = useState(false);

  function handleRate(rating: Rating) {
    setRevealed(false);
    onRate(rating);
  }

  return (
    <div className={styles.container}>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${(progress.current / progress.total) * 100}%` }}
        />
      </div>

      <div className={styles.topRow}>
        <p className={styles.counter}>
          {progress.current} / {progress.total}
        </p>
        {onFlag && (
          <button
            className={`${styles.flagBtn} ${isFlagged ? styles.flagActive : ''}`}
            onClick={onFlag}
            title={isFlagged ? 'Unflag this card' : 'Flag this card'}
          >
            {isFlagged ? 'Flagged' : 'Flag'}
          </button>
        )}
      </div>

      <div
        className={`${styles.card} ${revealed ? styles.revealed : ''}`}
        onClick={() => { if (!revealed) setRevealed(true); }}
      >
        <div className={styles.cardInner}>
          <div className={styles.cardFront}>
            <div className={styles.canvasWrap}>
              <CanvasRenderer elements={card.front.elements} />
            </div>
            <p className={styles.tapHint}>Tap to reveal</p>
          </div>
          <div className={styles.cardBack}>
            <p className={styles.sideLabel}>Answer</p>
            <div className={styles.canvasWrap}>
              <CanvasRenderer elements={card.back.elements} />
            </div>
          </div>
        </div>
      </div>

      {showCelebration && (
        <div className={styles.celebration}>
          <span className={styles.sparkle}>Excellent!</span>
        </div>
      )}

      {revealed && (
        <div className={styles.ratingBar}>
          <p className={styles.ratingPrompt}>How well did you know this?</p>
          <div className={styles.ratingButtons}>
            {RATINGS.map((r) => (
              <button
                key={r.value}
                className={styles.ratingBtn}
                style={{ '--btn-color': r.color } as React.CSSProperties}
                onClick={() => handleRate(r.value)}
              >
                <span className={styles.ratingLabel}>{r.label}</span>
                <span className={styles.ratingSub}>{r.sublabel}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
