/**
 * Parse Anki HTML field content into plain text + image references.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&#x27;': "'",
  '&#x2F;': '/',
  '&#60;': '<',
  '&#62;': '>',
  '&#38;': '&',
};

const ENTITY_RE = /&(?:#x?[0-9a-fA-F]+|[a-zA-Z]+);/g;

function decodeEntities(text: string): string {
  return text.replace(ENTITY_RE, (match) => {
    if (HTML_ENTITIES[match]) return HTML_ENTITIES[match];
    // Numeric entities
    if (match.startsWith('&#x')) {
      const code = parseInt(match.slice(3, -1), 16);
      return String.fromCodePoint(code);
    }
    if (match.startsWith('&#')) {
      const code = parseInt(match.slice(2, -1), 10);
      return String.fromCodePoint(code);
    }
    return match;
  });
}

interface ParsedField {
  text: string;
  imageRefs: string[];
}

export function parseAnkiField(html: string): ParsedField {
  const imageRefs: string[] = [];

  let processed = html;

  // Extract <img> src references
  processed = processed.replace(/<img\s[^>]*src\s*=\s*["']([^"']+)["'][^>]*\/?>/gi, (_match, src: string) => {
    imageRefs.push(src);
    return '';
  });

  // Handle cloze syntax: {{c1::answer::hint}} → answer, {{c1::answer}} → answer
  processed = processed.replace(/\{\{c\d+::([^}:]+)(?:::[^}]*)?\}\}/g, '$1');

  // Strip [sound:filename.mp3] references
  processed = processed.replace(/\[sound:[^\]]+\]/g, '');

  // Strip LaTeX delimiters but keep raw text
  processed = processed.replace(/\\\[|\\\]|\\\(|\\\)/g, '');
  processed = processed.replace(/\$\$?/g, '');

  // Replace <br>, <br/>, <br />, <div>, <p> with newlines
  processed = processed.replace(/<br\s*\/?>/gi, '\n');
  processed = processed.replace(/<\/?(div|p|li|tr|blockquote)[^>]*>/gi, '\n');

  // Strip all remaining HTML tags
  processed = processed.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  processed = decodeEntities(processed);

  // Normalize whitespace: collapse runs of spaces/tabs, trim lines, collapse multiple newlines
  processed = processed
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
    .trim();

  return { text: processed, imageRefs };
}

/**
 * Convert a cloze note field to front (blanks) and back (filled) versions.
 */
export function clozeToFrontBack(field: string): { front: string; back: string } {
  // Front: replace cloze with [...] or [hint]
  const front = field.replace(
    /\{\{c\d+::([^}:]+)(?:::([^}]*))?\}\}/g,
    (_match, _answer: string, hint: string | undefined) =>
      hint ? `[${hint}]` : '[...]',
  );

  // Back: replace cloze with the answer
  const back = field.replace(/\{\{c\d+::([^}:]+)(?:::[^}]*)?\}\}/g, '$1');

  return { front, back };
}
