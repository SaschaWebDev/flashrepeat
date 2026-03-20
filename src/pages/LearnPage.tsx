import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import type { Card, Rating } from '../types';
import { getStudyCards, updateCardSRS, flagCard, unflagCard, recordReview, getCardsForDeck, checkAndFlagLeech, getSettings } from '../db/operations';
import { calculateNextReview, shuffleCards, prioritizeByRetrievability } from '../srs/engine';
import { updateStreakAfterSession } from '../utils/streak';
import { StudyCard } from '../components/learn/StudyCard';
import { SessionComplete } from '../components/learn/SessionComplete';
import styles from './LearnPage.module.css';

const MAX_REINSERTS_PER_CARD = 3;
const REINSERT_DISTANCE: Record<1 | 2, [number, number]> = {
  1: [3, 5],
  2: [8, 12],
};

function getReinsertDistance(rating: Rating): number | null {
  if (rating !== 1 && rating !== 2) return null;
  const [min, max] = REINSERT_DISTANCE[rating];
  return min + Math.floor(Math.random() * (max - min + 1));
}

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
  const [leechToast, setLeechToast] = useState<string | null>(null);

  const mode = searchParams.get('mode') ?? 'normal';
  const isCram = mode === 'cram';
  const reverseParam = searchParams.get('reverse') === '1';
  const deckIdsParam = searchParams.get('decks');
  const sizeParam = searchParams.get('size');
  const sessionSize = sizeParam ? parseInt(sizeParam, 10) : 50;
  const tParam = searchParams.get('t');

  const reinsertCountRef = useRef<Map<string, number>>(new Map());
  const revealedRef = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const leechThresholdRef = useRef(4);

  // Track revealed state for keyboard handler
  useEffect(() => {
    revealedRef.current = revealed;
  }, [revealed]);

  // Load leech threshold
  useEffect(() => {
    getSettings().then(s => {
      leechThresholdRef.current = s.leechThreshold ?? 4;
    });
  }, []);

  const loadCards = useCallback(async () => {
    setDone(false);
    setCurrentIndex(0);
    setReviewed(0);
    setRatings([]);
    setRevealed(false);
    setLoading(true);
    reinsertCountRef.current.clear();

    let ids: string[];
    if (deckId) {
      ids = [deckId];
    } else if (deckIdsParam) {
      ids = deckIdsParam.split(',');
    } else {
      navigate('/app', { replace: true });
      return;
    }

    if (isCram) {
      // Cram mode: load all active cards, shuffle, no SRS filtering
      const allCards: Card[] = [];
      for (const id of ids) {
        const deckCards = await getCardsForDeck(id);
        allCards.push(...deckCards);
      }

      if (allCards.length === 0) {
        setDone(true);
        setLoading(false);
        return;
      }

      setQueue(shuffleCards(allCards).slice(0, sessionSize));
      setLoading(false);
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
  }, [deckId, deckIdsParam, mode, isCram, sessionSize, tParam, navigate]);

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
        if (isCram) {
          // In cram mode, any key advances
          if (e.key === ' ' || e.key === 'Enter' || (Number(e.key) >= 1 && Number(e.key) <= 5)) {
            e.preventDefault();
            handleCramNext();
          }
        } else {
          const num = Number(e.key);
          if (num >= 1 && num <= 5) {
            e.preventDefault();
            handleRate(num as Rating);
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queue, currentIndex, isCram]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCramNext() {
    setReviewed((r) => r + 1);
    setRevealed(false);
    if (currentIndex + 1 >= queue.length) {
      setDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  async function handleRate(rating: Rating) {
    const card = queue[currentIndex];
    if (!card) return;

    const newSRS = calculateNextReview(card.srs, rating);
    await updateCardSRS(card.id, newSRS);

    // Record review history
    await recordReview(card.id, card.deckId, rating, newSRS.easeFactor, newSRS.interval);

    // Feature 5: Leech detection
    if (rating === 1) {
      const isLeech = await checkAndFlagLeech(card.id, card.deckId, leechThresholdRef.current);
      if (isLeech) {
        setLeechToast('Leech detected! Card has been flagged for review.');
        setTimeout(() => setLeechToast(null), 3000);
      }
    }

    setRatings(prev => [...prev, rating]);
    setReviewed((r) => r + 1);
    setRevealed(false);

    // Show celebration for Perfect rating
    if (rating === 5) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1500);
    }

    // Re-insertion logic for low ratings
    const distance = getReinsertDistance(rating);
    const count = reinsertCountRef.current.get(card.id) ?? 0;
    const willReinsert = distance !== null && count < MAX_REINSERTS_PER_CARD;

    if (willReinsert) {
      reinsertCountRef.current.set(card.id, count + 1);
      const insertAt = Math.min(currentIndex + 1 + distance, queue.length);
      const updatedCard: Card = { ...card, srs: newSRS };
      setQueue(q => {
        const newQ = [...q];
        newQ.splice(insertAt, 0, updatedCard);
        return newQ;
      });
    }

    const newQueueLength = queue.length + (willReinsert ? 1 : 0);

    if (currentIndex + 1 >= newQueueLength) {
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
        ratings={isCram ? [] : ratings}
        deckIds={deckIdsParam ? deckIdsParam.split(',') : deckId ? [deckId] : undefined}
        mode={mode}
        lastSessionSize={sessionSize}
        isCram={isCram}
      />
    );
  }

  const current = queue[currentIndex];
  if (!current) {
    return (
      <SessionComplete
        reviewed={reviewed}
        deckId={deckId}
        ratings={isCram ? [] : ratings}
        deckIds={deckIdsParam ? deckIdsParam.split(',') : deckId ? [deckId] : undefined}
        mode={mode}
        lastSessionSize={sessionSize}
        isCram={isCram}
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
          {isCram && (
            <span className={styles.cramBadge}>Cram</span>
          )}
          {mode === 'free-roam' && (
            <span className={styles.modeBadge}>Free Roam</span>
          )}
          {reverseParam && (
            <span className={styles.modeBadge}>Reverse</span>
          )}
          <span className={styles.shortcutHint}>
            {isCram ? 'Space to reveal, any key to continue' : 'Space to reveal, 1-5 to rate'}
          </span>
        </div>
      </div>

      {leechToast && (
        <div className={styles.leechToast}>{leechToast}</div>
      )}

      <StudyCard
        key={currentIndex}
        card={current}
        onRate={isCram ? undefined : handleRate}
        onCramNext={isCram ? handleCramNext : undefined}
        onFlag={isCram ? undefined : handleFlag}
        isFlagged={current.flaggedAt !== null}
        progress={{ current: currentIndex + 1, total: queue.length }}
        showCelebration={showCelebration}
        reverse={reverseParam}
        isCram={isCram}
      />
    </div>
  );
}
