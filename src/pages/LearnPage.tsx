import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import type { Card, Rating } from '../types';
import { getStudyCards, updateCardSRS, flagCard, unflagCard, recordReview } from '../db/operations';
import { calculateNextReview, shuffleCards, prioritizeByRetrievability } from '../srs/engine';
import { updateStreakAfterSession } from '../utils/streak';
import { StudyCard } from '../components/learn/StudyCard';
import { SessionComplete } from '../components/learn/SessionComplete';
import styles from './LearnPage.module.css';

export function LearnPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);

  const mode = searchParams.get('mode') ?? 'normal';
  const deckIdsParam = searchParams.get('decks');
  const sizeParam = searchParams.get('size');
  const sessionSize = sizeParam ? parseInt(sizeParam, 10) : 50;
  const tParam = searchParams.get('t');

  const revealedRef = useRef(false);
  const [revealed, setRevealed] = useState(false);

  // Track revealed state for keyboard handler
  useEffect(() => {
    revealedRef.current = revealed;
  }, [revealed]);

  const loadCards = useCallback(async () => {
    setDone(false);
    setCurrentIndex(0);
    setReviewed(0);
    setRatings([]);
    setRevealed(false);
    setLoading(true);

    let ids: string[];
    if (deckId) {
      ids = [deckId];
    } else if (deckIdsParam) {
      ids = deckIdsParam.split(',');
    } else {
      navigate('/app', { replace: true });
      return;
    }

    const { cards, dueCount } = await getStudyCards(ids, sessionSize);

    if (cards.length === 0) {
      setDone(true);
      setLoading(false);
      return;
    }

    const dueCards = cards.slice(0, dueCount);
    const nonDueCards = cards.slice(dueCount);

    let ordered: Card[];
    if (mode === 'free-roam') {
      ordered = shuffleCards(cards);
    } else {
      ordered = [...prioritizeByRetrievability(dueCards), ...shuffleCards(nonDueCards)];
    }

    setQueue(ordered);
    setLoading(false);
  }, [deckId, deckIdsParam, mode, sessionSize, tParam, navigate]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (!revealedRef.current) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setRevealed(true);
        }
      } else {
        const num = Number(e.key);
        if (num >= 1 && num <= 5) {
          e.preventDefault();
          handleRate(num as Rating);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queue, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRate(rating: Rating) {
    const card = queue[currentIndex];
    if (!card) return;

    const newSRS = calculateNextReview(card.srs, rating);
    await updateCardSRS(card.id, newSRS);

    // Record review history
    await recordReview(card.id, card.deckId, rating, newSRS.easeFactor, newSRS.interval);

    setRatings(prev => [...prev, rating]);
    setReviewed((r) => r + 1);
    setRevealed(false);

    // Show celebration for Perfect rating
    if (rating === 5) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1500);
    }

    if (currentIndex + 1 >= queue.length) {
      await updateStreakAfterSession();
      setDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  async function handleFlag() {
    const card = queue[currentIndex];
    if (!card) return;
    if (card.flaggedAt) {
      await unflagCard(card.id);
      setQueue(q => q.map(c => c.id === card.id ? { ...c, flaggedAt: null } : c));
    } else {
      await flagCard(card.id);
      setQueue(q => q.map(c => c.id === card.id ? { ...c, flaggedAt: Date.now() } : c));
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading cards...</div>;
  }

  if (done) {
    return (
      <SessionComplete
        reviewed={reviewed}
        deckId={deckId}
        ratings={ratings}
        deckIds={deckIdsParam ? deckIdsParam.split(',') : deckId ? [deckId] : undefined}
        mode={mode}
        lastSessionSize={sessionSize}
      />
    );
  }

  const current = queue[currentIndex];
  if (!current) {
    return (
      <SessionComplete
        reviewed={reviewed}
        deckId={deckId}
        ratings={ratings}
        deckIds={deckIdsParam ? deckIdsParam.split(',') : deckId ? [deckId] : undefined}
        mode={mode}
        lastSessionSize={sessionSize}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.exitBtn} onClick={() => navigate(-1)}>
          ✕ Exit
        </button>
        <div className={styles.badges}>
          {mode === 'free-roam' && (
            <span className={styles.modeBadge}>Free Roam</span>
          )}
          <span className={styles.shortcutHint}>Space to reveal, 1-5 to rate</span>
        </div>
      </div>
      <StudyCard
        key={current.id}
        card={current}
        onRate={handleRate}
        onFlag={handleFlag}
        isFlagged={current.flaggedAt !== null}
        progress={{ current: currentIndex + 1, total: queue.length }}
        showCelebration={showCelebration}
      />
    </div>
  );
}
