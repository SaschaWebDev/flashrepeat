interface TranscriptResult {
  title: string;
  transcript: string;
  durationSeconds: number;
}

interface CaptionTrack {
  baseUrl: string;
  vssId: string;
  languageCode: string;
  kind?: string;
}

const MAX_DURATION_SECONDS = 2 * 60 * 60; // 2 hours

const INNERTUBE_API_URL = 'https://www.youtube.com/youtubei/v1/player';
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
  const playerResponse = await fetchPlayerResponse(videoId);

  // Check playability status for clear error messages
  const playabilityStatus = playerResponse.playabilityStatus as
    { status?: string; reason?: string } | undefined;
  const status = playabilityStatus?.status;

  if (status && status !== 'OK') {
    if (status === 'ERROR') {
      throw new TranscriptError('INVALID_URL', 'Video not found');
    }
    if (status === 'LOGIN_REQUIRED') {
      throw new TranscriptError('NO_TRANSCRIPT', 'This video is private');
    }
    if (status === 'UNPLAYABLE') {
      throw new TranscriptError('NO_TRANSCRIPT', 'This video is unavailable');
    }
    if (status === 'LIVE_STREAM_OFFLINE') {
      throw new TranscriptError('NO_TRANSCRIPT', 'Live streams are not supported');
    }
    throw new TranscriptError('NO_TRANSCRIPT', 'Video is not available');
  }

  // Extract title and duration
  const videoDetails = playerResponse.videoDetails as
    { title?: string; lengthSeconds?: string } | undefined;
  const title = videoDetails?.title ?? 'Untitled Video';
  const durationSeconds = parseInt(videoDetails?.lengthSeconds ?? '0', 10);

  if (durationSeconds > MAX_DURATION_SECONDS) {
    throw new TranscriptError('VIDEO_TOO_LONG', 'Videos longer than 2 hours are not supported');
  }

  // Navigate parsed JSON for caption tracks
  const captions = playerResponse.captions as
    { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } } | undefined;
  const captionTracks = captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!captionTracks?.length) {
    throw new TranscriptError('NO_TRANSCRIPT', 'This video has no captions available');
  }

  // Priority: manual English > any manual > auto English > first available
  const selected =
    captionTracks.find(t => t.vssId === '.en') ??
    captionTracks.find(t => t.vssId?.startsWith('.') && t.kind !== 'asr') ??
    captionTracks.find(t => t.vssId === 'a.en' || (t.languageCode === 'en' && t.kind === 'asr')) ??
    captionTracks[0]!;

  const captionUrl = cleanUrl(selected.baseUrl);

  // Fetch the captions XML
  const captionResponse = await fetch(captionUrl);
  if (!captionResponse.ok) {
    throw new TranscriptError('NO_TRANSCRIPT', 'Could not fetch captions');
  }

  const xml = await captionResponse.text();
  const transcript = parseTranscriptXml(xml);

  if (!transcript.trim()) {
    throw new TranscriptError('NO_TRANSCRIPT', 'Transcript is empty');
  }

  return { title, transcript, durationSeconds };
}

async function fetchPlayerResponse(videoId: string): Promise<Record<string, unknown>> {
  // Strategy 1: Innertube ANDROID client (fast, no HTML parsing)
  try {
    const innertube = await fetchViaInnertube(videoId);
    if (hasCaptionTracks(innertube)) {
      return innertube;
    }
  } catch {
    // Innertube failed entirely — fall through to watch page
  }

  // Strategy 2: Watch page scraping (reliable, extracts embedded player response)
  return fetchViaWatchPage(videoId);
}

async function fetchViaInnertube(videoId: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${INNERTUBE_API_URL}?key=${INNERTUBE_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 13; en_US) gzip',
    },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '20.10.38',
          androidSdkVersion: 33,
          hl: 'en',
        },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });

  if (!response.ok) {
    throw new TranscriptError('INVALID_URL', 'Could not fetch video metadata');
  }

  const data: unknown = await response.json();
  if (typeof data !== 'object' || data === null) {
    throw new TranscriptError('NO_TRANSCRIPT', 'Invalid response from YouTube');
  }

  return data as Record<string, unknown>;
}

async function fetchViaWatchPage(videoId: string): Promise<Record<string, unknown>> {
  const url = `https://www.youtube.com/watch?v=${videoId}&hl=en`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new TranscriptError('INVALID_URL', 'Could not fetch video page');
  }

  const html = await response.text();
  return extractPlayerResponseFromHtml(html);
}

function extractPlayerResponseFromHtml(html: string): Record<string, unknown> {
  const marker = 'var ytInitialPlayerResponse = ';
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) {
    throw new TranscriptError('NO_TRANSCRIPT', 'Could not extract video data');
  }

  const jsonStart = startIdx + marker.length;
  let depth = 0;
  let jsonEnd = jsonStart;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }

  const jsonStr = html.substring(jsonStart, jsonEnd);
  try {
    const data: unknown = JSON.parse(jsonStr);
    if (typeof data !== 'object' || data === null) {
      throw new Error('not an object');
    }
    return data as Record<string, unknown>;
  } catch {
    throw new TranscriptError('NO_TRANSCRIPT', 'Could not parse video data');
  }
}

function hasCaptionTracks(data: Record<string, unknown>): boolean {
  const captions = data.captions as
    { playerCaptionsTracklistRenderer?: { captionTracks?: unknown[] } } | undefined;
  return (captions?.playerCaptionsTracklistRenderer?.captionTracks?.length ?? 0) > 0;
}

function parseTranscriptXml(xml: string): string {
  // Extract text from <text> elements, strip XML tags and decode entities
  const segments: string[] = [];
  const textMatches = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)];

  for (const match of textMatches) {
    const raw = match[1];
    if (!raw) continue;
    const decoded = raw
      .replace(/<[^>]+>/g, '') // strip nested tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/\n/g, ' ')
      .trim();
    if (decoded) {
      segments.push(decoded);
    }
  }

  return segments.join(' ').replace(/\s+/g, ' ').trim();
}

function cleanUrl(url: string): string {
  return url.replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
}

export class TranscriptError extends Error {
  constructor(
    public code: 'NO_TRANSCRIPT' | 'VIDEO_TOO_LONG' | 'INVALID_URL',
    message: string,
  ) {
    super(message);
    this.name = 'TranscriptError';
  }
}
