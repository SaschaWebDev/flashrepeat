import { useState, useRef, useEffect } from 'react';
import type { Deck, CardContent } from '../../types';
import { parseApkgFile, type AnkiNote, type AnkiModel } from '../../utils/anki-parser';
import { parseAnkiField, clozeToFrontBack } from '../../utils/anki-html';
import { ankiFieldToCardContent } from '../../utils/card-content';
import { bulkCreateCards, getAllDecks } from '../../db/operations';
import { CardPreviewList } from '../youtube/CardPreviewList';
import styles from './AnkiImporter.module.css';

type Step = 'input' | 'loading' | 'preview' | 'confirm';

interface CardPair {
  front: string;
  back: string;
}

interface RichCardPair {
  front: CardContent;
  back: CardContent;
}

interface AnkiImporterProps {
  deckId: string;
  onDone: () => void;
}

export function AnkiImporter({ deckId, onDone }: AnkiImporterProps) {
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState('');

  // Preview state
  const [ankiDeckName, setAnkiDeckName] = useState('');
  const [cards, setCards] = useState<CardPair[]>([]);
  const [cardContents, setCardContents] = useState<RichCardPair[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetDeckId, setTargetDeckId] = useState(deckId);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAllDecks().then(setDecks);
  }, []);

  function reset() {
    setStep('input');
    setError(null);
    setLoadingText('');
    setAnkiDeckName('');
    setCards([]);
    setCardContents([]);
    setSelected(new Set());
    setTargetDeckId(deckId);
    setWarnings([]);
  }

  function buildCards(
    notes: AnkiNote[],
    models: Map<number, AnkiModel>,
    media: Map<string, string>,
  ): { textPairs: CardPair[]; richPairs: RichCardPair[] } {
    const textPairs: CardPair[] = [];
    const richPairs: RichCardPair[] = [];

    for (const note of notes) {
      const model = models.get(note.modelId);
      if (!model) continue;

      if (model.isCloze) {
        // Cloze note: use field[0] to generate front/back
        if (note.fields.length < 1) continue;
        const rawField = note.fields[0];
        const { front: clozeFront, back: clozeBack } = clozeToFrontBack(rawField);

        const parsedFront = parseAnkiField(clozeFront);
        const parsedBack = parseAnkiField(clozeBack);

        textPairs.push({
          front: parsedFront.text || '[cloze]',
          back: parsedBack.text || '[cloze]',
        });
        richPairs.push({
          front: ankiFieldToCardContent(parsedFront.text, parsedFront.imageRefs, media),
          back: ankiFieldToCardContent(parsedBack.text, parsedBack.imageRefs, media),
        });
      } else {
        // Standard note: field[0] = front, field[1] = back
        if (note.fields.length < 2) continue;

        const parsedFront = parseAnkiField(note.fields[0]);
        const parsedBack = parseAnkiField(note.fields[1]);

        const frontText = parsedFront.text;
        const backText = parsedBack.text;

        // Skip notes with no usable content on either side
        if (!frontText && parsedFront.imageRefs.length === 0) continue;
        if (!backText && parsedBack.imageRefs.length === 0) continue;

        textPairs.push({
          front: frontText || '[image]',
          back: backText || '[image]',
        });
        richPairs.push({
          front: ankiFieldToCardContent(frontText, parsedFront.imageRefs, media),
          back: ankiFieldToCardContent(backText, parsedBack.imageRefs, media),
        });
      }
    }

    return { textPairs, richPairs };
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds 50 MB limit');
      return;
    }

    setError(null);
    setStep('loading');
    setLoadingText('Extracting deck...');

    // Use setTimeout to let the UI update before heavy processing
    setTimeout(async () => {
      try {
        setLoadingText('Reading database...');
        const result = await parseApkgFile(file);

        if (!result.ok) {
          setError(result.error);
          setStep('input');
          return;
        }

        setLoadingText('Processing media...');
        // Small delay to render the updated text
        await new Promise((r) => setTimeout(r, 50));

        setLoadingText('Building cards...');
        await new Promise((r) => setTimeout(r, 50));

        const { textPairs, richPairs } = buildCards(result.notes, result.models, result.media);

        if (textPairs.length === 0) {
          setError('No importable cards found in this deck');
          setStep('input');
          return;
        }

        setAnkiDeckName(result.deckName);
        setCards(textPairs);
        setCardContents(richPairs);
        setSelected(new Set(textPairs.map((_, i) => i)));
        setWarnings(result.warnings);
        setStep('preview');
      } catch {
        setError('Failed to parse Anki deck — the file may be corrupted');
        setStep('input');
      }
    }, 50);
  }

  function handleToggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function handleImport() {
    const selectedRich = cardContents
      .filter((_, i) => selected.has(i))
      .map((c) => ({ front: c.front, back: c.back }));

    if (selectedRich.length === 0) return;

    await bulkCreateCards(targetDeckId, selectedRich, 'draft');
    setImportedCount(selectedRich.length);
    setStep('confirm');
  }

  if (step === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>{loadingText}</span>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className={styles.container}>
        <div className={styles.previewHeader}>
          <span className={styles.deckName}>{ankiDeckName}</span>
          <span className={styles.cardCount}>{cards.length} cards found</span>
        </div>

        {warnings.length > 0 && (
          <div className={styles.warnings}>
            {warnings.map((w, i) => (
              <div key={i} className={styles.warning}>{w}</div>
            ))}
          </div>
        )}

        <CardPreviewList
          cards={cards}
          selected={selected}
          onToggle={handleToggle}
          onSelectAll={() => setSelected(new Set(cards.map((_, i) => i)))}
          onDeselectAll={() => setSelected(new Set())}
        />

        <div className={styles.deckPicker}>
          <label className={styles.deckPickerLabel}>Import to deck</label>
          <select
            className={styles.deckSelect}
            value={targetDeckId}
            onChange={(e) => setTargetDeckId(e.target.value)}
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <button
          className={styles.importBtn}
          onClick={handleImport}
          disabled={selected.size === 0}
        >
          Import {selected.size} as Drafts
        </button>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className={styles.container}>
        <div className={styles.confirmState}>
          <span className={styles.confirmIcon}>&#10003;</span>
          <span className={styles.confirmTitle}>
            {importedCount} cards imported as drafts
          </span>
          <span className={styles.confirmDesc}>
            Review them in the Drafts tab before adding to your study queue.
          </span>
          <div className={styles.confirmActions}>
            <button className={styles.viewDeckBtn} onClick={onDone}>
              View Deck
            </button>
            <button className={styles.anotherBtn} onClick={reset}>
              Import Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step: input (default)
  return (
    <div className={styles.container}>
      <div
        className={styles.fileZone}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className={styles.fileIcon}>📦</span>
        <span className={styles.fileLabel}>Choose an Anki deck file</span>
        <span className={styles.fileHint}>
          Supports .apkg files exported from Anki
        </span>
      </div>
      <input
        ref={fileInputRef}
        className={styles.hiddenInput}
        type="file"
        accept=".apkg"
        onChange={handleFileSelect}
      />
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
