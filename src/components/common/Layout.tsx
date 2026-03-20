import { Outlet, NavLink } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import styles from './Layout.module.css';

export function Layout() {
  const { theme, setTheme } = useTheme();

  function cycleTheme() {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    setTheme(next);
  }

  const themeIcon = theme === 'dark' ? '☽' : theme === 'light' ? '☀' : '⚙';

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.logo}>
          <span className={styles.logoIcon}>⚡</span>
          <span className={styles.logoText}>FlashRepeat</span>
        </NavLink>
        <nav className={styles.nav}>
          <NavLink
            to="/app"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.active : ''}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.active : ''}`
            }
          >
            Settings
          </NavLink>
          <button
            className={styles.themeToggle}
            onClick={cycleTheme}
            title={`Theme: ${theme}`}
          >
            {themeIcon}
          </button>
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
