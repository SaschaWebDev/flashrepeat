import { v4 as uuidv4 } from 'uuid';
import { db } from './index';
import type { Card, CardContent, Deck, DeckStats, SRSData, Rating, UserSettings, ReviewRecord } from '../types';

const DEFAULT_SRS: SRSData = {
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
  nextReviewDate: 0, // immediately due
  lastReviewDate: null,
};

const DEFAULT_SETTINGS: UserSettings = {
  id: 'default',
  homeTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dailyReviewGoal: 20,
  dailyOverdueCap: 50,
  lastStudyDate: null,
  currentStreak: 0,
  theme: 'dark',
  leechThreshold: 4,
};

// ── Settings operations ──

export async function getSettings(): Promise<UserSettings> {
  const settings = await db.settings.get('default');
  if (settings) return settings;
  await db.settings.add(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

export async function updateSettings(updates: Partial<Omit<UserSettings, 'id'>>): Promise<void> {
  const existing = await db.settings.get('default');
  if (!existing) {
    await db.settings.add({ ...DEFAULT_SETTINGS, ...updates });
  } else {
    await db.settings.update('default', updates);
  }
}

// ── Review history operations ──

export async function recordReview(
  cardId: string,
  deckId: string,
  rating: Rating,
  easeFactor: number,
  interval: number,
): Promise<void> {
  const record: ReviewRecord = {
    id: uuidv4(),
    cardId,
    deckId,
    rating,
    easeFactor,
    interval,
    reviewedAt: Date.now(),
  };
  await db.reviewHistory.add(record);
}

export async function getReviewHistory(since?: number): Promise<ReviewRecord[]> {
  if (since) {
    return db.reviewHistory.where('reviewedAt').above(since).toArray();
  }
  return db.reviewHistory.toArray();
}

export async function getReviewsForDay(date: Date, timezone: string): Promise<ReviewRecord[]> {
  const dayStart = getDayStart(date, timezone);
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return db.reviewHistory
    .where('reviewedAt')
    .between(dayStart, dayEnd, true, false)
    .toArray();
}

function getDayStart(date: Date, timezone: string): number {
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone });
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getTime();
}

// ── Deck operations ──

export async function createDeck(name: string, description = '', color = '#6366f1'): Promise<Deck> {
  const now = Date.now();
  const deck: Deck = {
    id: uuidv4(),
    name,
    description,
    color,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.decks.add(deck);
  return deck;
}

export async function updateDeck(id: string, updates: Partial<Pick<Deck, 'name' | 'description' | 'color'>>): Promise<void> {
  await db.decks.update(id, { ...updates, updatedAt: Date.now() });
}

export async function softDeleteDeck(id: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.decks, db.cards, async () => {
    await db.decks.update(id, { deletedAt: now, updatedAt: now });
    // Cascade soft-delete to all cards in this deck
    await db.cards.where('deckId').equals(id).modify({
      deletedAt: now,
      updatedAt: now,
    });
  });
}

export async function getAllDecks(): Promise<Deck[]> {
  const all = await db.decks.toArray();
  return all.filter(d => d.deletedAt === null);
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const deck = await db.decks.get(id);
  return deck?.deletedAt === null ? deck : undefined;
}

// ── Card operations ──

export async function createCard(
  deckId: string,
  front: CardContent,
  back: CardContent,
  status: 'active' | 'draft' = 'active',
): Promise<Card> {
  const now = Date.now();
  const existing = await db.cards.where('deckId').equals(deckId).toArray();
  const maxOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1);
  const card: Card = {
    id: uuidv4(),
    deckId,
    front,
    back,
    srs: { ...DEFAULT_SRS },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    flaggedAt: null,
    status,
    sortOrder: maxOrder + 1,
  };
  await db.cards.add(card);
  return card;
}

export async function updateCard(
  id: string,
  updates: Partial<Pick<Card, 'front' | 'back' | 'status'>>,
): Promise<void> {
  await db.cards.update(id, { ...updates, updatedAt: Date.now() });
}

export async function updateCardSRS(id: string, srs: SRSData): Promise<void> {
  await db.cards.update(id, { srs, updatedAt: Date.now() });
}

export async function softDeleteCard(id: string): Promise<void> {
  const now = Date.now();
  await db.cards.update(id, { deletedAt: now, updatedAt: now });
}

export async function flagCard(id: string): Promise<void> {
  await db.cards.update(id, { flaggedAt: Date.now(), updatedAt: Date.now() });
}

export async function unflagCard(id: string): Promise<void> {
  await db.cards.update(id, { flaggedAt: null, updatedAt: Date.now() });
}

