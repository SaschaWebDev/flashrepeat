import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Deck, DeckStats } from '../../types';
import { getDeckStats } from '../../db/operations';
import styles from './DeckCard.module.css';

interface DeckCardProps {
  deck: Deck;
  onDelete: (id: string) => void;
}

export function DeckCard({ deck, onDelete }: DeckCardProps) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DeckStats | null>(null);

  useEffect(() => {
    getDeckStats(deck.id).then(setStats);
  }, [deck.id]);

  return (
    <div
      className={styles.card}
      style={{ '--deck-color': deck.color } as React.CSSProperties}
      onClick={() => navigate(`/deck/${deck.id}`)}
    >
      <div className={styles.colorBar} />
      <div className={styles.content}>
        <h3 className={styles.name}>{deck.name}</h3>
        {deck.description && (
          <p className={styles.description}>{deck.description}</p>
        )}
        {stats && (
          <div className={styles.stats}>
            <span className={styles.stat}>
              <span className={styles.statValue}>{stats.totalCards}</span>
              <span className={styles.statLabel}>cards</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statValue + ' ' + styles.due}>{stats.dueCards}</span>
              <span className={styles.statLabel}>due</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statValue + ' ' + styles.learned}>{stats.learnedCards}</span>
              <span className={styles.statLabel}>learned</span>
            </span>
          </div>
        )}
      </div>
      <div className={styles.actions}>
        {stats && stats.totalCards > 0 && (
          <button
            className={styles.studyBtn}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/deck/${deck.id}`);
            }}
          >
            {stats.dueCards > 0 ? `Study (${stats.dueCards})` : 'Study'}
          </button>
        )}
        <button
          className={styles.deleteBtn}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(deck.id);
          }}
          aria-label="Delete deck"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
