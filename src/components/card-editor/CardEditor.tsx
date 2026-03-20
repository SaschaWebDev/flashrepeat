import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CardContent, CanvasElement } from '../../types';
import { CanvasContainer } from '../canvas/CanvasContainer';
import { CanvasEditor } from '../canvas/CanvasEditor';
import { CanvasToolbar } from '../canvas/CanvasToolbar';
import { ElementProperties } from '../canvas/ElementProperties';
import { LayersPanel } from '../canvas/LayersPanel';
import { useHistory } from '../../hooks/useHistory';
import styles from './CardEditor.module.css';

interface CardEditorProps {
  initialFront?: CardContent;
  initialBack?: CardContent;
  onSave: (front: CardContent, back: CardContent) => void;
  onCancel: () => void;
  submitLabel?: string;
}

function getTextFromContent(content: CardContent): string {
  const textEl = content.elements.find((el) => el.type === 'text');
  return textEl?.content ?? '';
}

function makeDefaultContent(): CardContent {
  return {
    elements: [
      {
        id: uuidv4(),
        type: 'text',
        x: 5,
        y: 5,
        width: 90,
        height: 90,
        zIndex: 1,
        content: '',
        fontSize: 18,
        fontFamily: 'Inter, sans-serif',
        textAlign: 'center',
        color: '#e8e8f0',
      },
    ],
  };
}

function hasContent(content: CardContent): boolean {
  return content.elements.some(el => {
    if (el.type === 'text') return el.content.trim().length > 0;
    if (el.type === 'image') return el.content.length > 0;
    return false;
  });
}

export function CardEditor({
  initialFront,
  initialBack,
  onSave,
  onCancel,
  submitLabel = 'Add Card',
}: CardEditorProps) {
  const frontHistory = useHistory<CardContent>(initialFront ?? makeDefaultContent());
  const backHistory = useHistory<CardContent>(initialBack ?? makeDefaultContent());
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const front = frontHistory.state;
  const back = backHistory.state;
  const activeHistory = activeSide === 'front' ? frontHistory : backHistory;
  const activeContent = activeHistory.state;

  const selectedElement = activeContent.elements.find(e => e.id === selectedElementId) ?? null;

  const handleElementsChange = useCallback((elements: CanvasElement[]) => {
    activeHistory.push({ elements });
  }, [activeHistory]);

  function handleElementUpdate(updated: CanvasElement) {
    activeHistory.push({
      elements: activeContent.elements.map(el =>
        el.id === updated.id ? updated : el
      ),
    });
  }

  function handleElementDelete() {
    if (!selectedElementId) return;
    activeHistory.push({
      elements: activeContent.elements.filter(el => el.id !== selectedElementId),
    });
    setSelectedElementId(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasContent(front) || !hasContent(back)) return;
    onSave(front, back);
    frontHistory.reset(makeDefaultContent());
    backHistory.reset(makeDefaultContent());
    setActiveSide('front');
    setSelectedElementId(null);
  }

  function handleSideSwitch(side: 'front' | 'back') {
    setActiveSide(side);
    setSelectedElementId(null);
  }

  // Undo/Redo keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        activeHistory.undo();
      }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        activeHistory.redo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeHistory]);

  // Quick text mode: if only 1 text element, show simple textarea
  const singleTextElement = activeContent.elements.length === 1
    && activeContent.elements[0].type === 'text'
    ? activeContent.elements[0]
    : null;

  const [mode, setMode] = useState<'simple' | 'canvas'>(
    (initialFront && initialFront.elements.length > 1) || (initialBack && initialBack.elements.length > 1)
      ? 'canvas'
      : 'simple'
  );

  return (
    <form className={styles.editor} onSubmit={handleSubmit}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeSide === 'front' ? styles.activeTab : ''}`}
          onClick={() => handleSideSwitch('front')}
        >
          Front
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeSide === 'back' ? styles.activeTab : ''}`}
          onClick={() => handleSideSwitch('back')}
        >
          Back
        </button>
        <button
          type="button"
          className={`${styles.modeToggle} ${mode === 'canvas' ? styles.modeActive : ''}`}
          onClick={() => setMode(mode === 'simple' ? 'canvas' : 'simple')}
          title={mode === 'simple' ? 'Switch to canvas editor' : 'Switch to simple editor'}
        >
          {mode === 'simple' ? 'Canvas' : 'Simple'}
        </button>
      </div>

      {mode === 'simple' && singleTextElement ? (
        <div className={styles.canvas}>
          <textarea
            className={styles.textInput}
            value={singleTextElement.content}
            onChange={(e) => {
              handleElementUpdate({ ...singleTextElement, content: e.target.value });
            }}
            placeholder={activeSide === 'front' ? 'Enter the question or prompt...' : 'Enter the answer...'}
            autoFocus
          />
        </div>
      ) : (
        <>
          <CanvasToolbar elements={activeContent.elements} onChange={handleElementsChange} />
          <CanvasContainer>
            {(scale) => (
              <CanvasEditor
                elements={activeContent.elements}
                onChange={handleElementsChange}
                scale={scale}
              />
            )}
          </CanvasContainer>
          {selectedElement && (
            <ElementProperties
              element={selectedElement}
              onChange={handleElementUpdate}
              onDelete={handleElementDelete}
            />
          )}
          <LayersPanel
            elements={activeContent.elements}
            selectedId={selectedElementId}
            onSelect={setSelectedElementId}
            onChange={handleElementsChange}
          />
        </>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className={styles.saveBtn}
          disabled={!hasContent(front) || !hasContent(back)}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export { getTextFromContent };