export async function getCardsForDeck(deckId: string): Promise<Card[]> {
  return db.cards
    .where('deckId')
    .equals(deckId)
    .toArray()
    .then(cards => cards.filter(c => c.deletedAt === null && c.status === 'active'));
}

export async function getDraftCardsForDeck(deckId: string): Promise<Card[]> {
  return db.cards
    .where('deckId')
    .equals(deckId)
    .toArray()
    .then(cards => cards.filter(c => c.deletedAt === null && c.status === 'draft'));
}

export async function getDueCards(deckIds: string[], limit = 50): Promise<Card[]> {
  const now = Date.now();
  const allDue: Card[] = [];

  for (const deckId of deckIds) {
    const cards = await db.cards
      .where('deckId')
      .equals(deckId)
      .toArray();

    const due = cards.filter(
      c => c.deletedAt === null
        && c.status === 'active'
        && c.flaggedAt === null
        && c.srs.nextReviewDate <= now,
    );
    allDue.push(...due);
  }

  // Sort by next review date (most overdue first), limit batch
  allDue.sort((a, b) => a.srs.nextReviewDate - b.srs.nextReviewDate);
  return allDue.slice(0, limit);
}

export async function getStudyCards(
  deckIds: string[],
  sessionSize: number,
): Promise<{ cards: Card[]; dueCount: number }> {
  const now = Date.now();
  const allCards: Card[] = [];

  for (const deckId of deckIds) {
    const cards = await db.cards.where('deckId').equals(deckId).toArray();
    const eligible = cards.filter(
      c => c.deletedAt === null && c.status === 'active' && c.flaggedAt === null,
    );
    allCards.push(...eligible);
  }

  const due = allCards
    .filter(c => c.srs.nextReviewDate <= now)
    .sort((a, b) => a.srs.nextReviewDate - b.srs.nextReviewDate);

  const nonDue = allCards
    .filter(c => c.srs.nextReviewDate > now)
    .sort((a, b) => a.srs.nextReviewDate - b.srs.nextReviewDate);

  const selectedDue = due.slice(0, sessionSize);
  const remaining = sessionSize - selectedDue.length;
  const selectedNonDue = remaining > 0 ? nonDue.slice(0, remaining) : [];

  return {
    cards: [...selectedDue, ...selectedNonDue],
    dueCount: selectedDue.length,
  };
}

export async function bulkCreateCards(
  deckId: string,
  cards: Array<{ front: CardContent; back: CardContent }>,
  status: 'active' | 'draft' = 'active',
): Promise<void> {
  const now = Date.now();
  const existing = await db.cards.where('deckId').equals(deckId).toArray();
  const maxOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1);
  const records: Card[] = cards.map((c, i) => ({
    id: uuidv4(),
    deckId,
    front: c.front,
    back: c.back,
    srs: { ...DEFAULT_SRS },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    flaggedAt: null,
    status,
    sortOrder: maxOrder + 1 + i,
  }));
  await db.transaction('rw', db.cards, async () => {
    await db.cards.bulkAdd(records);
  });
}

export async function bulkApproveCards(cardIds: string[]): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.cards, async () => {
    for (const id of cardIds) {
      await db.cards.update(id, { status: 'active' as const, updatedAt: now });
    }
  });
}

// ── Duplicate card ──

export async function duplicateCard(cardId: string): Promise<Card | null> {
  const original = await db.cards.get(cardId);
  if (!original || original.deletedAt !== null) return null;

  const now = Date.now();
  const existing = await db.cards.where('deckId').equals(original.deckId).toArray();
  const maxOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1);

  // Clone front, append "(copy)" to first text element
  const frontElements = original.front.elements.map((el, i) => {
    if (i === 0 && el.type === 'text' && el.content.trim().length > 0) {
      return { ...el, id: uuidv4(), content: el.content + ' (copy)' };
    }
    return { ...el, id: uuidv4() };
  });

  const backElements = original.back.elements.map(el => ({ ...el, id: uuidv4() }));

  const card: Card = {
    id: uuidv4(),
    deckId: original.deckId,
    front: { elements: frontElements },
    back: { elements: backElements },
    srs: {
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReviewDate: 0,
      lastReviewDate: null,
    },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    flaggedAt: null,
    status: 'active',
    sortOrder: maxOrder + 1,
  };

  await db.cards.add(card);
  return card;
}

// ── Bulk operations ──

export async function bulkDeleteCards(cardIds: string[]): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.cards, async () => {
    for (const id of cardIds) {
      await db.cards.update(id, { deletedAt: now, updatedAt: now });
    }
  });
}

