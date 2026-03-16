import { fetchTranscript, TranscriptError } from './transcript';
import { generateFlashcards } from './generate';

interface Env {
  ANTHROPIC_API_KEY: string;
}

interface RequestBody {
  videoId: string;
  maxCards?: number;
}

// Simple per-isolate rate limiter (best-effort)
const rateLimiter = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimiter.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  rateLimiter.set(ip, recent);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  rateLimiter.set(ip, recent);
  return false;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') ?? '*';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Only handle POST /api/youtube-flashcards
    if (url.pathname !== '/api/youtube-flashcards' || request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Not found' }, 404, origin);
    }

    // Rate limiting
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (isRateLimited(ip)) {
      return jsonResponse(
        { ok: false, error: 'Too many requests, wait a few minutes', code: 'RATE_LIMITED' },
        429,
        origin,
      );
    }

    // Validate API key is configured
    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse(
        { ok: false, error: 'Server configuration error', code: 'LLM_ERROR' },
        500,
        origin,
      );
    }

    // Parse request body
    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { ok: false, error: 'Invalid request body', code: 'INVALID_URL' },
        400,
        origin,
      );
    }

    const { videoId, maxCards = 15 } = body;

    // Validate videoId
    if (!videoId || typeof videoId !== 'string' || !/^[\w-]{11}$/.test(videoId)) {
      return jsonResponse(
        { ok: false, error: 'Invalid video ID', code: 'INVALID_URL' },
        400,
        origin,
      );
    }

    // Clamp maxCards
    const clampedMaxCards = Math.min(Math.max(Math.round(maxCards), 5), 30);

    try {
      // Step 1: Fetch transcript
      const { title, transcript } = await fetchTranscript(videoId);

      // Step 2: Generate flashcards
      const { cards } = await generateFlashcards(
        env.ANTHROPIC_API_KEY,
        title,
        transcript,
        clampedMaxCards,
      );

      return jsonResponse({ ok: true, videoTitle: title, cards }, 200, origin);
    } catch (err) {
      if (err instanceof TranscriptError) {
        return jsonResponse(
          { ok: false, error: err.message, code: err.code },
          400,
          origin,
        );
      }

      console.error('Worker error:', err);
      return jsonResponse(
        { ok: false, error: 'Could not generate flashcards', code: 'LLM_ERROR' },
        500,
        origin,
      );
    }
  },
};
