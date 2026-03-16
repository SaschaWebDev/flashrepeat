import type { Rating, SRSData } from '../types';

/**
 * Modified FSRS algorithm with 5-button rating system.
 *
 * EF_new = EF_old + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)) + P_bonus
 *
 * Guardrails:
 * - "Perfect" (q=5): max interval jump capped at 2.5x previous interval
 * - "Again" (q=1): EF penalized by max 20%, interval drops to 1 day (not full reset)
 */

const MIN_EASE_FACTOR = 1.3;
const PERFECT_BONUS = 0.15;
const PERFECT_MAX_MULTIPLIER = 2.5;
const AGAIN_MAX_PENALTY = 0.2; // 20% max EF penalty

export function calculateNextReview(current: SRSData, rating: Rating): SRSData {
  const q = rating;

  // Calculate new ease factor using the modified formula
  let efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);

  // Apply "Again" guardrail: cap EF penalty at 20%
  if (q === 1) {
    const maxPenalty = current.easeFactor * AGAIN_MAX_PENALTY;
    efDelta = Math.max(efDelta, -maxPenalty);
  }

  // Apply "Perfect" bonus
  const pBonus = q === 5 ? PERFECT_BONUS : 0;

  let newEF = current.easeFactor + efDelta + pBonus;
  newEF = Math.max(newEF, MIN_EASE_FACTOR);

  // Calculate new interval
  let newInterval: number;
  let newRepetitions: number;

  if (q === 1) {
    // "Again" - drop to 1 day, don't fully reset repetitions
    newInterval = 1;
    newRepetitions = Math.max(0, current.repetitions - 1);
  } else if (current.repetitions === 0) {
    // First successful review
    newInterval = 1;
    newRepetitions = 1;
  } else if (current.repetitions === 1) {
    // Second successful review
    newInterval = 6;
    newRepetitions = 2;
  } else {
    // Subsequent reviews
    newInterval = Math.round(current.interval * newEF);
    newRepetitions = current.repetitions + 1;

    // "Perfect" guardrail: cap interval jump at 2.5x
    if (q === 5) {
      const maxInterval = Math.round(current.interval * PERFECT_MAX_MULTIPLIER);
      newInterval = Math.min(newInterval, maxInterval);
    }
  }

  // Ensure minimum 1 day interval
  newInterval = Math.max(1, newInterval);

  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  return {
    easeFactor: newEF,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewDate: now + newInterval * msPerDay,
    lastReviewDate: now,
  };
}

/**
 * Fisher-Yates shuffle for Free Roaming mode.
 * Shuffles cards in-place for interleaved practice.
 */
export function shuffleCards<T>(cards: T[]): T[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Prioritize cards by "retrievability" - how close they are to being forgotten.
 * Most overdue cards come first.
 */
export function prioritizeByRetrievability<T extends { srs: SRSData }>(cards: T[]): T[] {
  const now = Date.now();
  return [...cards].sort((a, b) => {
    const overdueA = now - a.srs.nextReviewDate;
    const overdueB = now - b.srs.nextReviewDate;
    return overdueB - overdueA; // most overdue first
  });
}
