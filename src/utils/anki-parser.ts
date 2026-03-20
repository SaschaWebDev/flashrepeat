/**
 * Parse .apkg (Anki deck package) files in-browser.
 * Uses JSZip for ZIP extraction and sql.js (WASM SQLite) for database parsing.
 */
import JSZip from 'jszip';
import initSqlJs, { type Database } from 'sql.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB per image
const MAX_NOTES = 500;

export interface AnkiNote {
  id: number;
  modelId: number;
  fields: string[];
  tags: string[];
}

export interface AnkiModel {
  name: string;
  fieldNames: string[];
  isCloze: boolean;
}

export type AnkiParseResult =
  | {
      ok: true;
      deckName: string;
      notes: AnkiNote[];
      models: Map<number, AnkiModel>;
      media: Map<string, string>;
      warnings: string[];
    }
  | { ok: false; error: string };

const MIME_TYPES: Record<string, string> = {
  gif: 'image/gif',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};

function getMimeType(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  return MIME_TYPES[ext] ?? null;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function parseApkgFile(file: File): Promise<AnkiParseResult> {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024} MB limit` };
  }

  const warnings: string[] = [];
  let db: Database | null = null;

  try {
    // Step 1: Read file
    const arrayBuffer = await file.arrayBuffer();

    // Step 2: Extract ZIP
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(arrayBuffer);
    } catch {
      return { ok: false, error: 'Invalid file — not a valid .apkg archive' };
    }

    // Step 3: Find the SQLite database
    const dbFile = zip.file('collection.anki21') ?? zip.file('collection.anki2');

    if (!dbFile) {
      // Check for anki21b (protobuf format, Anki 2.1.50+)
      if (zip.file('collection.anki21b')) {
        return {
          ok: false,
          error: 'This deck uses the newer Anki 2.1.50+ format (anki21b) which is not yet supported. Please export the deck from Anki using "Anki Deck Package (.apkg)" with compatibility mode enabled.',
        };
      }
      return { ok: false, error: 'Invalid .apkg file — no collection database found' };
    }

    const dbBuffer = await dbFile.async('uint8array');

    // Step 4: Init sql.js and open database
    const wasmResponse = await fetch(new URL('/sql-wasm.wasm', import.meta.url).href);
    if (!wasmResponse.ok) {
      return { ok: false, error: 'Failed to load WebAssembly module' };
    }
    const wasmBinary = new Uint8Array(await wasmResponse.arrayBuffer());
    const SQL = await initSqlJs({ wasmBinary });
    db = new SQL.Database(dbBuffer);

    // Step 5: Read collection metadata (models, decks)
    const colResult = db.exec('SELECT models, decks FROM col LIMIT 1');
    if (colResult.length === 0 || colResult[0].values.length === 0) {
      return { ok: false, error: 'Invalid Anki database — no collection data' };
    }

    const modelsJson = JSON.parse(colResult[0].values[0][0] as string) as Record<
      string,
      { name: string; flds: Array<{ name: string }>; type?: number }
    >;
    const decksJson = JSON.parse(colResult[0].values[0][1] as string) as Record<
      string,
      { name: string }
    >;

    // Build models map
    const models = new Map<number, AnkiModel>();
    for (const [idStr, model] of Object.entries(modelsJson)) {
      models.set(Number(idStr), {
        name: model.name,
        fieldNames: model.flds.map((f) => f.name),
        isCloze: model.type === 1,
      });
    }

    // Get deck name (use first non-Default deck, or first deck)
    const deckEntries = Object.values(decksJson);
    const nonDefault = deckEntries.find((d) => d.name !== 'Default');
    const deckName = nonDefault?.name ?? deckEntries[0]?.name ?? 'Imported Deck';

    // Step 6: Read notes
    const notesResult = db.exec('SELECT id, mid, flds, tags FROM notes LIMIT ' + (MAX_NOTES + 1));
    if (notesResult.length === 0) {
      return { ok: false, error: 'No notes found in this deck' };
    }

    const rows = notesResult[0].values;
    if (rows.length > MAX_NOTES) {
      warnings.push(`Deck has more than ${MAX_NOTES} notes — only the first ${MAX_NOTES} will be imported`);
    }

    const notes: AnkiNote[] = rows.slice(0, MAX_NOTES).map((row) => ({
      id: row[0] as number,
      modelId: row[1] as number,
      fields: (row[2] as string).split('\x1f'),
      tags: (row[3] as string)
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 0),
    }));

    // Step 7: Parse media
    const media = new Map<string, string>();
    const mediaFile = zip.file('media');
    if (mediaFile) {
      let mediaMap: Record<string, string>;
      try {
        const mediaJson = await mediaFile.async('string');
        mediaMap = JSON.parse(mediaJson) as Record<string, string>;
      } catch {
        mediaMap = {};
        warnings.push('Could not parse media index — images may be missing');
      }

      let skippedOversized = 0;
      for (const [numKey, originalName] of Object.entries(mediaMap)) {
        const mime = getMimeType(originalName);
        if (!mime) continue; // skip non-image files (audio, etc.)

        const mediaEntry = zip.file(numKey);
        if (!mediaEntry) continue;

        const data = await mediaEntry.async('uint8array');
        if (data.length > MAX_IMAGE_SIZE) {
          skippedOversized++;
          continue;
        }

        const base64 = uint8ToBase64(data);
        media.set(originalName, `data:${mime};base64,${base64}`);
      }

      if (skippedOversized > 0) {
        warnings.push(`${skippedOversized} image(s) skipped (exceeded ${MAX_IMAGE_SIZE / 1024 / 1024} MB limit)`);
      }
    }

    return { ok: true, deckName, notes, models, media, warnings };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: `Failed to parse Anki deck: ${message}` };
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
