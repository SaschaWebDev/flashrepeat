import { db } from '../db/index';
import type { Deck, Card, ReviewRecord } from '../types';

export interface DeckExport {
  version: 1;
  exportedAt: number;
  deck: Deck;
  cards: Card[];
}

export interface FullExport {
  version: 1;
  exportedAt: number;
  decks: Deck[];
  cards: Card[];
  reviewHistory: ReviewRecord[];
}

export async function exportDeck(deckId: string): Promise<DeckExport | null> {
  const deck = await db.decks.get(deckId);
  if (!deck || deck.deletedAt !== null) return null;

  const cards = await db.cards
    .where('deckId')
    .equals(deckId)
    .toArray()
    .then(c => c.filter(card => card.deletedAt === null));

  return {
    version: 1,
    exportedAt: Date.now(),
    deck,
    cards,
  };
}

export async function exportAll(): Promise<FullExport> {
  const decks = await db.decks.toArray().then(d => d.filter(deck => deck.deletedAt === null));
  const cards = await db.cards.toArray().then(c => c.filter(card => card.deletedAt === null));
  const reviewHistory = await db.reviewHistory.toArray();

  return {
    version: 1,
    exportedAt: Date.now(),
    decks,
    cards,
    reviewHistory,
  };
}

export function downloadJson(data: DeckExport | FullExport, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
