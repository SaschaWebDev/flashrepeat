import Dexie, { type Table } from 'dexie';
import type { Card, Deck, UserSettings, ReviewRecord } from '../types';

class FlashRepeatDB extends Dexie {
  decks!: Table<Deck, string>;
  cards!: Table<Card, string>;
  settings!: Table<UserSettings, string>;
  reviewHistory!: Table<ReviewRecord, string>;

  constructor() {
    super('flashrepeat');

    this.version(1).stores({
      decks: 'id, name, deletedAt, updatedAt',
      cards: 'id, deckId, [deckId+srs.nextReviewDate], deletedAt, updatedAt',
    });

    this.version(2).stores({
      decks: 'id, name, deletedAt, updatedAt',
      cards: 'id, deckId, [deckId+srs.nextReviewDate], deletedAt, updatedAt, flaggedAt, status',
      settings: 'id',
      reviewHistory: 'id, cardId, deckId, reviewedAt',
    }).upgrade(tx => {
      return tx.table('cards').toCollection().modify(card => {
        if (card.flaggedAt === undefined) card.flaggedAt = null;
        if (card.status === undefined) card.status = 'active';
      });
    });

    this.version(3).stores({
      decks: 'id, name, deletedAt, updatedAt',
      cards: 'id, deckId, [deckId+srs.nextReviewDate], deletedAt, updatedAt, flaggedAt, status',
      settings: 'id',
      reviewHistory: 'id, cardId, deckId, reviewedAt',
    }).upgrade(tx => {
      return tx.table('settings').toCollection().modify(settings => {
        if (settings.theme === undefined) settings.theme = 'dark';
        if (settings.leechThreshold === undefined) settings.leechThreshold = 4;
      });
    });

    this.version(4).stores({
      decks: 'id, name, deletedAt, updatedAt',
      cards: 'id, deckId, [deckId+srs.nextReviewDate], deletedAt, updatedAt, flaggedAt, status, sortOrder',
      settings: 'id',
      reviewHistory: 'id, cardId, deckId, reviewedAt',
    }).upgrade(tx => {
      return tx.table('cards').toArray().then(cards => {
        const byDeck = new Map<string, typeof cards>();
        for (const card of cards) {
          const group = byDeck.get(card.deckId) ?? [];
          group.push(card);
          byDeck.set(card.deckId, group);
        }
        const updates: Promise<number>[] = [];
        for (const group of byDeck.values()) {
          group.sort((a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt);
          for (let i = 0; i < group.length; i++) {
            updates.push(tx.table('cards').update(group[i].id, { sortOrder: i }));
          }
        }
        return Promise.all(updates);
      });
    });
  }
}

export const db = new FlashRepeatDB();

// Request persistent storage on init
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {
    // Best effort - some browsers may deny
  });
}
