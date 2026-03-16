import { getReviewHistory, getSettings, updateSettings } from '../db/operations';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24-hour grace period

function getCalendarDay(timestamp: number, timezone: string): string {
  return new Date(timestamp).toLocaleDateString('en-CA', { timeZone: timezone });
}

export async function calculateStreak(): Promise<{
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: number | null;
}> {
  const settings = await getSettings();
  const timezone = settings.homeTimezone;
  const reviews = await getReviewHistory();

  if (reviews.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastStudyDate: null };
  }

  // Group reviews by calendar day
  const daySet = new Set<string>();
  let lastReviewTime = 0;
  for (const r of reviews) {
    daySet.add(getCalendarDay(r.reviewedAt, timezone));
    if (r.reviewedAt > lastReviewTime) lastReviewTime = r.reviewedAt;
  }

  const days = [...daySet].sort().reverse(); // most recent first
  const today = getCalendarDay(Date.now(), timezone);

  // Check if streak is still alive (today or within grace period)
  const mostRecentDay = days[0];
  const now = Date.now();
  const timeSinceLastReview = now - lastReviewTime;

  if (mostRecentDay !== today && timeSinceLastReview > MS_PER_DAY + GRACE_PERIOD_MS) {
    return { currentStreak: 0, longestStreak: calculateLongest(days), lastStudyDate: lastReviewTime };
  }

  // Count consecutive days from most recent
  let streak = 1;
  for (let i = 0; i < days.length - 1; i++) {
    const current = new Date(days[i]);
    const prev = new Date(days[i + 1]);
    const diffMs = current.getTime() - prev.getTime();
    if (diffMs <= MS_PER_DAY + 1000) { // +1s tolerance for DST
      streak++;
    } else {
      break;
    }
  }

  return {
    currentStreak: streak,
    longestStreak: calculateLongest(days),
    lastStudyDate: lastReviewTime,
  };
}

function calculateLongest(daysDesc: string[]): number {
  if (daysDesc.length === 0) return 0;
  const days = [...daysDesc].reverse(); // oldest first
  let longest = 1;
  let current = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diffMs = curr.getTime() - prev.getTime();
    if (diffMs <= MS_PER_DAY + 1000) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

export async function updateStreakAfterSession(): Promise<void> {
  const { currentStreak, lastStudyDate } = await calculateStreak();
  await updateSettings({ currentStreak, lastStudyDate });
}

export async function getHeatMapData(daysBack = 365): Promise<Map<string, number>> {
  const settings = await getSettings();
  const timezone = settings.homeTimezone;
  const since = Date.now() - daysBack * MS_PER_DAY;
  const reviews = await getReviewHistory(since);

  const map = new Map<string, number>();
  for (const r of reviews) {
    const day = getCalendarDay(r.reviewedAt, timezone);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return map;
}
