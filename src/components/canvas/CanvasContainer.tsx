import { useRef, useState, useEffect, type ReactNode } from 'react';
import styles from './CanvasContainer.module.css';

interface CanvasContainerProps {
  children: (scale: number) => ReactNode;
  className?: string;
}

export function CanvasContainer({ children, className }: CanvasContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        // Base canvas is 360px wide (design reference)
        setScale(width / 360);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className ?? ''}`}
    >
      <div className={styles.letterbox}>
        {children(scale)}
      </div>
    </div>
  );
}
