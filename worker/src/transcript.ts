interface TranscriptResult {
  title: string;
  transcript: string;
  durationSeconds: number;
}

const MAX_DURATION_SECONDS = 2 * 60 * 60; // 2 hours

export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
  // Fetch the video page to extract captions metadata
  const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!pageResponse.ok) {
    throw new TranscriptError('INVALID_URL', 'Could not fetch video page');
  }

  const html = await pageResponse.text();

  // Extract video title
  const titleMatch = html.match(/"title":"([^"]+)"/);
  const title = titleMatch?.[1] ? decodeUnicodeEscapes(titleMatch[1]) : 'Untitled Video';

  // Extract duration
  const durationMatch = html.match(/"lengthSeconds":"(\d+)"/);
  const durationSeconds = durationMatch?.[1] ? parseInt(durationMatch[1], 10) : 0;

  if (durationSeconds > MAX_DURATION_SECONDS) {
    throw new TranscriptError('VIDEO_TOO_LONG', 'Videos longer than 2 hours are not supported');
  }

  // Extract captions player response
  const captionsMatch = html.match(/"captions":\s*(\{.*?"captionTracks":\s*\[.*?\].*?\})/s);
  if (!captionsMatch?.[1]) {
    throw new TranscriptError('NO_TRANSCRIPT', 'This video has no captions available');
  }

  const captionsJson = captionsMatch[1];

  // Find caption track URLs
  const trackMatches = [...captionsJson.matchAll(/"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/g)];
  if (trackMatches.length === 0) {
    throw new TranscriptError('NO_TRANSCRIPT', 'This video has no captions available');
  }

  // Prefer manually created captions (kind !== "asr")
  // Look for English captions first
  let captionUrl: string | null = null;

  // Try to find manual English captions
  const manualMatch = captionsJson.match(
    /"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"[^}]*?"vssId":"\.en"/
  );
  if (manualMatch?.[1]) {
    captionUrl = cleanUrl(manualMatch[1]);
  }

  // Fall back to any manual captions
  if (!captionUrl) {
    const anyManualMatch = captionsJson.match(
      /"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"[^}]*?"vssId":"\.(?!a\.)[^"]+"/
    );
    if (anyManualMatch?.[1]) {
      captionUrl = cleanUrl(anyManualMatch[1]);
    }
  }

  // Fall back to auto-generated English
  if (!captionUrl) {
    const autoEnMatch = captionsJson.match(
      /"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"[^}]*?"vssId":"a\.en"/
    );
    if (autoEnMatch?.[1]) {
      captionUrl = cleanUrl(autoEnMatch[1]);
    }
  }

  // Fall back to first available track
  if (!captionUrl) {
    const firstTrack = trackMatches[0];
    if (firstTrack?.[1]) {
      captionUrl = cleanUrl(firstTrack[1]);
    }
  }

  if (!captionUrl) {
    throw new TranscriptError('NO_TRANSCRIPT', 'This video has no captions available');
  }

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

function decodeUnicodeEscapes(str: string): string {
  return str.replace(/\\u[\dA-Fa-f]{4}/g, (match) =>
    String.fromCharCode(parseInt(match.slice(2), 16))
  );
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
