import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index';
import type { Card, Deck, ReviewRecord } from '../types';
import type { DeckExport, FullExport } from './export';

type ImportData = DeckExport | FullExport;

function isFullExport(data: ImportData): data is FullExport {
  return 'decks' in data && Array.isArray(data.decks);
}

function isDeckExport(data: ImportData): data is DeckExport {
  return 'deck' in data && 'cards' in data;
}

export interface ImportResult {
  decksImported: number;
  cardsImported: number;
}

export function validateImportFile(data: unknown): data is ImportData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (obj.version !== 1) return false;
  if (typeof obj.exportedAt !== 'number') return false;

  if ('decks' in obj) {
    return Array.isArray(obj.decks) && Array.isArray(obj.cards);
  }
  if ('deck' in obj) {
    return typeof obj.deck === 'object' && Array.isArray(obj.cards);
  }
  return false;
}

export async function importJson(data: ImportData): Promise<ImportResult> {
  if (isFullExport(data)) {
    return importFullExport(data);
  }
  if (isDeckExport(data)) {
    return importDeckExport(data);
  }
  throw new Error('Invalid import format');
}

async function importDeckExport(data: DeckExport): Promise<ImportResult> {
  const now = Date.now();
  const newDeckId = uuidv4();

  const deck: Deck = {
    ...data.deck,
    id: newDeckId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const cards: Card[] = data.cards.map((card, index) => ({
    ...card,
    id: uuidv4(),
    deckId: newDeckId,
    updatedAt: now,
    deletedAt: null,
    sortOrder: card.sortOrder ?? index,
  }));

  await db.transaction('rw', db.decks, db.cards, async () => {
    await db.decks.add(deck);
    if (cards.length > 0) {
      await db.cards.bulkAdd(cards);
    }
  });

  return { decksImported: 1, cardsImported: cards.length };
}

async function importFullExport(data: FullExport): Promise<ImportResult> {
  const now = Date.now();
  const deckIdMap = new Map<string, string>();

  const decks: Deck[] = data.decks.map(deck => {
    const newId = uuidv4();
    deckIdMap.set(deck.id, newId);
    return {
      ...deck,
      id: newId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  });

  const cards: Card[] = data.cards.map((card, index) => ({
    ...card,
    id: uuidv4(),
    deckId: deckIdMap.get(card.deckId) ?? card.deckId,
    updatedAt: now,
    deletedAt: null,
    sortOrder: card.sortOrder ?? index,
  }));

  const reviews: ReviewRecord[] = (data.reviewHistory ?? []).map(r => ({
    ...r,
    id: uuidv4(),
  }));

  await db.transaction('rw', db.decks, db.cards, db.reviewHistory, async () => {
    if (decks.length > 0) await db.decks.bulkAdd(decks);
    if (cards.length > 0) await db.cards.bulkAdd(cards);
    if (reviews.length > 0) await db.reviewHistory.bulkAdd(reviews);
  });

  return { decksImported: decks.length, cardsImported: cards.length };
}
