import { useEffect, useState } from 'react';
import type { UserSettings } from '../types';
import { getSettings, updateSettings } from '../db/operations';
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

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  async function handleSave() {
    if (!settings) return;
    await updateSettings({
      homeTimezone: settings.homeTimezone,
      dailyReviewGoal: settings.dailyReviewGoal,
      dailyOverdueCap: settings.dailyOverdueCap,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
      </div>

      <div className={styles.actions}>
        <button className={styles.saveBtn} onClick={handleSave}>
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
