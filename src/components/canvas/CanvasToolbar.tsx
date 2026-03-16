import { useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement } from '../../types';
import { MAX_ELEMENTS } from './CanvasEditor';
import { compressImage } from '../../utils/image-utils';
import styles from './CanvasToolbar.module.css';

interface CanvasToolbarProps {
  elements: CanvasElement[];
  onChange: (elements: CanvasElement[]) => void;
}

export function CanvasToolbar({ elements, onChange }: CanvasToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const atCap = elements.length >= MAX_ELEMENTS;

  function getNextZIndex(): number {
    if (elements.length === 0) return 1;
    return Math.max(...elements.map(e => e.zIndex)) + 1;
  }

  function addText() {
    if (atCap) return;
    const el: CanvasElement = {
      id: uuidv4(),
      type: 'text',
      x: 10,
      y: 10,
      width: 80,
      height: 30,
      zIndex: getNextZIndex(),
      content: 'New text',
      fontSize: 18,
      fontFamily: 'Inter, sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#e8e8f0',
    };
    onChange([...elements, el]);
  }

  async function handleImageFile(file: File) {
    if (atCap) return;
    try {
      const dataUrl = await compressImage(file);
      const el: CanvasElement = {
        id: uuidv4(),
        type: 'image',
        x: 10,
        y: 10,
        width: 60,
        height: 40,
        zIndex: getNextZIndex(),
        content: dataUrl,
      };
      onChange([...elements, el]);
    } catch {
      // Silently fail — user can try again
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
      e.target.value = '';
    }
  }

  return (
    <div className={styles.toolbar}>
      <button
        className={styles.toolBtn}
        onClick={addText}
        disabled={atCap}
        title="Add Text"
      >
        T
      </button>
      <button
        className={styles.toolBtn}
        onClick={() => fileInputRef.current?.click()}
        disabled={atCap}
        title="Add Image"
      >
        IMG
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className={styles.hiddenInput}
      />
      <span className={styles.count}>
        {elements.length}/{MAX_ELEMENTS}
      </span>
    </div>
  );
}
