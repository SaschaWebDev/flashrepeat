import { useEffect, useState, useRef } from 'react';
import type { UserSettings, ThemeMode } from '../types';
import { getSettings, updateSettings } from '../db/operations';
import { exportAll, downloadJson } from '../utils/export';
import { validateImportFile, importJson } from '../utils/import-json';
import { useTheme } from '../hooks/useTheme';
import styles from './SettingsPage.module.css';

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Moscow',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Australia/Perth',
  'Pacific/Auckland',
  'America/Sao_Paulo',
];

export function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  async function handleSave() {
    if (!settings) return;
    await updateSettings({
      homeTimezone: settings.homeTimezone,
      dailyReviewGoal: settings.dailyReviewGoal,
      dailyOverdueCap: settings.dailyOverdueCap,
      leechThreshold: settings.leechThreshold,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleExportAll() {
    const data = await exportAll();
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(data, `flashrepeat-backup-${date}.json`);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!validateImportFile(data)) {
        setImportStatus('Invalid file format');
        return;
      }

      const result = await importJson(data);
      setImportStatus(`Imported ${result.decksImported} deck(s) with ${result.cardsImported} card(s)`);
    } catch {
      setImportStatus('Failed to import file');
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => setImportStatus(null), 4000);
  }

  if (!settings) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Study Preferences</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="timezone">Home Timezone</label>
          <select
            id="timezone"
            className={styles.select}
            value={settings.homeTimezone}
            onChange={e => setSettings({ ...settings, homeTimezone: e.target.value })}
          >
            {COMMON_TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="daily-goal">Daily Review Goal</label>
          <input
            id="daily-goal"
            className={styles.input}
            type="number"
            min={1}
            max={500}
            value={settings.dailyReviewGoal}
            onChange={e => setSettings({ ...settings, dailyReviewGoal: Math.max(1, Number(e.target.value)) })}
          />
          <span className={styles.hint}>Cards to review per day</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="overdue-cap">Daily Overdue Cap (Paced Mode)</label>
          <input
            id="overdue-cap"
            className={styles.input}
            type="number"
            min={1}
            max={500}
            value={settings.dailyOverdueCap}
            onChange={e => setSettings({ ...settings, dailyOverdueCap: Math.max(1, Number(e.target.value)) })}
          />
          <span className={styles.hint}>Max overdue cards shown per session</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="leech-threshold">Leech Threshold</label>
          <input
            id="leech-threshold"
            className={styles.input}
            type="number"
            min={2}
            max={20}
            value={settings.leechThreshold}
            onChange={e => setSettings({ ...settings, leechThreshold: Math.max(2, Number(e.target.value)) })}
          />
          <span className={styles.hint}>Number of "Again" ratings before a card is flagged as a leech</span>
        </div>
      </div>

      {/* Feature 10: Theme */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Appearance</h2>
        <div className={styles.field}>
          <label className={styles.label}>Theme</label>
          <div className={styles.themeOptions}>
            {(['dark', 'light', 'system'] as ThemeMode[]).map(t => (
              <button
                key={t}
                className={`${styles.themePill} ${theme === t ? styles.themePillActive : ''}`}
                onClick={() => setTheme(t)}
              >
                {t === 'dark' ? 'Dark' : t === 'light' ? 'Light' : 'System'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feature 1: Export & Import */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Data</h2>

        <div className={styles.field}>
          <label className={styles.label}>Backup</label>
          <span className={styles.hint}>Export all decks, cards, and review history as JSON</span>
          <button className={styles.exportAllBtn} onClick={handleExportAll}>
            Export All Data
          </button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Restore</label>
          <span className={styles.hint}>Import a previously exported JSON backup</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className={styles.fileInput}
          />
          {importStatus && (
            <span className={styles.importStatus}>{importStatus}</span>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.saveBtn} onClick={handleSave}>
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
