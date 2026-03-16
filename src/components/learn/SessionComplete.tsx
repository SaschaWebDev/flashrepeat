import { useNavigate } from 'react-router-dom';
import type { Rating } from '../../types';
import { RATINGS } from '../../types';
import styles from './SessionComplete.module.css';

interface SessionCompleteProps {
  reviewed: number;
  deckId?: string;
  ratings?: Rating[];
  deckIds?: string[];
  mode?: string;
  lastSessionSize?: number;
}

export function SessionComplete({ reviewed, deckId, ratings = [], deckIds, mode, lastSessionSize }: SessionCompleteProps) {
  const navigate = useNavigate();

  // Calculate accuracy (Good/Easy/Perfect = correct)
  const correct = ratings.filter(r => r >= 3).length;
  const accuracy = ratings.length > 0 ? Math.round((correct / ratings.length) * 100) : 0;

  // Rating breakdown
  const breakdown = RATINGS.map(r => ({
    ...r,
    count: ratings.filter(rating => rating === r.value).length,
  }));

  return (
    <div className={styles.container}>
      <div className={styles.icon}>🎉</div>
      <h2 className={styles.title}>Session Complete</h2>
      <p className={styles.subtitle}>
        You reviewed <strong>{reviewed}</strong> card{reviewed !== 1 ? 's' : ''}
        {ratings.length > 0 && (
          <> with <strong>{accuracy}%</strong> accuracy</>
        )}
      </p>

      {ratings.length > 0 && (
        <div className={styles.breakdown}>
          {breakdown.filter(b => b.count > 0).map(b => (
            <span key={b.value} className={styles.breakdownItem}>
              <span className={styles.breakdownDot} style={{ background: b.color }} />
              {b.label}: {b.count}
            </span>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.primaryBtn}
          onClick={() => {
            const t = Date.now();
            const size = lastSessionSize ?? 50;
            if (deckId) {
              const params = new URLSearchParams({ size: String(size), t: String(t) });
              if (mode && mode !== 'normal') params.set('mode', mode);
              navigate(`/learn/${deckId}?${params.toString()}`);
            } else if (deckIds && deckIds.length > 0) {
              const params = new URLSearchParams({
                decks: deckIds.join(','),
                size: String(size),
                t: String(t),
              });
              if (mode) params.set('mode', mode);
              navigate(`/learn?${params.toString()}`);
            }
          }}
        >
          Study Again
        </button>
        {deckId && (
          <button className={styles.secondaryBtn} onClick={() => navigate(`/deck/${deckId}`)}>
            Back to Deck
          </button>
        )}
        <button className={styles.secondaryBtn} onClick={() => navigate('/app')}>
          Dashboard
        </button>
      </div>
    </div>
  );
}
