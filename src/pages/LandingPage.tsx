import { useNavigate } from 'react-router-dom';
import styles from './LandingPage.module.css';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          <span className={styles.heroIcon}>⚡</span>
          FlashRepeat
        </h1>
        <p className={styles.heroSubtitle}>
          Beautiful flashcards with spaced repetition. Study smarter, remember longer.
        </p>
        <div className={styles.heroActions}>
          <button className={styles.ctaBtn} onClick={() => navigate('/app')}>
            Start Learning
          </button>
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🧠</span>
          <h3 className={styles.featureTitle}>Spaced Repetition</h3>
          <p className={styles.featureDesc}>
            A modified FSRS algorithm schedules reviews at the optimal time for long-term retention.
          </p>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🎨</span>
          <h3 className={styles.featureTitle}>Canvas Editor</h3>
          <p className={styles.featureDesc}>
            Design cards with text, images, and rich formatting. Drag, resize, and layer elements freely.
          </p>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>📱</span>
          <h3 className={styles.featureTitle}>Works Offline</h3>
          <p className={styles.featureDesc}>
            Everything lives in your browser. No accounts, no cloud, no data collection. Your data stays yours.
          </p>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🔥</span>
          <h3 className={styles.featureTitle}>Streaks & Stats</h3>
          <p className={styles.featureDesc}>
            Track your progress with daily goals, streak counters, and a GitHub-style activity heat map.
          </p>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>⌨️</span>
          <h3 className={styles.featureTitle}>Keyboard First</h3>
          <p className={styles.featureDesc}>
            Space to reveal, 1-5 to rate. Study an entire deck without touching your mouse.
          </p>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🎯</span>
          <h3 className={styles.featureTitle}>Multiple Modes</h3>
          <p className={styles.featureDesc}>
            Normal mode for focused study. Free Roam to mix cards across all your decks.
          </p>
        </div>
      </section>

      <section className={styles.cta}>
        <p className={styles.ctaText}>No sign-up needed. Just start.</p>
        <button className={styles.ctaBtn} onClick={() => navigate('/app')}>
          Open Dashboard
        </button>
      </section>
    </div>
  );
}
