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
  }
}

export const db = new FlashRepeatDB();

// Request persistent storage on init
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {
    // Best effort - some browsers may deny
  });
}
