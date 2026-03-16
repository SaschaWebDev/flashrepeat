import { API_BASE_URL } from '../config';

interface FlashcardPair {
  front: string;
  back: string;
}

interface GenerateResponse {
  ok: true;
  videoTitle: string;
  cards: FlashcardPair[];
}

interface ErrorResponse {
  ok: false;
  error: string;
  code: 'NO_TRANSCRIPT' | 'VIDEO_TOO_LONG' | 'INVALID_URL' | 'LLM_ERROR' | 'RATE_LIMITED';
}

export type YouTubeFlashcardsResult = GenerateResponse | ErrorResponse;

const VIDEO_ID_PATTERNS = [
  // youtube.com/watch?v=ID
  /[?&]v=([\w-]{11})/,
  // youtu.be/ID
  /youtu\.be\/([\w-]{11})/,
  // youtube.com/embed/ID
  /youtube\.com\/embed\/([\w-]{11})/,
  // youtube.com/shorts/ID
  /youtube\.com\/shorts\/([\w-]{11})/,
];

export function extractVideoId(url: string): string | null {
  const trimmed = url.trim();
  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export async function generateFlashcardsFromYouTube(
  url: string,
  maxCards?: number,
  signal?: AbortSignal,
): Promise<YouTubeFlashcardsResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    return { ok: false, error: 'Please enter a valid YouTube URL', code: 'INVALID_URL' };
  }

  const endpoint = `${API_BASE_URL}/api/youtube-flashcards`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, maxCards }),
    signal,
  });

  if (!response.ok) {
    try {
      const data = await response.json();
      return data as YouTubeFlashcardsResult;
    } catch {
      console.error(`YouTube API error: ${response.status} from ${endpoint}`);
      return { ok: false, error: 'Could not reach the flashcard server', code: 'LLM_ERROR' as const };
    }
  }

  const data: YouTubeFlashcardsResult = await response.json();
  return data;
}
