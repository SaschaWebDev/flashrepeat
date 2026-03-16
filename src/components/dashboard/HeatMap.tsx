import { useEffect, useState } from 'react';
import { getHeatMapData } from '../../utils/streak';
import styles from './HeatMap.module.css';

const WEEKS = 52;
const DAYS_PER_WEEK = 7;
const CELL_SIZE = 12;
const GAP = 2;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getIntensity(count: number, max: number): number {
  if (count === 0) return 0;
  if (max === 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function HeatMap() {
  const [data, setData] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    getHeatMapData(WEEKS * 7).then(setData);
  }, []);

  // Build grid of days
  const today = new Date();
  const cells: { date: string; count: number; col: number; row: number }[] = [];

  // Start from (WEEKS * 7) days ago
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (WEEKS * DAYS_PER_WEEK - 1));

  // Adjust to start on Sunday
  const startDayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - startDayOfWeek);

  let maxCount = 0;
  for (const count of data.values()) {
    if (count > maxCount) maxCount = count;
  }

  const date = new Date(startDate);
  let col = 0;
  while (date <= today) {
    const dateStr = date.toLocaleDateString('en-CA');
    const count = data.get(dateStr) ?? 0;
    const row = date.getDay();

    cells.push({ date: dateStr, count, col, row });

    date.setDate(date.getDate() + 1);
    if (date.getDay() === 0) col++;
  }

  const totalCols = col + 1;
  const svgWidth = totalCols * (CELL_SIZE + GAP) + 30;
  const svgHeight = DAYS_PER_WEEK * (CELL_SIZE + GAP) + 20;

  // Month labels
  const monthPositions: { label: string; x: number }[] = [];
  let lastMonth = -1;
  for (const cell of cells) {
    if (cell.row !== 0) continue;
    const month = new Date(cell.date).getMonth();
    if (month !== lastMonth) {
      monthPositions.push({
        label: MONTH_LABELS[month],
        x: cell.col * (CELL_SIZE + GAP) + 30,
      });
      lastMonth = month;
    }
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Activity</h3>
      <div className={styles.scrollWrap}>
        <svg width={svgWidth} height={svgHeight} className={styles.svg}>
          {/* Month labels */}
          {monthPositions.map((m, i) => (
            <text
              key={i}
              x={m.x}
              y={10}
              className={styles.monthLabel}
            >
              {m.label}
            </text>
          ))}

          {/* Cells */}
          {cells.map((cell) => (
            <rect
              key={cell.date}
              x={cell.col * (CELL_SIZE + GAP) + 30}
              y={cell.row * (CELL_SIZE + GAP) + 16}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={2}
              className={styles[`intensity${getIntensity(cell.count, maxCount)}`] ?? styles.intensity0}
            >
              <title>{cell.date}: {cell.count} review{cell.count !== 1 ? 's' : ''}</title>
            </rect>
          ))}
        </svg>
      </div>
      <div className={styles.legend}>
        <span className={styles.legendLabel}>Less</span>
        <span className={`${styles.legendCell} ${styles.intensity0}`} />
        <span className={`${styles.legendCell} ${styles.intensity1}`} />
        <span className={`${styles.legendCell} ${styles.intensity2}`} />
        <span className={`${styles.legendCell} ${styles.intensity3}`} />
        <span className={`${styles.legendCell} ${styles.intensity4}`} />
        <span className={styles.legendLabel}>More</span>
      </div>
    </div>
  );
}
