interface FlashcardPair {
  front: string;
  back: string;
}

interface GenerateResult {
  cards: FlashcardPair[];
}

export async function generateFlashcards(
  apiKey: string,
  videoTitle: string,
  transcript: string,
  maxCards: number,
): Promise<GenerateResult> {
  // Truncate transcript if very long (~100K chars ≈ ~25K tokens)
  const maxTranscriptChars = 100_000;
  const truncatedTranscript = transcript.length > maxTranscriptChars
    ? transcript.slice(0, maxTranscriptChars) + '\n[transcript truncated]'
    : transcript;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: buildPrompt(videoTitle, truncatedTranscript, maxCards),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const data: AnthropicResponse = await response.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock) {
    throw new Error('No text response from Claude API');
  }

  return parseFlashcardResponse(textBlock.text);
}

function buildPrompt(title: string, transcript: string, maxCards: number): string {
  return `You are a flashcard generation expert. Create ${maxCards} high-quality Q&A flashcard pairs from this YouTube video transcript.

Video title: "${title}"

Transcript:
${transcript}

Instructions:
- Create exactly ${maxCards} flashcard pairs (or fewer if the content doesn't support that many).
- Each flashcard has a "front" (question) and "back" (answer).
- Use varied question types: definitions, explanations, comparisons, cause-and-effect, application questions.
- Questions should be specific and testable — not vague.
- Answers should be concise (1-3 sentences). Include the key fact, not fluff.
- Cover the most important concepts from the video.
- Do NOT create trivial questions (e.g., "What is the title of this video?").
- Do NOT reference the video itself (e.g., "According to the speaker..."). Cards should be self-contained knowledge.

Respond with ONLY a JSON array of objects, each with "front" and "back" string fields. No markdown, no explanation, just the JSON array.

Example format:
[{"front":"What is spaced repetition?","back":"A learning technique where review intervals increase over time based on recall difficulty, optimizing long-term memory retention."}]`;
}

function parseFlashcardResponse(text: string): GenerateResult {
  // Try to extract JSON array from the response
  const trimmed = text.trim();

  // Try direct parse
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return { cards: validateCards(parsed) };
    }
  } catch {
    // Try to find JSON array in the response
  }

  // Try to extract array from markdown code block or surrounding text
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return { cards: validateCards(parsed) };
      }
    } catch {
      // Fall through
    }
  }

  throw new Error('Could not parse flashcard response from LLM');
}

function validateCards(raw: unknown[]): FlashcardPair[] {
  const cards: FlashcardPair[] = [];
  for (const item of raw) {
    if (
      typeof item === 'object' &&
      item !== null &&
      'front' in item &&
      'back' in item &&
      typeof (item as Record<string, unknown>).front === 'string' &&
      typeof (item as Record<string, unknown>).back === 'string'
    ) {
      const front = ((item as Record<string, unknown>).front as string).trim();
      const back = ((item as Record<string, unknown>).back as string).trim();
      if (front && back) {
        cards.push({ front, back });
      }
    }
  }
  return cards;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}
