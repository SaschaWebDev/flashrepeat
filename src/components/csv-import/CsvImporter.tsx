import { useState, useRef, useEffect } from 'react';
import type { Deck } from '../../types';
import { parseCsvFlashcards } from '../../utils/csv-parser';
import { bulkCreateCards, getAllDecks } from '../../db/operations';
import { textToCardContent } from '../../utils/card-content';
import { CardPreviewList } from '../youtube/CardPreviewList';
import styles from './CsvImporter.module.css';

type Step = 'input' | 'preview' | 'confirm';

interface CardPair {
  front: string;
  back: string;
}

interface CsvImporterProps {
  deckId: string;
  onDone: () => void;
}

export function CsvImporter({ deckId, onDone }: CsvImporterProps) {
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  // Preview state
  const [cards, setCards] = useState<CardPair[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetDeckId, setTargetDeckId] = useState(deckId);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAllDecks().then(setDecks);
  }, []);

  function reset() {
    setStep('input');
    setError(null);
    setFileName('');
    setCards([]);
    setSelected(new Set());
    setTargetDeckId(deckId);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    if (file.size > 1_048_576) {
      setError('File exceeds 1 MB limit');
      return;
    }

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const result = parseCsvFlashcards(text);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCards(result.rows);
      setSelected(new Set(result.rows.map((_, i) => i)));
      setStep('preview');
    };
    reader.onerror = () => {
      setError('Could not read file');
    };
    reader.readAsText(file);
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
    const selectedCards = cards
      .filter((_, i) => selected.has(i))
      .map((c) => ({
        front: textToCardContent(c.front),
        back: textToCardContent(c.back),
      }));

    if (selectedCards.length === 0) return;

    await bulkCreateCards(targetDeckId, selectedCards, 'draft');
    setImportedCount(selectedCards.length);
    setStep('confirm');
  }

  if (step === 'preview') {
    return (
      <div className={styles.container}>
        <div className={styles.previewHeader}>
          <span className={styles.fileName}>{fileName}</span>
          <span className={styles.cardCount}>{cards.length} cards found</span>
        </div>

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
        <span className={styles.fileIcon}>📄</span>
        <span className={styles.fileLabel}>Choose a CSV file</span>
        <span className={styles.fileHint}>
          Supports Question/Answer or Front/Back headers
        </span>
      </div>
      <input
        ref={fileInputRef}
        className={styles.hiddenInput}
        type="file"
        accept=".csv,.txt"
        onChange={handleFileSelect}
      />
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
