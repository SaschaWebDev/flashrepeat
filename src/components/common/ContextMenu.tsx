import { useState, useRef, useEffect } from 'react';
import styles from './ContextMenu.module.css';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  submenu?: ContextMenuItem[];
  onClick?: () => void;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
}

export function ContextMenu({ items }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setOpenSubmenuIndex(null);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setOpenSubmenuIndex(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function handleItemClick(item: ContextMenuItem) {
    if (item.submenu) return;
    setOpen(false);
    setOpenSubmenuIndex(null);
    item.onClick?.();
  }

  function handleSubmenuItemClick(subItem: ContextMenuItem) {
    setOpen(false);
    setOpenSubmenuIndex(null);
    subItem.onClick?.();
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        className={styles.trigger}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(prev => !prev);
          setOpenSubmenuIndex(null);
        }}
        aria-label="Card actions"
      >
        &#x22EF;
      </button>
      {open && (
        <div className={styles.dropdown}>
          {items.map((item, index) => (
            <div
              key={index}
              className={styles.menuItemWrapper}
              onMouseEnter={() => {
                if (item.submenu) setOpenSubmenuIndex(index);
              }}
              onMouseLeave={() => {
                if (item.submenu) setOpenSubmenuIndex(null);
              }}
            >
              <button
                className={item.danger ? styles.menuItemDanger : styles.menuItem}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.submenu) {
                    setOpenSubmenuIndex(openSubmenuIndex === index ? null : index);
                  } else {
                    handleItemClick(item);
                  }
                }}
              >
                {item.icon && <span className={styles.menuIcon}>{item.icon}</span>}
                <span>{item.label}</span>
                {item.submenu && <span className={styles.submenuArrow}>&#x25B8;</span>}
              </button>
              {item.submenu && openSubmenuIndex === index && (
                <div className={styles.submenu}>
                  {item.submenu.length === 0 ? (
                    <div className={styles.submenuEmpty}>No other decks</div>
                  ) : (
                    item.submenu.map((subItem, subIndex) => (
                      <button
                        key={subIndex}
                        className={styles.menuItem}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSubmenuItemClick(subItem);
                        }}
                      >
                        {subItem.icon && <span className={styles.deckDot} style={{ background: subItem.icon }} />}
                        <span>{subItem.label}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
