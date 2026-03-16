import { useState } from 'react';
import type { Deck } from '../../types';
import styles from './CreateDeckForm.module.css';

const DECK_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

interface EditDeckFormProps {
  deck: Deck;
  onSubmit: (name: string, description: string, color: string) => void;
  onCancel: () => void;
}

export function EditDeckForm({ deck, onSubmit, onCancel }: EditDeckFormProps) {
  const [name, setName] = useState(deck.name);
  const [description, setDescription] = useState(deck.description);
  const [color, setColor] = useState(deck.color);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), description.trim(), color);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="deck-name-edit">Name</label>
        <input
          id="deck-name-edit"
          className={styles.input}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Biology 101"
          autoFocus
          maxLength={100}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="deck-desc-edit">Description (optional)</label>
        <textarea
          id="deck-desc-edit"
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this deck about?"
          rows={2}
          maxLength={500}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Color</label>
        <div className={styles.colors}>
          {DECK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.colorSwatch} ${color === c ? styles.selected : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={styles.submitBtn} disabled={!name.trim()}>
          Save Changes
        </button>
      </div>
    </form>
  );
}
