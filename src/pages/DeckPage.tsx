import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Card, Deck, DeckStats } from '../types';
import {
  getDeck, getCardsForDeck, getDraftCardsForDeck, getDeckStats,
  createCard, updateCard, updateDeck, softDeleteCard, bulkApproveCards,
} from '../db/operations';
import { SessionSizePicker } from '../components/learn/SessionSizePicker';
import { CardEditor, getTextFromContent } from '../components/card-editor/CardEditor';
import { EditDeckForm } from '../components/dashboard/EditDeckForm';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { YouTubeImporter } from '../components/youtube/YouTubeImporter';
import styles from './DeckPage.module.css';

export function DeckPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [drafts, setDrafts] = useState<Card[]>([]);
  const [stats, setStats] = useState<DeckStats | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [showEditDeck, setShowEditDeck] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [tab, setTab] = useState<'cards' | 'drafts'>('cards');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!deckId) return;
    const [d, c, dr, s] = await Promise.all([
      getDeck(deckId),
      getCardsForDeck(deckId),
      getDraftCardsForDeck(deckId),
      getDeckStats(deckId),
    ]);
    if (!d) {
      navigate('/app', { replace: true });
      return;
    }
    setDeck(d);
    setCards(c);
    setDrafts(dr);
    setStats(s);
    setLoading(false);
  }, [deckId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  function getCardText(card: Card, side: 'front' | 'back'): string {
    const content = side === 'front' ? card.front : card.back;
    return getTextFromContent(content);
  }

  async function handleEditDeck(name: string, description: string, color: string) {
    if (!deckId) return;
    await updateDeck(deckId, { name, description, color });
    setShowEditDeck(false);
    load();
  }

  async function approveDraft(card: Card) {
    await updateCard(card.id, { status: 'active' });
    load();
  }

  async function handleApproveAll() {
    if (drafts.length === 0) return;
    await bulkApproveCards(drafts.map((d) => d.id));
    load();
  }

  if (loading || !deck) {
    return <div className={styles.loading}>Loading...</div>;
  }

  const displayCards = tab === 'cards' ? cards : drafts;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/app')}>
          ← Back
        </button>
        <div className={styles.deckInfo}>
          <div
            className={styles.colorDot}
            style={{ background: deck.color }}
          />
          <div>
            <h1 className={styles.title}>
              {deck.name}
              <button
                className={styles.editDeckBtn}
                onClick={() => setShowEditDeck(true)}
                title="Edit deck"
              >
                Edit
              </button>
            </h1>
            {deck.description && (
              <p className={styles.description}>{deck.description}</p>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          {stats && stats.totalCards > 0 && (
            <button
              className={styles.studyBtn}
              onClick={() => setShowSessionPicker(true)}
            >
              {stats.dueCards > 0 ? `Study (${stats.dueCards} due)` : 'Study'}
            </button>
          )}
          <button className={styles.addBtn} onClick={() => setShowYouTube(true)}>
            YouTube Import
          </button>
          <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
            + Add Card
          </button>
        </div>
      </div>

      {stats && (
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statNum}>{stats.totalCards}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statNum} ${styles.newNum}`}>{stats.newCards}</span>
            <span className={styles.statLabel}>New</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statNum} ${styles.dueNum}`}>{stats.dueCards}</span>
            <span className={styles.statLabel}>Due</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statNum} ${styles.learnedNum}`}>{stats.learnedCards}</span>
            <span className={styles.statLabel}>Learned</span>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${tab === 'cards' ? styles.tabActive : ''}`}
          onClick={() => setTab('cards')}
        >
          Cards ({cards.length})
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'drafts' ? styles.tabActive : ''}`}
          onClick={() => setTab('drafts')}
        >
          Drafts ({drafts.length})
        </button>
        {tab === 'drafts' && drafts.length > 0 && (
          <button className={styles.approveAllBtn} onClick={handleApproveAll}>
            Approve All
          </button>
        )}
      </div>

      {displayCards.length === 0 ? (
        <EmptyState
          icon={tab === 'cards' ? '🃏' : '📝'}
          title={tab === 'cards' ? 'No cards yet' : 'No drafts'}
          description={
            tab === 'cards'
              ? 'Add your first card to start building this deck.'
              : 'Draft cards will appear here for review before being added to the study queue.'
          }
          action={tab === 'cards' ? { label: '+ Add Card', onClick: () => setShowAdd(true) } : undefined}
        />
      ) : (
        <div className={styles.cardList}>
          {displayCards.map((card) => (
            <div key={card.id} className={styles.cardRow}>
              <div
                className={styles.cardContent}
                onClick={() => setEditingCard(card)}
                role="button"
                tabIndex={0}
              >
                <span className={styles.cardFront}>{getCardText(card, 'front')}</span>
                <span className={styles.cardSep}>→</span>
                <span className={styles.cardBack}>{getCardText(card, 'back')}</span>
              </div>
              <div className={styles.cardMeta}>
                {tab === 'cards' && (
                  <>
                    {card.srs.repetitions === 0 ? (
                      <span className={styles.badge + ' ' + styles.newBadge}>New</span>
                    ) : card.srs.nextReviewDate <= Date.now() ? (
                      <span className={styles.badge + ' ' + styles.dueBadge}>Due</span>
                    ) : (
                      <span className={styles.badge + ' ' + styles.learnedBadge}>
                        {Math.ceil((card.srs.nextReviewDate - Date.now()) / 86400000)}d
                      </span>
                    )}
                    {card.flaggedAt && (
                      <span className={styles.badge + ' ' + styles.flagBadge}>Flagged</span>
                    )}
                  </>
                )}
                {tab === 'drafts' && (
                  <button
                    className={styles.approveBtn}
                    onClick={() => approveDraft(card)}
                  >
                    Approve
                  </button>
                )}
                <button
                  className={styles.editCardBtn}
                  onClick={() => setEditingCard(card)}
                  aria-label="Edit card"
                >
                  Edit
                </button>
                <button
                  className={styles.deleteCardBtn}
                  onClick={() => {
                    softDeleteCard(card.id).then(load);
                  }}
                  aria-label="Delete card"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Card">
        <CardEditor
          onSave={async (front, back) => {
            if (!deckId) return;
            await createCard(deckId, front, back);
            setShowAdd(false);
            load();
          }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      <Modal
        open={editingCard !== null}
        onClose={() => setEditingCard(null)}
        title="Edit Card"
      >
        {editingCard && (
          <CardEditor
            initialFront={editingCard.front}
            initialBack={editingCard.back}
            submitLabel="Save"
            onSave={async (front, back) => {
              await updateCard(editingCard.id, { front, back });
              setEditingCard(null);
              load();
            }}
            onCancel={() => setEditingCard(null)}
          />
        )}
      </Modal>

      <Modal
        open={showEditDeck}
        onClose={() => setShowEditDeck(false)}
        title="Edit Deck"
      >
        <EditDeckForm
          deck={deck}
          onSubmit={handleEditDeck}
          onCancel={() => setShowEditDeck(false)}
        />
      </Modal>

      <Modal
        open={showYouTube}
        onClose={() => setShowYouTube(false)}
        title="YouTube Import"
      >
        {deckId && (
          <YouTubeImporter
            deckId={deckId}
            onDone={() => {
              setShowYouTube(false);
              setTab('drafts');
              load();
            }}
          />
        )}
      </Modal>

      <Modal
        open={showSessionPicker}
        onClose={() => setShowSessionPicker(false)}
        title="Study Session"
      >
        {stats && deck && (
          <SessionSizePicker
            deckName={deck.name}
            dueCount={stats.dueCards}
            totalActive={stats.totalCards}
            onStart={(size) => {
              setShowSessionPicker(false);
              navigate(`/learn/${deckId}?size=${size}`);
            }}
            onCancel={() => setShowSessionPicker(false)}
          />
        )}
      </Modal>
    </div>
  );
}
