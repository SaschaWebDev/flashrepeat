import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Card, Deck, DeckStats, CanvasElement, Rating } from '../types';
import { RATINGS } from '../types';
import {
  getDeck, getCardsForDeck, getDraftCardsForDeck, getDeckStats,
  createCard, updateCard, updateDeck, softDeleteCard, bulkApproveCards,
  duplicateCard, bulkDeleteCards, bulkMoveCards, bulkFlagCards,
  getAllDecks, getLeechCards, getBestRatingsForDeck,
  bulkUpdateCardOrder, moveCardToDeck, flagCard, unflagCard,
} from '../db/operations';
import { exportDeck, downloadJson } from '../utils/export';
import { SessionSizePicker } from '../components/learn/SessionSizePicker';
import { CardEditor } from '../components/card-editor/CardEditor';
import { EditDeckForm } from '../components/dashboard/EditDeckForm';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { YouTubeImporter } from '../components/youtube/YouTubeImporter';
import { CsvImporter } from '../components/csv-import/CsvImporter';
import { AnkiImporter } from '../components/anki-import/AnkiImporter';
import { ImportMenu, type ImportType } from '../components/import-menu/ImportMenu';
import { ContextMenu, type ContextMenuItem } from '../components/common/ContextMenu';
import { CanvasRenderer } from '../components/canvas/CanvasRenderer';
import styles from './DeckPage.module.css';

type SortOption = 'created' | 'due' | 'difficulty' | 'alpha' | 'manual';
type FilterStatus = 'all' | 'new' | 'due' | 'learned' | 'flagged';

function getTextFromCard(card: Card): string {
  const frontText = card.front.elements
    .filter(el => el.type === 'text')
    .map(el => el.content)
    .join(' ');
  const backText = card.back.elements
    .filter(el => el.type === 'text')
    .map(el => el.content)
    .join(' ');
  return `${frontText} ${backText}`.toLowerCase();
}

