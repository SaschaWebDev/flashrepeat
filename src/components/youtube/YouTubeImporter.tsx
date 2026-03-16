import { useState, useRef, useEffect } from 'react';
import type { Deck } from '../../types';
import { extractVideoId, generateFlashcardsFromYouTube } from '../../api/youtube-flashcards';
import { bulkCreateCards } from '../../db/operations';
import { textToCardContent } from '../../utils/card-content';
import { getAllDecks } from '../../db/operations';
import { CardPreviewList } from './CardPreviewList';
import styles from './YouTubeImporter.module.css';

type Step = 'input' | 'loading' | 'preview' | 'confirm';

interface CardPair {
  front: string;
  back: string;
}

interface YouTubeImporterProps {
  deckId: string;
  onDone: () => void;
}

export function YouTubeImporter({ deckId, onDone }: YouTubeImporterProps) {
  const [step, setStep] = useState<Step>('input');
  const [url, setUrl] = useState('');
  const [maxCards, setMaxCards] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState('');

  // Preview state
  const [videoTitle, setVideoTitle] = useState('');
  const [cards, setCards] = useState<CardPair[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetDeckId, setTargetDeckId] = useState(deckId);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getAllDecks().then(setDecks);
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function reset() {
    setStep('input');
    setUrl('');
    setError(null);
    setCards([]);
    setSelected(new Set());
    setVideoTitle('');
    setTargetDeckId(deckId);
  }

  async function handleGenerate() {
    const videoId = extractVideoId(url);
    if (!videoId) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    setError(null);
    setStep('loading');
    setLoadingText('Fetching transcript and generating flashcards...');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await generateFlashcardsFromYouTube(url, maxCards, controller.signal);

      if (!result.ok) {
        const messages: Record<string, string> = {
          NO_TRANSCRIPT: 'This video has no captions available',
          VIDEO_TOO_LONG: 'Videos longer than 2 hours are not supported',
          INVALID_URL: 'Please enter a valid YouTube URL',
          LLM_ERROR: 'Could not generate flashcards, please try again',
          RATE_LIMITED: 'Too many requests, please wait a few minutes',
        };
        setError(messages[result.code] ?? result.error);
        setStep('input');
        return;
      }

      setVideoTitle(result.videoTitle);
      setCards(result.cards);
      setSelected(new Set(result.cards.map((_, i) => i)));
      setStep('preview');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStep('input');
        return;
      }
      setError('Could not reach the server');
      setStep('input');
    } finally {
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    setStep('input');
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

  if (step === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>{loadingText}</span>
          <button className={styles.cancelBtn} onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className={styles.container}>
        <div className={styles.previewHeader}>
          <span className={styles.videoTitle}>{videoTitle}</span>
          <span className={styles.cardCount}>{cards.length} cards generated</span>
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
      <div className={styles.inputGroup}>
        <input
          className={styles.urlInput}
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="Paste a YouTube URL..."
          autoFocus
        />
        <div className={styles.sliderGroup}>
          <span className={styles.sliderLabel}>Cards:</span>
          <input
            className={styles.slider}
            type="range"
            min={5}
            max={30}
            value={maxCards}
            onChange={(e) => setMaxCards(Number(e.target.value))}
          />
          <span className={styles.sliderValue}>{maxCards}</span>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button
        className={styles.generateBtn}
        onClick={handleGenerate}
        disabled={!url.trim()}
      >
        Generate Flashcards
      </button>
    </div>
  );
}
