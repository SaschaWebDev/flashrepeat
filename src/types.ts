export interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Card {
  id: string;
  deckId: string;
  front: CardContent;
  back: CardContent;
  srs: SRSData;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  flaggedAt: number | null;
  status: 'active' | 'draft';
}

export interface CardContent {
  elements: CanvasElement[];
}

export interface CanvasElement {
  id: string;
  type: 'text' | 'image';
  x: number;      // percentage 0-100
  y: number;      // percentage 0-100
  width: number;  // percentage 0-100
  height: number; // percentage 0-100
  zIndex: number;
  content: string; // text content or image data URL
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
}

export interface SRSData {
  easeFactor: number;     // starts at 2.5
  interval: number;       // days until next review
  repetitions: number;    // consecutive correct reviews
  nextReviewDate: number; // timestamp
  lastReviewDate: number | null;
}

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface RatingOption {
  value: Rating;
  label: string;
  sublabel: string;
  color: string;
}

export const RATINGS: RatingOption[] = [
  { value: 1, label: 'Again', sublabel: 'Forgot completely', color: '#ef4444' },
  { value: 2, label: 'Hard', sublabel: 'Severe effort', color: '#f97316' },
  { value: 3, label: 'Good', sublabel: 'Some hesitation', color: '#eab308' },
  { value: 4, label: 'Easy', sublabel: 'Instant recall', color: '#22c55e' },
  { value: 5, label: 'Perfect', sublabel: 'Trivial', color: '#3b82f6' },
];

export interface StudySession {
  deckIds: string[];
  mode: 'normal' | 'free-roam';
  dailyCap: number;
}

export interface DeckStats {
  totalCards: number;
  dueCards: number;
  newCards: number;
  learnedCards: number;
}

export interface UserSettings {
  id: string; // always 'default'
  homeTimezone: string;
  dailyReviewGoal: number;
  dailyOverdueCap: number;
  lastStudyDate: number | null;
  currentStreak: number;
}

export interface ReviewRecord {
  id: string;
  cardId: string;
  deckId: string;
  rating: Rating;
  easeFactor: number;
  interval: number;
  reviewedAt: number;
}