function MiniCardPreview({ elements }: { elements: CanvasElement[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScale(entry.contentRect.width / 360);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={styles.miniCard}>
      <div className={styles.miniCardCanvas}>
        <CanvasRenderer elements={elements} scale={scale} />
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function getDifficultyLabel(easeFactor: number): { label: string; color: string } {
  if (easeFactor >= 2.5) return { label: 'Easy', color: 'var(--success)' };
  if (easeFactor >= 2.0) return { label: 'Medium', color: 'var(--warning)' };
  if (easeFactor >= 1.6) return { label: 'Hard', color: '#f97316' };
  return { label: 'Very Hard', color: 'var(--danger)' };
}

function getRatingDisplay(rating: Rating): { sublabel: string; color: string } {
  const found = RATINGS.find(r => r.value === rating);
  return found
    ? { sublabel: found.sublabel, color: found.color }
    : { sublabel: '—', color: 'var(--text-tertiary)' };
}

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
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showAnkiImport, setShowAnkiImport] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [tab, setTab] = useState<'cards' | 'drafts'>('cards');
  const [loading, setLoading] = useState(true);

  // Feature 2: Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Feature 9: Sort
  const [sortBy, setSortBy] = useState<SortOption>('created');

  // Feature 5: Leech Detection
  const [leechCardIds, setLeechCardIds] = useState<Set<string>>(new Set());

  // Card metadata: best ratings
  const [bestRatings, setBestRatings] = useState<Map<string, Rating>>(new Map());

  // Drag and drop
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Feature 8: Bulk Operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveTo, setShowMoveTo] = useState(false);
  const [allDecks, setAllDecks] = useState<Deck[]>([]);

  const load = useCallback(async () => {
    if (!deckId) return;
    const [d, c, dr, s, decks] = await Promise.all([
      getDeck(deckId),
      getCardsForDeck(deckId),
      getDraftCardsForDeck(deckId),
      getDeckStats(deckId),
      getAllDecks(),
    ]);
    if (!d) {
      navigate('/app', { replace: true });
      return;
    }
    setDeck(d);
    setCards(c);
    setDrafts(dr);
    setStats(s);
    setAllDecks(decks.filter(dk => dk.id !== deckId));
    setLoading(false);

    // Load leech info + best ratings
    getLeechCards(deckId).then(setLeechCardIds);
    getBestRatingsForDeck(deckId).then(setBestRatings);
  }, [deckId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

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

  // Feature 1: Export
  async function handleExportDeck() {
    if (!deckId || !deck) return;
    const data = await exportDeck(deckId);
    if (data) {
      const safeName = deck.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      downloadJson(data, `flashrepeat-${safeName}.json`);
    }
  }

  // Feature 6: Duplicate
  async function handleDuplicate(cardId: string) {
    await duplicateCard(cardId);
    load();
  }

  // Feature 8: Bulk operations
  function toggleSelect(cardId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(displayCards.map(c => c.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    await bulkDeleteCards([...selectedIds]);
    setSelectedIds(new Set());
    load();
  }

  async function handleBulkFlag(flag: boolean) {
    if (selectedIds.size === 0) return;
    await bulkFlagCards([...selectedIds], flag);
    setSelectedIds(new Set());
    load();
  }

  async function handleBulkMove(targetDeckId: string) {
    if (selectedIds.size === 0) return;
    await bulkMoveCards([...selectedIds], targetDeckId);
    setSelectedIds(new Set());
    setShowMoveTo(false);
    load();
  }

  async function openMoveDialog() {
    const decks = await getAllDecks();
    setAllDecks(decks.filter(d => d.id !== deckId));
    setShowMoveTo(true);
  }

  // Drag and drop handlers
  function handleDragStart(e: React.DragEvent, cardId: string) {
    setDraggedId(cardId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }

  function handleDragLeave() {
    setDragOverIndex(null);
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    if (!draggedId) return;

    const dragIndex = displayCards.findIndex(c => c.id === draggedId);
    if (dragIndex === -1 || dragIndex === dropIndex) {
      setDraggedId(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...displayCards];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    const updates = reordered.map((c, i) => ({ id: c.id, sortOrder: i }));

    // Optimistic update
    const updatedCards = cards.map(c => {
      const u = updates.find(u => u.id === c.id);
      return u ? { ...c, sortOrder: u.sortOrder } : c;
    });
    setCards(updatedCards);
    setSortBy('manual');
    bulkUpdateCardOrder(updates);

    setDraggedId(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverIndex(null);
  }

  // Context menu items builder
  function buildContextMenuItems(card: Card): ContextMenuItem[] {
    const items: ContextMenuItem[] = [
      {
        label: 'Edit',
        onClick: () => setEditingCard(card),
      },
      {
        label: 'Duplicate',
        onClick: () => handleDuplicate(card.id),
      },
      {
        label: card.flaggedAt ? 'Unflag' : 'Flag',
        onClick: async () => {
          if (card.flaggedAt) {
            await unflagCard(card.id);
          } else {
            await flagCard(card.id);
          }
          load();
        },
      },
      {
        label: 'Move to',
        submenu: allDecks.map(d => ({
          label: d.name,
          icon: d.color,
          onClick: async () => {
            await moveCardToDeck(card.id, d.id);
            load();
          },
        })),
      },
      {
        label: 'Delete',
        danger: true,
        onClick: () => {
          softDeleteCard(card.id).then(load);
        },
      },
    ];
    return items;
  }

  // Feature 2+9: Filtered & sorted display cards
  const displayCards = useMemo(() => {
    const now = Date.now();
    let result = tab === 'cards' ? cards : drafts;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => getTextFromCard(c).includes(q));
    }

    // Status filter
    if (tab === 'cards' && filterStatus !== 'all') {
      result = result.filter(c => {
        switch (filterStatus) {
          case 'new': return c.srs.repetitions === 0;
          case 'due': return c.srs.nextReviewDate <= now && c.srs.repetitions > 0;
          case 'learned': return c.srs.nextReviewDate > now && c.srs.repetitions > 0;
          case 'flagged': return c.flaggedAt !== null;
          default: return true;
        }
      });
    }

    // Sort
    const sorted = [...result];
    switch (sortBy) {
      case 'created':
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'due':
        sorted.sort((a, b) => a.srs.nextReviewDate - b.srs.nextReviewDate);
        break;
      case 'difficulty':
        sorted.sort((a, b) => a.srs.easeFactor - b.srs.easeFactor);
        break;
      case 'alpha': {
        sorted.sort((a, b) => {
          const aText = getTextFromCard(a);
          const bText = getTextFromCard(b);
          return aText.localeCompare(bText);
        });
        break;
      }
      case 'manual':
        sorted.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        break;
    }

    return sorted;
  }, [tab, cards, drafts, searchQuery, filterStatus, sortBy]);

  if (loading || !deck) {
    return <div className={styles.loading}>Loading...</div>;
  }

  const hasSelection = selectedIds.size > 0;

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
            <>
              <button
                className={styles.studyBtn}
                onClick={() => setShowSessionPicker(true)}
              >
                {stats.dueCards > 0 ? `Study (${stats.dueCards} due)` : 'Study'}
              </button>
              <button
                className={styles.cramBtn}
                onClick={() => navigate(`/learn/${deckId}?mode=cram&size=${stats.totalCards}`)}
              >
                Cram
              </button>
            </>
          )}
          <button className={styles.exportBtn} onClick={handleExportDeck} title="Export deck">
            Export
          </button>
          <ImportMenu onSelect={(type: ImportType) => {
            if (type === 'youtube') setShowYouTube(true);
            else if (type === 'csv') setShowCsvImport(true);
            else if (type === 'anki') setShowAnkiImport(true);
          }} />
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

      {/* Feature 2: Search & Filter + Feature 9: Sort */}
      {(tab === 'cards' ? cards.length : drafts.length) > 0 && (
        <div className={styles.toolbar}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search cards..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {tab === 'cards' && (
            <div className={styles.filterChips}>
              {(['all', 'new', 'due', 'learned', 'flagged'] as FilterStatus[]).map(f => (
                <button
                  key={f}
                  className={`${styles.chip} ${filterStatus === f ? styles.chipActive : ''}`}
                  onClick={() => setFilterStatus(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
          <select
            className={styles.sortSelect}
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
          >
            <option value="created">Date Created</option>
            <option value="due">Due Date</option>
            <option value="difficulty">Difficulty</option>
            <option value="alpha">Alphabetical</option>
            <option value="manual">Manual Order</option>
          </select>
        </div>
      )}

      {/* Feature 8: Bulk action bar */}
      {hasSelection && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedIds.size} selected</span>
          <button className={styles.bulkBtn} onClick={selectAll}>Select All</button>
          <button className={styles.bulkBtn} onClick={deselectAll}>Deselect</button>
          <button className={styles.bulkBtn} onClick={() => handleBulkFlag(true)}>Flag</button>
          <button className={styles.bulkBtn} onClick={() => handleBulkFlag(false)}>Unflag</button>
          <button className={styles.bulkBtn} onClick={openMoveDialog}>Move to...</button>
          <button className={`${styles.bulkBtn} ${styles.bulkDanger}`} onClick={handleBulkDelete}>
            Delete ({selectedIds.size})
          </button>
        </div>
      )}

      {displayCards.length === 0 ? (
        searchQuery || filterStatus !== 'all' ? (
          <EmptyState
            icon="🔍"
            title="No matching cards"
            description="Try adjusting your search or filter."
          />
        ) : (
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
        )
      ) : (
        <div className={styles.cardList}>
          {displayCards.map((card, index) => (
            <React.Fragment key={card.id}>
              {dragOverIndex === index && draggedId !== card.id && (
                <div className={styles.dropIndicator} />
              )}
              <div
                className={`${styles.cardEntry} ${selectedIds.has(card.id) ? styles.cardSelected : ''} ${draggedId === card.id ? styles.cardDragging : ''}`}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
              <div className={styles.cardEntryHeader}>
                <div className={styles.cardBadges}>
                  {/* Feature 8: Checkbox */}
                  <input
                    type="checkbox"
                    className={styles.cardCheckbox}
                    checked={selectedIds.has(card.id)}
                    onChange={() => toggleSelect(card.id)}
                    onClick={e => e.stopPropagation()}
                  />
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
                      {leechCardIds.has(card.id) && (
                        <span className={styles.badge + ' ' + styles.leechBadge}>Leech</span>
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
                </div>
                <div className={styles.cardActions}>
                  <ContextMenu items={buildContextMenuItems(card)} />
                </div>
              </div>
              {tab === 'cards' && (card.srs.lastReviewDate !== null || bestRatings.has(card.id) || card.srs.repetitions > 0) && (
                <div className={styles.cardMeta}>
                  {card.srs.lastReviewDate !== null && (
                    <span className={styles.metaItem}>
                      <span className={styles.metaLabel}>Last studied:</span>{' '}
                      <span className={styles.metaValue}>{formatTimeAgo(card.srs.lastReviewDate)}</span>
                    </span>
                  )}
                  {bestRatings.has(card.id) && (() => {
                    const display = getRatingDisplay(bestRatings.get(card.id)!);
                    return (
                      <span className={styles.metaItem}>
                        <span className={styles.metaLabel}>Best:</span>{' '}
                        <span className={styles.metaValue} style={{ color: display.color }}>{display.sublabel}</span>
                      </span>
                    );
                  })()}
                  {card.srs.repetitions > 0 && (() => {
                    const diff = getDifficultyLabel(card.srs.easeFactor);
                    return (
                      <span className={styles.metaItem}>
                        <span className={styles.metaLabel}>Difficulty:</span>{' '}
                        <span className={styles.metaValue} style={{ color: diff.color }}>{diff.label}</span>
                      </span>
                    );
                  })()}
                </div>
              )}
              <div
                className={styles.cardPair}
                draggable
                onDragStart={(e) => handleDragStart(e, card.id)}
                onDragEnd={handleDragEnd}
                onClick={() => setEditingCard(card)}
                role="button"
                tabIndex={0}
              >
                <div className={styles.cardSide}>
                  <span className={styles.sideLabel}>Question</span>
                  <MiniCardPreview elements={card.front.elements} />
                </div>
                <div className={styles.cardSide}>
                  <span className={styles.sideLabel}>Answer</span>
                  <MiniCardPreview elements={card.back.elements} />
                </div>
              </div>
            </div>
            </React.Fragment>
          ))}
          {dragOverIndex === displayCards.length && draggedId && (
            <div className={styles.dropIndicator} />
          )}
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
        open={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        title="CSV Import"
      >
        {deckId && (
          <CsvImporter
            deckId={deckId}
            onDone={() => {
              setShowCsvImport(false);
              setTab('drafts');
              load();
            }}
          />
        )}
      </Modal>

      <Modal
        open={showAnkiImport}
        onClose={() => setShowAnkiImport(false)}
        title="Anki Import"
      >
        {deckId && (
          <AnkiImporter
            deckId={deckId}
            onDone={() => {
              setShowAnkiImport(false);
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
            onStart={(size, reverse) => {
              setShowSessionPicker(false);
              const params = new URLSearchParams({ size: String(size) });
              if (reverse) params.set('reverse', '1');
              navigate(`/learn/${deckId}?${params.toString()}`);
            }}
            onCancel={() => setShowSessionPicker(false)}
          />
        )}
      </Modal>

      {/* Feature 8: Move to deck modal */}
      <Modal
        open={showMoveTo}
        onClose={() => setShowMoveTo(false)}
        title="Move to Deck"
      >
        <div className={styles.moveList}>
          {allDecks.length === 0 ? (
            <p className={styles.moveEmpty}>No other decks available</p>
          ) : (
            allDecks.map(d => (
              <button
                key={d.id}
                className={styles.moveItem}
                onClick={() => handleBulkMove(d.id)}
              >
                <span className={styles.moveDot} style={{ background: d.color }} />
                {d.name}
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
