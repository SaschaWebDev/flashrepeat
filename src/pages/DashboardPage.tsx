import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Deck, UserSettings } from '../types';
import { getAllDecks, createDeck, softDeleteDeck, getSettings, getReviewHistory } from '../db/operations';
import { calculateStreak } from '../utils/streak';
import { DeckCard } from '../components/dashboard/DeckCard';
import { HeatMap } from '../components/dashboard/HeatMap';
import { CreateDeckForm } from '../components/dashboard/CreateDeckForm';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const loadDecks = useCallback(async () => {
    const [result, s, streakData] = await Promise.all([
      getAllDecks(),
      getSettings(),
      calculateStreak(),
    ]);
    setDecks(result);
    setSettings(s);
    setStreak(streakData.currentStreak);

    // Count today's reviews
    const timezone = s.homeTimezone;
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    const allReviews = await getReviewHistory();
    const todayReviews = allReviews.filter(r => {
      const day = new Date(r.reviewedAt).toLocaleDateString('en-CA', { timeZone: timezone });
      return day === todayStr;
    });
    setTodayCount(todayReviews.length);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  async function handleCreate(name: string, description: string, color: string) {
    await createDeck(name, description, color);
    setShowCreate(false);
    loadDecks();
  }

  async function handleDelete(id: string) {
    await softDeleteDeck(id);
    loadDecks();
  }

  function handleStudyAll() {
    const deckIds = decks.map((d) => d.id).join(',');
    navigate(`/learn?decks=${deckIds}&mode=free-roam&size=50`);
  }

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  const dailyGoal = settings?.dailyReviewGoal ?? 20;
  const goalProgress = Math.min(100, (todayCount / dailyGoal) * 100);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Your Decks</h1>
          <p className={styles.subtitle}>
            {decks.length} deck{decks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className={styles.headerActions}>
          {decks.length > 1 && (
            <button className={styles.freeRoamBtn} onClick={handleStudyAll}>
              Free Roam
            </button>
          )}
          <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
            + New Deck
          </button>
        </div>
      </div>

      {/* Stats row: streak + daily goal */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statEmoji}>🔥</span>
          <div>
            <span className={styles.statValue}>{streak}</span>
            <span className={styles.statLabel}>day streak</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.goalWrap}>
            <div className={styles.goalBar}>
              <div
                className={styles.goalFill}
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            <span className={styles.goalText}>
              {todayCount}/{dailyGoal} today
            </span>
          </div>
        </div>
      </div>

      {decks.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No decks yet"
          description="Create your first deck to start learning with spaced repetition."
          action={{ label: '+ Create Deck', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className={styles.grid}>
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <HeatMap />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Deck">
        <CreateDeckForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>
    </div>
  );
}