export async function bulkMoveCards(cardIds: string[], targetDeckId: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.cards, async () => {
    for (const id of cardIds) {
      await db.cards.update(id, { deckId: targetDeckId, updatedAt: now });
    }
  });
}

export async function bulkFlagCards(cardIds: string[], flag: boolean): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.cards, async () => {
    for (const id of cardIds) {
      await db.cards.update(id, {
        flaggedAt: flag ? now : null,
        updatedAt: now,
      });
    }
  });
}

// ── Leech detection ──

export async function getLeechCards(deckId: string, threshold = 4): Promise<Set<string>> {
  const reviews = await db.reviewHistory
    .where('deckId')
    .equals(deckId)
    .toArray();

  const againCounts = new Map<string, number>();
  for (const r of reviews) {
    if (r.rating === 1) {
      againCounts.set(r.cardId, (againCounts.get(r.cardId) ?? 0) + 1);
    }
  }

  const leeches = new Set<string>();
  for (const [cardId, count] of againCounts) {
    if (count >= threshold) {
      leeches.add(cardId);
    }
  }

  return leeches;
}

export async function checkAndFlagLeech(cardId: string, deckId: string, threshold = 4): Promise<boolean> {
  const reviews = await db.reviewHistory
    .where('cardId')
    .equals(cardId)
    .toArray();

  const againCount = reviews.filter(r => r.rating === 1).length;
  if (againCount >= threshold) {
    const card = await db.cards.get(cardId);
    if (card && !card.flaggedAt) {
      await db.cards.update(cardId, { flaggedAt: Date.now(), updatedAt: Date.now() });
    }
    return true;
  }
  return false;
}

export async function getBestRatingsForDeck(deckId: string): Promise<Map<string, Rating>> {
  const reviews = await db.reviewHistory
    .where('deckId')
    .equals(deckId)
    .toArray();

  const best = new Map<string, Rating>();
  for (const r of reviews) {
    const current = best.get(r.cardId);
    if (current === undefined || r.rating > current) {
      best.set(r.cardId, r.rating);
    }
  }
  return best;
}

export async function bulkUpdateCardOrder(updates: Array<{ id: string; sortOrder: number }>): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.cards, async () => {
    for (const u of updates) {
      await db.cards.update(u.id, { sortOrder: u.sortOrder, updatedAt: now });
    }
  });
}

export async function moveCardToDeck(cardId: string, targetDeckId: string): Promise<void> {
  await bulkMoveCards([cardId], targetDeckId);
}

export async function mergeDecks(
  sourceDeckIds: string[],
  name: string,
  description = '',
  color = '#6366f1',
): Promise<Deck> {
  const now = Date.now();
  const newDeckId = uuidv4();
  const newDeck: Deck = {
    id: newDeckId,
    name,
    description,
    color,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.transaction('rw', db.decks, db.cards, db.reviewHistory, async () => {
    await db.decks.add(newDeck);

    let sortCounter = 0;
    for (const deckId of sourceDeckIds) {
      const cards = await db.cards
        .where('deckId')
        .equals(deckId)
        .toArray()
        .then(c => c.filter(card => card.deletedAt === null && card.status === 'active'));

      cards.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      for (const card of cards) {
        await db.cards.update(card.id, {
          deckId: newDeckId,
          sortOrder: sortCounter++,
          updatedAt: now,
        });
      }
    }

    // Update review history to point to new deck
    for (const deckId of sourceDeckIds) {
      await db.reviewHistory
        .where('deckId')
        .equals(deckId)
        .modify({ deckId: newDeckId });
    }

    // Soft-delete source decks and their remaining cards (drafts, already-deleted)
    for (const deckId of sourceDeckIds) {
      await db.decks.update(deckId, { deletedAt: now, updatedAt: now });
      await db.cards.where('deckId').equals(deckId).modify({
        deletedAt: now,
        updatedAt: now,
      });
    }
  });

  return newDeck;
}

export async function getDeckStats(deckId: string): Promise<DeckStats> {
  const now = Date.now();
  const cards = await db.cards
    .where('deckId')
    .equals(deckId)
    .toArray()
    .then(cards => cards.filter(c => c.deletedAt === null && c.status === 'active'));

  let dueCards = 0;
  let newCards = 0;
  let learnedCards = 0;

  for (const card of cards) {
    if (card.srs.repetitions === 0) {
      newCards++;
    } else if (card.srs.nextReviewDate <= now) {
      dueCards++;
    } else {
      learnedCards++;
    }
  }

  return {
    totalCards: cards.length,
    dueCards: dueCards + newCards, // new cards are also "due"
    newCards,
    learnedCards,
  };
}
